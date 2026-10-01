import { Type } from "@google/genai";
import { z } from "zod";

import { generateContent } from "../../lib/gemini";

// Fixed taxonomy from VISTA_module3_system_prompt.md Section 1.
export const RISK_THEMES = [
  "financial_crime",
  "sanctions",
  "fraud",
  "regulatory_breach",
  "tax_offence",
  "esg",
  "operational_risk",
  "other",
] as const;
export type RiskTheme = (typeof RISK_THEMES)[number];

export const categorizationSchema = z.object({
  risk_theme: z.enum(RISK_THEMES),
  ai_summary: z.string().min(1),
});
export type CategorizationResult = z.infer<typeof categorizationSchema>;

export class CategorizationValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You are screening one web search result for adverse media relevant to a bank's Know Your Vendor (KYV) risk review. You will be given the subject being screened (a company, director, or shareholder) and one search result (title, URL, source domain, and a short snippet - never the full article).

1. Pick exactly one risk_theme from this fixed list: financial_crime, sanctions, fraud, regulatory_breach, tax_offence, esg, operational_risk, other. If the result does not clearly relate to any risk topic (e.g. it's an unrelated namesake, a generic company profile, or a job listing), use "other".
2. Write a 1-3 sentence summary in your own words describing what the result appears to be about and why it might (or might not) be risk-relevant to this subject. Paraphrase - do not copy phrases from the snippet verbatim, and do not invent details the snippet doesn't support.
3. Return strict JSON: { "risk_theme": "", "ai_summary": "" }`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    risk_theme: { type: Type.STRING, enum: [...RISK_THEMES] },
    ai_summary: { type: Type.STRING },
  },
  required: ["risk_theme", "ai_summary"],
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export interface ArticleToCategorize {
  subjectName: string;
  title: string;
  url: string;
  sourceDomain: string | null;
  snippet: string | null;
}

const userPrompt = (article: ArticleToCategorize) =>
  [
    `Subject being screened: ${article.subjectName}`,
    "",
    "Search result:",
    `Title: ${article.title}`,
    `URL: ${article.url}`,
    `Source domain: ${article.sourceDomain ?? "unknown"}`,
    `Snippet: ${article.snippet ?? "(no snippet available)"}`,
  ].join("\n");

export async function categorizeArticle(
  article: ArticleToCategorize
): Promise<CategorizationResult> {
  const response = await generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userPrompt(article) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new CategorizationValidationError("Gemini returned an empty response");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CategorizationValidationError("Gemini's response was not valid JSON");
  }

  const parsed = categorizationSchema.safeParse(json);
  if (!parsed.success) {
    throw new CategorizationValidationError(
      `Gemini's response did not match the expected schema: ${parsed.error.message}`
    );
  }

  return parsed.data;
}
