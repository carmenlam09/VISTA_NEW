import { Badge } from "@/components/ui/badge";

export function FieldLabel({ text, aiExtracted }: { text: string; aiExtracted: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{text}</span>
      {aiExtracted && <Badge variant="warning">AI-extracted</Badge>}
    </div>
  );
}
