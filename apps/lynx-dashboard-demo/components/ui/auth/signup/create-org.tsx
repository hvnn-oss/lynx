import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function CreateOrgForm({
  onComplete,
  backward,
  isLoading = false,
  error = "",
}: {
  onComplete: (e: { name: string }) => void;
  backward: () => void;
  isLoading?: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const t = useTranslations("auth");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === "" || isLoading) return;
    onComplete({ name });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">조직을 생성합니다</h1>
        <p className="text-sm font-light">
          모든 사용자는 하나 이상의 조직에 소속되어야 합니다.
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="registerform-name">
            {t("register.org-name.title")}
          </FieldLabel>
          <Input
            id="registerform-name"
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={t("register.org-name.placeholder")}
            type="text"
            value={name}
          />
          {error !== "" && (
            <FieldDescription className="text-destructive mt-1">
              {t(error)}
            </FieldDescription>
          )}
        </Field>
        <Field className="mt-5 flex gap-2">
          <Button
            type="button"
            variant={"secondary"}
            size={"lg"}
            onClick={backward}
            disabled={isLoading}
          >
            {t("register.backward")}
          </Button>
          <Button type="submit" size={"lg"} disabled={name.trim() === "" || isLoading}>
            {isLoading ? <DashRing /> : t("register.submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
