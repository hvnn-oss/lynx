"use client";

import api from "@/lib/api";
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
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import axios from "axios";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignupForm({
  onComplete,
}: {
  onComplete: (e: { name: string; pw: string }) => void;
}) {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<{
    email?: string;
    name?: string;
    pw?: string;
    pwRepeat?: string;
    etc?: string;
  }>({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pwRepeat, setPwRepeat] = useState("");
  const params = useSearchParams();
  const t = useTranslations("auth");

  useEffect(() => {
    const prepare = async () => {
      const token = params.get("token");
      if (!token) {
        window.location.href = "/signup";
        throw Error("Couldn't find email verify token.");
      }
      const request = authContract.verifyEmailToken.request.safeParse({ token });
      if (!request.success) {
        setError({ etc: "INVALID_SIGNUP_TOKEN" });
        setLoading(false);
        return;
      }
      try {
        const res = await api.post(
          getAuthEndpointPath(authContract.verifyEmailToken),
          request.data,
        );
        const data = authContract.verifyEmailToken.response.parse(res.data);
        setEmail(data.email);
        setLoading(false);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          setError({ etc: error.response?.data.error_code ?? "UNKNOWN_ERROR" });
        } else {
          setError({ etc: "UNKNOWN_ERROR" });
        }
        setLoading(false);
      }
    };
    prepare();
  }, [params]);

  if (error.etc)
    return (
      <div>
        <div>{t("errors.signup-verification-failed")}</div>
      </div>
    );

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="w-full h-20" />
        <Skeleton className="w-full h-20" />
        <Skeleton className="w-full h-20" />
        <Skeleton className="w-full h-20" />
      </div>
    );

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">{t("register.profile.title")}</h1>
        <p className="text-sm font-light">
          {t("register.profile.description")}
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="registerform-email">
            {t("login.email.title")}
          </FieldLabel>
          <Input id="registerform-email" value={email} disabled type="email" />
        </Field>
        <Field>
          <FieldLabel htmlFor="registerform-name">
            {t("register.name.title")}
          </FieldLabel>
          <Input
            id="registerform-name"
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={t("register.name.placeholder")}
            type="text"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="registerform-password">
            {t("register.password.title")}
          </FieldLabel>
          <Input
            id="registerform-password"
            onChange={(e) => {
              setPw(e.target.value);
            }}
            placeholder={t("register.password.placeholder")}
            type="password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="registerform-password-repeat">
            {t("register.password-repeat.title")}
          </FieldLabel>
          <Input
            id="registerform-password-repeat"
            onChange={(e) => {
              setPwRepeat(e.target.value);
            }}
            placeholder={t("register.password-repeat.placeholder")}
            type="password"
          />
        </Field>
        <Field className="mt-5">
          <Button
            type="submit"
            size={"lg"}
            onClick={() => {
              onComplete({ name, pw });
            }}
            disabled={
              name === "" || pw !== pwRepeat || pw === "" || pwRepeat === ""
            }
          >
            {!isLoading ? t("register.submit") : <DashRing />}
          </Button>
          <FieldDescription className="text-center">
            {t("common.alreadyHaveAccount")}{" "}
            <Link href="/login">{t("common.loginLink")}</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  );
}
