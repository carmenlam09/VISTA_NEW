import { Badge } from "@/components/ui/badge";
import type { SubjectType } from "@/types/screening";

const LABELS: Record<SubjectType, string> = {
  company: "Company",
  director: "Director",
  shareholder: "Shareholder",
};

export function SubjectBadge({
  subjectType,
  subjectName,
}: {
  subjectType: SubjectType;
  subjectName: string;
}) {
  return (
    <Badge variant="outline">
      {LABELS[subjectType]}: {subjectName}
    </Badge>
  );
}
