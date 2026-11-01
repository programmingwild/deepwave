from __future__ import annotations

import argparse
import json
from pathlib import Path

from ultralytics import YOLO
import yaml


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and export the DEEPWAVE visual pollution detector")
    parser.add_argument("--data", required=True, help="Path to validated YOLO data.yaml")
    parser.add_argument("--model", default="yolo11n.pt", help="Ultralytics checkpoint")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--fraction", type=float, default=1.0)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--project", default="ml/runs")
    args = parser.parse_args()

    model = YOLO(args.model)
    result = model.train(
        data=str(Path(args.data).resolve()),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        device=args.device,
        project=args.project,
        name="deepwave-pollution",
        pretrained=True,
    )
    best = Path(result.save_dir) / "weights" / "best.pt"
    if not best.exists():
        raise SystemExit(f"Training finished but checkpoint was not found: {best}")
    YOLO(str(best)).export(format="onnx", imgsz=args.imgsz, simplify=True)
    config = yaml.safe_load(Path(args.data).read_text(encoding="utf-8"))
    names = config.get("names", [])
    if isinstance(names, dict):
        names = [names[key] for key in sorted(names, key=lambda value: int(value))]
    classes_file = Path("public/models/classes.json")
    classes_file.parent.mkdir(parents=True, exist_ok=True)
    classes_file.write_text(json.dumps(names, indent=2), encoding="utf-8")
    print(f"Best checkpoint: {best}")
    print(f"ONNX export: {best.with_suffix('.onnx')}")
    print(f"Class labels: {classes_file}")
    print("Do not treat detections as pollutant identification until field validation is complete.")


if __name__ == "__main__":
    main()
