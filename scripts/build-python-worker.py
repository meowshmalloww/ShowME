"""Build the constrained verifier as a single-file worker for electron-builder."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "workers" / "python" / "verify.py"
DIST = ROOT / "workers" / "python" / "dist"
WORK = ROOT / "workers" / "python" / "build"
SPEC = ROOT / "workers" / "python"

command = [
    sys.executable,
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--name",
    "showme-verify",
    "--distpath",
    str(DIST),
    "--workpath",
    str(WORK),
    "--specpath",
    str(SPEC),
    str(SCRIPT),
]
subprocess.run(command, check=True, cwd=ROOT)
