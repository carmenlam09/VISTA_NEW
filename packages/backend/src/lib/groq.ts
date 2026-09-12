import Groq from "groq-sdk";

// Constructed lazily so a missing API key only breaks the calls that need
// it, not the whole server - same convention as lib/gemini.ts.
let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set");
    }
    client = new Groq({ apiKey });
  }
  return client;
}
