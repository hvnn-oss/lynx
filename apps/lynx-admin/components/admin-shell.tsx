"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getAdminOverview, logoutAdmin } from "@/lib/admin-api";
import type { AdminOverview } from "@/lib/admin-types";
import { ErrorState, LoadingState } from "./ui";

const navigation = [
  { href: "/", label: "운영 요약", description: "전체 상태" },
  { href: "/audit-logs", label: "감사 기록", description: "변경과 데이터" },
  { href: "/organizations", label: "조직 관리", description: "고객과 사용량" },
  { href: "/users", label: "사용자 관리", description: "계정과 관리자 권한" },
  {
    href: "/api-keys",
    label: "API Key",
    description: "키 상태와 OpenAPI 사용량",
  },
  { href: "/pilot", label: "파일럿 관리", description: "초대와 접근 권한" },
  { href: "/plans", label: "요금제 관리", description: "한도와 기능" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  const loadSession = () => {
    setError("");
    getAdminOverview()
      .then(setOverview)
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error ? cause.message : "관리자 인증이 필요합니다.";
        setError(message);
      });
  };

  useEffect(() => {
    let isCurrent = true;
    getAdminOverview()
      .then((result) => {
        if (isCurrent) setOverview(result);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setError(
          cause instanceof Error ? cause.message : "관리자 인증이 필요합니다.",
        );
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (!overview && !error) {
    return <LoadingState label="관리자 권한을 확인하고 있습니다." />;
  }
  if (!overview) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand-mark">L</div>
          <ErrorState message={error} onRetry={loadSession} />
          <button
            className="button button-primary button-block"
            onClick={() => router.replace("/login")}
          >
            관리자 로그인
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark brand-mark-small">L</span>
          <div>
            <strong>Lynx Admin</strong>
            <span>운영 관리 콘솔</span>
          </div>
        </div>
        <nav>
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-item nav-item-active" : "nav-item"}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">
            {overview.currentAdmin.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{overview.currentAdmin.name}</strong>
            <span>{overview.currentAdmin.email}</span>
          </div>
          <button
            title="로그아웃"
            onClick={async () => {
              await logoutAdmin();
              router.replace("/login");
            }}
          >
            나가기
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
