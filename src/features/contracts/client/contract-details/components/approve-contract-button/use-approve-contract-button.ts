"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/shared/lib/api-client";
import { ERROR_MESSAGES } from "@/shared/lib/error-messages";
import { getQueryClient } from "@/shared/lib/query-client";
import { contractKeys } from "../../../../contracts.keys";
import { approveContract } from "../../../contracts.queries";
import type { ApproveContractButtonProps } from "./types";

export function useApproveContractButton({
  id,
  canApprove,
  terms,
  relatedQueryKeys,
}: ApproveContractButtonProps) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => approveContract(id, terms),
    onSuccess: () => {
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: contractKeys.all });
      for (const queryKey of relatedQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      toast.success("تم اعتماد العقد");
      setOpen(false);
    },
    onError: (error) => {
      setOpen(false);
      if (error instanceof ApiError && error.status === 409) {
        void getQueryClient().invalidateQueries({ queryKey: contractKeys.detail(id) });
      }
    },
  });

  return {
    open,
    setOpen: (value: boolean) => {
      if (!mutation.isPending && (!value || canApprove)) setOpen(value);
    },
    confirm: () => {
      if (!mutation.isPending && canApprove) mutation.mutate();
    },
    isPending: mutation.isPending,
    errorMessage: mutation.error
      ? mutation.error instanceof ApiError
        ? mutation.error.message
        : ERROR_MESSAGES.INTERNAL_ERROR
      : null,
  };
}
