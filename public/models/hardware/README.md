# Hardware GLB assets

The Arduino Uno and Raspberry Pi GLBs are converted from the supplied STEP CAD files. The sensor carrier remains a lightweight generated model because no sensor STEP files were supplied.

- `arduino-uno-real.glb`: supplied `arduino uno.STEP`, converted with OpenCascade
- `raspberry-pi-real.glb`: supplied `Raspberry Pi 4 Model B.STEP`, converted with OpenCascade
- `sensor-pack.glb`: DEEPWAVE water-quality carrier based on the sensor wiring in `arduino/DEEPWAVE_WaterQuality.ino`

Regenerate generated references with `npm run models:generate` or convert the supplied STEP files with `npm run models:convert-step`.