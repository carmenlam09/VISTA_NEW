import { getGeminiClient } from "../lib/gemini";
import { getGroqClient } from "../lib/groq";
import { prisma } from "../lib/prisma";

// Unlike the extraction services, this summarizes existing structured data
// into a narrative - no Zod schema, just a sanity check that the model
// actually returned something (per VISTA_module2_system_prompt.md Section 3).
// Text-only (no PDF/document input needed), so this tries Groq first and
// falls back to Gemini if Groq is unavailable or errors.
export class SummaryGenerationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are a KYV (Know Your Vendor) risk analyst at a bank. You will be given a JSON profile of a vendor combining their corporate registration data (Module 1) and screening/due-diligence results (Module 2: CTOS credit reports and NetReveal watchlist searches).

Write a concise, risk-relevant narrative summary (3-6 short paragraphs or a tight bulleted list) covering:
- Overall corporate standing (status, structure) in one line.
- Financial position: revenue, profitability, liquidity/leverage ratios, and whether they look healthy or concerning.
- Legal exposure: any legal cases as defendant or plaintiff, and what they suggest about risk.
- Watchlist / adverse findings: call out clearly and specifically if any NetReveal watchperson details or sanctions hits were found for the company or any individual - this is the highest-priority signal.

Be specific and reference actual figures/names from the data. If a category has no data at all, say so briefly rather than omitting it. Do not include any preamble like "Here is a summary" - write the summary directly.`;

export async function generateScreeningSummary(
  vendorId: string
): Promise<{ summaryText: string; model: string }> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      corporateInfo: true,
      shareCapital: true,
      directors: true,
      shareholders: true,
      ctosEnquiries: {
        include: { financialHighlights: true, legalCases: true, tradeReferences: true },
      },
      netrevealRecords: true,
    },
  });
  if (!vendor) throw new SummaryGenerationError("Vendor not found");

  const profile = {
    company: {
      name: vendor.companyName,
      registrationNo: vendor.registrationNo,
      status: vendor.status,
      corporateInfo: vendor.corporateInfo,
      shareCapital: vendor.shareCapital,
    },
    directors: vendor.directors,
    shareholders: vendor.shareholders,
    ctosEnquiries: vendor.ctosEnquiries.map((enquiry) => ({
      subjectType: enquiry.subjectType,
      subjectName: enquiry.subjectName,
      financialHighlights: enquiry.financialHighlights,
      legalCases: enquiry.legalCases,
      tradeReferences: enquiry.tradeReferences,
    })),
    netrevealRecords: vendor.netrevealRecords,
  };

  const userPrompt = `Vendor profile (JSON):\n${JSON.stringify(profile, null, 2)}`;

  try {
    const groqResponse = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const summaryText = groqResponse.choices[0]?.message?.content?.trim();
    if (!summaryText || summaryText.length < 20) {
      throw new SummaryGenerationError("Groq returned an empty or too-short summary");
    }
    return { summaryText, model: GROQ_MODEL };
  } catch (groqError) {
    const response = await getGeminiClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: { systemInstruction: SYSTEM_PROMPT },
    });

    const summaryText = response.text?.trim();
    if (!summaryText || summaryText.length < 20) {
      throw new SummaryGenerationError("Gemini returned an empty or too-short summary");
    }

    return { summaryText, model: GEMINI_MODEL };
  }
}
