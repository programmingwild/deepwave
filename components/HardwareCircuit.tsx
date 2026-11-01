"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { engine } from "@/lib/core/engine";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Chip, Panel } from "@/components/ui";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ASSET_ROOT = `${basePath}/models/hardware`;

function wire(from: THREE.Vector3, to: THREE.Vector3, color: number) {
  const curve = new THREE.CatmullRomCurve3([
    from,
    new THREE.Vector3((from.x + to.x) / 2, from.y + 1.8, from.z),
    new THREE.Vector3((from.x + to.x) / 2, to.y + 1.8, to.z),
    to,
  ]);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.045, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
}

export function HardwareCircuit() {
  useTelemetry();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06121e);
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100);
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbdefff, 0x07121d, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(2, 14, 8);
    scene.add(key);
    const cyanLight = new THREE.PointLight(0x22d3ee, 40, 22);
    cyanLight.position.set(0, 6, 2);
    scene.add(cyanLight);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x0b2435, roughness: 0.72, metalness: 0.1 }),
    );
    board.position.y = -0.3;
    scene.add(board);
    const boardGrid = new THREE.GridHelper(22, 22, 0x1b6680, 0x12374c);
    boardGrid.position.y = -0.1;
    boardGrid.scale.z = 10 / 22;
    scene.add(boardGrid);

    const loader = new GLTFLoader();
    const assets = new Map<string, THREE.Group>();
    const load = (name: string, position: THREE.Vector3, scale: number) => {
      loader.load(`${ASSET_ROOT}/${name}.glb`, (gltf) => {
        const model = gltf.scene;
        model.position.copy(position);
        model.scale.setScalar(scale);
        model.rotation.x = -0.08;
        scene.add(model);
        assets.set(name, model);
      });
    };
    load("raspberry-pi", new THREE.Vector3(-7, 0, 0), 0.78);
    load("arduino-uno", new THREE.Vector3(0, 0, 0), 0.78);
    load("sensor-pack", new THREE.Vector3(7, 0, 0), 0.78);

    const wires = [
      wire(new THREE.Vector3(-4.2, 0.5, 0), new THREE.Vector3(-3.4, 0.5, 0), 0x22d3ee),
      wire(new THREE.Vector3(3.4, 0.5, 0), new THREE.Vector3(4.2, 0.5, 0), 0x34d399),
      wire(new THREE.Vector3(-3.6, 0.5, -2.6), new THREE.Vector3(3.6, 0.5, -2.6), 0xfbbf24),
    ];
    wires.forEach((item) => scene.add(item));

    const beacons = [
      { position: new THREE.Vector3(-7, 1.15, 0), color: 0x22d3ee },
      { position: new THREE.Vector3(0, 1.15, 0), color: 0xfbbf24 },
      { position: new THREE.Vector3(7, 1.15, 0), color: 0x34d399 },
    ].map(({ position, color }) => {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      beacon.position.copy(position);
      scene.add(beacon);
      return beacon;
    });

    let raf = 0;
    let t = 0;
    const frame = () => {
      t += 1;
      const motion = engine.getHardwareMotion();
      const fresh = motion !== null && Date.now() - motion.ts < 3000;
      const speed = motion?.speed ?? 0;
      const pulse = fresh ? 0.75 + Math.abs(Math.sin(t * 0.08)) * 0.8 : 0.25;
      beacons.forEach((beacon, index) => {
        const material = beacon.material as THREE.MeshBasicMaterial;
        material.opacity = index === 1 ? pulse : fresh ? 0.5 + pulse * 0.35 : 0.2;
        beacon.scale.setScalar(index === 1 ? 1 + (speed / 255) * 1.2 : 1);
      });
      wires.forEach((item, index) => {
        const material = item.material as THREE.MeshBasicMaterial;
        material.opacity = fresh ? 0.48 + Math.abs(Math.sin(t * 0.06 + index)) * 0.45 : 0.2;
      });
      const orbit = t * 0.0025;
      camera.position.x = Math.sin(orbit) * 2.5;
      camera.position.y = 14.5 + Math.sin(t * 0.008) * 0.4;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      const width = container.clientWidth;
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      board.geometry.dispose();
      (board.material as THREE.Material).dispose();
      boardGrid.dispose();
      wires.forEach((item) => {
        item.geometry.dispose();
        (item.material as THREE.Material).dispose();
      });
      beacons.forEach((beacon) => {
        beacon.geometry.dispose();
        (beacon.material as THREE.Material).dispose();
      });
      assets.forEach((model) => {
        model.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        });
      });
      container.removeChild(renderer.domElement);
    };
  }, []);

  const motion = engine.getHardwareMotion();
  const linked = motion !== null && Date.now() - motion.ts < 3000;

  return (
    <Panel
      title="HARDWARE CIRCUIT — 3D NODE MAP"
      right={<Chip tone={linked ? "ok" : "default"}>{linked ? "ARDUINO STREAM LIVE" : "WAITING FOR ARDUINO"}</Chip>}
      className="h-full"
    >
      <div className="flex h-[360px] flex-col">
        <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden" style={{ touchAction: "none" }}>
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-slate-300">
            <span className="text-cyan-300">RASPBERRY PI</span>
            <span className="text-amber-300">ARDUINO UNO</span>
            <span className="text-emerald-300">SENSOR ARRAY</span>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 font-mono text-[9px] tracking-widest text-slate-500">
            USB / UART · I2C SENSOR BUS · LIVE TELEMETRY WIRES
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 z-10 font-mono text-[9px] text-slate-500">
            {linked ? `${motion?.distance.toFixed(1)} CM · PWM ${motion?.speed}` : "NO SERIAL DATA"}
          </div>
        </div>
      </div>
    </Panel>
  );
}
