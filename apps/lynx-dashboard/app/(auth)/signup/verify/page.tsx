"use client";

import CreateOrgForm from "@/components/ui/auth/signup/create-org";
import SignupForm from "@/components/ui/auth/signup/signup";
import { RequestRegisterDto } from "@repo/dto";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Signup() {
  const [step, setStep] = useState(1);
  const [signUpData, setData] = useState<RequestRegisterDto>({
    name: "",
    password: "",
    token: "",
    organization_info: {
      name: "",
    },
  });
  const param = useSearchParams();

  useEffect(() => {
    const temp = signUpData;
    const token = param.get("token");
    if (!token) {
      window.location.href = "/signup";
      throw Error("Couldn't find email verify token.");
    }
    temp.token = token;
    setData(temp);
  }, [param, signUpData]);

  return (
    <main>
      {step === 0 && (
        <SignupForm
          onComplete={(e) => {
            const temp = signUpData;
            temp.name = e.name;
            temp.password = e.pw;
            setData(temp);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <CreateOrgForm
          onComplete={(e) => {
            let temp = signUpData;
            temp.organization_info = {
              name: e.name,
            };
            setData(temp);
            setStep(1);
          }}
          backward={() => {
            setStep(0);
          }}
        />
      )}
    </main>
  );
}
