"use client";

import CreateOrgForm from "@/components/screen/auth/signup/create-org";
import SignupForm from "@/components/screen/auth/signup/signup";
import { authContract } from "@repo/contract";
import type { SignUpDto } from "@repo/dto";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { requestContract } from "@/lib/api";
import axios from "axios";

export default function Signup() {
  const param = useSearchParams();
  const token = param.get("token");
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
      window.location.href = "/signup";
    }
  }, [token]);

  return (
    <main>
      {step === 0 && (
        <SignupForm
          onComplete={(e) => {
            setData((prev) => ({
              ...prev,
              name: e.name,
              password: e.pw,
            }));
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
            setData(updatedData);
            setIsLoading(true);
            setError("");
            const request = authContract.signUp.request.safeParse(updatedData);
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
              window.location.href = "/login";
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
          }}
          backward={() => {
            setStep(0);
          }}
        />
      )}
    </main>
  );
}
