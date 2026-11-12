"use client";

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import type { ClientFormFieldsProps } from "./types";
import { useClientFormFields } from "./use-client-form-fields";

export function ClientFormFields(props: ClientFormFieldsProps) {
  const { form, errors, isPending, onSubmit } = useClientFormFields(props);
  const { register } = form;
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      {errors.root?.message && (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">اسم العميل</Label>
        <Input
          id="name"
          aria-invalid={!!errors.name}
          aria-describedby="name-error"
          {...register("name")}
        />
        {errors.name?.message && (
          <p id="name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">الهاتف</Label>
        <Input
          id="phone"
          type="tel"
          dir="ltr"
          aria-invalid={!!errors.phone}
          aria-describedby="phone-error"
          {...register("phone")}
        />
        {errors.phone?.message && (
          <p id="phone-error" className="text-sm text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">الملاحظات</Label>
        <Textarea
          id="notes"
          aria-invalid={!!errors.notes}
          aria-describedby="notes-error"
          {...register("notes")}
        />
        {errors.notes?.message && (
          <p id="notes-error" className="text-sm text-destructive">
            {errors.notes.message}
          </p>
        )}
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {props.mode === "edit" ? "حفظ التعديلات" : "إضافة عميل"}
        </Button>
      </div>
    </form>
  );
}
