"use client";

import { ErrorState } from "@/shared/components/error-state";
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
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        جارٍ التحميل…
      </p>
    );
  } else if (detail.isError) {
    body = <ErrorState message="تعذر تحميل العميل." onRetry={() => void detail.refetch()} />;
  } else {
    body = <ClientFormFields mode="edit" client={detail.data} />;
  }

  return (
    <section className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {body}
    </section>
  );
}
