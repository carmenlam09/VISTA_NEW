import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateKyvReportSection } from "@/hooks/useKyvReportMutations";
import type { KyvReportSection } from "@/types/kyvReport";

export function KyvReportSectionCard({
  vendorId,
  reportId,
  section,
  editable,
}: {
  vendorId: string;
  reportId: string;
  section: KyvReportSection;
  editable: boolean;
}) {
  const [content, setContent] = useState(section.content);
  const updateSection = useUpdateKyvReportSection(vendorId, reportId);

  // Resync local draft when switching sections/reports or after a save
  // refetches fresh content from the server.
  useEffect(() => {
    setContent(section.content);
  }, [section.id, section.content]);

  const dirty = content !== section.content;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{section.title}</h3>
        <Badge variant={section.isEdited ? "success" : "warning"}>
          {section.isEdited ? "Edited by reviewer" : "AI-drafted"}
        </Badge>
      </div>

      <Textarea
        rows={8}
        value={content}
        disabled={!editable}
        onChange={(e) => setContent(e.target.value)}
      />

      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            disabled={!dirty || updateSection.isPending}
            onClick={() => updateSection.mutate({ sectionId: section.id, content })}
          >
            {updateSection.isPending ? "Saving..." : "Save"}
          </Button>
          {updateSection.isError && (
            <p className="text-xs text-destructive">{updateSection.error.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
