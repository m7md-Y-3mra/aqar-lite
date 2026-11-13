"use client";

import Link from "next/link";

import { ErrorState } from "@/shared/components/error-state";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/shared/components/ui/native-select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { ReserveUnitDialogProps } from "./types";
import { useReserveUnitDialog } from "./use-reserve-unit-dialog";

export function ReserveUnitDialog(props: ReserveUnitDialogProps) {
  const { open, close, options, form, errors, isPending, onSubmit } = useReserveUnitDialog(props);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
    >
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>حجز الوحدة</DialogTitle>
          <DialogDescription>اختر عميلاً لتأكيد حجز الوحدة لمدة ٧٢ ساعة.</DialogDescription>
        </DialogHeader>
        {options.isPending ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">جارٍ التحميل…</span>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        ) : options.isError ? (
          <ErrorState
            message="تعذر تحميل بيانات الحجز. حاول مرة أخرى."
            onRetry={() => void options.refetch()}
          />
        ) : (
          <div className="space-y-4">
            <p>
              {options.data.unit.projectName} – {options.data.unit.number}
            </p>
            {options.data.unit.status !== "AVAILABLE" ? (
              <>
                <p>هذه الوحدة لم تعد متاحة. اختر وحدة أخرى.</p>
                <Button variant="outline" onClick={close}>
                  إغلاق
                </Button>
              </>
            ) : options.data.clients.length === 0 ? (
              <Link href="/clients/new" className={buttonVariants({ variant: "link" })}>
                أضف عميلاً أولاً
              </Link>
            ) : (
              <form noValidate onSubmit={onSubmit} className="space-y-4">
                {errors.root?.message && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.root.message}</AlertDescription>
                  </Alert>
                )}
                <input type="hidden" {...form.register("unitId")} />
                {errors.unitId?.message && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.unitId.message}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reserve-client">العميل</Label>
                  <NativeSelect
                    id="reserve-client"
                    className="w-full"
                    aria-invalid={!!errors.clientId}
                    aria-describedby="reserve-client-error"
                    disabled={isPending}
                    {...form.register("clientId")}
                  >
                    <NativeSelectOption value="">اختر عميلاً</NativeSelectOption>
                    {options.data.clients.map((client) => (
                      <NativeSelectOption key={client.id} value={client.id}>
                        {client.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {errors.clientId?.message && (
                    <p id="reserve-client-error" className="text-sm text-destructive">
                      {errors.clientId.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isPending}>
                  تأكيد الحجز
                </Button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
