import type { LLMProvider, LLMGenerateRequest, LLMGenerateResult } from "./types";
import { pickKeyWithRetry, recordKeyUsage } from "../key-pool";

const ARK_ENDPOINT_DEFAULT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DEFAULT_MODEL = process.env.LLM_MODEL_ARK ?? "ep-20260408230057-cgq9s";
const MAX_RETRIES = 3;

export class ArkProvider implements LLMProvider {
  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { id: keyId, key: apiKey, endpoint, modelName } =
        await pickKeyWithRetry("ark", "llm");

      const resolvedEndpoint = endpoint || ARK_ENDPOINT_DEFAULT;
      const resolvedModel = modelName || DEFAULT_MODEL;

      try {
        const result = await this.callArk(apiKey, resolvedEndpoint, resolvedModel, req);
        await recordKeyUsage("ark", "llm", keyId);
        return result;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "PROVIDER_RATE_LIMITED") {
          lastError = err as Error;
          console.warn(`[ark/llm] 429 on key ${keyId}, retrying with next key...`);
          continue;
        }
        throw err;
      }
    }

    const msg = lastError?.message ?? "All Ark LLM keys are rate-limited.";
    const err = new Error(msg);
    (err as NodeJS.ErrnoException).code = "PROVIDER_RATE_LIMITED";
    throw err;
  }

  private async callArk(
    apiKey: string,
    endpoint: string,
    model: string,
    req: LLMGenerateRequest
  ): Promise<LLMGenerateResult> {
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

    const res = await fetch(endpoint, {
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
