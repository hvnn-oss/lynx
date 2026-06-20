import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function CreateOrgForm({
  onComplete,
  backward,
}: {
  onComplete: (e: { name: string }) => void;
  backward: () => void;
}) {
  const [isLoading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const t = useTranslations("auth");

  return (
    <div>
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
          />
        </Field>
        <Field className="mt-5">
          <Button
            type="submit"
            variant={"secondary"}
            size={"lg"}
            onClick={backward}
          >
            {!isLoading ? t("register.backward") : <DashRing />}
          </Button>
          <Button type="submit" size={"lg"}>
            {!isLoading ? t("register.submit") : <DashRing />}
          </Button>
        </Field>
      </FieldGroup>
    </div>
  );
}
