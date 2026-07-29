"use client";

import {
  clearStoredAccessToken,
  getStoredAccessToken,
  isAccessTokenExpired,
  refreshAccessToken,
  requestContract,
} from "@/lib/api";
import { withRedirect } from "@/lib/safe-redirect";
import { teamInvitationContract } from "@repo/contract";
import type { TeamInvitationDetailsResponseDto } from "@repo/dto";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Building2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeamInvitationPage() {
  const t = useTranslations("teamInvite");
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [invitation, setInvitation] =
    useState<TeamInvitationDetailsResponseDto | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");
  const invitePath = code ? `/invite?code=${encodeURIComponent(code)}` : "/invite";

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!code) {
        setError(t("invalid"));
        setIsAuthenticated(false);
        return;
      }

      try {
        const details = await requestContract({
          basePath: teamInvitationContract.basePath,
          endpoint: teamInvitationContract.get,
          request: { code },
        });
        if (isMounted) setInvitation(details);
      } catch {
        if (isMounted) setError(t("invalid"));
      }

      const accessToken = getStoredAccessToken();
      if (accessToken && !isAccessTokenExpired(accessToken)) {
        if (isMounted) setIsAuthenticated(true);
        return;
      }
      try {
        await refreshAccessToken();
        if (isMounted) setIsAuthenticated(true);
      } catch {
        clearStoredAccessToken();
        if (isMounted) setIsAuthenticated(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [code, t]);

  async function acceptInvitation() {
    if (!code) return;
    setIsAccepting(true);
    setError("");
    try {
      const response = await requestContract({
        basePath: teamInvitationContract.basePath,
        endpoint: teamInvitationContract.accept,
        request: { code },
      });
      window.location.href = response.redirectTo;
    } catch {
      setError(t("acceptFailed"));
      setIsAccepting(false);
    }
  }

  if (!invitation && !error) {
    return <Skeleton className="h-56 w-full" />;
  }

  if (!invitation) {
    return (
      <main>
        <h1 className="text-lg font-semibold">{t("invalidTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-6 w-full" variant="outline" asChild>
          <Link href="/login">{t("goToLogin")}</Link>
        </Button>
      </main>
    );
  }

  const signupQuery = new URLSearchParams({
    teamInvite: code!,
    redirects: invitePath,
  });

  return (
    <main>
      <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/30">
        <Building2 className="size-5" />
      </div>
      <h1 className="mt-5 text-lg font-semibold">
        {t("title", { organization: invitation.organizationName })}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("description", {
          email: invitation.emailHint,
          role: invitation.role,
        })}
      </p>
      <div className="mt-5 rounded-lg border bg-muted/20 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("organization")}</span>
          <span className="font-medium">{invitation.organizationName}</span>
        </div>
        <div className="mt-3 flex justify-between gap-4">
          <span className="text-muted-foreground">{t("role")}</span>
          <span className="font-medium">{invitation.role}</span>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {isAuthenticated === true ? (
        <Button
          className="mt-6 w-full"
          disabled={isAccepting}
          onClick={() => void acceptInvitation()}
        >
          <UserPlus className="size-4" />
          {isAccepting ? t("accepting") : t("accept")}
        </Button>
      ) : isAuthenticated === false ? (
        <div className="mt-6 grid gap-2">
          <Button asChild>
            <Link href={`/signup?${signupQuery.toString()}`}>
              {t("createAccount")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={withRedirect("/login", invitePath)}>
              {t("signIn")}
            </Link>
          </Button>
        </div>
      ) : (
        <Skeleton className="mt-6 h-9 w-full" />
      )}
    </main>
  );
}
