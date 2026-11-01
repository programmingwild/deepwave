import type { Detection } from "@/lib/types";

type OrtModule = typeof import("onnxruntime-web");

declare global {
  interface Window {
    ort?: OrtModule;
  }
}

export interface OnnxDetector {
  detect(imageData: ImageData): Promise<Detection[]>;
}

const MODEL_SIZE = 320;
const DEFAULT_LABELS = ["pollution", "debris", "oil_sheen", "plastic", "other"];

async function loadOrt(): Promise<OrtModule> {
  if (typeof window === "undefined") throw new Error("ONNX Runtime requires a browser");
  if (window.ort) return window.ort;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-deepwave-ort]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("ONNX Runtime failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.deepwaveOrt = "true";
    script.src = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("ONNX Runtime failed to load"));
    document.head.appendChild(script);
  });
  if (!window.ort) throw new Error("ONNX Runtime global was not created");
  return window.ort;
}

function iou(a: Detection, b: Detection): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.w * a.h + b.w * b.h - intersection;
  return union > 0 ? intersection / union : 0;
}

function suppress(detections: Detection[]): Detection[] {
  const result: Detection[] = [];
  for (const detection of [...detections].sort((a, b) => b.conf - a.conf)) {
    if (result.some((kept) => kept.label === detection.label && iou(kept, detection) > 0.45)) continue;
    result.push(detection);
  }
  return result.slice(0, 30);
}

export async function createOnnxDetector(
  modelUrl = "/models/deepwave-pollution.onnx",
  labels = DEFAULT_LABELS,
): Promise<OnnxDetector> {
  const ort = await loadOrt();
  let activeLabels = labels;
  try {
    const response = await fetch("/models/classes.json", { cache: "no-store" });
    if (response.ok) {
      const configured = await response.json();
      if (Array.isArray(configured) && configured.every((label) => typeof label === "string")) {
        activeLabels = configured;
      }
    }
  } catch {
    // Default labels keep the detector usable before a trained class file is copied.
  }
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  return {
    async detect(imageData) {
      const input = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
      for (let y = 0; y < MODEL_SIZE; y += 1) {
        for (let x = 0; x < MODEL_SIZE; x += 1) {
          const sourceX = Math.min(imageData.width - 1, Math.floor((x / MODEL_SIZE) * imageData.width));
          const sourceY = Math.min(imageData.height - 1, Math.floor((y / MODEL_SIZE) * imageData.height));
          const source = (sourceY * imageData.width + sourceX) * 4;
          const offset = y * MODEL_SIZE + x;
          input[offset] = imageData.data[source] / 255;
          input[MODEL_SIZE * MODEL_SIZE + offset] = imageData.data[source + 1] / 255;
          input[2 * MODEL_SIZE * MODEL_SIZE + offset] = imageData.data[source + 2] / 255;
        }
      }

      const tensor = new ort.Tensor("float32", input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
      const output = await session.run({ [inputName]: tensor });
      const result = output[outputName];
      const dims = result.dims.map(Number);
      const values = result.data as Float32Array;
      const channelFirst = dims.length === 3 && dims[1] < dims[2];
      const channels = dims.length === 3 ? (channelFirst ? dims[1] : dims[2]) : 0;
      const count = dims.length === 3 ? (channelFirst ? dims[2] : dims[1]) : 0;
      if (channels < 5 || count === 0) return [];

      const detections: Detection[] = [];
      for (let index = 0; index < count; index += 1) {
        const read = (channel: number) => channelFirst
          ? values[channel * count + index]
          : values[index * channels + channel];
        const x = read(0) / MODEL_SIZE;
        const y = read(1) / MODEL_SIZE;
        const w = read(2) / MODEL_SIZE;
        const h = read(3) / MODEL_SIZE;
        let bestClass = 0;
        let bestScore = 0;
        const hasObjectness = channels === activeLabels.length + 5;
        const objectness = hasObjectness ? read(4) : 1;
        const firstClass = hasObjectness ? 5 : 4;
        for (let classIndex = 0; classIndex < channels - firstClass; classIndex += 1) {
          const score = objectness * read(firstClass + classIndex);
          if (score > bestScore) {
            bestScore = score;
            bestClass = classIndex;
          }
        }
        if (bestScore < 0.35 || w <= 0 || h <= 0) continue;
        detections.push({
          label: (activeLabels[bestClass] ?? `CLASS_${bestClass}`).toUpperCase(),
          x: Math.max(0, x - w / 2),
          y: Math.max(0, y - h / 2),
          w: Math.min(1, w),
          h: Math.min(1, h),
          conf: Math.round(bestScore * 100),
        });
      }
      return suppress(detections);
    },
  };
}
