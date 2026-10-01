import { ApiError, GoogleGenAI } from "@google/genai";

// Accepts multiple keys so a per-minute quota hit on one project can fail
// over to another instead of failing the request - GEMINI_API_KEYS is a
// comma (or newline) separated list; GEMINI_API_KEY/GOOGLE_API_KEY still
// work as a single-key fallback for anyone who hasn't switched over.
function loadApiKeys(): string[] {
  const list = process.env.GEMINI_API_KEYS;
  const keys = list
    ? list
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter(Boolean)
    : [process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY].filter(
        (k): k is string => Boolean(k)
      );

  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEYS (or GEMINI_API_KEY / GOOGLE_API_KEY) is not set");
  }
  return keys;
}

// Constructed lazily so a missing API key only breaks the first call that
// needs it, not the whole server. One client per key, in the order keys were
// listed - that order is also the failover order.
let clients: GoogleGenAI[] | null = null;

function getClients(): GoogleGenAI[] {
  if (!clients) {
    clients = loadApiKeys().map(
      (apiKey) =>
        new GoogleGenAI({
          vertexai: false,
          apiKey,
          httpOptions: {
            timeout: 120_000,
            retryOptions: {
              // 429 is deliberately NOT in this list: a per-minute quota hit
              // doesn't clear in the few seconds a backoff retry would wait,
              // so retrying it here would just waste time on the same
              // exhausted key before withKeyRotation below ever gets a
              // chance to move on to the next one. 500/502/503/504/408 are
              // genuinely transient - worth a few retries on the same key.
              attempts: 5,
              initialDelay: 1,
              maxDelay: 20,
              httpStatusCodes: [408, 500, 502, 503, 504],
            },
          },
        })
    );
  }
  return clients;
}

async function withKeyRotation<T>(call: (client: GoogleGenAI) => Promise<T>): Promise<T> {
  const clientList = getClients();
  for (let i = 0; i < clientList.length; i++) {
    try {
      return await call(clientList[i]);
    } catch (err) {
      const isRateLimit = err instanceof ApiError && err.status === 429;
      const isLastKey = i === clientList.length - 1;
      if (!isRateLimit || isLastKey) {
        throw err;
      }
      console.error(`Gemini key #${i + 1} is rate-limited, failing over to key #${i + 2}`);
    }
  }
  // Unreachable - the loop above always either returns or throws - but
  // satisfies the compiler's control-flow analysis.
  throw new Error("No Gemini API keys configured");
}

type GenerateContentParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
type EmbedContentParams = Parameters<GoogleGenAI["models"]["embedContent"]>[0];

export function generateContent(params: GenerateContentParams) {
  return withKeyRotation((client) => client.models.generateContent(params));
}

export function embedContent(params: EmbedContentParams) {
  return withKeyRotation((client) => client.models.embedContent(params));
}
