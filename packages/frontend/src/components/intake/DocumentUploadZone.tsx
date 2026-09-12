import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUploadDocument } from "@/hooks/useVendorMutations";
import { cn } from "@/lib/utils";
import type { DocType, DocumentRecord } from "@/types/vendor";

interface DocumentUploadZoneProps {
  vendorId: string;
  docType: DocType;
  label: string;
  description?: string;
  existingDocument?: DocumentRecord;
  compact?: boolean;
}

export function DocumentUploadZone({
  vendorId,
  docType,
  label,
  description,
  existingDocument,
  compact,
}: DocumentUploadZoneProps) {
  const uploadDocument = useUploadDocument(vendorId);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    uploadDocument.mutate({ file, docType });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  if (existingDocument) {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-4 py-3",
          compact && "px-3 py-2"
        )}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="truncate text-xs text-muted-foreground">
            {existingDocument.fileName}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploadDocument.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploadDocument.isPending ? "Uploading..." : "Replace"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50",
        compact && "py-4"
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
      <div className="text-xs text-muted-foreground">
        {uploadDocument.isPending ? "Uploading..." : "Drag & drop, or click to browse"}
      </div>
      {uploadDocument.isError && (
        <Badge variant="destructive" className="mt-1">
          {uploadDocument.error.message}
        </Badge>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
