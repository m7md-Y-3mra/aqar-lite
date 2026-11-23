"use client";

import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PageLoading } from "@/shared/components/page-loading";
import { ClientFormFields } from "./components/client-form-fields";
import type { ClientFormProps } from "./types";
import { useClientForm } from "./use-client-form";

export function ClientForm(props: ClientFormProps) {
  const detail = useClientForm(props);
  const title = props.mode === "edit" ? "تعديل العميل" : "إضافة عميل";

  let body;
  if (props.mode === "create") {
    body = <ClientFormFields mode="create" />;
  } else if (detail.isPending) {
    body = <PageLoading />;
  } else if (detail.isError) {
    body = <ErrorState message="تعذر تحميل العميل." onRetry={() => void detail.refetch()} />;
  } else {
    body = <ClientFormFields mode="edit" client={detail.data} />;
  }

  return (
    <section className="max-w-2xl space-y-6">
      <PageHeader title={title} />
      <div className="rounded-xl border bg-card p-5 shadow-xs md:p-6">{body}</div>
    </section>
  );
}
