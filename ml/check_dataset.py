from __future__ import annotations

import argparse
from pathlib import Path

import yaml
from PIL import Image


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def resolve_split(root: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


def check_split(root: Path, value: str) -> tuple[int, int, list[str]]:
    image_dir = resolve_split(root, value)
    label_dir = Path(str(image_dir).replace("/images", "/labels").replace("\\images", "\\labels"))
    images = [path for path in image_dir.rglob("*") if path.suffix.lower() in IMAGE_EXTENSIONS]
    missing: list[str] = []
    valid = 0
    for image in images:
        try:
            with Image.open(image) as handle:
                handle.verify()
        except Exception as error:
            missing.append(f"invalid image {image}: {error}")
            continue
        label = label_dir / f"{image.stem}.txt"
        if not label.exists():
            missing.append(f"missing label {label}")
        else:
            valid += 1
    return len(images), valid, missing


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a YOLO detection dataset")
    parser.add_argument("--data", required=True, help="Path to YOLO data.yaml")
    args = parser.parse_args()

    data_file = Path(args.data).resolve()
    config = yaml.safe_load(data_file.read_text(encoding="utf-8"))
    root = Path(config.get("path", data_file.parent))
    if not root.is_absolute():
        root = (data_file.parent / root).resolve()

    total_images = 0
    total_valid = 0
    errors: list[str] = []
    for split in ("train", "val", "test"):
        if not config.get(split):
            continue
        images, valid, split_errors = check_split(root, config[split])
        total_images += images
        total_valid += valid
        errors.extend(split_errors[:20])
        print(f"{split}: images={images} paired_labels={valid}")

    names = config.get("names", [])
    if not names:
        errors.append("data.yaml has no class names")
    print(f"classes={len(names)} total_images={total_images} paired_labels={total_valid}")
    if errors:
        print("CHECK FAILED")
        print("\n".join(errors))
        raise SystemExit(1)
    if total_images == 0:
        raise SystemExit("CHECK FAILED: no images found")
    print("CHECK PASSED")


if __name__ == "__main__":
    main()
