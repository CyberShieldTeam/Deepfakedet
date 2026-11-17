"""Strict validation for the frozen external image research manifest."""
import hashlib
import io
import re
from pathlib import Path, PurePosixPath, PureWindowsPath
from PIL import Image,ImageOps


HEX64 = re.compile(r"^[a-f0-9]{64}$")
SAMPLE_ID = re.compile(r"^[a-f0-9]{24}$")
SHARD = re.compile(r"^data/CompEval-\d{5}-of-00413\.parquet$")
PHASH_MAX_DISTANCE = 6
ADMISSION_POLICY = {
    "version": "engine1-image-admission-v2",
    "maximumBytes": 10 * 1024 * 1024,
    "maximumPixels": 24_000_000,
    "minimumSidePixels": 64,
    "decodedIdentity": "Pillow EXIF transpose then RGB bytes, SHA-256",
    "perceptualIdentity": "grayscale Lanczos 32x32; SciPy orthonormal DCT; first 63 non-DC coefficients thresholded at their median",
    "maximumPerceptualHammingDistance": PHASH_MAX_DISTANCE,
    "uniqueAcrossAllPartitions": ["sampleId", "sourceGroup", "promptGroup", "encodedSha256", "decodedRgbSha256", "perceptualHash"],
    "groupBootstrapUnit": "sourceGroup",
}


def admission_policy_sha256():
    import json
    return hashlib.sha256(json.dumps(ADMISSION_POLICY,sort_keys=True,separators=(",",":")).encode()).hexdigest()


def _require(condition, code):
    if not condition:
        raise ValueError(code)


def _hamming(left, right):
    return (int(left, 16) ^ int(right, 16)).bit_count()


def expected_label_basis(label, generator, source_dataset):
    if label == "genuine":
        return (f"OwensLab CommunityForensics-Eval label=0; real_source={source_dataset}; "
                "camera-origin status not independently audited")
    return (f"OwensLab CommunityForensics-Eval label=1; declared model_name={generator}; "
            "label not independently re-adjudicated")


