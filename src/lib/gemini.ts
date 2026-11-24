/**
 * Minimal Gemini client (REST, no SDK). Import only from server code (route
 * handlers, server actions): the API key never reaches the browser. Configure with GEMINI_API_KEY and optionally GEMINI_MODEL —
 * the free and paid tiers differ only by which key is set.
 */

const DEFAULT_MODEL = "gemini-flash-lite-latest";

export class GeminiError extends Error {
  constructor(
    message: string,
    /** "config" = no key, "quota" = rate/daily limit hit, "failed" = anything else. */
    public kind: "config" | "quota" | "failed",
  ) {
    super(message);
  }
}

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Sends one image plus instructions and returns the parsed JSON reply, shaped
 * by `schema` (Gemini's OpenAPI-style response schema). Validate the result
 * yourself; the model can still return nonsense values.
 */
export async function geminiImageJson({
  prompt,
  image,
  schema,
}: {
  prompt: string;
  image: { mimeType: string; base64: string };
  schema: Record<string, unknown>;
}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set.", "config");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }, { text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
  } catch {
    throw new GeminiError("Couldn't reach Gemini.", "failed");
  }

  if (res.status === 429) throw new GeminiError("Gemini's daily limit is used up.", "quota");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Gemini ${res.status}: ${body.slice(0, 500)}`);
    throw new GeminiError(`Gemini returned ${res.status}.`, "failed");
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini's reply wasn't valid JSON.", "failed");
  }
}

// Per-user daily cap, in memory (one app instance, two users). Protects the
// shared free quota from a stuck retry loop more than from people.
const usage = new Map<string, number>();
export function takeDailyAllowance(userId: string, limit: number): boolean {
  const k = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  const n = usage.get(k) ?? 0;
  if (n >= limit) return false;
  if (usage.size > 1000) usage.clear();
  usage.set(k, n + 1);
  return true;
}
