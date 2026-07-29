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
import { useState } from "react";
import { requestContract, setStoredAccessToken } from "@/lib/api";
import axios from "axios";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import { authContract } from "@repo/contract";
import { withRedirect } from "@/lib/safe-redirect";

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginResult = authContract.login.request.safeParse({ email, password });
    if (!loginResult.success) {
      setError("errors.unknown");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await requestContract({
        basePath: authContract.basePath,
        endpoint: authContract.login,
        request: loginResult.data,
      });
      setStoredAccessToken(response.access_token);
      window.location.href = redirectTo;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        // Validation errors returned as array of objects in response.data.errors
        const errors = err.response?.data?.errors;
        const errCode =
          err.response?.data?.code ||
          err.response?.data?.error_code ||
          (errors && errors[0]?.error_code);
        if (errCode === "INVALID_CREDENTIALS") {
          setError("errors.invalid-credentials");
        } else if (errCode === "ORG_MUST_USE_SSO") {
          setError("errors.org-must-use-sso");
        } else {
          setError("errors.unknown");
        }
      } else {
        setError("errors.unknown");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
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
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="loginform-password">
            {t("login.password.title")}
          </FieldLabel>
          <Input
            id="loginform-password"
            placeholder={t("login.password.placeholder")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error !== "" && (
            <FieldDescription className="text-destructive mt-1">
              {t(error)}
            </FieldDescription>
          )}
        </Field>
        <Field>
          <Button
            type="submit"
            size={"lg"}
            disabled={isLoading || !email || !password}
          >
            {isLoading ? <DashRing /> : t("login.buttons.title")}
          </Button>
          <div className="flex gap-2 text-xs items-center">
            <div className="flex-1 h-px bg-foreground/30"></div>
            <p>{t("login.or")}</p>
            <div className="flex-1 h-px bg-foreground/30"></div>
          </div>
          <Link
            href=""
            onClick={(e) => {
              e.preventDefault();
              alert(t("errors.sso-disabled"));
            }}
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "mb-3",
            )}
          >
            {t("login.buttons.sso")}
          </Link>
          <FieldDescription className="text-center">
            {t("common.dontHaveAccount")}{" "}
            <Link href={withRedirect("/signup", redirectTo)}>
              {t("common.signupLink")}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
