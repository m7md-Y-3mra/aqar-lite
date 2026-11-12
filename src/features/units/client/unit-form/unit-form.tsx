"use client";

import { ErrorState } from "@/shared/components/error-state";
import { UnitFormFields } from "./components/unit-form-fields";
import type { UnitFormProps } from "./types";
import { useUnitForm } from "./use-unit-form";

export function UnitForm(props: UnitFormProps) {
  const detail = useUnitForm(props);
  const title = props.mode === "edit" ? "تعديل الوحدة" : "إضافة وحدة";

  let body;
  if (props.mode === "create") {
    body = <UnitFormFields mode="create" />;
  } else if (detail.isPending) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        جارٍ التحميل…
      </p>
    );
  } else if (detail.isError) {
    body = <ErrorState message="تعذر تحميل الوحدة." onRetry={() => void detail.refetch()} />;
  } else {
    body = <UnitFormFields mode="edit" unit={detail.data} onConflict={detail.refetch} />;
  }

  return (
    <section className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {body}
    </section>
  );
}
