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
import { RequestVerifyCodeDto } from "../../../../../../packages/dto/dist";

export default function RegisterEmailVerifyForm() {
  const [isLoading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const t = useTranslations("auth");

  const onSubmit = () => {
    const reqBody: RequestVerifyCodeDto = {
      email: email,
    };
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
              type="email"
            />
          </Field>
          <Field>
            <Button type="submit" size={"lg"} disabled={isLoading}>
              {!isLoading ? "인증 메일 전송" : <DashRing />}
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
