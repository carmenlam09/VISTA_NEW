import { Type } from "@google/genai";
import { z } from "zod";

import { getGeminiClient } from "../../lib/gemini";

// Stays on Gemini (not Groq): this sends the source PDF directly as
// inlineData, and Groq's hosted models don't accept PDF/document input
// (only images, and only through two vision models) - see
// console.groq.com/docs/vision.
//
// Matches the JSON shapes in VISTA_module2_system_prompt.md Section 3.
// financial_highlights is requested/extracted regardless of subject type, but
// callers only persist it when the enquiry's subject_type is "company".
export const ctosExtractionSchema = z.object({
  financial_highlights: z.object({
    total_issued_ordinary: z.number().nullable(),
    total_issued_preference: z.number().nullable(),
    total_issued_others: z.number().nullable(),
    revenue_turnover: z.number().nullable(),
    net_income: z.number().nullable(),
    current_assets: z.number().nullable(),
    current_liabilities: z.number().nullable(),
    current_ratio: z.number().nullable(),
    debt_to_equity_ratio: z.number().nullable(),
  }),
  legal_cases: z.array(
    z.object({
      case_type: z.enum(["defendant", "plaintiff"]),
      plaintiff: z.string().nullable(),
      defendant: z.string().nullable(),
      case_no: z.string().nullable(),
      remark: z.string().nullable(),
    })
  ),
  trade_references: z.array(
    z.object({
      referee: z.string().nullable(),
      account_no: z.string().nullable(),
      capacity: z.string().nullable(),
      statement_date: z.string().nullable(),
      default_amount: z.number().nullable(),
    })
  ),
});

export type CtosExtractionResult = z.infer<typeof ctosExtractionSchema>;

export class ExtractionValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You are extracting structured data from a CTOS credit/business report PDF (Malaysia), which may be a native-text or scanned document. This report may be about a company, or about an individual (a director or shareholder).

Extract:
- Financial Highlights (only present for a company report): total issued ordinary/preference/other share capital, revenue/turnover, net income, current assets, current liabilities, current ratio, debt-to-equity ratio. If this report is about an individual (not a company), or a figure is not present, use null for every field in financial_highlights.
- Legal Cases: every case listed under Section D1 (subject as Defendant - use case_type "defendant") and Section D2 (subject as Plaintiff - use case_type "plaintiff"), with plaintiff, defendant, case number, and any remark.
- Trade References (Section E2): every trade reference listed, with referee, account number, capacity, statement date, and default amount (RM).

Use null for any field that is missing or not legible. Format dates as YYYY-MM-DD. Do not invent data that is not in the document.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    financial_highlights: {
      type: Type.OBJECT,
      properties: {
        total_issued_ordinary: { type: Type.NUMBER, nullable: true },
        total_issued_preference: { type: Type.NUMBER, nullable: true },
        total_issued_others: { type: Type.NUMBER, nullable: true },
        revenue_turnover: { type: Type.NUMBER, nullable: true },
        net_income: { type: Type.NUMBER, nullable: true },
        current_assets: { type: Type.NUMBER, nullable: true },
        current_liabilities: { type: Type.NUMBER, nullable: true },
        current_ratio: { type: Type.NUMBER, nullable: true },
        debt_to_equity_ratio: { type: Type.NUMBER, nullable: true },
      },
      required: [
        "total_issued_ordinary",
        "total_issued_preference",
        "total_issued_others",
        "revenue_turnover",
        "net_income",
        "current_assets",
        "current_liabilities",
        "current_ratio",
        "debt_to_equity_ratio",
      ],
    },
    legal_cases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          case_type: { type: Type.STRING, enum: ["defendant", "plaintiff"] },
          plaintiff: { type: Type.STRING, nullable: true },
          defendant: { type: Type.STRING, nullable: true },
          case_no: { type: Type.STRING, nullable: true },
          remark: { type: Type.STRING, nullable: true },
        },
        required: ["case_type", "plaintiff", "defendant", "case_no", "remark"],
      },
    },
    trade_references: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          referee: { type: Type.STRING, nullable: true },
          account_no: { type: Type.STRING, nullable: true },
          capacity: { type: Type.STRING, nullable: true },
          statement_date: { type: Type.STRING, nullable: true },
          default_amount: { type: Type.NUMBER, nullable: true },
        },
        required: ["referee", "account_no", "capacity", "statement_date", "default_amount"],
      },
    },
  },
  required: ["financial_highlights", "legal_cases", "trade_references"],
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export async function extractCtosData(pdfBuffer: Buffer): Promise<CtosExtractionResult> {
  const base64Pdf = pdfBuffer.toString("base64");

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
          {
            text: "Extract the financial highlights (if this is a company report), legal cases, and trade references from this CTOS report.",
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

  const parsed = ctosExtractionSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractionValidationError(
      `Gemini's response did not match the expected extraction schema: ${parsed.error.message}`
    );
  }

  return parsed.data;
}
