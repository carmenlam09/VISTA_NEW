import { ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export const SUBJECT_TYPES = ["company", "director", "shareholder"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export interface ResolvedSubject {
  subjectName: string;
  relatedDirectorId: string | null;
  relatedShareholderId: string | null;
}

// Screening searches (CTOS/NetReveal) can target the vendor company itself or
// any director/shareholder already captured in Module 1. This resolves and
// validates the "who is this about" input, and derives subject_name
// server-side (from the actual Module 1 record) rather than trusting
// client-supplied text, since it's a denormalized snapshot for display.
export async function resolveSubject(
  vendorId: string,
  input: {
    subjectType: SubjectType;
    relatedDirectorId?: string | null;
    relatedShareholderId?: string | null;
  }
): Promise<ResolvedSubject> {
  if (input.subjectType === "company") {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new ValidationError("Vendor not found");
    return { subjectName: vendor.companyName, relatedDirectorId: null, relatedShareholderId: null };
  }

  if (input.subjectType === "director") {
    if (!input.relatedDirectorId) {
      throw new ValidationError('related_director_id is required when subject_type is "director"');
    }
    const director = await prisma.ssmDirector.findFirst({
      where: { id: input.relatedDirectorId, vendorId },
    });
    if (!director) throw new ValidationError("related_director_id does not belong to this vendor");
    return { subjectName: director.name, relatedDirectorId: director.id, relatedShareholderId: null };
  }

  // shareholder
  if (!input.relatedShareholderId) {
    throw new ValidationError(
      'related_shareholder_id is required when subject_type is "shareholder"'
    );
  }
  const shareholder = await prisma.ssmShareholder.findFirst({
    where: { id: input.relatedShareholderId, vendorId },
  });
  if (!shareholder) {
    throw new ValidationError("related_shareholder_id does not belong to this vendor");
  }
  return {
    subjectName: shareholder.name,
    relatedDirectorId: null,
    relatedShareholderId: shareholder.id,
  };
}
