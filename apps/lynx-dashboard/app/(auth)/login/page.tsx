"use client";
import LoginForm from "@/components/screen/auth/login-form";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  isAccessTokenExpired,
  refreshAccessToken,
} from "@/lib/api";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirects"));
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolveAuthState = async () => {
      const token = getStoredAccessToken();
      if (token && !isAccessTokenExpired(token)) {
        window.location.href = redirectTo;
        return;
      }

      try {
        await refreshAccessToken();
        window.location.href = redirectTo;
      } catch {
        clearStoredAccessToken();
        if (isMounted) setIsAnonymous(true);
      }
    };

    void resolveAuthState();

    return () => {
      isMounted = false;
    };
  }, [redirectTo]);

  if (isAnonymous === null) {
    return null;
  }
  return (
    <main>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">{t("login.title")}</h1>
        <p className="text-sm font-light">{t("login.subTitle")}</p>
      </div>
      <LoginForm redirectTo={redirectTo} />
    </main>
  );
}
