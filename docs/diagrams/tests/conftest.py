"""Shared pytest fixtures."""
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from common import load_config  # noqa: E402

needs_elk = pytest.mark.skipif(
    not shutil.which("node") or not (ROOT / "node_modules" / "elkjs").exists(),
    reason="Node.js and elkjs (npm install) are required for layout tests",
)


@pytest.fixture()
def cfg():
    return load_config(ROOT / "diagram.config.yaml")


@pytest.fixture()
def example_spec():
    return ROOT / "spec.example.yaml"
