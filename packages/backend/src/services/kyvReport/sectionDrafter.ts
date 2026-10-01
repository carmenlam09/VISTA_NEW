import { generateContent } from "../../lib/gemini";

export class SectionDraftError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface DraftedSection {
  content: string;
  model: string;
}

const SYSTEM_PROMPT = `You are drafting one section of a bank's KYV (Know Your Vendor) risk review report for a vendor. You will be given that section's specific instructions and a JSON data package covering everything confirmed about this vendor: its Module 1 corporate registration profile, and only the Module 2/3 findings (legal cases, NetReveal watchlist hits, adverse media articles) a human reviewer has already confirmed as genuinely relevant - never a pending or dismissed one. Each included finding may carry a triage_rationale field explaining why a reviewer judged it relevant; use it as context, not as something to quote directly.

Write plain narrative text for this section only - no JSON, no markdown headers repeating the section title, no preamble like "Here is the section". Be specific and reference actual figures, names, and case details from the data package where relevant to the section's instructions. If the data package has nothing relevant to this section, say so briefly rather than inventing content. Reproduce identifying numbers - IC/passport numbers, registration numbers, case numbers - exactly as they appear in the data package; never re-group their digits, add or remove dashes, or otherwise reformat them.`;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

function buildUserPrompt(sectionInstructions: string, dataPackage: unknown): string {
  return [
    `Section instructions: ${sectionInstructions}`,
    "",
    "Vendor data package (JSON):",
    JSON.stringify(dataPackage, null, 2),
  ].join("\n");
}

// This is narrative drafting from already-verified structured data, not new
// extraction - a length/non-empty check on the output is sufficient
// validation (per VISTA_module5_system_prompt.md Section 3); full Zod schema
// validation isn't necessary here.
export async function draftSection(
  sectionInstructions: string,
  dataPackage: unknown
): Promise<DraftedSection> {
  const prompt = buildUserPrompt(sectionInstructions, dataPackage);
  const response = await generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const text = response.text?.trim();
  if (!text || text.length < 10) {
    throw new SectionDraftError("Gemini returned an empty or too-short section draft");
  }
  return { content: text, model: GEMINI_MODEL };
}
