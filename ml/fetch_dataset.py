from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import HfApi, snapshot_download


DEFAULT_DATASET = "karanwxlia/Underwater-Trash-Detection-Dataset"


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and fingerprint an underwater vision dataset")
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--output", default="ml/data/underwater-trash")
    args = parser.parse_args()

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    info = HfApi().dataset_info(args.dataset)
    local = Path(snapshot_download(repo_id=args.dataset, repo_type="dataset", local_dir=output))
    manifest = {
        "dataset": args.dataset,
        "revision": info.sha,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "license_tags": [tag for tag in info.tags if tag.startswith("license:")],
        "source": f"https://huggingface.co/datasets/{args.dataset}",
        "local_path": str(local),
    }
    (output / "download-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    print("Next: locate the dataset data.yaml, then run check_dataset.py and train.py.")


if __name__ == "__main__":
    main()
