import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ai_service.evaluate_video import load_manifest, interval_metrics, summarize, evaluate


class VideoEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        (self.root/'terms.md').write_text('Local software-control test scope; not independent media approval')
        (self.root/'sample.mp4').write_bytes(b'unit admission bytes, never decoded or called camera footage')
        self.registry=dict(schema_version=1,datasets={'controls':dict(status='approved',version='1',
            approved_cohorts=['software_control'],license='local-control',license_uri='terms.md',
            approval_reference='unit-fixture authorization',source_identity_reviewed=True,independent_ground_truth=False,
            evidence_path='terms.md',evidence_sha256=hashlib.sha256((self.root/'terms.md').read_bytes()).hexdigest())})
        self.row=dict(id='one',task='video_temporal',path='sample.mp4',sha256=hashlib.sha256((self.root/'sample.mp4').read_bytes()).hexdigest(),
            dataset='controls',dataset_version='1',cohort='software_control',ground_truth='not_applicable',
            label_basis='unit software input',label_reference='terms.md',source='project://unit',license='local-control',license_uri='terms.md',
            group='source-a',source_ids=['source-a'],subject_ids=[],identity_status='not_applicable',split='development',parent_id=None,
            contamination_status='reviewed_no_known_overlap',manipulation_type='not_applicable',conditions=['static'],
            metadata=dict(fps=8,width=64,height=64,frames=24,fourcc=828601953,frame_rate_mode='constant_verified'),
            encoding=dict(codec='h264',container='mp4',pixel_format='yuv420p'),annotations=dict(status='none',intervals=[]))

    def files(self,rows=None,role='development'):
        manifest=self.root/'manifest.json';registry=self.root/'registry.json'
        manifest.write_text(json.dumps(dict(schema_version=1,task='video_temporal_diagnostics',evaluation_role=role,samples=rows or [self.row])))
        registry.write_text(json.dumps(self.registry))
        return manifest,registry

    def test_admission_and_reserved_role_guard_before_sample_access(self):
        m,r=self.files()
        self.assertEqual(len(load_manifest(m,self.root,r)[2]),1)
        m,r=self.files(role='reserved_final')
        with patch('ai_service.evaluate_video.verified_file') as verify:
            with self.assertRaisesRegex(ValueError,'sealed'):load_manifest(m,self.root,r)
            verify.assert_not_called()

    def test_rejects_incomplete_unauthorized_contaminated_and_changed_content(self):
        for change in ({'license':''},{'dataset':'not-approved'},{'contamination_status':'unknown'},
                       {'sha256':'0'*64},{'path':'../outside.mp4'},{'identity_status':'unknown'},
                       {'metadata':{**self.row['metadata'],'frame_rate_mode':'unknown'}}):
            with self.subTest(change=change):
                m,r=self.files([{**self.row,**change}])
                with self.assertRaises(ValueError):load_manifest(m,self.root,r)
        self.registry['datasets']['controls']['status']='blocked'
        m,r=self.files()
        with self.assertRaisesRegex(ValueError,'authorized'):load_manifest(m,self.root,r)

    def test_source_identity_and_derivatives_cannot_cross_splits(self):
        (self.root/'two.mp4').write_bytes(b'different unit input')
        second={**copy.deepcopy(self.row),'id':'two','path':'two.mp4','sha256':hashlib.sha256(b'different unit input').hexdigest(),
                'split':'validation'}
        m,r=self.files([self.row,second])
        with self.assertRaisesRegex(ValueError,'crosses'):load_manifest(m,self.root,r)
        first={**self.row,'identity_status':'verified','subject_ids':['canonical-person']}
        second.update(group='different-source',source_ids=['different-source'],identity_status='verified',subject_ids=['canonical-person'])
        m,r=self.files([first,second])
        with self.assertRaisesRegex(ValueError,'crosses'):load_manifest(m,self.root,r)
        second.update(split='development',subject_ids=[],identity_status='not_applicable',parent_id='one')
        m,r=self.files([self.row,second])
        with self.assertRaisesRegex(ValueError,'Derivative'):load_manifest(m,self.root,r)

    def test_independent_camera_label_needs_separate_approval(self):
        self.registry['datasets']['controls']['approved_cohorts'].append('camera_recording')
        m,r=self.files([{**self.row,'cohort':'camera_recording','ground_truth':'authentic'}])
        with self.assertRaisesRegex(ValueError,'ground truth'):load_manifest(m,self.root,r)

    def test_validation_media_not_read_and_runtime_metadata_mismatch_rejected(self):
        validation={**self.row,'split':'validation','path':'sealed-video.mp4'}
        m,r=self.files([validation])
        self.assertEqual(load_manifest(m,self.root,r)[2],[])
        m,r=self.files()
        output=dict(classification='INCONCLUSIVE',decisionProbability=None,status='measured',
                    sourceFrameRate=9,sourceFrameCount=24,sourceWidth=64,sourceHeight=64,sourceFourcc=828601953)
        with patch('ai_service.evaluate_video.analyze_bytes',return_value=output):
            with self.assertRaisesRegex(ValueError,'metadata disagrees'):evaluate(m,self.root,r)

    def test_localization_requires_independent_annotations_and_one_to_one_matching(self):
        result=interval_metrics([[0,1]],[[0,1]],False)
        self.assertIsNone(result['precision']);self.assertIsNone(result['recall'])
        result=interval_metrics([[0,1],[3,4]],[[0,1],[6,7]],True)
        self.assertEqual((result['precision'],result['recall']),(.5,.5))
        result=interval_metrics([[0,1],[0,1]],[[0,1]],True)
        self.assertEqual(result['tp'],1)
        self.assertEqual(result['fp'],1)

    def test_incomplete_results_do_not_reduce_candidate_burden(self):
        result=summarize([dict(complete=False,duration_seconds=3,candidate_count=0)])
        self.assertEqual(result['incomplete_videos'],1)
        self.assertIsNone(result['candidates_per_source_minute'])
        self.assertIsNone(result['candidate_intervals'])


if __name__=='__main__':unittest.main()
