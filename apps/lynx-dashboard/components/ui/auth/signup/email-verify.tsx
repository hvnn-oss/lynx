import { Button } from "@repo/ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { useTranslations } from "next-intl";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import Link from "next/link";
import { useState } from "react";
import {
  RequestVerifyCodeDto,
  ResponseVerifyCodeDto,
} from "../../../../../../packages/dto/dist";
import api from "@/lib/api";
import axios from "axios";
import { ERROR_CODES } from "../../../../../../packages/constants/dist";

export default function RegisterEmailVerifyForm({
  onSuccess,
}: {
  onSuccess: (email: string) => void;
}) {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const t = useTranslations("auth");
  const emailRegex: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    const reqBody: RequestVerifyCodeDto = {
      email: email,
    };
    try {
      const res = await api.post("/auth/signup/create-verify", reqBody);
      const data = res.data as ResponseVerifyCodeDto;
      if (!data.success) {
        throw new Error();
      }
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
        <h1 className="text-lg font-semibold">이메일을 입력해주세요</h1>
        <p className="text-sm font-light">
          작성하신 이메일로 인증 메일이 발송됩니다.
        </p>
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
              disabled={email === "" || !emailRegex.test(email) || isLoading}
              onClick={onSubmit}
            >
              {!isLoading ? t("register.send-verifycode") : <DashRing />}
            </Button>
            <FieldDescription className="text-center">
              Already have an account? <Link href="/login">Login</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </main>
  );
}
