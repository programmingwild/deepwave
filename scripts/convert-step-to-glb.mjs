import fs from "node:fs";
import path from "node:path";
import occtimportjs from "occt-import-js";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const outputDir = path.resolve("public/models/hardware");
const inputs = [
  {
    source: process.argv[2] ?? "C:/Users/Janardhanan/Downloads/arduino uno.STEP",
    output: "arduino-uno-real.glb",
    name: "Arduino Uno R3 - supplied STEP CAD",
  },
  {
    source: process.argv[3] ?? "C:/Users/Janardhanan/Downloads/Raspberry Pi 4 Model B.STEP",
    output: "raspberry-pi-real.glb",
    name: "Raspberry Pi 4 Model B - supplied STEP CAD",
  },
];

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    }, (error) => this.onerror?.(error));
  }
};

function colorValue(color) {
  if (!Array.isArray(color) || color.length < 3) return 0x7d8790;
  return (Math.round(color[0] * 255) << 16) | (Math.round(color[1] * 255) << 8) | Math.round(color[2] * 255);
}

function meshFromStep(mesh, index) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(mesh.attributes.position.array);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (mesh.attributes.normal?.array) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(mesh.index.array);
  geometry.computeBoundingSphere();
  const object = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: colorValue(mesh.color), roughness: 0.48, metalness: 0.18 }),
  );
  object.name = mesh.name || `STEP component ${index + 1}`;
  return object;
}

async function convert(occt, input) {
  if (!fs.existsSync(input.source)) throw new Error(`Missing STEP file: ${input.source}`);
  const content = fs.readFileSync(input.source);
  const result = occt.ReadStepFile(new Uint8Array(content), {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.001,
    angularDeflection: 0.15,
  });
  if (!result.success) throw new Error(`OpenCascade could not read ${input.source}`);
  const scene = new THREE.Group();
  scene.name = input.name;
  result.meshes.forEach((mesh, index) => scene.add(meshFromStep(mesh, index)));
  const exporter = new GLTFExporter();
  const data = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, trs: false }));
  const outputPath = path.join(outputDir, input.output);
  fs.writeFileSync(outputPath, Buffer.from(data));
  console.log(`${input.name}: ${result.meshes.length} meshes -> ${outputPath} (${Math.round(data.byteLength / 1024)} KB)`);
}

fs.mkdirSync(outputDir, { recursive: true });
const occt = await occtimportjs();
for (const input of inputs) await convert(occt, input);
