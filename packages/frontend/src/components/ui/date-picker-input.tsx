import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn, formatDate, maskDateInput, parseDdMmYyyy } from "@/lib/utils";

import { Input } from "./input";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Calendar cells for one month, Sunday-first, padded to full weeks with nulls. */
function monthGrid(year: number, month: number): (Date | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = new Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * A dd-mm-yyyy text field (still fully typeable - see maskDateInput/
 * parseDdMmYyyy in lib/utils, which exist specifically because a native
 * `<input type="date">`'s typing order follows the browser's locale, not
 * this app's day-first convention) plus a calendar dropdown for reviewers
 * who'd rather click a date than type one. Both paths write to the same
 * dd-mm-yyyy text value, so nothing about the existing filtering logic
 * downstream needs to know which one was used.
 */
export function DatePickerInput({
  id,
  value,
  onChange,
  placeholder = "dd-mm-yyyy",
  invalid = false,
  minDate = null,
  maxDate = null,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  minDate?: Date | null;
  maxDate?: Date | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDdMmYyyy(value);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Jump the calendar to whatever the field currently holds each time it
    // opens, so browsing in a prior session doesn't linger.
    setViewDate(selected ?? new Date());
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function isDisabled(day: Date): boolean {
    if (minDate && startOfDay(day) < startOfDay(minDate)) return true;
    if (maxDate && startOfDay(day) > startOfDay(maxDate)) return true;
    return false;
  }

  function pick(day: Date) {
    if (isDisabled(day)) return;
    onChange(formatDate(day));
    setOpen(false);
  }

  const today = new Date();
  const cells = monthGrid(viewDate.getFullYear(), viewDate.getMonth());

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={10}
          value={value}
          onChange={(e) => onChange(maskDateInput(e.target.value))}
          onFocus={() => setOpen(true)}
          aria-invalid={invalid}
          className={cn("pr-8", invalid && "border-destructive focus-visible:ring-destructive", className)}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open calendar"
          tabIndex={-1}
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Calendar size={14} />
        </button>
      </div>

      {open && (
        <div className="card-elevated absolute left-0 top-full z-50 mt-1.5 w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold">{MONTH_LABEL.format(viewDate)}</span>
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              aria-label="Next month"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={i} className="text-[10px] font-medium text-muted-foreground">
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={i} />;
              const disabled = isDisabled(day);
              const isSelected = isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={cn(
                    "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                    disabled
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-brand font-semibold text-brand-foreground hover:bg-brand",
                    !isSelected && isToday && "font-semibold text-brand"
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full rounded-md py-1 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