def validate_media_image_manifest(manifest, root, protocol, protocol_bytes,
                                  dataset, revision, license_text):
    """Validate schema, source identity, partitions, hashes and paths before inference.

    Image bytes are re-hashed here before any model is loaded. Decoded-pixel hashes are
    checked by the evaluator when it decodes each image, using the pinned Pillow policy.
    """
    expected_top = {
        "schemaVersion", "dataset", "revision", "license", "protocolSha256", "admissionPolicy", "admissionPolicySha256",
        "inventorySha256", "exclusions", "rows", "scope",
    }
    _require(isinstance(manifest, dict) and set(manifest) == expected_top, "MANIFEST_SCHEMA")
    _require(manifest["schemaVersion"] == 2, "MANIFEST_SCHEMA_VERSION")
    _require(manifest["dataset"] == dataset and dataset == protocol.get("dataset"), "DATASET_IDENTITY")
    _require(manifest["revision"] == revision and revision == protocol.get("revision"), "DATASET_REVISION")
    _require(manifest["license"] == license_text, "DATASET_LICENSE")
    _require(isinstance(manifest["scope"], str) and manifest["scope"].strip(), "MANIFEST_SCOPE")
    protocol_sha = hashlib.sha256(protocol_bytes).hexdigest()
    _require(manifest["protocolSha256"] == protocol_sha, "FROZEN_PROTOCOL_CHANGED")
    _require(manifest["admissionPolicy"] == ADMISSION_POLICY and
             manifest["admissionPolicySha256"] == admission_policy_sha256(), "ADMISSION_POLICY_CHANGED")
    _require(isinstance(manifest["inventorySha256"], str) and HEX64.fullmatch(manifest["inventorySha256"]), "INVENTORY_HASH")
    _require(isinstance(manifest["exclusions"], dict) and
             all(isinstance(k, str) and isinstance(v, int) and not isinstance(v, bool) and v >= 0
                 for k, v in manifest["exclusions"].items()), "EXCLUSION_COUNTS")
    _require(isinstance(manifest["rows"], list), "MANIFEST_ROWS")

    row_fields = {
        "id", "path", "sha256", "decodedSha256", "perceptualHash", "label", "role",
        "group", "promptGroup", "generator", "sourceDataset", "source",
        "publisherImageName", "shard", "index", "license", "labelBasis", "geometry",
    }
    quotas = protocol.get("roles")
    _require(isinstance(quotas, dict) and quotas, "PROTOCOL_ROLES")
    expected_count = sum(sum(labels.values()) for labels in quotas.values())
    _require(len(manifest["rows"]) == expected_count, "FROZEN_COUNT")

    root = Path(root).resolve()
    ids, paths, encoded, pixels, groups, prompts = set(), set(), set(), set(), {}, set()
    perceptual = []
    source_prefix = f"https://huggingface.co/datasets/{dataset}/tree/{revision}"
    quotas_seen = {role: {label: 0 for label in labels} for role, labels in quotas.items()}
    for row in manifest["rows"]:
        _require(isinstance(row, dict) and set(row) == row_fields, "ROW_SCHEMA")
        _require(isinstance(row["id"], str) and SAMPLE_ID.fullmatch(row["id"]), "SAMPLE_ID")
        _require(row["id"] not in ids, "DUPLICATE_SAMPLE_ID")
        ids.add(row["id"])

        _require(isinstance(row["role"], str) and row["role"] in quotas and
                 isinstance(row["label"], str) and row["label"] in quotas[row["role"]], "PARTITION_OR_LABEL")
        quotas_seen[row["role"]][row["label"]] += 1
        _require(isinstance(row["group"], str) and HEX64.fullmatch(row["group"]), "SOURCE_GROUP_HASH")
        _require(row["group"] not in groups, "SOURCE_GROUP_DUPLICATE_OR_LEAKAGE")
        groups[row["group"]] = row["role"]
        _require(row["promptGroup"] is None or
                 (isinstance(row["promptGroup"], str) and HEX64.fullmatch(row["promptGroup"])), "PROMPT_GROUP_HASH")
        if row["promptGroup"] is not None:
            _require(row["promptGroup"] not in prompts, "PROMPT_GROUP_DUPLICATE_OR_LEAKAGE")
            prompts.add(row["promptGroup"])

        for field in ("sha256", "decodedSha256"):
            _require(isinstance(row[field], str) and HEX64.fullmatch(row[field]), f"{field.upper()}_FORMAT")
        _require(row["sha256"] not in encoded, "DUPLICATE_ENCODED_HASH")
        _require(row["decodedSha256"] not in pixels, "DUPLICATE_DECODED_HASH")
        encoded.add(row["sha256"])
        pixels.add(row["decodedSha256"])
        _require(isinstance(row["perceptualHash"], str) and re.fullmatch(r"[a-f0-9]{16}", row["perceptualHash"]), "PERCEPTUAL_HASH")
        perceptual.append((row["perceptualHash"], row["id"]))

        _require(isinstance(row["path"], str) and row["path"].strip(), "IMAGE_PATH")
        rel = PurePosixPath(row["path"])
        _require(not rel.is_absolute() and "\\" not in row["path"] and
                 not PureWindowsPath(row["path"]).drive and ".." not in rel.parts, "IMAGE_PATH")
        image_path = root.joinpath(*rel.parts).resolve()
        _require(image_path.is_relative_to(root), "IMAGE_PATH_ESCAPE")
        _require(image_path not in paths, "DUPLICATE_IMAGE_PATH")
        paths.add(image_path)
        _require(image_path.is_file(), "IMAGE_FILE_MISSING")
        size = image_path.stat().st_size
        _require(0 < size <= ADMISSION_POLICY["maximumBytes"], "IMAGE_BYTE_LIMIT")
        _require(hashlib.sha256(image_path.read_bytes()).hexdigest() == row["sha256"], "SOURCE_HASH_MISMATCH")

        _require(row["generator"] is not None and isinstance(row["generator"], str) and row["generator"].strip(), "GENERATOR_IDENTITY")
        if row["label"] == "genuine":
            _require(row["sourceDataset"] == "coco", "GENUINE_SOURCE_LABEL")
            _require(row["generator"] in {"publisher_labelled_real", "camera_publisher_label"}, "GENUINE_GENERATOR_LABEL")
        else:
            _require(row["sourceDataset"] is None or
                     (isinstance(row["sourceDataset"], str) and row["sourceDataset"].strip()), "SYNTHETIC_SOURCE_LABEL")
            _require(row["generator"] not in {"publisher_labelled_real", "camera_publisher_label"}, "SYNTHETIC_GENERATOR_LABEL")
        expected_basis = expected_label_basis(row["label"], row["generator"], row["sourceDataset"])
        _require(row["labelBasis"] == expected_basis, "LABEL_BASIS")
        _require(row["source"] == source_prefix, "DATASET_SOURCE_URL")
        _require(isinstance(row["publisherImageName"], str) and row["publisherImageName"].strip(), "PUBLISHER_SAMPLE_ID")
        _require(isinstance(row["shard"], str) and SHARD.fullmatch(row["shard"]), "SHARD_IDENTITY")
        _require(isinstance(row["index"], int) and not isinstance(row["index"], bool) and row["index"] >= 0, "SHARD_ROW_INDEX")
        _require(row["license"] == license_text, "ROW_LICENSE")

        geometry = row["geometry"]
        _require(isinstance(geometry, dict) and set(geometry) == {"format", "width", "height", "orientedSize", "mode"}, "GEOMETRY_SCHEMA")
        _require(isinstance(geometry["format"], str) and geometry["format"] in {"JPEG", "PNG", "WEBP"}, "IMAGE_FORMAT")
        width, height = geometry["width"], geometry["height"]
        oriented = geometry["orientedSize"]
        _require(isinstance(width, int) and not isinstance(width, bool) and width >= ADMISSION_POLICY["minimumSidePixels"] and
                 isinstance(height, int) and not isinstance(height, bool) and height >= ADMISSION_POLICY["minimumSidePixels"] and width * height <= ADMISSION_POLICY["maximumPixels"],
                 "IMAGE_GEOMETRY")
        _require(isinstance(oriented, list) and len(oriented) == 2 and
                 all(isinstance(d, int) and not isinstance(d, bool) and d > 0 for d in oriented) and
                 oriented[0] * oriented[1] == width * height, "ORIENTED_GEOMETRY")
        _require(isinstance(geometry["mode"], str) and geometry["mode"].strip(), "IMAGE_MODE")
        try:
            with Image.open(io.BytesIO(image_path.read_bytes())) as source:
                _require(source.format == geometry["format"], "IMAGE_FORMAT_MISMATCH")
                _require(list(source.size) == [width,height] and source.mode == geometry["mode"], "IMAGE_GEOMETRY_MISMATCH")
                _require(source.width * source.height <= 24_000_000, "IMAGE_PIXEL_LIMIT")
                decoded=ImageOps.exif_transpose(source).convert("RGB")
                _require(list(decoded.size) == oriented, "ORIENTED_GEOMETRY_MISMATCH")
                _require(hashlib.sha256(decoded.tobytes()).hexdigest() == row["decodedSha256"], "DECODED_HASH_MISMATCH")
                from ai_service.image_benchmark import fingerprints
                actual_phash=f"{fingerprints(decoded):016x}"
                _require(actual_phash == row["perceptualHash"], "PERCEPTUAL_HASH_MISMATCH")
        except (OSError,ValueError) as error:
            if str(error).startswith(("IMAGE_","DECODED_HASH","ORIENTED_GEOMETRY","PERCEPTUAL_HASH")):raise
            raise ValueError("IMAGE_DECODE") from error

    for role, labels in quotas.items():
        _require(set(labels) == {"genuine", "synthetic"}, "PROTOCOL_LABELS")
        for label, count in labels.items():
            _require(quotas_seen[role][label] == count, "FROZEN_QUOTA")
    for i, (left, left_id) in enumerate(perceptual):
        for right, right_id in perceptual[i + 1:]:
            _require(_hamming(left, right) > PHASH_MAX_DISTANCE,
                     f"PERCEPTUAL_DUPLICATE:{left_id}:{right_id}")
    return manifest["rows"]
