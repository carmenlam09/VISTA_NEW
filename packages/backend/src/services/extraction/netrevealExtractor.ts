import { Type } from "@google/genai";
import { z } from "zod";

import { getGeminiClient } from "../../lib/gemini";

// Stays on Gemini (not Groq): this sends the source PDF directly as
// inlineData, and Groq's hosted models don't accept PDF/document input
// (only images, and only through two vision models) - see
// console.groq.com/docs/vision.
//
// Matches the JSON shape in VISTA_module2_system_prompt.md Section 3.
export const netrevealExtractionSchema = z.object({
  dob_doi: z.string().nullable(),
  nationality: z.string().nullable(),
  check_name: z.string().nullable(),
  uid: z.string().nullable(),
  watchperson_details: z.string().nullable(),
});

export type NetrevealExtractionResult = z.infer<typeof netrevealExtractionSchema>;

export class ExtractionValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You are extracting structured data from a NetReveal watchlist/screening search result PDF, which may be about a company or an individual (a director or shareholder).

Extract:
- dob_doi: Date of Birth (for an individual) or Date of Incorporation (for a company), formatted as YYYY-MM-DD.
- nationality: the subject's nationality or country of incorporation.
- check_name: the exact name variant the search was run against.
- uid: any unique identifier shown for the match (e.g. IC/passport/registration number).
- watchperson_details: the full text of any Watchperson Details / FPFA Watch Person Details / sanctions or watchlist match found. Use null if there is no watchlist hit.

Use null for any field that is missing or not legible. Do not invent data that is not in the document.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    dob_doi: { type: Type.STRING, nullable: true },
    nationality: { type: Type.STRING, nullable: true },
    check_name: { type: Type.STRING, nullable: true },
    uid: { type: Type.STRING, nullable: true },
    watchperson_details: { type: Type.STRING, nullable: true },
  },
  required: ["dob_doi", "nationality", "check_name", "uid", "watchperson_details"],
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export async function extractNetrevealData(pdfBuffer: Buffer): Promise<NetrevealExtractionResult> {
  const base64Pdf = pdfBuffer.toString("base64");

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
          { text: "Extract the subject and watchlist details from this NetReveal search result." },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new ExtractionValidationError("Gemini returned an empty response");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ExtractionValidationError("Gemini's response was not valid JSON");
  }

  const parsed = netrevealExtractionSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractionValidationError(
      `Gemini's response did not match the expected extraction schema: ${parsed.error.message}`
    );
  }

  return parsed.data;
}
