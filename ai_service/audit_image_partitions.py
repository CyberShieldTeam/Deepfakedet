"""Verify cached content and observable split separation, without running a classifier."""
import hashlib
import json
from collections import Counter
from pathlib import Path
from ai_service.evaluate_image import read_manifest


def main():
    root=Path('.model-cache')
    paths={role:root/f'benchmark_v2_{role}.json' for role in ('development','reserved_final')}
    manifests={role:json.loads(path.read_text(encoding='utf-8')) for role,path in paths.items()}
    for path in paths.values():
        read_manifest(path)  # Validate every cached file checksum and required provenance fields.
    old=json.loads(Path('reports/benchmark_partitions.json').read_text(encoding='utf-8'))
    previous=old['development']['samples']+old['reserved_final']['samples']
    dev=manifests['development']['samples']
    final=manifests['reserved_final']['samples']
    issues=[]
    minimum=63
    for label,left,right in (('new_development_vs_final',dev,final),
                             ('new_vs_previous',dev+final,previous)):
        for a in left:
            for b in right:
                distance=(int(a['phash63'],16)^int(b['phash63'],16)).bit_count()
                minimum=min(minimum,distance)
                if a['sha256']==b['sha256'] or a['group']==b['group'] or distance<=6:
                    issues.append(dict(comparison=label,left=a['id'],right=b['id'],distance=distance))
    report=dict(manifest_sha256={role:hashlib.sha256(path.read_bytes()).hexdigest() for role,path in paths.items()},
                samples={role:len(m['samples']) for role,m in manifests.items()},
                counts={role:dict(Counter(f"{s['domain']}/{s['label']}" for s in m['samples']))
                        for role,m in manifests.items()},
                known_overlap_issues=issues,minimum_cross_partition_phash_distance=minimum,
                passed=not issues,all_cached_checksums_verified=True,heldout_scored=False,
                limitation='No identity recognition or original-source audit; passing this check does not establish population, identity or training-set independence')
    Path('reports/benchmark_v2_split_audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report),flush=True)
    if issues:
        raise SystemExit(1)


if __name__=='__main__':
    main()
