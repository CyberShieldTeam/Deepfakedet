import hashlib
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
import subprocess
import sys
from unittest.mock import patch
from ai_service import claim_nli
from ai_service.evaluate_nli import metrics, wilson, validate_manifest, supervised_command


class NliControls(unittest.TestCase):
    def test_evaluation_deadline_terminates_owned_control_process(self):
        code, output = supervised_command([sys.executable, '-c', 'import time;time.sleep(30)'], timeout_seconds=.2)
        self.assertEqual(code, 124)
        self.assertIn('no completed benchmark claimed', output)

    def test_hash_and_size_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'config.json'; path.write_bytes(b'abc')
            file = {'config.json': (3, 'sha256', hashlib.sha256(b'abc').hexdigest())}
            with patch.object(claim_nli, 'FILES', file):
                claim_nli.verify_snapshot(directory)
                path.write_bytes(b'abd')
                with self.assertRaisesRegex(ValueError, 'HASH'):
                    claim_nli.verify_snapshot(directory)
                path.write_bytes(b'abcx')
                with self.assertRaisesRegex(ValueError, 'SIZE'):
                    claim_nli.verify_snapshot(directory)

    def test_low_memory_before_weights_or_torch(self):
        with patch('psutil.virtual_memory', return_value=SimpleNamespace(available=1024**3)), patch.object(claim_nli, 'verify_snapshot') as verify:
            with self.assertRaisesRegex(RuntimeError, 'MEMORY'):
                claim_nli.NliModel('unused')
            verify.assert_not_called()

    def test_unsupported_language_has_no_scores(self):
        model = object.__new__(claim_nli.NliModel)
        self.assertEqual(model.predict([{'premise': 'हिंदी', 'hypothesis': 'दावा', 'language': 'hi'}]), [{'status': 'unsupported_language'}])

    def test_long_tokens_abstain_without_forward_or_truncation(self):
        model = object.__new__(claim_nli.NliModel)
        calls = []
        def tokenizer(premise, hypothesis, **kwargs):
            calls.append((premise, hypothesis, kwargs))
            return {'input_ids': list(range(513))}
        model.tokenizer = tokenizer
        self.assertEqual(model.predict([{'premise': 'Exact source.', 'hypothesis': 'Exact claim.', 'language': 'en'}])[0]['status'], 'input_over_limit')
        self.assertEqual(calls, [('Exact source.', 'Exact claim.', {'truncation': False})])

    def test_input_bounds_and_extra_fields(self):
        model = object.__new__(claim_nli.NliModel)
        for pairs in [[], [{}]*9, [{'premise': 'x', 'hypothesis': 'x', 'language': 'en', 'command': 'execute'}], [{'premise': 'x', 'hypothesis': 'x'*1001, 'language': 'en'}]]:
            with self.assertRaises(ValueError):
                model.predict(pairs)

    def test_metrics_and_explicit_undefined_denominators(self):
        rows = [{'label': 'entailment', 'status': 'executed', 'argmax': 'entailment', 'accepted': True},
                {'label': 'contradiction', 'status': 'executed', 'argmax': 'entailment', 'accepted': True},
                {'label': 'neutral', 'status': 'input_over_limit'}]
        result = metrics(rows)
        self.assertEqual(result['confusionMatrix'], [[0, 1, 0], [0, 1, 0], [0, 0, 0]])
        self.assertEqual(result['accuracy'], .5)
        self.assertEqual(result['accuracyAllSelected'], 1/3)
        self.assertEqual(result['acceptedCoverage'], 2/3)
        self.assertEqual(result['falseSupport']['acceptedRate'], .5)
        self.assertIsNone(result['perClass']['neutral']['recall'])
        self.assertIsNone(wilson(0, 0))
        self.assertIsNone(metrics([])['accuracy'])

    def test_protocol_and_source_group_tampering_rejected_before_scoring(self):
        protocol = b'{}'
        with self.assertRaisesRegex(ValueError, 'protocol changed'):
            validate_manifest({'protocolSha256': 'wrong'}, protocol)
        row = dict(id='control', role='development', premise='Exact premise.', hypothesis='Exact claim.',
                   label='entailment', language='en', group='forged', pairSha256='unused')
        data = {'protocolSha256': hashlib.sha256(protocol).hexdigest(), 'rows': [row]}
        with self.assertRaisesRegex(ValueError, 'group fingerprint'):
            validate_manifest(data, protocol)

    def test_duplicate_premise_groups_rejected_even_for_distinct_claims(self):
        protocol = b'{}';premise = 'Exact premise.'
        rows = []
        for i in range(2):
            hypothesis = 'Claim '+str(i)
            rows.append(dict(id=str(i), role='development' if i == 0 else 'held_out', premise=premise,
                             hypothesis=hypothesis, label='neutral', language='en',
                             group=hashlib.sha256(premise.casefold().encode()).hexdigest(),
                             pairSha256=hashlib.sha256(json.dumps([premise.casefold(), hypothesis.casefold()]).encode()).hexdigest()))
        with self.assertRaisesRegex(ValueError, 'Repeated premise'):
            validate_manifest({'protocolSha256': hashlib.sha256(protocol).hexdigest(), 'rows': rows}, protocol)


if __name__ == '__main__':
    unittest.main()
