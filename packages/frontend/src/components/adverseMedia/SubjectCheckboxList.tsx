import { useSubjects } from "@/hooks/useSubjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/screening";

function SubjectGroup({
  label,
  items,
  selectedIds,
  onToggle,
}: {
  label: string;
  items: Subject[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-1.5 rounded-full border border-input px-2.5 py-1 text-xs"
          >
            <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => onToggle(s.id)} />
            {s.name}
          </label>
        ))}
      </div>
    </div>
  );
}

export function SubjectCheckboxList({
  vendorId,
  selectedIds,
  onChange,
  className,
}: {
  vendorId: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
}) {
  const { data: subjects, isLoading } = useSubjects(vendorId);

  const companies = subjects?.filter((s) => s.type === "company") ?? [];
  const directors = subjects?.filter((s) => s.type === "director") ?? [];
  const shareholders = subjects?.filter((s) => s.type === "shareholder") ?? [];

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading subjects...</p>;
  }
  if (!subjects || subjects.length === 0) {
    return <p className="text-xs text-muted-foreground">No subjects captured for this vendor yet.</p>;
  }

  const allSelected = subjects.length > 0 && subjects.every((s) => selectedIds.has(s.id));

  return (
    <div className={cn("space-y-2", className)}>
      <label className="flex items-center gap-1.5 text-xs font-medium">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = !allSelected && selectedIds.size > 0;
          }}
          onChange={() => onChange(allSelected ? new Set() : new Set(subjects.map((s) => s.id)))}
        />
        Select all ({subjects.length})
      </label>
      <SubjectGroup label="Company" items={companies} selectedIds={selectedIds} onToggle={toggle} />
      <SubjectGroup label="Directors" items={directors} selectedIds={selectedIds} onToggle={toggle} />
      <SubjectGroup
        label="Shareholders"
        items={shareholders}
        selectedIds={selectedIds}
        onToggle={toggle}
      />
    </div>
  );
}
