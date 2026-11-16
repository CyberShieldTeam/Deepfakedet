import unittest
from ai_service.evaluate_extraction import evaluate,text_metrics,set_metrics
class EvaluationControls(unittest.TestCase):
    def manifest(self):return dict(schemaVersion=1,independent=True,split='development',datasetId='MATH CONTROL NOT DATA',rights='control',permissionEvidence='control',annotationProtocol='control',annotationProvenance='control',approvedBy='test',approvedAt='2026-01-01')
    def test_no_ground_truth(self):
        r=evaluate(self.manifest());self.assertIsNone(r['ocr']);self.assertIsNone(r['speech']);self.assertIsNone(r['candidates']);self.assertIsNone(r['relationships']);self.assertIsNone(r['reviewAgreement'])
    def test_math_only(self):
        self.assertEqual(text_metrics([dict(reference='abc',prediction='axc')])['characterErrorRate'],1/3)
        self.assertEqual(set_metrics([dict(reference=['a'],prediction=['a','b'])])['precision'],.5)
    def test_rights_and_holdout_gates(self):
        for change in [dict(rights=''),dict(independent=False),dict(split='test')]:
            with self.assertRaises(ValueError):evaluate({**self.manifest(),**change})
    def test_boundaries(self):
        with self.assertRaises(ValueError):evaluate({**self.manifest(),'ocr':[dict(id='x',sourceSha256='a'*64,reference='x'*501,prediction='')]})
if __name__=='__main__':unittest.main()
