# Hardware GLB assets

These lightweight GLB assets are generated from the official board identities and approximate physical dimensions so the dashboard can render a self-contained circuit view without depending on an external CDN.

- `arduino-uno.glb`: Arduino Uno R3 reference: https://docs.arduino.cc/hardware/uno-rev3/
- `raspberry-pi.glb`: Raspberry Pi 4 Model B reference: https://www.raspberrypi.com/products/raspberry-pi-4-model-b/
- `sensor-pack.glb`: DEEPWAVE water-quality carrier based on the sensor wiring in `arduino/DEEPWAVE_WaterQuality.ino`

Regenerate with `npm run models:generate`.