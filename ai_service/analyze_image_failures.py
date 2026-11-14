"""Create quantitative failure diagnostics without modifying source images or labels."""
import argparse
import json
import statistics
from pathlib import Path
from ai_service.evaluate_image import metrics


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reports',nargs='+')
    parser.add_argument('--output',default='reports/image_failure_analysis.json')
    args=parser.parse_args()
    results=[]
    for filename in args.reports:
        report=json.loads(Path(filename).read_text(encoding='utf-8'))
        originals=[r for r in report['rows'] if r['variant']=='original']
        original_by_id={r['id']:r for r in originals}
        failures={}
        for name,predicate,reverse in (
            ('false_negative',lambda r:r['label']=='synthetic' and r['score']<.5,False),
            ('false_positive',lambda r:r['label']=='genuine' and r['score']>=.5,True)):
            failures[name]=sorted([r for r in originals if r.get('score') is not None and predicate(r)],
                                  key=lambda r:r['score'],reverse=reverse)[:4]
        associations={}
        for dimension, key in (('resolution',lambda r:'max_side_above_2048' if max(r['width'],r['height'])>2048 else 'max_side_at_most_2048'),
                              ('format',lambda r:r['format']),('generator',lambda r:r['generator']),
                              ('jpeg_quantization',lambda r:'not_JPEG' if r.get('jpeg_quantization_mean') is None else
                               'mean_quantization_at_most_10' if r['jpeg_quantization_mean']<=10 else 'mean_quantization_above_10')):
            associations[dimension]={}
            for row in originals:
                associations[dimension].setdefault(key(row),[]).append(row)
            associations[dimension]={k:metrics(v,.5) for k,v in associations[dimension].items()}
        paired={}
        for variant in ('jpeg75','max512'):
            pairs=[(original_by_id[r['id']],r) for r in report['rows'] if r['variant']==variant and
                   r.get('score') is not None and original_by_id[r['id']].get('score') is not None]
            paired[variant]=dict(n=len(pairs),mean_score_change=statistics.mean(b['score']-a['score'] for a,b in pairs) if pairs else None,
                                threshold_flips=sum((a['score']>=.5)!=(b['score']>=.5) for a,b in pairs),
                                corrected=sum(((a['score']>=.5)==(a['label']=='synthetic')) is False and
                                              ((b['score']>=.5)==(b['label']=='synthetic')) for a,b in pairs),
                                worsened=sum(((a['score']>=.5)==(a['label']=='synthetic')) and
                                             ((b['score']>=.5)!=(b['label']=='synthetic')) for a,b in pairs))
        results.append(dict(model=report['model'],representative_errors=failures,associations=associations,paired=paired,
                            threshold_sweep={str(threshold):metrics(originals,threshold) for threshold in (.01,.05,.1,.25,.5,.75,.9,.99)},
                            caution='Development diagnostics only; association does not identify a cause. Thresholds not selected on held-out data.'))
    Path(args.output).write_text(json.dumps(results,indent=2,allow_nan=False),encoding='utf-8')
    print(f'Saved {args.output}')


if __name__=='__main__':
    main()
