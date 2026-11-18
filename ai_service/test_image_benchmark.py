import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from ai_service.evaluate_image import metrics
from ai_service.image_benchmark import summarize, wilson
from ai_service.reserve_image_holdout import overlaps


class BenchmarkTests(unittest.TestCase):
    def test_confusion_metrics_and_zero_event_uncertainty(self):
        rows=[dict(id=str(i),group=f"source-{i}",label=label,score=score) for i,(label,score) in enumerate(
            [('genuine',.1),('genuine',.8),('synthetic',.9),('synthetic',.2)])]
        result=summarize(rows)
        self.assertEqual(result,summarize(rows))
        self.assertEqual(result['accuracy'],.5)
        self.assertEqual(result['precision'],.5)
        self.assertEqual(result['f1'],.5)
        self.assertEqual(result['false_negative_rate'],.5)
        self.assertEqual(result['specificity'],.5)
        self.assertEqual(result['balanced_accuracy'],.5)
        self.assertEqual(result['confusion_matrix'],dict(actual_genuine=[1,1],actual_synthetic=[1,1]))
        self.assertGreater(wilson(0,31)[1],0.1)
        self.assertIsNone(wilson(0,0))

    def test_failures_not_counted_as_successes_and_groups_bootstrapped(self):
        rows=[dict(id='a',group='same',label='genuine',score=.1),
              dict(id='b',group='same',label='genuine',score=.2),
              dict(id='c',group='other',label='synthetic',score=.9),
              dict(id='d',group='missing',label='synthetic',score=None)]
        result=summarize(rows)
        self.assertEqual(result['total'],4)
        self.assertEqual(result['scored'],3)
        self.assertEqual(result['failed_or_skipped'],1)
        self.assertEqual(result['auroc'],1)
        self.assertEqual(result['auroc_ci95_group_bootstrap'],[1.,1.])
        self.assertEqual(result['ci95_source_group_bootstrap']['unit'],'source_group')
        self.assertEqual(result['ci95_source_group_bootstrap']['replicates'],1000)
        self.assertEqual(result['ci95_source_group_bootstrap']['intervals']['balanced_accuracy'],[1.,1.])
        self.assertEqual(result['auroc_ci95_group_bootstrap'],result['ci95_source_group_bootstrap']['intervals']['auroc'])

    def test_metric_inputs_reject_unknown_labels_nonfinite_scores_and_missing_values(self):
        with self.assertRaisesRegex(ValueError,'unknown label'):
            metrics([dict(label='maybe',score=.2)],.5)
        for score in (float('nan'),float('inf'),float('-inf'),'0.5',True):
            with self.subTest(score=score):
                with self.assertRaisesRegex(ValueError,'score'):
                    metrics([dict(label='genuine',score=score)],.5)
        with self.assertRaisesRegex(ValueError,'label and score'):
            metrics([dict(label='genuine')],.5)
        with self.assertRaisesRegex(ValueError,'label and score'):
            metrics([dict(score=.2)],.5)
        for threshold in (float('nan'),float('inf'),-0.1,1.1,True):
            with self.subTest(threshold=threshold):
                with self.assertRaisesRegex(ValueError,'Threshold'):
                    metrics([dict(label='genuine',score=.2)],threshold)

    def test_empty_and_single_class_metrics_reconcile_counts(self):
        empty=summarize([])
        self.assertEqual((empty['total'],empty['scored'],empty['failed_or_skipped']),(0,0,0))
        self.assertIsNone(empty['accuracy'])
        self.assertEqual(empty['ci95_source_group_bootstrap']['replicates'],0)
        rows=[dict(id='a',group='a',label='synthetic',score=.9),
              dict(id='b',group='b',label='synthetic',score=.2)]
        result=summarize(rows)
        confusion_total=sum(sum(values) for values in result['confusion_matrix'].values())
        self.assertEqual(confusion_total,result['scored'])
        self.assertIsNone(result['auroc'])
        self.assertIsNone(result['specificity'])
        self.assertIsNone(result['balanced_accuracy'])
        self.assertIsNone(result['ci95_source_group_bootstrap']['intervals']['auroc'])
        with self.assertRaisesRegex(ValueError,'well-formed id'):
            summarize([dict(label='genuine',score=.1)])

    def test_summarize_rejects_malformed_group_and_latency(self):
        with self.assertRaisesRegex(ValueError,'group'):
            summarize([dict(id='a',group=7,label='genuine',score=.1)])
        with self.assertRaisesRegex(ValueError,'latency'):
            summarize([dict(id='a',group='a',label='genuine',score=.1,seconds=float('nan'))])

    def test_summarize_rejects_duplicate_or_malformed_sample_ids(self):
        duplicate=[dict(id='sample-1',group='source-a',label='genuine',score=.1),
                   dict(id='sample-1',group='source-b',label='synthetic',score=.9)]
        with self.assertRaisesRegex(ValueError,'Duplicate benchmark sample id'):
            summarize(duplicate)
        for sample_id in ('',' leading','bad id','bad\\nvalue','x'*257):
            with self.subTest(sample_id=sample_id):
                with self.assertRaisesRegex(ValueError,'well-formed id'):
                    summarize([dict(id=sample_id,group='source-a',label='genuine',score=.1)])

    def test_source_group_bootstrap_requires_explicit_valid_group_ids(self):
        with self.assertRaisesRegex(ValueError,'requires a well-formed group id'):
            summarize([dict(id='sample-a',label='genuine',score=.1)])
        with self.assertRaisesRegex(ValueError,'requires a well-formed group id'):
            summarize([dict(id='sample-a',group=' ',label='genuine',score=.1)])

    def test_overlap_guards_for_hash_pixels_perception_and_source(self):
        record=dict(sha256='exact',decoded='pixels',phash=0,source_group='source')
        self.assertTrue(overlaps(record,'exact','other',(1<<63)-1))
        self.assertTrue(overlaps(record,'other','pixels',(1<<63)-1))
        self.assertTrue(overlaps(record,'other','other',0b111111))
        self.assertTrue(overlaps(record,'other','other',(1<<63)-1,'source'))
        self.assertFalse(overlaps(record,'other','other',0b1111111,'different'))

    def test_reserved_final_data_rejected_before_model_loading(self):
        from ai_service.image_benchmark import main
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'reserved.json'
            path.write_text(json.dumps(dict(benchmark_role='reserved_final')),encoding='utf-8')
            with patch('sys.argv',['benchmark','--model','community','--manifest',str(path),'--output','unused']), \
                 patch('ai_service.image_benchmark.load_scorer') as load:
                with self.assertRaisesRegex(ValueError,'final test remains sealed'):
                    main()
                load.assert_not_called()


if __name__=='__main__':
    unittest.main()
