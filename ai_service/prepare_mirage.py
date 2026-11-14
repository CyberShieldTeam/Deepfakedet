"""Download a bounded pinned screening subset. This is not an identity-disjoint benchmark."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor

REPO = "Yunncheng/Mirage-Test"
REVISION = "820a191bb0844ae74a1bd9eb57b28268257a4053"


def download(url):
    with urlopen(url, timeout=60) as response:
        data = response.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise ValueError("Download exceeds per-file bound")
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-class-domain", type=int, default=10)
    args = parser.parse_args()
    if not 1 <= args.per_class_domain <= 20:
        parser.error("Choose 1–20 images per class/domain")
    root = Path(".model-cache/mirage-screening")
    root.mkdir(parents=True, exist_ok=True)
    selected = []
    for domain in ("Animal", "Human", "Object", "Scene"):
        for label_dir, label in (("0_real", "genuine"), ("1_fake", "synthetic")):
            url = f"https://huggingface.co/api/datasets/{REPO}/tree/{REVISION}/{domain}/{label_dir}?recursive=true&limit=1000"
            entries = json.loads(download(url))
            files = [e for e in entries if e["type"] == "file" and e["path"].lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
            files.sort(key=lambda e: hashlib.sha256(e["path"].encode()).hexdigest())
            if len(files) < args.per_class_domain:
                raise ValueError(f"Insufficient listing for {domain}/{label_dir}; inspect dataset layout")
            selected.extend((entry, label, domain) for entry in files[:args.per_class_domain])

    def save(item):
        entry, label, domain = item
        url = f"https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/{entry['path']}"
        target = (root / entry["path"]).resolve()
        if not target.is_relative_to(root.resolve()):
            raise ValueError("Dataset entry escapes cache directory")
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raw = target.read_bytes()
        else:
            raw = download(url)
            target.write_bytes(raw)
        digest = hashlib.sha256(raw).hexdigest()
        if entry.get("lfs", {}).get("oid") and digest != entry["lfs"]["oid"]:
            raise ValueError("Publisher content hash mismatch")
        return dict(id=entry["path"], path=entry["path"], sha256=digest, source=url,
                    license="MIT (dataset declaration; underlying source rights not independently audited)",
                    group=entry["path"], split="test", label=label, domain=domain)

    with ThreadPoolExecutor(max_workers=4) as pool:
        samples = list(pool.map(save, selected))
    manifest = dict(task="general_ai_generated_image", dataset=REPO, revision=REVISION,
                    limitations=["Subset of first API listing (max 1000 per stratum), hash-ordered; not random population sampling",
                                 "Source/identity and training overlap unverified; group is file identity only",
                                 "Human synthetic images are not a facial-manipulation ground-truth benchmark",
                                 "Test-only diagnostics; no threshold fitting or calibration"], samples=samples)
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Prepared {len(samples)} samples at {root / 'manifest.json'}", flush=True)


if __name__ == "__main__":
    main()
