import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

const outputDir = "public/models/hardware";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    }, (error) => this.onerror?.(error));
  }
};

function material(color, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, emissive, emissiveIntensity: emissive ? 0.3 : 0 });
}

function box(parent, name, size, position, color, emissive = 0x000000) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, emissive));
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, radius, height, position, color, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function arduinoUno() {
  const root = new THREE.Group();
  root.name = "Arduino Uno R3";
  box(root, "UNO PCB", [6.8, 0.18, 5.3], [0, 0, 0], 0x167c80);
  box(root, "USB connector", [0.8, 0.45, 1.5], [-3.35, 0.28, 1.25], 0xb9c2c7);
  box(root, "DC barrel jack", [0.7, 0.55, 1.0], [-3.35, 0.32, -1.15], 0x202830);
  box(root, "ATmega328P", [1.5, 0.25, 1.5], [0.45, 0.26, 0], 0x111827);
  box(root, "16 MHz resonator", [0.7, 0.18, 0.32], [1.8, 0.25, 0.85], 0xc6cbd0);
  box(root, "5V regulator", [0.65, 0.3, 0.38], [2.05, 0.3, -0.8], 0x17202b);
  box(root, "USB interface IC", [0.9, 0.22, 0.7], [-1.25, 0.26, 0.65], 0x17202b);
  box(root, "ICSP header", [1.4, 0.16, 0.42], [2.15, 0.27, 1.9], 0x111827);
  for (let i = 0; i < 6; i++) cylinder(root, "ICSP pin", 0.055, 0.3, [1.75 + (i % 3) * 0.3, 0.3, 1.75 + Math.floor(i / 3) * 0.3], 0xd6a84f);
  for (const [x, z, color] of [[-1.6, 1.15, 0xff3333], [-1.2, 1.15, 0x34d399], [-0.8, 1.15, 0xfbbf24]]) {
    cylinder(root, "status LED", 0.08, 0.08, [x, 0.36, z], color);
  }
  box(root, "Reset button", [0.45, 0.3, 0.45], [-1.6, 0.3, -1.7], 0xd7e3e8);
  for (let i = 0; i < 14; i++) cylinder(root, `Digital pin D${i}`, 0.06, 0.32, [-2.7 + i * 0.4, 0.28, -2.2], 0x111827);
  for (let i = 0; i < 6; i++) cylinder(root, `Analog pin A${i}`, 0.06, 0.32, [0.7 + i * 0.4, 0.28, 2.2], 0x111827);
  for (let i = 0; i < 8; i++) cylinder(root, "Power pin", 0.06, 0.32, [-2.7 + i * 0.4, 0.28, 2.2], 0x111827);
  root.userData.source = "https://docs.arduino.cc/hardware/uno-rev3/";
  return root;
}

function raspberryPi() {
  const root = new THREE.Group();
  root.name = "Raspberry Pi 4 Model B";
  box(root, "PI PCB", [7.0, 0.18, 5.2], [0, 0, 0], 0x236b45);
  box(root, "CPU heat spreader", [1.7, 0.42, 1.7], [0.1, 0.3, -0.15], 0x7d8790);
  box(root, "USB stack", [1.15, 0.7, 2.5], [-2.65, 0.45, 0.65], 0xb9c2c7);
  box(root, "HDMI", [1.0, 0.45, 0.75], [-2.65, 0.28, -1.65], 0x202830);
  box(root, "Ethernet", [1.4, 0.75, 1.2], [2.8, 0.45, 1.45], 0xb9c2c7);
  box(root, "micro SD slot", [2.0, 0.3, 0.55], [0.6, 0.3, 2.1], 0x151b22);
  box(root, "USB-C power", [0.7, 0.35, 0.65], [2.8, 0.3, -1.7], 0xb9c2c7);
  box(root, "WiFi shield", [1.8, 0.12, 0.8], [0.8, 0.25, 1.1], 0x17202b);
  box(root, "Camera connector", [1.6, 0.14, 0.35], [-0.9, 0.27, 2.2], 0xd6a84f);
  box(root, "Audio jack", [0.65, 0.5, 0.65], [2.8, 0.3, -0.8], 0x202830);
  for (let i = 0; i < 20; i++) {
    cylinder(root, "GPIO pin", 0.045, 0.36, [-2.0 + (i % 10) * 0.45, 0.28, -2.0], 0xd6a84f);
    cylinder(root, "GPIO pin", 0.045, 0.36, [-2.0 + (i % 10) * 0.45, 0.28, -1.55], 0xd6a84f);
  }
  root.userData.source = "https://www.raspberrypi.com/products/raspberry-pi-4-model-b/";
  return root;
}

function sensorPack() {
  const root = new THREE.Group();
  root.name = "Water Quality Sensor Pack";
  box(root, "Sensor carrier", [8.2, 0.16, 5.4], [0, 0, 0], 0x374151);
  const sensors = [
    ["pH probe", -2.5, 1.35, 0x22d3ee],
    ["Turbidity module", 0, 1.35, 0x34d399],
    ["TDS module", 2.5, 1.35, 0xa78bfa],
    ["Ultrasonic level", -1.25, -1.35, 0xfbbf24],
    ["Pump driver", 1.25, -1.35, 0xf87171],
  ];
  for (const [name, x, z, color] of sensors) {
    box(root, name, [1.7, 0.35, 1.25], [x, 0.3, z], color);
    cylinder(root, `${name} connector`, 0.1, 0.35, [x, 0.55, z], 0x111827);
    for (let pin = 0; pin < 4; pin++) cylinder(root, `${name} pin ${pin + 1}`, 0.045, 0.28, [x - 0.45 + pin * 0.3, 0.3, z - 0.72], 0xd6a84f);
  }
  cylinder(root, "pH probe body", 0.24, 2.2, [-2.5, 0.4, 2.15], 0xd7e3e8, [Math.PI / 2, 0, 0]);
  cylinder(root, "ultrasonic transducer A", 0.24, 0.32, [-1.55, 0.55, -2.1], 0xb9c2c7, [Math.PI / 2, 0, 0]);
  cylinder(root, "ultrasonic transducer B", 0.24, 0.32, [-0.95, 0.55, -2.1], 0xb9c2c7, [Math.PI / 2, 0, 0]);
  root.userData.source = "https://docs.arduino.cc/hardware/uno-rev3/";
  return root;
}

async function exportModel(name, scene) {
  const exporter = new GLTFExporter();
  const data = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, trs: false }));
  await writeFile(`${outputDir}/${name}.glb`, Buffer.from(data));
}

await mkdir(outputDir, { recursive: true });
await exportModel("arduino-uno", arduinoUno());
await exportModel("raspberry-pi", raspberryPi());
await exportModel("sensor-pack", sensorPack());
console.log(`Generated hardware GLBs in ${outputDir}`);
