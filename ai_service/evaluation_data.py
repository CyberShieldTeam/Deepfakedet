"""Shared offline evaluation file and split admission checks."""
import hashlib
from pathlib import Path


def verified_file(root, relative, digest, extensions=None, max_bytes=None):
    root=Path(root).resolve()
    path=(root/relative).resolve()
    if not path.is_relative_to(root) or not path.is_file() or (extensions and path.suffix.lower() not in extensions):
        raise ValueError('Evaluation path escapes root, is missing or has an unsupported format')
    if max_bytes is not None and path.stat().st_size>max_bytes:
        raise ValueError('Evaluation file exceeds byte budget')
    with path.open('rb') as source:
        actual=hashlib.file_digest(source,'sha256').hexdigest()
    if actual!=digest:
        raise ValueError('SHA-256 mismatch: '+relative)
    return path


def require_disjoint(rows):
    seen={}
    for row in rows:
        keys=[('source_group',row['group']),('content',row['sha256'])]
        keys += [('identity',identity) for identity in row.get('subject_ids',[])]
        keys += [('source_lineage',source) for source in row.get('source_ids',[])]
        for kind,key in keys:
            namespace=(row.get('task'),kind,key)
            if namespace in seen and seen[namespace]!=row['split']:
                raise ValueError('Source group, identity, lineage or duplicate content crosses dataset splits')
            seen[namespace]=row['split']
