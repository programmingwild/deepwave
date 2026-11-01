export type VisualRisk = "CLEAR" | "WATCH" | "SUSPECTED_EVENT";

export interface VisionAssessment {
  risk: VisualRisk;
  probability: number;
  confidence: number;
  turbidity: number;
  sheen: number;
  debris: number;
  evidence: string[];
  instruction: string;
}

export interface DatasetSource {
  name: string;
  purpose: string;
  url: string;
  use: string;
}

/**
 * Public starting points for training a real model. These are references only;
 * images still need licensing, labeling, and domain validation before use.
 */
export const DATASET_SOURCES: DatasetSource[] = [
  {
    name: "Underwater Trash Detection",
    purpose: "Custom underwater trash object detection",
    url: "https://huggingface.co/datasets/karanwxlia/Underwater-Trash-Detection-Dataset",
    use: "Primary debris detector training",
  },
  {
    name: "Underwater Objects",
    purpose: "Underwater object detection",
    url: "https://huggingface.co/datasets/Francesco/underwater-objects-5v7p8",
    use: "Add varied underwater objects",
  },
  {
    name: "Underwater Image Enhancement",
    purpose: "Image enhancement training data",
    url: "https://huggingface.co/datasets/iamvastava/underwater_image_enhancement",
    use: "Improve visibility before inference",
  },
  {
    name: "NASA Marine Debris TACO",
    purpose: "Marine debris object detection",
    url: "https://huggingface.co/datasets/isp-uv-es/nasa-marine-debris-taco",
    use: "Add debris classes after license review",
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Lightweight browser-side screening model. It uses color/contrast proxies so
 * an IP camera works without shipping a large ML model; it cannot identify a
 * pollutant and should be replaced by a trained model on labeled field data.
 */
export function assessVisualFrame(imageData: ImageData): VisionAssessment {
  const { data, width, height } = imageData;
  const step = 8;
  let samples = 0;
  let bright = 0;
  let saturated = 0;
  let murky = 0;
  let debris = 0;
  let sheen = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const spread = max - min;
      const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
      samples += 1;
      if (luminance > 0.78) bright += 1;
      if (spread > 0.28) saturated += 1;
      if (luminance > 0.18 && luminance < 0.48 && g > r * 0.9 && g > b * 0.82) murky += 1;
      if (spread > 0.18 && luminance > 0.52 && r > b * 1.18) debris += 1;
      if (luminance > 0.72 && spread > 0.12 && b > r * 0.9) sheen += 1;
    }
  }

  const ratio = (value: number) => (samples ? value / samples : 0);
  const turbidity = clamp(ratio(murky) * 170 + ratio(saturated) * 35, 0, 100);
  const debrisScore = clamp(ratio(debris) * 240, 0, 100);
  const sheenScore = clamp(ratio(sheen) * 190, 0, 100);
  const probability = Math.round(clamp(turbidity * 0.48 + sheenScore * 0.32 + debrisScore * 0.2, 0, 99));
  const evidence: string[] = [];

  if (turbidity > 38) evidence.push("elevated murky/particulate color pattern");
  if (sheenScore > 34) evidence.push("bright chromatic surface-sheen proxy");
  if (debrisScore > 30) evidence.push("possible floating debris pattern");

  const risk: VisualRisk = probability >= 62 ? "SUSPECTED_EVENT" : probability >= 32 ? "WATCH" : "CLEAR";
  const instruction = risk === "SUSPECTED_EVENT"
    ? "Mark location, keep recording, increase water sampling, and confirm with sensors before escalation."
    : risk === "WATCH"
      ? "Keep the frame stable, collect a 30-second clip, and compare visual evidence with water-quality trends."
      : "Continue routine survey and keep the camera pointed into the sampling area.";

  return {
    risk,
    probability,
    confidence: Math.round(clamp(42 + evidence.length * 14, 42, 84)),
    turbidity: Math.round(turbidity),
    sheen: Math.round(sheenScore),
    debris: Math.round(debrisScore),
    evidence: evidence.length ? evidence : ["no strong visual pollution proxy detected"],
    instruction,
  };
}