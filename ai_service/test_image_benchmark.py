import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from ai_service.image_benchmark import summarize, wilson
from ai_service.reserve_image_holdout import overlaps


class BenchmarkTests(unittest.TestCase):
    def test_confusion_metrics_and_zero_event_uncertainty(self):
        rows=[dict(id=str(i),label=label,score=score) for i,(label,score) in enumerate(
            [('genuine',.1),('genuine',.8),('synthetic',.9),('synthetic',.2)])]
        result=summarize(rows)
        self.assertEqual(result['accuracy'],.5)
        self.assertEqual(result['precision'],.5)
        self.assertEqual(result['f1'],.5)
        self.assertEqual(result['specificity'],.5)
        self.assertEqual(result['balanced_accuracy'],.5)
        self.assertEqual(result['false_negative_rate'],.5)
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
        self.assertIn('balanced_accuracy',result['ci95_group_bootstrap']['metrics'])
        self.assertEqual(result['ci95_group_bootstrap']['replicates'],300)

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
