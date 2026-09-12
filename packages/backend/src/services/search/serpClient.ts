import { MissingApiKeyError, getJson } from "serpapi";

// Narrowed view of a SerpApi Google organic result - only the fields Module 3
// is allowed to keep. Per CLAUDE.md's copyright/compliance constraint, no raw
// article body is ever fetched or stored - callers must not persist anything
// beyond these fields plus an AI-written paraphrase.
export interface SerpOrganicResult {
  title: string;
  link: string;
  snippet: string | null;
  displayedLink: string | null;
  source: string | null;
  position: number | null;
}

export class SerpSearchError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function getApiKey(): string {
  const key = process.env.SERP_API_KEY;
  if (!key) {
    throw new SerpSearchError("SERP_API_KEY is not set");
  }
  return key;
}

// The library rejects with the raw HTTP response body (a JSON string, per
// SerpApi's own error convention: {"error": "..."}), not an Error instance -
// try to pull the actual message out of it for a readable error.
function describeError(err: unknown): string {
  const raw = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // raw wasn't JSON - fall through and use it as-is
  }
  return raw;
}

function toOrganicResult(entry: unknown): SerpOrganicResult | null {
  if (typeof entry !== "object" || entry === null) return null;
  const r = entry as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title : null;
  const link = typeof r.link === "string" ? r.link : null;
  if (!title || !link) return null;
  return {
    title,
    link,
    snippet: typeof r.snippet === "string" ? r.snippet : null,
    displayedLink: typeof r.displayed_link === "string" ? r.displayed_link : null,
    source: typeof r.source === "string" ? r.source : null,
    position: typeof r.position === "number" ? r.position : null,
  };
}

// One query -> Google organic search results via SerpApi (serpapi.com).
// `SERP_API_KEY` is read lazily so a missing key only breaks a search call,
// not the whole server - same convention as lib/gemini.ts / lib/groq.ts.
export async function searchGoogle(
  query: string,
  options?: { num?: number; gl?: string; hl?: string }
): Promise<SerpOrganicResult[]> {
  const apiKey = getApiKey();

  let json: Record<string, unknown>;
  try {
    json = await getJson({
      engine: "google",
      api_key: apiKey,
      q: query,
      num: options?.num,
      gl: options?.gl,
      hl: options?.hl,
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      throw new SerpSearchError("SERP_API_KEY is not set");
    }
    throw new SerpSearchError(`SERP API request failed: ${describeError(err)}`);
  }

  if (typeof json.error === "string") {
    throw new SerpSearchError(`SERP API returned an error: ${json.error}`);
  }

  const organicResults = Array.isArray(json.organic_results) ? json.organic_results : [];
  return organicResults
    .map(toOrganicResult)
    .filter((r): r is SerpOrganicResult => r !== null);
}
