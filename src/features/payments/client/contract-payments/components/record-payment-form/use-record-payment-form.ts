"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api-client";
import { applyApiError } from "@/shared/lib/form-errors";
import { getQueryClient } from "@/shared/lib/query-client";
import { paymentKeys } from "../../../../payments.keys";
import { recordPaymentInputSchema } from "../../../../payments.schemas";
import type { RecordPaymentInput } from "../../../../payments.types";
import { recordPayment } from "../../../payments.queries";
import type { RecordPaymentFormProps } from "./types";

export function useRecordPaymentForm({ contractId, relatedQueryKeys }: RecordPaymentFormProps) {
  // One key per payment: kept across double clicks and retries, replaced only after a save
  // or after the server says the key was already used for another amount.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentInputSchema),
    defaultValues: { amount: undefined },
  });

  const refresh = () => {
    const queryClient = getQueryClient();
    void queryClient.invalidateQueries({ queryKey: paymentKeys.list(contractId) });
    for (const queryKey of relatedQueryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const mutation = useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      recordPayment(contractId, input.amount, idempotencyKey),
    onSuccess: () => {
      refresh();
      toast.success("تم تسجيل الدفعة");
      form.reset({ amount: undefined });
      setIdempotencyKey(crypto.randomUUID());
    },
    onError: (error: Error) => {
      applyApiError(error, form.setError);
      if (error instanceof ApiError && error.status === 409) {
        refresh();
        if (error.code === "IDEMPOTENCY_KEY_REUSED") setIdempotencyKey(crypto.randomUUID());
      }
    },
  });

  return {
    form,
    errors: form.formState.errors,
    isPending: mutation.isPending,
    onSubmit: form.handleSubmit((input) => {
      form.clearErrors("root");
      if (!mutation.isPending) mutation.mutate(input);
    }),
  };
}
