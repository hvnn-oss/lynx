"use client";
import { requestContract } from "@/lib/api";
import { authContract } from "@repo/contract";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSafeRedirect, withRedirect } from "@/lib/safe-redirect";
import RegisterEmailVerifyForm from "./signup/email-verify";
import RegisterEmailSent from "./signup/email-sent";

export default function RegisterForm() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [requiresInvitation, setRequiresInvitation] = useState<boolean | null>(
    null,
  );
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invite") ?? undefined;
  const teamInvitationCode = searchParams.get("teamInvite") ?? undefined;
  const redirectTo = getSafeRedirect(searchParams.get("redirects"));
  const isBootstrapSignup = searchParams.get("bootstrap") === "1";
  const t = useTranslations("access");

  useEffect(() => {
    void requestContract({
      basePath: authContract.basePath,
      endpoint: authContract.signupPolicy,
    })
      .then((policy) => setRequiresInvitation(policy.requiresInvitation))
      .catch(() => setRequiresInvitation(false));
  }, []);

  if (requiresInvitation === null) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (
    requiresInvitation &&
    !invitationToken &&
    !teamInvitationCode &&
    !isBootstrapSignup
  ) {
    return (
      <section>
        <h1 className="text-lg font-semibold">
          {t("signup.invitationRequiredTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("signup.invitationRequiredDescription")}
        </p>
        <Button className="mt-6 w-full" variant="outline" asChild>
          <Link href={withRedirect("/login", redirectTo)}>
            {t("signup.goToLogin")}
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <div>
      {step === 0 && (
        <RegisterEmailVerifyForm
          invitationToken={invitationToken}
          teamInvitationCode={teamInvitationCode}
          redirectTo={redirectTo}
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
