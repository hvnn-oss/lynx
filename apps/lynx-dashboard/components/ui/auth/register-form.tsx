"use client";
import { useState } from "react";
import RegisterEmailVerifyForm from "./signup/email-verify";
import RegisterEmailSent from "./signup/email-sent";

export default function RegisterForm() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");

  return (
    <div>
      {step === 0 && (
        <RegisterEmailVerifyForm
          onSuccess={(email: string) => {
            setStep(1);
            setEmail(email);
          }}
        />
      )}
      {step === 1 && <RegisterEmailSent email={email} />}
    </div>
  );
}
