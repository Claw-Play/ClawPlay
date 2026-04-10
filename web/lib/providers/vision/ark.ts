import type { VisionProvider, VisionAnalyzeRequest, VisionAnalyzeResponse, DetectedObject } from "./types";
import { pickKeyWithRetry, recordKeyUsage } from "../key-pool";

const ARK_CHAT_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DEFAULT_MODEL = process.env.VISION_MODEL_ARK ?? "ep-20260408230057-cgq9s";
const PROVIDER = "ark_vision";
const MAX_RETRIES = 3;

/**
 * Parse Ark's Visual Grounding response tags into normalized DetectedObject[].
 * Ark outputs: <bbox>x1 y1 x2 y2</bbox> with coords normalized to 0-999.
 * We convert to 0-1000 range to match Gemini's coordinate space.
 *
 * NOTE: Ark docs explicitly advise against requesting JSON output for bounding boxes.
 * We parse the <bbox> tag format instead.
 */
function parseBboxTags(text: string): DetectedObject[] {
  const results: DetectedObject[] = [];
  // Match optional label before <bbox> tag: "label name<bbox>x y x y</bbox>"
  const pattern = /([^<\n]*?)\s*<bbox>\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*<\/bbox>/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const label = match[1].trim() || "object";
    // Ark coords are 0-999; scale to 0-1000 to match Gemini
    const x1 = Math.round((parseInt(match[2]) / 999) * 1000);
    const y1 = Math.round((parseInt(match[3]) / 999) * 1000);
    const x2 = Math.round((parseInt(match[4]) / 999) * 1000);
    const y2 = Math.round((parseInt(match[5]) / 999) * 1000);
    results.push({ label, box: [x1, y1, x2, y2] });
  }
  return results;
}

export class ArkVisionProvider implements VisionProvider {
  async analyze(req: VisionAnalyzeRequest): Promise<VisionAnalyzeResponse> {
    if (req.mode === "segment") {
      const err = new Error("segment mode is not supported by Ark provider. Use --provider gemini.");
      (err as NodeJS.ErrnoException).code = "MODE_NOT_SUPPORTED";
      throw err;
    }

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
          console.warn(`[ark/vision] 429 on key ${keyId}, retrying with next key...`);
          continue;
        }
        throw err;
      }
    }

    const msg = lastError?.message ?? "All Ark vision keys are rate-limited.";
    const err = new Error(msg);
    (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
    throw err;
  }

  private async callArk(apiKey: string, req: VisionAnalyzeRequest): Promise<VisionAnalyzeResponse> {
    // Build image content parts
    const imageParts = req.images.map((img) => {
      const url =
        img.type === "url"
          ? img.data
          : `data:${img.mimeType ?? "image/jpeg"};base64,${img.data}`;
      return { type: "image_url", image_url: { url } };
    });

    // For detect mode, append grounding instruction to prompt
    let promptText = req.prompt;
    if (req.mode === "detect") {
      promptText +=
        "\n\n对每个检测到的目标，输出其边界框坐标，格式为：目标名称<bbox>x1 y1 x2 y2</bbox>。坐标归一化到0-999范围，左上角为原点。";
    }

    const messages = [
      {
        role: "user",
        content: [
          ...imageParts,
          { type: "text", text: promptText },
        ],
      },
    ];

    const res = await fetch(ARK_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: DEFAULT_MODEL, messages }),
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
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.completion_tokens ?? 0,
          totalTokens: (data.usage.prompt_tokens ?? 0) + (data.usage.completion_tokens ?? 0),
        }
      : undefined;

    if (req.mode === "detect") {
      const objects = parseBboxTags(content);
      return { type: "json", data: objects, usage };
    }

    return { type: "text", text: content, usage };
  }
}
