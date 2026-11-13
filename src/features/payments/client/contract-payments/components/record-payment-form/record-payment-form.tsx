"use client";

import { Controller } from "react-hook-form";

import { MoneyInput } from "@/shared/components/money-input";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { formatRiyals } from "@/shared/lib/money";
import type { RecordPaymentFormProps } from "./types";
import { useRecordPaymentForm } from "./use-record-payment-form";

export function RecordPaymentForm(props: RecordPaymentFormProps) {
  const { form, errors, isPending, onSubmit } = useRecordPaymentForm(props);

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
      {errors.root?.message && (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2 sm:max-w-sm">
        <Label htmlFor="amount">مبلغ الدفعة (ريال)</Label>
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <MoneyInput
              id="amount"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isPending}
              aria-invalid={!!errors.amount}
              aria-describedby="amount-hint amount-error"
            />
          )}
        />
        <p id="amount-hint" className="text-sm text-muted-foreground">
          المتبقي على العقد: {formatRiyals(props.remaining)} ريال
        </p>
        {errors.amount?.message && (
          <p id="amount-error" className="text-sm text-destructive">
            {errors.amount.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "جارٍ الحفظ…" : "تسجيل الدفعة"}
      </Button>
    </form>
  );
}
