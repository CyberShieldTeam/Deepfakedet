import hashlib
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from ai_service import research_models
from ai_service.prepare_advanced_evaluation import near,tokens
from ai_service.evaluate_advanced_models import validate
from ai_service.evaluate_scifact import measure


class AdvancedControls(unittest.TestCase):
    def test_pinned_bytes_reject_tampering(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'asset';path.write_bytes(b'abc')
            research_models.verify(path,'asset',(3,'sha256',hashlib.sha256(b'abc').hexdigest()))
            path.write_bytes(b'abd')
            with self.assertRaisesRegex(ValueError,'HASH'):research_models.verify(path,'asset',(3,'sha256',hashlib.sha256(b'abc').hexdigest()))
            with self.assertRaisesRegex(ValueError,'SIZE'):research_models.verify(path,'asset',(4,'sha256','unused'))

    def test_memory_admission_before_snapshot_or_import(self):
        with patch('psutil.virtual_memory',return_value=SimpleNamespace(available=1024**3)),patch.object(research_models,'snapshot') as verify:
            with self.assertRaisesRegex(RuntimeError,'MEMORY'):research_models.ResearchModel('unused','reranker')
            verify.assert_not_called()

    def test_exact_pair_and_no_silent_truncation(self):
        model=object.__new__(research_models.ResearchModel)
        calls=[]
        def tokenizer(first,second,**kwargs):
            calls.append((first,second,kwargs));return {'input_ids':list(range(513))}
        model.tokenizer=tokenizer
        result=model.pair('Exact claim','Exact source')
        self.assertEqual(result,{'status':'input_over_limit','tokens':513})
        self.assertEqual(calls,[('Exact claim','Exact source',{'truncation':False})])
        self.assertEqual(model.pair('', 'source')['status'],'input_over_limit')

    def test_near_claim_family_guard(self):
        self.assertTrue(near('The fictional bridge is open.',[tokens('The fictional bridge is open')]))
        self.assertFalse(near('The library is closed',[tokens('The bridge is open')]))

    def test_protocol_tampering_rejected(self):
        with self.assertRaisesRegex(ValueError,'PROTOCOL'):validate({'protocolSha256':'wrong'},'deberta')

    def test_relevance_denominators_include_missing_gold(self):
        result=measure(['unjudged','gold'],{'gold':1,'absent':1},1)
        self.assertEqual(result['recall'],0);self.assertEqual(result['mrr'],.5);self.assertEqual(result['ndcg'],0)
        self.assertEqual(measure(['gold'],{'gold':1,'absent':1},6)['recall'],.5)
        self.assertIsNone(measure([],{},1)['recall'])


if __name__=='__main__':unittest.main()
