import subprocess
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from ai_service.temporal import analyze_pair
from ai_service.temporal_video import analyze_file, analyze_bytes

CLIP=Path(__file__).resolve().parents[1]/'test/fixtures/video/test_pattern_3s.mp4'


class TemporalVideoTests(unittest.TestCase):
    def test_quality_gates_and_cut_do_not_become_forgery_labels(self):
        dark=np.zeros((96,128,3),dtype=np.uint8)
        self.assertEqual(analyze_pair(dark,dark)['observation'],'insufficient_light')
        cut=analyze_pair(dark,np.full_like(dark,255))
        self.assertEqual(cut['observation'],'scene_transition_candidate')
        self.assertEqual(cut['regions'],[])
        self.assertNotIn('probability',cut)
        flat=np.full_like(dark,128)
        self.assertEqual(analyze_pair(flat,flat)['observation'],'insufficient_texture')

    def test_camera_translation_and_local_change_are_distinct_observations(self):
        rng=np.random.default_rng(17)
        first=cv2.GaussianBlur(rng.integers(50,206,(128,160,3),dtype=np.uint8),(5,5),0)
        shifted=cv2.warpAffine(first,np.float32([[1,0,2],[0,1,0]]),(160,128),borderMode=cv2.BORDER_REFLECT)
        normal=analyze_pair(first,shifted)
        self.assertEqual(normal['observation'],'coherent_motion')
        shifted[48:80,64:96]=0
        changed=analyze_pair(first,shifted)
        self.assertEqual(changed['observation'],'localized_change_candidate')
        self.assertTrue(changed['regions'])
        for box in changed['regions']:
            self.assertLessEqual(box['x']+box['width'],160)
            self.assertLessEqual(box['y']+box['height'],128)

    def test_streaming_fixture_has_bounded_samples_and_null_probability(self):
        result=analyze_file(CLIP,.25)
        self.assertIn(result['status'],('measured','partial'))
        self.assertLessEqual(result['sampledFrames'],25)
        self.assertEqual(result['processedPairs'],len(result['intervals']))
        self.assertEqual(result['classification'],'INCONCLUSIVE')
        self.assertIsNone(result['decisionProbability'])
        self.assertTrue(all(i['endSeconds']>i['startSeconds'] for i in result['intervals']))
        self.assertTrue(all(max(i['analysisWidth'],i['analysisHeight'])<=480 for i in result['intervals']))
        self.assertEqual(result['sourceFrameCount'],24)

    def test_config_and_timeout_fail_closed(self):
        with self.assertRaises(ValueError): analyze_file(CLIP,0)
        coarse=analyze_file(CLIP,60)
        self.assertEqual(coarse['status'],'insufficient_evidence')
        self.assertEqual(coarse['processedPairs'],1)
        with self.assertRaises(ValueError): analyze_bytes(b'x'*(8*1024*1024+1))
        with patch('ai_service.temporal_video.subprocess.run',side_effect=subprocess.TimeoutExpired('worker',8)):
            result=analyze_bytes(CLIP.read_bytes())
        self.assertEqual(result['status'],'timed_out')
        self.assertEqual(result['intervals'],[])
        self.assertIsNone(result['decisionProbability'])

    def test_soft_deadline_returns_partial_without_inventing_observations(self):
        with patch('ai_service.temporal_video.time.monotonic',side_effect=[0,7,7.1]):
            result=analyze_file(CLIP)
        self.assertEqual(result['status'],'partial')
        self.assertEqual(result['processedPairs'],0)

    def test_real_child_timeout_preserves_production_deadline(self):
        from ai_service import temporal_video
        self.assertEqual(temporal_video.HARD_SECONDS,8)
        started=time.monotonic()
        # Trigger an actual subprocess startup timeout without waiting eight seconds.
        with patch('ai_service.temporal_video.HARD_SECONDS',.001):
            result=analyze_bytes(CLIP.read_bytes())
        self.assertEqual(result['status'],'timed_out')
        self.assertLess(time.monotonic()-started,3)
        self.assertEqual(temporal_video.HARD_SECONDS,8)
        self.assertIsNone(result['decisionProbability'])


if __name__=='__main__': unittest.main()
