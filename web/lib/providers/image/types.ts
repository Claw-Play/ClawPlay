export interface ImageGenerateRequest {
  prompt: string;
  /** Aspect ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9" */
  size?: string;
  /** Resolution tier: "1K" | "2K" | "4K" */
  quality?: string;
  /**
   * Reference images as base64 strings in data URI format:
   * "data:image/png;base64,..." or plain base64.
   * Maximum 14 images.
   */
  refImages?: string[];
  /** Enable web search grounding */
  webSearch?: boolean;
}

export type ImageGenerateResponse =
  | { type: "url"; url: string }
  | { type: "b64"; b64: string; mimeType: string };

export interface ImageProvider {
  generate(req: ImageGenerateRequest): Promise<ImageGenerateResponse>;
}
