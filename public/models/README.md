Place the trained ONNX detector here with this exact filename:

`deepwave-pollution.onnx`

After training:

1. Copy `ml/runs/deepwave-pollution/weights/best.onnx` to this folder.
2. Copy `public/models/classes.json` here, or let `ml/train.py` create it.
3. Restart `npm run dev` if the model was copied after the page loaded.
4. Connect the phone IP camera in the dashboard.
5. Check the camera panel for `PC ONNX: READY` and red ONNX detection boxes.

The browser runs ONNX Runtime Web using the PC CPU through WebAssembly. The phone only supplies the video frames. If the file is absent or invalid, the panel shows `PC ONNX: UNAVAILABLE` and retains the explainable visual screener.
