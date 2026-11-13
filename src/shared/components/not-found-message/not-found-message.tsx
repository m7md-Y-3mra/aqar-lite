import Link from "next/link";

import { buttonVariants } from "@/shared/components/ui/button";

export function NotFoundMessage() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">الصفحة غير موجودة</h1>
      <p className="text-muted-foreground">لم نجد ما تبحث عنه، أو ليست لديك صلاحية الوصول إليه.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        العودة إلى الرئيسية
      </Link>
    </section>
  );
}
