"""Actual owned subprocess-tree termination regression; no campaign/model accuracy test."""
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
import psutil
from ai_service.profile_campaign_resources import terminate_tree

class CampaignCleanupTests(unittest.TestCase):
    def test_timeout_cleanup_terminates_launcher_and_worker(self):
        with tempfile.TemporaryDirectory() as root:
            pidfile=Path(root)/'child.pid'
            script="import subprocess,sys,time; from pathlib import Path; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)'],creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)); Path(sys.argv[1]).write_text(str(p.pid)); time.sleep(30)"
            parent=subprocess.Popen([sys.executable,'-c',script,str(pidfile)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            try:
                deadline=time.monotonic()+5
                while not pidfile.exists() and time.monotonic()<deadline:time.sleep(.02)
                self.assertTrue(pidfile.exists(),'Owned child failed to start')
                child=int(pidfile.read_text())
                terminate_tree(parent)
                self.assertIsNotNone(parent.poll())
                self.assertFalse(psutil.pid_exists(child),'Owned worker survived cleanup')
            finally:
                if parent.poll() is None:terminate_tree(parent)

if __name__=='__main__':unittest.main()
