"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/shared/lib/api-client";
import { formatRiyadhDateTime } from "@/shared/lib/dates";
import { applyApiError } from "@/shared/lib/form-errors";
import { getQueryClient } from "@/shared/lib/query-client";
import { reservationKeys } from "../../reservations.keys";
import { reserveInputSchema } from "../../reservations.schemas";
import type { ReserveInput } from "../../reservations.types";
import { reserveOptionsOptions, reserveUnit } from "../reservations.queries";
import type { ReserveUnitDialogProps } from "./types";

export function useReserveUnitDialog({ unitsQueryKey }: ReserveUnitDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("reserve");
  const open = z.uuid().safeParse(value).success;
  const unitId = open ? value! : "";

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("reserve");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (value !== null && !open) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("reserve");
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    }
  }, [value, open, searchParams, pathname, router]);

  const options = useQuery({ ...reserveOptionsOptions(unitId), enabled: open });
  const form = useForm<ReserveInput>({
    resolver: zodResolver(reserveInputSchema),
    values: { unitId, clientId: "" },
  });
  const mutation = useMutation({
    mutationFn: reserveUnit,
    onSuccess: (data) => {
      toast.success("تم حجز الوحدة حتى " + formatRiyadhDateTime(data.expiresAt));
      void getQueryClient().invalidateQueries({ queryKey: reservationKeys.all });
      void getQueryClient().invalidateQueries({ queryKey: unitsQueryKey });
      close();
    },
    onError: (error) => {
      applyApiError(error, form.setError);
      if (error instanceof ApiError && error.status === 409) {
        void getQueryClient().invalidateQueries({ queryKey: unitsQueryKey });
      }
    },
  });

  return {
    open,
    close,
    options,
    form,
    errors: form.formState.errors,
    isPending: mutation.isPending,
    onSubmit: form.handleSubmit((input) => {
      if (!mutation.isPending) {
        form.clearErrors();
        mutation.mutate(input);
      }
    }),
  };
}
