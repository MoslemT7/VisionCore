import yaml
from pathlib import Path
from typing import Dict


def load_config(config_path: str) -> Dict:
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_config_path(filename: str) -> str:
    base = Path(__file__).parent.parent.parent
    return str(base / "config" / filename)

