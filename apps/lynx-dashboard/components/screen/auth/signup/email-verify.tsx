import { requestContract } from "@/lib/api";
import { ERROR_CODES } from "@repo/constants";
import { authContract } from "@repo/contract";
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
import { withRedirect } from "@/lib/safe-redirect";

export default function RegisterEmailVerifyForm({
  invitationToken,
  teamInvitationCode,
  redirectTo,
  onSuccess,
}: {
  invitationToken?: string;
  teamInvitationCode?: string;
  redirectTo: string;
  onSuccess: (email: string) => void;
}) {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const t = useTranslations("auth");
  const accessT = useTranslations("access");
  const isEmailValid = authContract.createEmailVerification.request.safeParse({
    email,
    invitation_token: invitationToken,
    team_invitation_code: teamInvitationCode,
    redirects: redirectTo,
  }).success;

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    const request = authContract.createEmailVerification.request.safeParse({
      email,
      invitation_token: invitationToken,
      team_invitation_code: teamInvitationCode,
      redirects: redirectTo,
    });
    if (!request.success) {
      setError("errors.unknown");
      setLoading(false);
      return;
    }
    try {
      await requestContract({
        basePath: authContract.basePath,
        endpoint: authContract.createEmailVerification,
        request: request.data,
      });
      onSuccess(email);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorCode =
          error.response?.data.code ?? error.response?.data.error_code;
        if (errorCode === ERROR_CODES.ORG_MUST_USE_SSO) {
          setError("errors.org-must-use-sso");
          setLoading(false);
          return;
        }
        if (
          errorCode === ERROR_CODES.COULD_NOT_SEND_EMAIL
        ) {
          setError("errors.could-not-send-email");
          setLoading(false);
          return;
        }
        if (
          errorCode === ERROR_CODES.USER_ALREADY_EXISTS
        ) {
          setError("errors.user_already_exists");
          setLoading(false);
          return;
        }
        if (
          errorCode === ERROR_CODES.SIGNUP_INVITATION_REQUIRED ||
          errorCode === ERROR_CODES.INVALID_ACCESS_INVITATION ||
          errorCode === ERROR_CODES.TEAM_INVITATION_NOT_FOUND ||
          errorCode === ERROR_CODES.TEAM_INVITATION_EMAIL_MISMATCH
        ) {
          setError("invalid-invitation");
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
                {error === "invalid-invitation"
                  ? accessT("signup.invalidInvitation")
                  : t(error)}
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
              <Link href={withRedirect("/login", redirectTo)}>
                {t("common.loginLink")}
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </main>
  );
}
