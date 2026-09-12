import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type CorporateInfoInput, useUpdateCorporateInfo } from "@/hooks/useVendorMutations";
import type { SsmCorporateInfo } from "@/types/vendor";

import { FieldLabel } from "./FieldLabel";

function toForm(info: SsmCorporateInfo | null): CorporateInfoInput {
  return {
    company_name: info?.companyName ?? null,
    former_company_name: info?.formerCompanyName ?? null,
    date_of_name_change: info?.dateOfNameChange?.slice(0, 10) ?? null,
    date_of_incorporation: info?.dateOfIncorporation?.slice(0, 10) ?? null,
    company_status: info?.companyStatus ?? null,
    nature_of_business: info?.natureOfBusiness ?? null,
  };
}

export function CorporateInfoSection({
  vendorId,
  corporateInfo,
}: {
  vendorId: string;
  corporateInfo: SsmCorporateInfo | null;
}) {
  const [form, setForm] = useState<CorporateInfoInput>(() => toForm(corporateInfo));
  const updateCorporateInfo = useUpdateCorporateInfo(vendorId);
  const verified = corporateInfo?.isVerified ?? false;

  function set<K extends keyof CorporateInfoInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? null : value }));
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Corporate Information</h2>
        {verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Needs review</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel text="Company Name" aiExtracted={!verified} />
          <Input
            value={form.company_name ?? ""}
            onChange={(e) => set("company_name", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel text="Former Company Name" aiExtracted={!verified} />
          <Input
            value={form.former_company_name ?? ""}
            onChange={(e) => set("former_company_name", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel text="Date of Name Change" aiExtracted={!verified} />
          <Input
            type="date"
            value={form.date_of_name_change ?? ""}
            onChange={(e) => set("date_of_name_change", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel text="Date of Incorporation" aiExtracted={!verified} />
          <Input
            type="date"
            value={form.date_of_incorporation ?? ""}
            onChange={(e) => set("date_of_incorporation", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel text="Company Status" aiExtracted={!verified} />
          <Input
            value={form.company_status ?? ""}
            onChange={(e) => set("company_status", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel text="Nature of Business" aiExtracted={!verified} />
          <Textarea
            value={form.nature_of_business ?? ""}
            onChange={(e) => set("nature_of_business", e.target.value)}
          />
        </div>
      </div>

      {updateCorporateInfo.isError && (
        <p className="mt-2 text-xs text-destructive">{updateCorporateInfo.error.message}</p>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={updateCorporateInfo.isPending}
          onClick={() => updateCorporateInfo.mutate(form)}
        >
          {updateCorporateInfo.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </section>
  );
}
