import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ai_service.diagnose_image_runtime import supervise


class DiagnosticSupervisorTests(unittest.TestCase):
    def test_timeout_writes_structured_report(self):
        class FakeMemory:
            rss = 12 * 1_048_576

        class FakeObserved:
            def memory_info(self):
                return FakeMemory()

        class FakeProcess:
            pid = 42
            returncode = -9

            def poll(self):
                return None

            def communicate(self, timeout=None):
                return ('{"event":"stage_start","stage":"import_torch"}\n', None)

        cache = Path(__file__).resolve().parents[1] / ".model-cache"
        cache.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as folder:
            output = Path(folder) / "report.json"
            with patch("subprocess.Popen", return_value=FakeProcess()), \
                 patch("psutil.Process", return_value=FakeObserved()), \
                 patch("time.sleep"), patch("time.monotonic", side_effect=[0, 2, 2.1]), \
                 patch("ai_service.diagnose_image_runtime._terminate_tree"):
                code = supervise(Path(__file__), output, 1, 0.1, "model", "revision")
            report = json.loads(output.read_text())
            self.assertEqual(code, 124)
            self.assertTrue(report["timedOut"])
            self.assertEqual(report["events"][0]["stage"], "import_torch")


if __name__ == "__main__":
    unittest.main()
