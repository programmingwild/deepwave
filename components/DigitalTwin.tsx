"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { engine } from "@/lib/core/engine";
import { POLLUTION_HOTSPOTS } from "@/lib/core/engine";
import { useTelemetry } from "@/lib/hooks/useTelemetry";
import { Panel, Chip } from "@/components/ui";

/** map x/y (0..1) -> world x/z */
const WX = (u: number) => (u - 0.5) * 46;
const WZ = (v: number) => (v - 0.5) * 46;

export function DigitalTwin() {
  const state = useTelemetry();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020d1c);
    scene.fog = new THREE.Fog(0x020d1c, 40, 95);

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 200);
    camera.position.set(34, 30, 34);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // lights
    const ambient = new THREE.AmbientLight(0x274b6b, 1.2);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0x7dd3fc, 2.2);
    sun.position.set(20, 40, 15);
    scene.add(sun);
    const rim = new THREE.PointLight(0x22d3ee, 60, 80);
    rim.position.set(-18, 6, -14);
    scene.add(rim);

    // bathymetric terrain: plane with vertex noise
    const size = 56;
    const seg = 44;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    const posAttr = geo.attributes.position;
    const seed = 1234;
    const rnd = (() => {
      let s = seed;
      return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
    })();
    const heights = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      let h =
        Math.sin(x * 0.25) * 1.1 +
        Math.cos(y * 0.3) * 1.3 +
        Math.sin((x + y) * 0.18) * 0.9 +
        (rnd() - 0.5) * 0.7;
      // hotspot depressions
      for (const hs of POLLUTION_HOTSPOTS) {
        const d = Math.hypot(x - WX(hs.x), y - WZ(hs.y));
        h -= 2.4 * Math.exp(-(d * d) / 22);
      }
      heights[i] = h;
      posAttr.setZ(i, h);
    }
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x0a2a4a,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: true,
        transparent: true,
        opacity: 0.92,
      }),
    );
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    // depth-grid overlay
    const grid = new THREE.GridHelper(size, 22, 0x1e5a8a, 0x14385c);
    grid.position.y = 0.12;
    scene.add(grid);

    // hotspot markers + plume particles
    const plumes = POLLUTION_HOTSPOTS.map((hs) => {
      const pGeo = new THREE.BufferGeometry();
      const N = 90;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = WX(hs.x) + (Math.random() - 0.5) * 3.4;
        pos[i * 3 + 1] = Math.random() * 5;
        pos[i * 3 + 2] = WZ(hs.y) + (Math.random() - 0.5) * 3.4;
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0x8b3dff,
        size: 0.22,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(pGeo, mat);
      scene.add(pts);
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 3.4, 12),
        new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.55 }),
      );
      beacon.position.set(WX(hs.x), 1.7, WZ(hs.y));
      scene.add(beacon);
      return { pts, baseY: Math.random() * 1000 };
    });

    // fleet ROVs: simple hull + thruster + glow
    const rovs = new Map<string, { group: THREE.Group; thr: THREE.Mesh; light: THREE.PointLight }>();
    const FLEET = ["DW-01", "DW-02", "DW-03"] as const;
    const hullGeo = new THREE.BoxGeometry(2.2, 0.8, 1.5);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e5a75, emissiveIntensity: 0.4, roughness: 0.3 });
    const thrGeo = new THREE.BoxGeometry(0.5, 0.5, 0.7);
    for (const id of FLEET) {
      const group = new THREE.Group();
      const hull = new THREE.Mesh(hullGeo, hullMat);
      group.add(hull);
      const t1 = new THREE.Mesh(thrGeo, new THREE.MeshStandardMaterial({ color: 0x9adcf7 }));
      t1.position.set(-1.1, -0.4, 0);
      const t2 = new THREE.Mesh(thrGeo, new THREE.MeshStandardMaterial({ color: 0x9adcf7 }));
      t2.position.set(1.1, -0.4, 0);
      group.add(t1, t2);
      const light = new THREE.PointLight(0x38bdf8, 30, 14);
      light.position.set(0, 0.6, 0);
      group.add(light);
      scene.add(group);
      rovs.set(id, { group, thr: t1, light });
    }

    const hardwareGroup = new THREE.Group();
    const hardwareHull = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.65, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x7a3d08, emissiveIntensity: 0.45, roughness: 0.35 }),
    );
    const hardwareThruster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.1, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    hardwareThruster.rotation.z = Math.PI / 2;
    hardwareThruster.position.x = -1.35;
    const hardwareLight = new THREE.PointLight(0xfbbf24, 35, 14);
    hardwareLight.position.y = 0.55;
    hardwareGroup.add(hardwareHull, hardwareThruster, hardwareLight);
    hardwareGroup.visible = false;
    scene.add(hardwareGroup);

    // auto orbit + drag orbit
    let azimuth = 0.65;
    let polar = 1.02;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      azimuth += (e.clientX - lastX) * 0.005;
      polar = Math.min(1.35, Math.max(0.45, polar + (e.clientY - lastY) * 0.005));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => (dragging = false);
    container.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // resize
    const onResize = () => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let t = 0;
    const frame = () => {
      t += 1;
      if (!dragging) azimuth += 0.0014;

      // camera orbit
      const dist = 38;
      camera.position.set(
        Math.sin(azimuth) * Math.cos(polar) * dist,
        Math.sin(polar) * dist,
        Math.cos(azimuth) * Math.cos(polar) * dist,
      );
      camera.lookAt(0, 0, 0);

      // plume animation
      const p01 = engine.isSimulatingPollution() ? 1 : 0.25;
      for (let i = 0; i < plumes.length; i++) {
        const { pts, baseY } = plumes[i];
        const posAttr2 = pts.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr2.array as Float32Array;
        for (let k = 0; k < arr.length; k += 3) {
          arr[k + 1] = (arr[k + 1] + 0.01 + Math.sin(t * 0.02 + k) * 0.004) % 6;
          arr[k] += Math.sin(t * 0.01 + k * 0.7) * 0.004;
        }
        posAttr2.needsUpdate = true;
        (pts.material as THREE.PointsMaterial).opacity = 0.45 + p01 * 0.5 * Math.min(1, Math.abs(Math.sin(t * 0.05 + baseY)));
      }

      // fleet positions
      const peek = engine.peek();
      for (const id of FLEET) {
        const entry = rovs.get(id);
        if (!entry) continue;
        const r = id === peek.selectedRover ? peek.rover : peek.fleet[id].rover;
        const x = WX(r.position.x);
        const z = WZ(r.position.y);
        const h = terrainHeight(x, z);
        entry.group.position.set(x, h + 1.1, z);
        entry.group.rotation.y = (-r.heading * Math.PI) / 180;
        const manual = peek.control.active && id === peek.selectedRover;
        entry.thr.position.z = Math.abs(peek.control.throttle) > 0.05 && manual ? 0.4 : 0;
        entry.light.intensity = manual ? 40 : 22;
      }

      const hardware = engine.getHardwareMotion();
      const hardwareFresh = hardware !== null && Date.now() - hardware.ts < 3000;
      hardwareGroup.visible = hardwareFresh;
      if (hardwareFresh && hardware) {
        const depth = hardware.level !== null ? hardware.level / 100 : 0.5;
        const x = THREE.MathUtils.clamp((hardware.distance - 5) * 0.18, -8, 8);
        hardwareGroup.position.set(x, 2.2 - depth * 2.5, 10);
        hardwareGroup.rotation.y = Math.sin(t * 0.012) * 0.08;
        hardwareThruster.scale.x = 0.75 + (hardware.speed / 255) * 1.8;
        hardwareLight.intensity = 18 + (hardware.speed / 255) * 55;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    function terrainHeight(x: number, z: number): number {
      // nearest vertex approximation (grid is uniform)
      const step = size / seg;
      const ix = Math.round((x + size / 2) / step);
      const iz = Math.round((z + size / 2) / step);
      const i = Math.min(heights.length - 1, Math.max(0, ix + iz * (seg + 1)));
      return heights[i];
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geo.dispose();
      hullGeo.dispose();
      hullMat.dispose();
      thrGeo.dispose();
      hardwareHull.geometry.dispose();
      (hardwareHull.material as THREE.Material).dispose();
      hardwareThruster.geometry.dispose();
      (hardwareThruster.material as THREE.Material).dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  const sel = state.selectedRover;

  return (
    <Panel
      title="DIGITAL TWIN — 3D BATHYMETRY"
      right={
        <div className="flex items-center gap-2">
          <Chip tone="cyan">WEBGL RENDER</Chip>
          <span className="mono text-[9px] tracking-widest text-slate-500">CONTROLLING {sel}</span>
        </div>
      }
      className="h-full"
    >
      <div className="flex h-[360px] flex-col">
        <div
          ref={containerRef}
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-3 font-mono text-[10px] text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rotate-45 bg-[#22d3ee]" /> ROV FLEET
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#ff4d6d]" /> HOTSPOT BEACON
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#8b3dff]" /> PLUME
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#fbbf24]" /> ARDUINO LINK
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 font-mono text-[9px] tracking-widest text-slate-500">
            DRAG TO ORBIT · AUTO-ORBIT ACTIVE
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 font-mono text-[9px] tracking-widest text-slate-500">
            DEPTHFIELD 0–6 m · 44×44 GRID
          </div>
        </div>
      </div>
    </Panel>
  );
}