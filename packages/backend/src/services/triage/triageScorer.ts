import { Type } from "@google/genai";
import { z } from "zod";

import { getGeminiClient } from "../../lib/gemini";
import { getGroqClient } from "../../lib/groq";
import type { SubjectType } from "../subjects";

export const SUGGESTED_DECISIONS = ["relevant", "false_positive", "needs_review"] as const;
export type SuggestedDecision = (typeof SUGGESTED_DECISIONS)[number];

export const triageScoreSchema = z.object({
  confidence_score: z.number().min(0).max(100),
  ai_rationale: z.string().min(1),
  suggested_decision: z.enum(SUGGESTED_DECISIONS),
});
export type TriageScore = z.infer<typeof triageScoreSchema>;

export class TriageScoringError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface TriageFindingInput {
  subjectType: SubjectType;
  subjectName: string;
  identityIcPassportNo: string | null;
  findingSummary: string;
  historicalContext: string;
  crossVendorContext: string;
}

const SYSTEM_PROMPT = `You are an AI risk triage analyst for a bank's Know Your Vendor (KYV) process. You are given one screening finding (a NetReveal watchlist hit, a CTOS legal case, or an adverse media article) about a vendor company, director, or shareholder, plus supporting context: the subject's identity as captured in the bank's own records, any historical triage outcomes for the same or a related identity, and any cross-vendor relationships for that identity.

Assess how likely this finding is a genuine risk requiring escalation, versus a false positive (e.g. a namesake, an unrelated case, outdated or resolved information), considering:
- Name variations: does the finding's name closely match the subject's captured name, or is it a partial/ambiguous match (common name, different spelling)?
- Nationality: if both are known, does the finding's nationality match the subject's?
- Ownership structure / cross-vendor relationships: is this person linked to other vendors already in the system, and what happened with their past findings?
- Historical screening outcomes: has this same subject (or a related identity) been triaged before, and what was decided?

Return strict JSON:
{ "confidence_score": 0, "ai_rationale": "", "suggested_decision": "relevant" }

- confidence_score: 0-100, your estimate that this is a genuine risk requiring escalation (higher = more likely genuine).
- ai_rationale: 1-3 sentences explaining the score, referencing the specific factors above that drove it.
- suggested_decision: "relevant" for a likely genuine risk, "false_positive" for a likely non-issue, or "needs_review" when your own confidence is middling (roughly 40-70) and a human should decide instead.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    confidence_score: { type: Type.NUMBER },
    ai_rationale: { type: Type.STRING },
    suggested_decision: { type: Type.STRING, enum: [...SUGGESTED_DECISIONS] },
  },
  required: ["confidence_score", "ai_rationale", "suggested_decision"],
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
// gpt-oss supports Groq's strict json_schema structured output mode.
const GROQ_MODEL = process.env.GROQ_TRIAGE_MODEL ?? "openai/gpt-oss-20b";

function buildUserPrompt(input: TriageFindingInput): string {
  return [
    `Subject type: ${input.subjectType}`,
    `Subject name (as captured in Module 1): ${input.subjectName}`,
    `IC / Passport / Registration No.: ${input.identityIcPassportNo ?? "not captured"}`,
    "",
    "Finding under review:",
    input.findingSummary,
    "",
    "Historical triage outcomes for this identity (most recent first):",
    input.historicalContext,
    "",
    "Cross-vendor relationships for this identity:",
    input.crossVendorContext,
  ].join("\n");
}

async function scoreWithGroq(prompt: string): Promise<TriageScore> {
  const response = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "risk_triage_score",
        strict: true,
        schema: {
          type: "object",
          properties: {
            confidence_score: { type: "number" },
            ai_rationale: { type: "string" },
            suggested_decision: { type: "string", enum: [...SUGGESTED_DECISIONS] },
          },
          required: ["confidence_score", "ai_rationale", "suggested_decision"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new TriageScoringError("Groq returned an empty response");
  }

  const parsed = triageScoreSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new TriageScoringError(
      `Groq's response did not match the expected schema: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

async function scoreWithGemini(prompt: string): Promise<TriageScore> {
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new TriageScoringError("Gemini returned an empty response");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TriageScoringError("Gemini's response was not valid JSON");
  }

  const parsed = triageScoreSchema.safeParse(json);
  if (!parsed.success) {
    throw new TriageScoringError(
      `Gemini's response did not match the expected schema: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

// Text-only reasoning over context already gathered from Postgres (no
// PDF/document input needed), so this tries Groq first and falls back to
// Gemini if Groq is unavailable, errors, or returns something that doesn't
// validate - same pattern as adverseMediaCategorizer.ts.
export async function scoreTriageFinding(input: TriageFindingInput): Promise<TriageScore> {
  const prompt = buildUserPrompt(input);
  try {
    return await scoreWithGroq(prompt);
  } catch (groqError) {
    console.error(
      "Groq triage scoring failed, falling back to Gemini:",
      groqError instanceof Error ? groqError.message : groqError
    );
    return await scoreWithGemini(prompt);
  }
}
