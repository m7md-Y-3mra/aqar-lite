"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { applyApiError } from "@/shared/lib/form-errors";
import { formatRiyals } from "@/shared/lib/money";
import { getQueryClient } from "@/shared/lib/query-client";
import { contractKeys } from "../../contracts.keys";
import { contractTermsInputSchema } from "../../contracts.schemas";
import type { ContractTermsInput } from "../../contracts.types";
import { minFinalPrice } from "../../domain/pricing";
import { buildSchedule } from "../../domain/schedule";
import { createContract, updateContract } from "../contracts.queries";
import type { ContractFormProps } from "./types";

export function useContractForm(props: ContractFormProps) {
  const router = useRouter();
  const unitPrice = props.mode === "edit" ? props.contract.unit.price : props.unitPrice;
  const today = props.mode === "edit" ? props.contract.today : props.today;
  const minimum = minFinalPrice(unitPrice);
  const form = useForm<ContractTermsInput>({
    resolver: zodResolver(contractTermsInputSchema),
    defaultValues: props.mode === "edit" ? {
      finalPrice: props.contract.finalPrice,
      downPayment: props.contract.downPayment,
      installmentCount: props.contract.installmentCount,
    } : { finalPrice: unitPrice, downPayment: 0, installmentCount: 12 },
  });
  const values = useWatch({ control: form.control });
  const parsed = contractTermsInputSchema.safeParse(values);
  const lines = parsed.success && parsed.data.finalPrice >= minimum
    ? buildSchedule(parsed.data, today) : null;
  const mutation = useMutation({
    mutationFn: (input: ContractTermsInput) => props.mode === "edit"
      ? updateContract(props.contract.id, input)
      : createContract({ ...input, reservationId: props.reservationId }),
    onSuccess: (contract) => {
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: contractKeys.all });
      for (const queryKey of props.relatedQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      toast.success(props.mode === "edit" ? "تم حفظ التعديلات" : "تم إنشاء العقد");
      router.push(`/contracts/${contract.id}`);
    },
    onError: (error: Error) => applyApiError(error, form.setError),
  });
  return {
    form, errors: form.formState.errors, isPending: mutation.isPending, lines, minimum,
    onSubmit: form.handleSubmit((input) => {
      form.clearErrors("root");
      if (input.finalPrice < minimum) {
        form.setError("finalPrice", {
          type: "validate", message: `أقل سعر مسموح هو ${formatRiyals(minimum)} ريال`,
        });
        return;
      }
      if (!mutation.isPending) mutation.mutate(input);
    }),
  };
}
