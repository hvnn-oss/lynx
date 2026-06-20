"use client";

import { useEffect, useState } from "react";

// 로그인 유무를 감지하여 비인증 사용자를 로그인 페이지로 강제 이동시키는 권한 보호 컴포넌트입니다.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // URL에서 sso_token 쿼리 파라미터를 추출하고, 존재하면 로컬 스토리지에 저장 후 URL을 정리합니다.
    const urlParams = new URLSearchParams(window.location.search);
    const ssoToken = urlParams.get("sso_token");
    if (ssoToken) {
      localStorage.setItem("_uid", ssoToken);
      urlParams.delete("sso_token");
      const newSearch = urlParams.toString();
      const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // 로컬 스토리지에 유효한 세션 토큰이 존재하는지 확인합니다.
    const token = localStorage.getItem("_uid");
    if (!token) {
      window.location.href = "/login";
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  // 인증이 확인될 때까지 콘텐츠 렌더링을 지연시킵니다.
  if (isAuthenticated === null) {
    return null;
  }

  return <>{children}</>;
}
