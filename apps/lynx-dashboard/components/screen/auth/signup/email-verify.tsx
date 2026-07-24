import api from "@/lib/api";
import { ERROR_CODES } from "@repo/constants";
import { authContract, getAuthEndpointPath } from "@repo/contract";
import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import axios from "axios";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

export default function RegisterEmailVerifyForm({
  onSuccess,
}: {
  onSuccess: (email: string) => void;
}) {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const t = useTranslations("auth");
  const isEmailValid = authContract.createEmailVerification.request.safeParse({
    email,
  }).success;

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    const request = authContract.createEmailVerification.request.safeParse({
      email,
    });
    if (!request.success) {
      setError("errors.unknown");
      setLoading(false);
      return;
    }
    try {
      const res = await api.post(
        getAuthEndpointPath(authContract.createEmailVerification),
        request.data,
      );
      authContract.createEmailVerification.response.parse(res.data);
      onSuccess(email);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data.error_code === ERROR_CODES.ORG_MUST_USE_SSO) {
          setError("errors.org-must-use-sso");
          setLoading(false);
          return;
        }
        if (
          error.response?.data.error_code === ERROR_CODES.COULD_NOT_SEND_EMAIL
        ) {
          setError("errors.could-not-send-email");
          setLoading(false);
          return;
        }
        if (
          error.response?.data.error_code === ERROR_CODES.USER_ALREADY_EXISTS
        ) {
          setError("errors.user_already_exists");
          setLoading(false);
          return;
        }
      }
      setError("errors.unknown");
      setLoading(false);
      return;
    }
  };

  return (
    <main>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">{t("register.intro.title")}</h1>
        <p className="text-sm font-light">{t("register.intro.description")}</p>
      </div>
      <div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="loginform-email">
              {t("login.email.title")}
            </FieldLabel>
            <Input
              id="loginform-email"
              placeholder={t("login.email.placeholder")}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              type="email"
            />
            {error !== "" && (
              <FieldDescription className="text-destructive">
                {t(error)}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <Button
              type="submit"
              size={"lg"}
              disabled={!isEmailValid || isLoading}
              onClick={onSubmit}
            >
              {!isLoading ? t("register.send-verifycode") : <DashRing />}
            </Button>
            <FieldDescription className="text-center">
              {t("common.alreadyHaveAccount")}{" "}
              <Link href="/login">{t("common.loginLink")}</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </main>
  );
}
