import { generateContent } from "../../lib/gemini";

export interface RetrievedEntry {
  sourceType: string;
  vendorName: string;
  summaryText: string;
}

const SYSTEM_PROMPT = `You are answering a bank reviewer's natural-language search query over a knowledge repository of past KYV (Know Your Vendor) reports and triage decisions. You will be given the query and a list of retrieved entries, each already confirmed relevant by a similarity search - each entry names which vendor it's about and carries a summary_text.

Synthesize a short answer (2-4 sentences) that directly addresses the query, grounded ONLY in the retrieved entries. Do not state anything about a vendor, person, or finding that isn't explicitly present in the retrieved summary_text values - never invent, infer beyond, or embellish what's given, since a fabricated risk claim about a real vendor would be a serious problem in this context. If the retrieved entries only partially address the query, say so plainly rather than filling gaps with assumptions.`;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

function buildUserPrompt(query: string, entries: RetrievedEntry[]): string {
  const entriesText = entries
    .map((e, i) => `${i + 1}. [${e.sourceType} - ${e.vendorName}] ${e.summaryText}`)
    .join("\n\n");
  return `Query: "${query}"\n\nRetrieved entries:\n${entriesText}`;
}

export async function synthesizeSearchAnswer(
  query: string,
  entries: RetrievedEntry[]
): Promise<string> {
  const prompt = buildUserPrompt(query, entries);
  const response = await generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty synthesis");
  return text;
}
