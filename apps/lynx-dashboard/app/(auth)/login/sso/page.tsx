import SSOLoginForm from "@/components/screen/auth/sso-form";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("auth");
  return (
    <main>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">{t("login.title")}</h1>
        <p className="text-sm font-light">{t("login.subTitle")}</p>
      </div>
      <SSOLoginForm />
    </main>
  );
}
