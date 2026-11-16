import hashlib,json,tempfile,unittest
from pathlib import Path
from PIL import Image
from ai_service.ocr_evaluation import load_manifest,summarize
class EvaluationAdmissionControls(unittest.TestCase):
    def fixture(self,root):
        image=root/'a.png';Image.new('RGB',(20,10),'white').save(image)
        row=dict(id='a',path='a.png',sha256=hashlib.sha256(image.read_bytes()).hexdigest(),sourceGroup='doc-a',split='development',language='eng',quality='clear',rotation='0',resolution='20x10',density='sparse',sourceCategory='authored',reference='test')
        return dict(schemaVersion=2,scope='authored_controls',datasetId='math-control',datasetVersion='1',publisher='control',officialSource='control',rights='control',permissionEvidence='control',annotationProtocol='control',annotationProvenance='control',approvedBy='control',approvedAt='2026-11-16',profiles=['baseline'],rows=[row])
    def test_admission_hash_holdout_rights_and_path(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);m=self.fixture(root);file=root/'manifest.json';file.write_text(json.dumps(m));self.assertEqual(len(load_manifest(file)[1]),1)
            for changed in [dict(rights=''),dict(scope='unknown'),dict(profiles=['baseline']*2)]:
                file.write_text(json.dumps({**m,**changed}));self.assertRaises(ValueError,load_manifest,file)
            for changed in [dict(split='test'),dict(path='../outside.png'),dict(sha256='0'*64)]:
                file.write_text(json.dumps({**m,'rows':[{**m['rows'][0],**changed}]}));self.assertRaises(ValueError,load_manifest,file)
    def test_duplicate_and_near_duplicate(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);m=self.fixture(root);b=root/'b.png';Image.new('RGB',(20,10),(254,254,254)).save(b);r={**m['rows'][0],'id':'b','path':'b.png','sourceGroup':'doc-b','split':'train','sha256':hashlib.sha256(b.read_bytes()).hexdigest()};m['rows'].append(r);file=root/'manifest.json';file.write_text(json.dumps(m));self.assertRaisesRegex(ValueError,'Near-duplicate',load_manifest,file)
    def test_no_text_failure_and_unsupported_are_separate(self):
        rows=[dict(reference='',text='',state='NO_TEXT_DETECTED',wallSeconds=1,sampledPeakOcrTreeRssBytes=1),dict(reference='text',text=None,state='FAILED',wallSeconds=1,sampledPeakOcrTreeRssBytes=1),dict(reference='हिन्दी',text=None,state='UNAVAILABLE',wallSeconds=1,sampledPeakOcrTreeRssBytes=1)]
        r=summarize(rows);self.assertIsNone(r['transcription']);self.assertEqual(r['noTextCorrect'],1);self.assertEqual(r['technicalFailures'],1);self.assertEqual(r['unavailable'],1)
if __name__=='__main__':unittest.main()
