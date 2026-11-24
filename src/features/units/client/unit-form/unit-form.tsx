"use client";

import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PageLoading } from "@/shared/components/page-loading";
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
    body = <PageLoading />;
  } else if (detail.isError) {
    body = <ErrorState message="تعذر تحميل الوحدة." onRetry={() => void detail.refetch()} />;
  } else {
    body = <UnitFormFields mode="edit" unit={detail.data} onConflict={detail.refetch} />;
  }

  return (
    <section className="max-w-2xl space-y-6">
      <PageHeader title={title} />
      <div className="rounded-xl border bg-card p-5 shadow-xs md:p-6">{body}</div>
    </section>
  );
}
