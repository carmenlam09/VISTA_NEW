import { MODULES } from "shared-types";
import { useParams } from "react-router-dom";

export function ModulePage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const module = MODULES.find((m) => m.slug === moduleSlug);

  if (!module) {
    return <p className="text-sm text-muted-foreground">Unknown module.</p>;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-24 text-center">
      <h2 className="text-lg font-semibold">{module.label}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {module.implemented
          ? "This is where Module 1's intake & extraction workflow will render — built next."
          : `Module ${module.moduleNumber} — coming soon.`}
      </p>
    </div>
  );
}
