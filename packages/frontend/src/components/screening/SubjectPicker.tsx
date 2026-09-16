import { useSubjects } from "@/hooks/useSubjects";
import { cn } from "@/lib/utils";
import { ALL_SUBJECTS_ID, type Subject } from "@/types/screening";

export function SubjectPicker({
  vendorId,
  value,
  onChange,
  onSelectAll,
  includeAll = false,
  className,
}: {
  vendorId: string;
  value: string;
  onChange: (subject: Subject) => void;
  /**
   * Adverse media only. Kept as its own callback so onChange keeps its
   * (subject: Subject) signature for the screening modals, which have no
   * meaningful "every related party" mode.
   */
  onSelectAll?: () => void;
  includeAll?: boolean;
  className?: string;
}) {
  const { data: subjects, isLoading } = useSubjects(vendorId);

  const companies = subjects?.filter((s) => s.type === "company") ?? [];
  const directors = subjects?.filter((s) => s.type === "director") ?? [];
  const shareholders = subjects?.filter((s) => s.type === "shareholder") ?? [];

  return (
    <select
      value={value}
      disabled={isLoading}
      onChange={(e) => {
        if (e.target.value === ALL_SUBJECTS_ID) {
          onSelectAll?.();
          return;
        }
        const subject = subjects?.find((s) => s.id === e.target.value);
        if (subject) onChange(subject);
      }}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
    >
      <option value="" disabled>
        {isLoading ? "Loading subjects..." : "Select who this is about..."}
      </option>
      {includeAll && subjects && subjects.length > 0 && (
        <option value={ALL_SUBJECTS_ID}>
          All - company and related parties ({subjects.length})
        </option>
      )}
      {companies.length > 0 && (
        <optgroup label="Company">
          {companies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
      {directors.length > 0 && (
        <optgroup label="Directors">
          {directors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
      {shareholders.length > 0 && (
        <optgroup label="Shareholders">
          {shareholders.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
