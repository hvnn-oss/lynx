"use client";

import { useState } from "react";
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
import { authContract, getAuthEndpointPath } from "@repo/contract";

export default function SSOLoginForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const query = new URLSearchParams({ email });
    window.location.href = `/api${getAuthEndpointPath(authContract.ssoLogin)}?${query}`;
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="loginform-email">
            {t("login.email.title")}
          </FieldLabel>
          <Input
            id="loginform-email"
            placeholder={t("login.email.placeholder")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
            {t("common.dontHaveAccount")}{" "}
            <Link href="/signup">{t("common.signupLink")}</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
