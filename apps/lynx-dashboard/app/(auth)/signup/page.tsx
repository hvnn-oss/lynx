"use client";
import RegisterForm from "@/components/screen/auth/register-form";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  isAccessTokenExpired,
  refreshAccessToken,
} from "@/lib/api";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirects"));

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
      <RegisterForm />
    </main>
  );
}
