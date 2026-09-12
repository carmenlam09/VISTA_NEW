import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateKeyword, useKeywordLibrary, useUpdateKeyword } from "@/hooks/useKeywordLibrary";
import { RISK_THEMES, RISK_THEME_LABELS, type RiskTheme } from "@/types/adverseMedia";

export function KeywordLibraryModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: keywords } = useKeywordLibrary();
  const createKeyword = useCreateKeyword();
  const updateKeyword = useUpdateKeyword();
  const [newKeyword, setNewKeyword] = useState("");
  const [newTheme, setNewTheme] = useState<RiskTheme>("other");

  function handleAdd() {
    if (!newKeyword.trim()) return;
    createKeyword.mutate(
      { keyword: newKeyword.trim(), risk_theme: newTheme },
      { onSuccess: () => setNewKeyword("") }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyword Library</DialogTitle>
          <DialogDescription>
            Manage the approved keywords used to search for adverse media.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 pr-2 font-medium">Keyword</th>
                <th className="pb-2 pr-2 font-medium">Risk Theme</th>
                <th className="pb-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {keywords?.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="py-1.5 pr-2">{k.keyword}</td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={k.riskTheme}
                      onChange={(e) =>
                        updateKeyword.mutate({
                          id: k.id,
                          input: { risk_theme: e.target.value as RiskTheme },
                        })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {RISK_THEMES.map((t) => (
                        <option key={t} value={t}>
                          {RISK_THEME_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      checked={k.isActive}
                      onChange={(e) =>
                        updateKeyword.mutate({ id: k.id, input: { is_active: e.target.checked } })
                      }
                    />
                  </td>
                </tr>
              ))}
              {(!keywords || keywords.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    No keywords yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-end gap-2 border-t border-border pt-4">
          <div className="flex-1">
            <div className="mb-1 text-xs font-medium text-muted-foreground">New keyword</div>
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. bribery"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Risk theme</div>
            <select
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value as RiskTheme)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {RISK_THEMES.map((t) => (
                <option key={t} value={t}>
                  {RISK_THEME_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" disabled={!newKeyword.trim() || createKeyword.isPending} onClick={handleAdd}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
