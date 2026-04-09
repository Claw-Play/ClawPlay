import type { ImageProvider, ImageGenerateRequest, ImageGenerateResponse } from "./types";
import { pickKeyWithRetry, recordKeyUsage } from "../key-pool";

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const DEFAULT_MODEL = process.env.IMAGE_MODEL_ARK ?? "ep-20260307174559-w6lfl";
const PROVIDER = "ark_image";
const MAX_RETRIES = 3;

/**
 * Map aspect ratio + quality tier to Ark `size` pixel string.
 * Seedream-5.0-lite supports 2K (min) to 3K (max).
 * We normalize "1K" → 2K and "4K" → 3K to fit the model's range.
 */
function toArkSize(ratio: string, quality: string): string {
  const tier = quality === "4K" ? "3K" : "2K"; // 5.0-lite max is 3K

  const sizeMap: Record<string, Record<string, string>> = {
    "2K": {
      "1:1":  "2048x2048",
      "16:9": "2848x1600",
      "9:16": "1600x2848",
      "4:3":  "2304x1728",
      "3:4":  "1728x2304",
      "3:2":  "2496x1664",
      "2:3":  "1664x2496",
      "21:9": "3136x1344",
    },
    "3K": {
      "1:1":  "3072x3072",
      "16:9": "4096x2304",
      "9:16": "2304x4096",
      "4:3":  "3456x2592",
      "3:4":  "2592x3456",
      "3:2":  "3744x2496",
      "2:3":  "2496x3744",
      "21:9": "4704x2016",
    },
  };

  return sizeMap[tier]?.[ratio] ?? sizeMap["2K"]["1:1"];
}

export class ArkProvider implements ImageProvider {
  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { id: keyId, key: apiKey } = await pickKeyWithRetry(PROVIDER);

      try {
        const result = await this.callArk(apiKey, req);
        await recordKeyUsage(PROVIDER, keyId);
        return result;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "PROVIDER_RATE_LIMITED") {
          lastError = err as Error;
          console.warn(`[ark/image] 429 on key ${keyId}, retrying with next key...`);
          continue;
        }
        throw err;
      }
    }

    // All keys exhausted
    const msg = lastError?.message ?? "All Ark image keys are rate-limited.";
    const err = new Error(msg);
    (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
    throw err;
  }

  private async callArk(apiKey: string, req: ImageGenerateRequest): Promise<ImageGenerateResponse> {
    const size = toArkSize(req.size ?? "1:1", req.quality ?? "2K");

    const body: Record<string, unknown> = {
      model: DEFAULT_MODEL,
      prompt: req.prompt,
      size,
      output_format: "png",
      watermark: false,
      response_format: "url",
    };

    if (req.refImages && req.refImages.length > 0) {
      const images = req.refImages.slice(0, 14);
      body.image = images.length === 1 ? images[0] : images;
    }

    if (req.webSearch) {
      body.tools = [{ type: "web_search" }];
    }

    const res = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        const err = new Error("Provider rate limit exceeded. Please retry shortly.");
        (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
        throw err;
      }
      throw new Error(`Ark API error ${res.status}: ${text}`);
    }

    const data = await res.json() as {
      data: Array<{ url?: string; b64_json?: string }>;
      usage?: { generated_images?: number; output_tokens?: number; total_tokens?: number };
    };
    const item = data.data?.[0];

    const usage = data.usage
      ? {
          generatedImages: data.usage.generated_images ?? 1,
          outputTokens: data.usage.output_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;

    if (item?.url) {
      return { type: "url", url: item.url, usage };
    }
    if (item?.b64_json) {
      return { type: "b64", b64: item.b64_json, mimeType: "image/png", usage };
    }

    throw new Error("Ark API returned no image data.");
  }
}
