"use client";
import AuthLayout from "@/components/layout/auth/layout";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  isAccessTokenExpired,
  refreshAccessToken,
} from "@/lib/api";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolveAuthState = async () => {
      const token = getStoredAccessToken();
      if (token && !isAccessTokenExpired(token)) {
        window.location.href = "/dashboard";
        return;
      }

      try {
        await refreshAccessToken();
        window.location.href = "/dashboard";
      } catch {
        clearStoredAccessToken();
        if (isMounted) setIsAnonymous(true);
      }
    };

    void resolveAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAnonymous === null) {
    return null;
  }

  return (
    <div>
      <AuthLayout>{children}</AuthLayout>
    </div>
  );
}
