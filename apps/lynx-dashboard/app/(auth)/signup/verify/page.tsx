"use client";

import CreateOrgForm from "@/components/screen/auth/signup/create-org";
import SignupForm from "@/components/screen/auth/signup/signup";
import { authContract } from "@repo/contract";
import type { SignUpDto } from "@repo/dto";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { requestContract } from "@/lib/api";
import axios from "axios";
import { getSafeRedirect, withRedirect } from "@/lib/safe-redirect";

export default function Signup() {
  const param = useSearchParams();
  const token = param.get("token");
  const requestedRedirect = getSafeRedirect(param.get("redirects"));
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [signUpData, setData] = useState<SignUpDto>({
    name: "",
    password: "",
    token: token || "",
    organization_info: {
      name: "",
    },
  });

  useEffect(() => {
    if (!token) {
      window.location.href = withRedirect("/signup", requestedRedirect);
    }
  }, [requestedRedirect, token]);

  async function submitSignup(
    data: SignUpDto,
    redirectAfterLogin: string,
  ): Promise<void> {
    setData(data);
    setIsLoading(true);
    setError("");
    const request = authContract.signUp.request.safeParse(data);
    if (!request.success) {
      setError("errors.unknown");
      setIsLoading(false);
      return;
    }
    try {
      await requestContract({
        basePath: authContract.basePath,
        endpoint: authContract.signUp,
        request: request.data,
      });
      window.location.href = withRedirect("/login", redirectAfterLogin);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const errors = err.response?.data?.errors;
        const errCode =
          err.response?.data?.code ||
          err.response?.data?.error_code ||
          (errors && errors[0]?.error_code);
        if (errCode === "USER_ALREADY_EXISTS") {
          setError("errors.user_already_exists");
        } else if (errCode === "INVALID_SIGNUP_TOKEN") {
          setError("errors.invalid-signup-token");
        } else {
          setError("errors.unknown");
        }
      } else {
        setError("errors.unknown");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main>
      {step === 0 && (
        <SignupForm
          onComplete={(e) => {
            const profileData: SignUpDto = {
              token: token || "",
              name: e.name,
              password: e.pw,
            };
            setData((prev) => ({
              ...prev,
              name: e.name,
              password: e.pw,
            }));
            if (!e.requiresOrganization) {
              // 팀 초대 가입은 서버가 멤버십을 생성하므로 조직 생성 단계를 건너뜁니다.
              void submitSignup(profileData, "/dashboard");
              return;
            }
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <CreateOrgForm
          isLoading={isLoading}
          error={error}
          onComplete={async (e) => {
            const updatedData: SignUpDto = {
              ...signUpData,
              organization_info: {
                name: e.name,
              },
            };
            await submitSignup(updatedData, requestedRedirect);
          }}
          backward={() => {
            setStep(0);
          }}
        />
      )}
    </main>
  );
}
