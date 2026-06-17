"use client";

import { Input } from "@repo/ui/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function SSOLoginForm() {
  const t = useTranslations("auth");
  return (
    <div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="loginform-email">
            {t("login.email.title")}
          </FieldLabel>
          <Input
            id="loginform-email"
            placeholder={t("login.email.placeholder")}
            type="email"
          />
        </Field>
        <Field>
          <Button type="submit" size={"lg"}>
            {t("login.buttons.title")}
          </Button>
          <div className="flex gap-2 text-xs items-center">
            <div className="flex-1 h-px bg-foreground/30"></div>
            <p>{t("login.or")}</p>
            <div className="flex-1 h-px bg-foreground/30"></div>
          </div>
          <Link
            href={"/login"}
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "mb-3",
            )}
            type="submit"
          >
            {t("login.buttons.local")}
          </Link>
          <FieldDescription className="text-center">
            Don&apos;t have an account? <Link href="/register">Sign up</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  );
}
