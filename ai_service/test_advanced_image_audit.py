import unittest
from unittest.mock import patch
from pathlib import Path
from ai_service.advanced_image_audit import audit, resource_gate


class AdvancedAuditTests(unittest.TestCase):
    def test_reserved_role_rejected_before_sample_access(self):
        with patch.object(Path, "read_text", return_value='{"benchmark_role":"reserved_final"}'), \
             patch("ai_service.advanced_image_audit.read_manifest") as read:
            with self.assertRaisesRegex(ValueError, "development"):
                audit("unused.json")
            read.assert_not_called()

    def test_memory_gate_requires_both_physical_and_commit_headroom(self):
        self.assertFalse(resource_gate(8, 2, 4))
        self.assertFalse(resource_gate(2, 8, 4))
        self.assertTrue(resource_gate(4, 4, 4))


if __name__ == "__main__":
    unittest.main()
