"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { apiFetch } from "@/shared/lib/api-client";
import { applyApiError } from "@/shared/lib/form-errors";
import { getQueryClient } from "@/shared/lib/query-client";
import { clientKeys } from "../../../../clients.keys";
import { clientInputSchema } from "../../../../clients.schemas";
import type { ClientDto, ClientInput } from "../../../../clients.types";
import type { ClientFormFieldsProps } from "./types";

export function useClientFormFields(props: ClientFormFieldsProps) {
  const router = useRouter();
  const form = useForm<z.input<typeof clientInputSchema>, unknown, ClientInput>({
    resolver: zodResolver(clientInputSchema),
    defaultValues:
      props.mode === "edit"
        ? { name: props.client.name, phone: props.client.phone, notes: props.client.notes ?? "" }
        : { name: "", phone: "", notes: "" },
  });
  const mutation = useMutation({
    mutationFn: (input: ClientInput) =>
      props.mode === "edit"
        ? apiFetch<ClientDto>(`/api/clients/${props.client.id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          })
        : apiFetch<ClientDto>("/api/clients", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (client) => {
      void getQueryClient().invalidateQueries({ queryKey: clientKeys.all });
      toast.success(props.mode === "edit" ? "تم حفظ التعديلات" : "تمت إضافة العميل");
      router.push(`/clients/${client.id}`);
    },
    onError: (error: Error) => applyApiError(error, form.setError),
  });
  return {
    form,
    errors: form.formState.errors,
    isPending: mutation.isPending,
    onSubmit: form.handleSubmit((input) => {
      if (!mutation.isPending) mutation.mutate(input);
    }),
  };
}
