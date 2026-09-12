export function PdfPreviewPane({ documentId }: { documentId: string }) {
  return (
    <div className="h-full min-h-[600px] overflow-hidden rounded-lg border border-border bg-muted/30">
      <iframe title="Document preview" src={`/api/files/${documentId}`} className="h-full w-full" />
    </div>
  );
}
