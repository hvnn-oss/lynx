"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsLoading(true);
          setError("");
          try {
            await loginAdmin(email, password);
            router.replace("/");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "로그인 정보를 확인해 주세요.",
            );
          } finally {
            setIsLoading(false);
          }
        }}
      >
        <div className="brand-mark">L</div>
        <div className="auth-heading">
          <h1>관리자 로그인</h1>
          <p>활성화된 Lynx 관리자 계정만 접근할 수 있습니다.</p>
        </div>
        <label className="field">
          <span>이메일</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            autoComplete="current-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          className="button button-primary button-block"
          disabled={isLoading}
        >
          {isLoading ? "권한 확인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
