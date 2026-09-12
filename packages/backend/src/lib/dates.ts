// For dates coming out of AI extraction: best-effort parse, falling back to
// null rather than throwing - malformed model output shouldn't crash the
// write transaction. Reviewer-supplied dates (PUT bodies) should instead be
// validated strictly and rejected on bad input (see each route's own toDate).
export function parseExtractedDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
