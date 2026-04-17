import type { ImageProvider, ImageGenerateRequest, ImageGenerateResponse } from "./types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.IMAGE_MODEL_GEMINI ?? "gemini-3.1-flash-image-preview";

/** Gemini supports a fixed set of aspect ratio strings. Pass through as-is. */
const VALID_ASPECT_RATIOS = new Set([
  "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3",
  "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
]);

/** Gemini image sizes: "512" | "1K" | "2K" | "4K" */
function toGeminiSize(quality: string): string {
  if (quality === "4K") return "4K";
  if (quality === "2K") return "2K";
  return "1K"; // default
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  thought?: boolean;
  thoughtSignature?: string;
}

interface GeminiResponse {
  candidates: Array<{
    content: { parts: GeminiPart[] };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiProvider implements ImageProvider {
  private apiKey: string;
  private endpoint: string;
  private modelName: string;

  constructor(apiKey: string, endpoint?: string, modelName?: string) {
    this.apiKey = apiKey;
    this.endpoint = endpoint ?? GEMINI_BASE;
    this.modelName = modelName ?? DEFAULT_MODEL;
  }

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResponse> {
    const aspectRatio = VALID_ASPECT_RATIOS.has(req.size ?? "1:1")
      ? req.size
      : "1:1";

    const parts: object[] = [{ text: req.prompt }];

    if (req.refImages && req.refImages.length > 0) {
      for (const img of req.refImages.slice(0, 14)) {
        // Accept "data:image/png;base64,..." or plain base64
        const match = img.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        } else {
          parts.push({ inlineData: { mimeType: "image/png", data: img } });
        }
      }
    }

    const tools = req.webSearch ? [{ googleSearch: {} }] : undefined;

    const body: Record<string, unknown> = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio,
          imageSize: toGeminiSize(req.quality ?? "1K"),
        },
      },
      ...(tools ? { tools } : {}),
    };

    const res = await fetch(`${this.endpoint}/${this.modelName}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        const err = new Error("Provider rate limit exceeded. Please retry shortly.");
        (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
        throw err;
      }
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const data = await res.json() as GeminiResponse;
    const parts2 = data.candidates?.[0]?.content?.parts ?? [];

    const usage = data.usageMetadata
      ? {
          generatedImages: 1,
          outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined;

    // Skip thought parts, find the first inline image
    for (const part of parts2) {
      if (part.thought) continue;
      if (part.inlineData?.data) {
        return {
          type: "b64",
          b64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/png",
          usage,
        };
      }
    }

    throw new Error("Gemini API returned no image data.");
  }
}
