import { GoogleGenAI } from "@google/genai";

// Constructed lazily so a missing API key only breaks the extraction
// endpoint, not the whole server.
let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");
    }
    client = new GoogleGenAI({ vertexai: false, apiKey });
  }
  return client;
}
