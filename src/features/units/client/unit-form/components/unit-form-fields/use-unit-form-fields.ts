"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/shared/lib/api-client";
import { applyApiError } from "@/shared/lib/form-errors";
import { getQueryClient } from "@/shared/lib/query-client";
import { unitKeys } from "../../../../units.keys";
import { unitInputSchema } from "../../../../units.schemas";
import type { UnitDto, UnitInput } from "../../../../units.types";
import type { UnitFormFieldsProps } from "./types";

function toInput(unit: UnitDto): UnitInput {
  const { projectName, number, type, area, rooms, price } = unit;
  return { projectName, number, type, area, rooms, price };
}

export function useUnitFormFields(props: UnitFormFieldsProps) {
  const router = useRouter();
  const form = useForm<UnitInput>({
    resolver: zodResolver(unitInputSchema),
    defaultValues:
      props.mode === "edit"
        ? toInput(props.unit)
        : { projectName: "", number: "", type: "APARTMENT" },
  });

  const mutation = useMutation({
    mutationFn: (input: UnitInput) =>
      props.mode === "edit"
        ? apiFetch<UnitDto>(`/api/units/${props.unit.id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          })
        : apiFetch<UnitDto>("/api/units", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void getQueryClient().invalidateQueries({ queryKey: unitKeys.all });
      toast.success(props.mode === "edit" ? "تم حفظ التعديلات" : "تمت إضافة الوحدة");
      router.push("/units");
    },
    onError: async (error: Error) => {
      // A 409 means the unit changed under us: show its current price before the message.
      if (props.mode === "edit" && error instanceof ApiError && error.status === 409) {
        const { data } = await props.onConflict();
        if (data) form.resetField("price", { defaultValue: data.price });
      }
      applyApiError(error, form.setError);
    },
  });

  return {
    form,
    errors: form.formState.errors,
    isPending: mutation.isPending,
    // The price input is disabled in the UI only: an RHF-disabled field would be left out of the PATCH body.
    priceLocked: props.mode === "edit" && props.unit.status !== "AVAILABLE",
    onSubmit: form.handleSubmit((input) => {
      if (!mutation.isPending) mutation.mutate(input);
    }),
  };
}
