import { Type } from "@google/genai";
import { z } from "zod";

import { getGeminiClient } from "../../lib/gemini";

// Stays on Gemini (not Groq): this sends the source PDF directly as
// inlineData, and Groq's hosted models don't accept PDF/document input
// (only images, and only through two vision models) - see
// console.groq.com/docs/vision.
//
// Matches the JSON shape in CLAUDE.md Section 5.3. Dates are plain
// "YYYY-MM-DD" strings (or null) - callers convert to Date when persisting.
export const ssmExtractionSchema = z.object({
  corporate_info: z.object({
    company_name: z.string().nullable(),
    former_company_name: z.string().nullable(),
    date_of_name_change: z.string().nullable(),
    date_of_incorporation: z.string().nullable(),
    company_status: z.string().nullable(),
    nature_of_business: z.string().nullable(),
  }),
  share_capital: z.object({
    paid_up_capital: z.number().nullable(),
  }),
  directors: z.array(
    z.object({
      name: z.string(),
      ic_passport_no: z.string().nullable(),
      designation: z.string().nullable(),
    })
  ),
  shareholders: z.array(
    z.object({
      ic_passport_registration_no: z.string().nullable(),
      name: z.string(),
      total_shares: z.number().nullable(),
    })
  ),
});

export type SsmExtractionResult = z.infer<typeof ssmExtractionSchema>;

export class ExtractionValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You are extracting structured company registration data from a Malaysian SSM (Companies Commission of Malaysia) company report PDF, which may be a native-text or scanned document.

Read the whole document and extract, verbatim where possible:
- Corporate Information: company name, former company name (if any), date of name change, date of incorporation, company status (e.g. Active, Dormant, Struck Off), nature of business.
- Summary of Share Capital: the total paid-up capital.
- Directors / Officers: every listed director, manager, or company secretary, with their IC/passport number and designation.
- Shareholders / Members: every listed shareholder/member, with their IC/passport or registration number and total shares held.

Use null for any field that is missing or not legible in the document. Use null for date fields that cannot be parsed, and otherwise format dates as YYYY-MM-DD. Do not invent data that is not in the document.`;

// Gemini's own Schema format (a subset of OpenAPI schema, using the `Type`
// enum) - this constrains generation. The Zod schema above is still used to
// validate the parsed JSON before anything is written to the database.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    corporate_info: {
      type: Type.OBJECT,
      properties: {
        company_name: { type: Type.STRING, nullable: true },
        former_company_name: { type: Type.STRING, nullable: true },
        date_of_name_change: { type: Type.STRING, nullable: true },
        date_of_incorporation: { type: Type.STRING, nullable: true },
        company_status: { type: Type.STRING, nullable: true },
        nature_of_business: { type: Type.STRING, nullable: true },
      },
      required: [
        "company_name",
        "former_company_name",
        "date_of_name_change",
        "date_of_incorporation",
        "company_status",
        "nature_of_business",
      ],
    },
    share_capital: {
      type: Type.OBJECT,
      properties: {
        paid_up_capital: { type: Type.NUMBER, nullable: true },
      },
      required: ["paid_up_capital"],
    },
    directors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          ic_passport_no: { type: Type.STRING, nullable: true },
          designation: { type: Type.STRING, nullable: true },
        },
        required: ["name", "ic_passport_no", "designation"],
      },
    },
    shareholders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ic_passport_registration_no: { type: Type.STRING, nullable: true },
          name: { type: Type.STRING },
          total_shares: { type: Type.NUMBER, nullable: true },
        },
        required: ["ic_passport_registration_no", "name", "total_shares"],
      },
    },
  },
  required: ["corporate_info", "share_capital", "directors", "shareholders"],
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export async function extractSsmData(pdfBuffer: Buffer): Promise<SsmExtractionResult> {
  const base64Pdf = pdfBuffer.toString("base64");

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
          {
            text: "Extract the corporate information, share capital, directors, and shareholders from this SSM report.",
          },
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

  const parsed = ssmExtractionSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractionValidationError(
      `Gemini's response did not match the expected extraction schema: ${parsed.error.message}`
    );
  }

  return parsed.data;
}
