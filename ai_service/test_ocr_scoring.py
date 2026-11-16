import itertools,random,unittest
from ai_service.ocr_scoring import edit_distance,score_observations
from ai_service.evaluate_extraction import distance
class ScoringControls(unittest.TestCase):
    def test_exact_distance_against_dynamic_programming(self):
        strings=[''.join(s) for n in range(5) for s in itertools.product('ab',repeat=n)]
        for a in strings:
            for b in strings:self.assertEqual(edit_distance(a,b),distance(a,b))
        rng=random.Random(43)
        for _ in range(100):
            a=''.join(rng.choices('हింa🙂',k=20));b=''.join(rng.choices('హिb🙂',k=18));self.assertEqual(edit_distance(a,b),distance(a,b))
        self.assertEqual(edit_distance(['one','two'],['one','three']),1)
    def test_failure_denominator_and_no_text(self):
        rows=[dict(reference='abc',text='abc',state='COMPLETE'),dict(reference='abc',text=None,state='FAILED'),dict(reference='abc',text=None,state='UNAVAILABLE'),dict(reference='abc',text=None,state='MISSING'),dict(reference='',text=None,state='FAILED')]
        r=score_observations(rows);self.assertEqual(r['failureAsEmpty']['CER'],.75);self.assertEqual(r['conditionalSuccessful']['CER'],0);self.assertEqual(r['evaluatedCoverage'],.2);self.assertEqual(r['noTextCorrect'],0);self.assertFalse(r['complete'])
    def test_partial_unicode_and_empty_ground_truth(self):
        r=score_observations([dict(reference='é',text='e\u0301\n',state='PARTIAL'),dict(reference='',text='',state='NO_TEXT_DETECTED')]);self.assertEqual(r['failureAsEmpty']['CER'],0);self.assertEqual(r['partial'],1);self.assertEqual(r['noTextCorrect'],1)
        self.assertIsNone(score_observations([])['failureAsEmpty']['CER'])
        with self.assertRaises(ValueError):score_observations([dict(reference='x',text=None,state='COMPLETE')])
if __name__=='__main__':unittest.main()
