# DEEPWAVE visual model training

The dashboard currently uses a small browser-side visual screener. This workflow trains a real object detector from a labeled YOLO dataset and exports an ONNX model for later edge/browser deployment.

## 1. Install the training dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r ml\requirements.txt
```

## 2. Fetch and fingerprint a dataset

The default source is the verified Hugging Face dataset `karanwxlia/Underwater-Trash-Detection-Dataset`. The command records the immutable dataset revision and license tags in `download-manifest.json`.

```powershell
npm run ml:fetch
```

You can use another source returned by the Hugging Face search, for example:

```powershell
python ml\fetch_dataset.py --dataset Francesco/underwater-objects-5v7p8 --output ml\data\underwater-objects
```

Downloaded repositories are not assumed to be YOLO-ready. Inspect the output and find its `data.yaml`. If it has COCO or another annotation format, convert it before training.

## 3. Check labels before training

```powershell
python ml\check_dataset.py --data ml\data\underwater-trash\yolo\data.local.yaml
```

The checker verifies readable images, paired YOLO label files, and class names. It does not replace visual inspection or license review.

## 4. Train and export

```powershell
python ml\train.py --data ml\data\underwater-trash\yolo\data.local.yaml --epochs 50 --device cpu
```

For a quick CPU smoke run, use `--epochs 1 --imgsz 320 --batch 32 --workers 0 --fraction 0.05`. The best checkpoint is written under `runs/detect/ml/runs/deepwave-pollution/weights/best.pt` and exported to ONNX beside it. For an NVIDIA GPU, use `--device 0`.

The installed baseline was trained with that smoke configuration. Its dataset classes are `Bio`, `Rov`, and `Trash`; it is a trash/object detector, not a chemical-pollutant classifier. Train longer and add phone-collected labels before treating its alerts as operational pollution evidence.

## 5. Connect the phone camera

1. Put the phone and computer on the same Wi-Fi network.
2. Run an Android IP-camera app that provides an MJPEG endpoint, commonly ending in `/video`.
3. Open `http://localhost:3001` (or the port shown by `npm run dev`).
4. In **LIVE UNDERWATER SURVEILLANCE**, enter the phone URL under the feed and select **IP CAM**.
5. Expand **DATASETS + MODEL INSTRUCTIONS** to review training sources and operator actions.

The current browser result is a screening aid. It reports visual proxies for murk, sheen, and debris; it does not identify a chemical pollutant. Before operational use, add labeled footage from this phone/camera and validate alerts against water-quality sensor readings. The exported ONNX model must be integrated into the browser or Raspberry Pi inference path before it replaces the screener.