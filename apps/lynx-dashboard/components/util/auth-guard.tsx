"use client";

import { useEffect, useState } from "react";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  isAccessTokenExpired,
  refreshAccessToken,
} from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const cleanSsoQuery = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("sso") !== "success") return;

      urlParams.delete("sso");
      const newSearch = urlParams.toString();
      const cleanUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, document.title, cleanUrl);
    };

    const authenticate = async () => {
      cleanSsoQuery();

      const token = getStoredAccessToken();
      if (token && !isAccessTokenExpired(token)) {
        if (isMounted) setIsAuthenticated(true);
        return;
      }

      try {
        await refreshAccessToken();
        if (isMounted) setIsAuthenticated(true);
      } catch {
        clearStoredAccessToken();
        window.location.href = "/login";
      }
    };

    void authenticate();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAuthenticated === null) {
    return null;
  }

  return <>{children}</>;
}
