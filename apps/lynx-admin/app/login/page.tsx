import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { login } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

const errorMessages: Record<string, string> = {
  "invalid-credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
  forbidden: "어드민 권한이 없는 계정입니다.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <section className="w-full max-w-sm rounded-lg border bg-background p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border bg-muted">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-normal">
              Lynx Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              어드민 권한이 있는 계정으로 로그인합니다.
            </p>
          </div>
        </div>

        <form action={login} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" name="password" type="password" required />
            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
      </section>
    </main>
  );
}
