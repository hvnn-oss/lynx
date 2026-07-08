import { useTranslations } from "next-intl";

export default function RegisterEmailSent({ email }: { email: string }) {
  const t = useTranslations("auth");
  return (
    <div>
      <h1 className="text-lg font-semibold">
        {t("register.verify-email.check-inbox")}
      </h1>
      <p className="text-sm font-light">
        {t("register.verify-email.check-inbox-description", { email: email })}
      </p>
    </div>
  );
}
