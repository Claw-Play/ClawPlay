import type { LLMProvider, LLMGenerateRequest, LLMGenerateResult } from "./types";

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DEFAULT_MODEL = process.env.LLM_MODEL_ARK ?? "ep-20260408230057-cgq9s";

export class ArkProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const model = req.model ?? DEFAULT_MODEL;

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: req.prompt }],
    };

    if (req.maxTokens != null) {
      body.max_tokens = req.maxTokens;
    }
    if (req.temperature != null) {
      body.temperature = req.temperature;
    }

    const res = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? "";

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      text,
      model: data.model ?? model,
      usage:
        data.usage
          ? { inputTokens, outputTokens, totalTokens: data.usage.total_tokens ?? 0 }
          : undefined,
    };
  }
}
