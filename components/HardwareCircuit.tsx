"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { engine } from "@/lib/core/engine";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Chip, Panel } from "@/components/ui";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ASSET_ROOT = `${basePath}/models/hardware`;
const WORKFLOW = ["SENSORS", "ARDUINO", "USB", "PI / PYTHON", "EDGE MODEL", "DECISION", "DASH"];
const CONNECTIONS = [
  { signal: "pH probe", source: "A0", target: "pH AO", color: 0x22d3ee },
  { signal: "Turbidity", source: "A1", target: "TURB AO", color: 0x34d399 },
  { signal: "TDS", source: "A2", target: "TDS AO", color: 0xa78bfa },
  { signal: "Ultrasonic trigger", source: "D9", target: "TRIG", color: 0xfbbf24 },
  { signal: "Ultrasonic echo", source: "D10", target: "ECHO", color: 0xfb923c },
  { signal: "Pump PWM", source: "D5 / PWM", target: "ENA", color: 0xf87171 },
  { signal: "Serial telemetry", source: "USB", target: "PI UART", color: 0x60a5fa },
];

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

function pinMarker(position: THREE.Vector3, color: number) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  marker.position.copy(position);
  return marker;
}

export function HardwareCircuit() {
  useTelemetry();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06121e);
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100);
    camera.position.set(0, 18, 17);
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

    const breadboard = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.28, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xdbe7e9, roughness: 0.8, metalness: 0.05 }),
    );
    breadboard.position.set(0, 0.08, 4.0);
    scene.add(breadboard);
    const breadboardRail = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.04, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 }),
    );
    breadboardRail.position.set(0, 0.24, 3.35);
    scene.add(breadboardRail);
    const breadboardHoles: THREE.Mesh[] = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 25; column++) {
        const hole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8),
          new THREE.MeshBasicMaterial({ color: 0x334155 }),
        );
        hole.rotation.x = Math.PI / 2;
        hole.position.set(-3.8 + column * 0.32, 0.24, 3.55 + row * 0.28);
        scene.add(hole);
        breadboardHoles.push(hole);
      }
    }

    const loader = new GLTFLoader();
    const assets = new Map<string, THREE.Group>();
    const load = (name: string, position: THREE.Vector3, scale: number) => {
      loader.load(`${ASSET_ROOT}/${name}.glb`, (gltf) => {
        const model = gltf.scene;
        model.position.copy(position);
        model.scale.setScalar(scale);
        scene.add(model);
        assets.set(name, model);
      });
    };
    // Supplied STEP files are converted to millimetre GLBs; these scales keep
    // their real proportions while fitting the circuit board layout.
    load("raspberry-pi-real", new THREE.Vector3(-7, 0, 0), 0.12);
    load("arduino-uno-real", new THREE.Vector3(0, 0, 0), 0.1);
    load("sensor-pack", new THREE.Vector3(7, 0, 0), 0.78);

    const wirePoints: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(1.0, 0.55, 2.2), new THREE.Vector3(4.6, 0.6, 1.6)],
      [new THREE.Vector3(1.4, 0.55, 2.2), new THREE.Vector3(6.6, 0.6, 1.6)],
      [new THREE.Vector3(1.8, 0.55, 2.2), new THREE.Vector3(8.6, 0.6, 1.6)],
      [new THREE.Vector3(-1.0, 0.55, -2.2), new THREE.Vector3(5.8, 0.6, -1.6)],
      [new THREE.Vector3(-0.6, 0.55, -2.2), new THREE.Vector3(7.0, 0.6, -1.6)],
      [new THREE.Vector3(-0.2, 0.55, -2.2), new THREE.Vector3(8.2, 0.6, -1.6)],
      [new THREE.Vector3(-3.6, 0.6, 0), new THREE.Vector3(-4.4, 0.6, 0)],
    ];
    const wires = wirePoints.map(([from, to], index) => {
      const item = wire(from, to, CONNECTIONS[index].color);
      scene.add(item);
      return item;
    });
    const markers = wirePoints.flatMap(([from, to], index) => {
      const pair = [pinMarker(from, CONNECTIONS[index].color), pinMarker(to, CONNECTIONS[index].color)];
      pair.forEach((marker) => scene.add(marker));
      return pair;
    });

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
      breadboard.geometry.dispose();
      (breadboard.material as THREE.Material).dispose();
      breadboardRail.geometry.dispose();
      (breadboardRail.material as THREE.Material).dispose();
      breadboardHoles.forEach((hole) => {
        hole.geometry.dispose();
        (hole.material as THREE.Material).dispose();
      });
      board.geometry.dispose();
      (board.material as THREE.Material).dispose();
      boardGrid.dispose();
      wires.forEach((item) => {
        item.geometry.dispose();
        (item.material as THREE.Material).dispose();
      });
      markers.forEach((marker) => {
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
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
  const activeStage = linked ? Math.floor(Date.now() / 850) % WORKFLOW.length : -1;

  return (
    <Panel
      title="HARDWARE CIRCUIT — 3D NODE MAP"
      right={<Chip tone={linked ? "ok" : "default"}>{linked ? "ARDUINO STREAM LIVE" : "WAITING FOR ARDUINO"}</Chip>}
      className="h-full"
    >
      <div className="flex h-[520px] flex-col">
        <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden" style={{ touchAction: "none" }}>
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-slate-300">
            <span className="text-cyan-300">RASPBERRY PI</span>
            <span className="text-amber-300">ARDUINO UNO</span>
            <span className="text-emerald-300">SENSOR ARRAY</span>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[58%] truncate bg-[#06121e]/80 pr-1 font-mono text-[9px] tracking-widest text-slate-500">
            BREADBOARD BUS · PIN-TO-PIN SIGNALS · LIVE TELEMETRY WIRES
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 z-10 bg-[#06121e]/80 pl-1 font-mono text-[9px] text-slate-300">
            {linked ? `${motion?.distance.toFixed(1)} CM · PWM ${motion?.speed}` : "NO SERIAL DATA"}
          </div>
        </div>
        <div className="border-t border-[var(--line)] bg-black/20 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="section-label">TELEMETRY WORKFLOW</span>
            <span className="mono text-[9px] text-slate-500">{linked ? "PACKET FLOW ACTIVE" : "SIMULATION STANDBY"}</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {WORKFLOW.map((stage, index) => (
              <div key={stage} className="flex shrink-0 items-center gap-1">
                <span
                  className={`border px-1.5 py-1 font-mono text-[8px] tracking-wider transition-all duration-300 ${
                    activeStage === index
                      ? "border-cyan-300/70 bg-cyan-300/20 text-cyan-200 shadow-glow"
                      : activeStage > index
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                        : "border-[var(--line)] bg-black/20 text-slate-500"
                  }`}
                >
                  {stage}
                </span>
                {index < WORKFLOW.length - 1 && <span className="font-mono text-[10px] text-cyan-400/50">→</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--line)] bg-black/25 px-3 py-2 sm:grid-cols-4">
          {CONNECTIONS.map((connection) => (
            <div key={connection.signal} className="min-w-0 font-mono text-[8px] leading-tight">
              <div className="truncate text-slate-400">{connection.signal}</div>
              <div className="truncate" style={{ color: `#${connection.color.toString(16).padStart(6, "0")}` }}>
                {connection.target} → {connection.source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
