import type { VisionProvider, VisionAnalyzeRequest, VisionAnalyzeResponse, DetectedObject, SegmentMask } from "./types";

const DEFAULT_MODEL = process.env.VISION_MODEL_GEMINI ?? "gemini-2.0-flash";

function geminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/** Build inline image part for Gemini REST API */
function inlinePart(data: string, mimeType: string) {
  return { inline_data: { mime_type: mimeType, data } };
}

export class GeminiVisionProvider implements VisionProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyze(req: VisionAnalyzeRequest): Promise<VisionAnalyzeResponse> {
    // Build image parts (all as inline base64; URL inputs are passed as-is via inline_data workaround)
    // For URLs we fetch and convert to base64 server-side to stay within Gemini inline limits
    const imageParts: unknown[] = [];
    for (const img of req.images) {
      if (img.type === "b64") {
        imageParts.push(inlinePart(img.data, img.mimeType ?? "image/jpeg"));
      } else {
        // Fetch URL and encode inline
        const fetchRes = await fetch(img.data);
        if (!fetchRes.ok) throw new Error(`Failed to fetch image URL: ${img.data}`);
        const mimeType =
          fetchRes.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
        const buffer = await fetchRes.arrayBuffer();
        const b64 = Buffer.from(buffer).toString("base64");
        imageParts.push(inlinePart(b64, mimeType));
      }
    }

    let promptText = req.prompt;
    let generationConfig: Record<string, unknown> = {};

    if (req.mode === "detect") {
      promptText +=
        "\n\nDetect all prominent objects. Return a JSON array where each item has: \"label\" (string), \"box_2d\" ([ymin, xmin, ymax, xmax] normalized to 0-1000).";
      generationConfig = { response_mime_type: "application/json" };
    } else if (req.mode === "segment") {
      promptText +=
        '\n\nSegment the objects described. Return a JSON array where each item has: "label" (string), "box_2d" ([y0, x0, y1, x1] normalized to 0-1000), "mask" (base64-encoded PNG probability map, prefixed with "data:image/png;base64,").';
      generationConfig = {
        thinking_config: { thinking_budget: 0 },
      };
    }

    const parts = [...imageParts, { text: promptText }];

    const body: Record<string, unknown> = {
      contents: [{ parts }],
    };
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    const res = await fetch(`${geminiEndpoint(DEFAULT_MODEL)}?key=${this.apiKey}`, {
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

    const data = await res.json() as {
      candidates: Array<{ content: { parts: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (req.mode === "describe") {
      return { type: "text", text };
    }

    // Parse JSON response for detect/segment
    let parsed: unknown;
    try {
      // Strip markdown fences if present
      const cleaned = text.replace(/^```json\s*/m, "").replace(/```\s*$/m, "");
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`Gemini returned non-JSON response for ${req.mode} mode: ${text.slice(0, 200)}`);
    }

    if (req.mode === "detect") {
      const items = parsed as Array<{ label?: string; box_2d?: number[] }>;
      const objects: DetectedObject[] = items.map((item) => ({
        label: item.label ?? "object",
        // Gemini: [ymin, xmin, ymax, xmax] → normalize to [x1, y1, x2, y2]
        box: [
          item.box_2d?.[1] ?? 0,
          item.box_2d?.[0] ?? 0,
          item.box_2d?.[3] ?? 0,
          item.box_2d?.[2] ?? 0,
        ] as [number, number, number, number],
      }));
      return { type: "json", data: objects };
    }

    // segment
    const items = parsed as Array<{ label?: string; box_2d?: number[]; mask?: string }>;
    const masks: SegmentMask[] = items.map((item) => ({
      label: item.label ?? "object",
      box: [
        item.box_2d?.[1] ?? 0,
        item.box_2d?.[0] ?? 0,
        item.box_2d?.[3] ?? 0,
        item.box_2d?.[2] ?? 0,
      ] as [number, number, number, number],
      mask: item.mask ?? "",
    }));
    return { type: "json", data: masks };
  }
}
