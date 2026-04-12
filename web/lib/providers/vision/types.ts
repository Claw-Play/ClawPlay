export interface VisionImage {
  type: "url" | "b64";
  /** URL string or raw base64 data (no data URI prefix) */
  data: string;
  /** Required for b64 type */
  mimeType?: string;
}

export type VisionMode = "describe" | "detect" | "segment";

export interface VisionAnalyzeRequest {
  images: VisionImage[];
  prompt: string;
  mode: VisionMode;
}

/** Unified bounding box: [x1, y1, x2, y2] normalized to 0-1000 */
export interface DetectedObject {
  label: string;
  box: [number, number, number, number];
}

/** Segmentation mask item */
export interface SegmentMask {
  label: string;
  box: [number, number, number, number];
  /** base64-encoded PNG probability map */
  mask: string;
}

export type VisionAnalyzeResponse =
  | { type: "text"; text: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }
  | { type: "json"; data: DetectedObject[] | SegmentMask[]; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } };

export interface VisionProvider {
  analyze(req: VisionAnalyzeRequest): Promise<VisionAnalyzeResponse>;
}
