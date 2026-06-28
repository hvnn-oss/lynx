"use client";

import axios from "axios";
import { useEffect, useState } from "react";

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

    const refreshAccessToken = async () => {
      const res = await axios.post(
        "/api/auth/refresh",
        {},
        { withCredentials: true },
      );

      if (!res.data?.success || !res.data?.accessToken) {
        throw new Error("Could not refresh access token.");
      }

      localStorage.setItem("_uid", res.data.accessToken);
    };

    const authenticate = async () => {
      cleanSsoQuery();

      const token = localStorage.getItem("_uid");
      if (token) {
        if (isMounted) setIsAuthenticated(true);
        return;
      }

      try {
        await refreshAccessToken();
        if (isMounted) setIsAuthenticated(true);
      } catch {
        localStorage.removeItem("_uid");
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
