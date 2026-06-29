import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Building2,
  CheckSquare,
  CreditCard,
  Database,
  LogOut,
  Plus,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "@/lib/auth";
import type { AdminDashboard, AdminPlan } from "@/lib/admin-types";
import { adminFetch } from "@/lib/backend";
import { OrganizationWorkspacePlanManager } from "@/components/admin/organization-workspace-plan-manager";
import {
  createPlan,
  updateOrganization,
  updatePlan,
  updateUser,
  updateWorkspace,
} from "./actions";

export const dynamic = "force-dynamic";

const TODO_ITEMS = [
  {
    title: "가드레일 정책 관리",
    body: "조직별 정책 목록, 활성화 상태, 기본 정책 배포, 차단 로그 조회를 어드민에서 확인할 수 있게 만든다.",
  },
  {
    title: "가드레일 긴급 제어",
    body: "위험 정책을 빠르게 끄거나 FAIL_OPEN/FAIL_CLOSED 동작을 조정하는 안전한 승인 흐름을 추가한다.",
  },
  {
    title: "프롬프트 버전 관리",
    body: "프롬프트 버전 목록, 배포 상태, 실행 데이터 연결, 롤백 후보를 어드민에서 볼 수 있게 만든다.",
  },
  {
    title: "프롬프트 변경 감사",
    body: "누가 어떤 버전을 만들고 배포했는지 감사 로그와 실행 영향 범위를 함께 남긴다.",
  },
];

export default async function AdminPage() {
  const data = await adminFetch<AdminDashboard>("/admin/dashboard");
  const isSuperAdmin = data.me.role === "SUPER_ADMIN";

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Internal console
            </p>
            <h1 className="text-xl font-semibold tracking-normal">
              Lynx Admin
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.me.name} · {data.me.email} · {data.me.role}
            </p>
          </div>
          <form action={logout}>
            <Button variant="outline" size="sm">
              <LogOut className="size-3.5" />
              로그아웃
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <nav className="flex flex-wrap gap-2 text-sm">
          <NavLink href="#plans">요금제</NavLink>
          <NavLink href="#billing">로그 과금</NavLink>
          <NavLink href="#organization-workspace-plans">
            조직별 플랜
          </NavLink>
          <NavLink href="#users">사용자</NavLink>
          <NavLink href="#organizations">조직</NavLink>
          <NavLink href="#workspaces">워크스페이스</NavLink>
          <NavLink href="#roadmap">운영 TODO</NavLink>
        </nav>

        <section className="grid gap-3 md:grid-cols-4">
          <SummaryCard
            icon={<CreditCard className="size-4" />}
            label="요금제"
            value={`${data.counts.plans}개`}
            helper="DB에 등록된 플랜"
          />
          <SummaryCard
            icon={<UserRound className="size-4" />}
            label="사용자"
            value={`${data.counts.users}명`}
            helper="최근 50명 표시"
          />
          <SummaryCard
            icon={<Building2 className="size-4" />}
            label="조직"
            value={`${data.counts.organizations}개`}
            helper="최근 50개 표시"
          />
          <SummaryCard
            icon={<Database className="size-4" />}
            label="워크스페이스"
            value={`${data.counts.workspaces}개`}
            helper="최근 50개 표시"
          />
        </section>

        <Panel
          id="plans"
          title="요금제 관리"
          description="유저 수는 제한하지 않고, 보존 기간과 월 포함 로그 수, 초과 로그 단가를 플랜 기준으로 관리합니다."
        >
          {isSuperAdmin ? <CreatePlanForm /> : null}
          <div className="space-y-3">
            {data.plans.map((plan) => (
              <PlanForm key={plan.code} plan={plan} />
            ))}
          </div>
        </Panel>

        <Panel
          id="billing"
          title="로그 과금"
          description="각 플랜의 포함 로그 수와 초과 로그 1건당 단가를 빠르게 조정합니다. 실제 청구 계산은 이 값을 기준으로 별도 집계에서 처리합니다."
        >
          <div className="divide-y">
            {data.plans.map((plan) => (
              <form
                key={plan.code}
                action={updatePlan}
                className="grid gap-3 py-3 lg:grid-cols-[120px_1fr_1fr_120px]"
              >
                <input type="hidden" name="code" value={plan.code} />
                <input type="hidden" name="name" value={plan.name} />
                <input
                  type="hidden"
                  name="retentionDays"
                  value={plan.retentionDays}
                />
                <input
                  type="hidden"
                  name="monthlyEventLimit"
                  value={plan.monthlyEventLimit ?? ""}
                />
                <input
                  type="hidden"
                  name="features"
                  value={JSON.stringify(plan.features)}
                />
                {plan.isActive ? (
                  <input type="hidden" name="isActive" value="on" />
                ) : null}
                <div className="flex items-center">
                  <Badge>{plan.code}</Badge>
                </div>
                <Field label="월 포함 로그 수">
                  <Input
                    name="includedLogCount"
                    type="number"
                    defaultValue={plan.includedLogCount ?? ""}
                    min={1}
                    placeholder="무제한이면 비움"
                  />
                </Field>
                <Field label="초과 로그 단가">
                  <Input
                    name="logOverageUnitPrice"
                    type="number"
                    step="0.000001"
                    defaultValue={plan.logOverageUnitPrice ?? ""}
                    min={0}
                    placeholder="예: 0.000001"
                  />
                </Field>
                <div className="flex items-end">
                  <Button type="submit" size="sm" variant="outline">
                    저장
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </Panel>

        <Panel
          id="organization-workspace-plans"
          title="조직별 워크스페이스 요금제"
          description="조직을 이름 또는 ID로 검색한 뒤, 해당 조직의 워크스페이스를 선택해 적용 플랜을 조정합니다."
        >
          <OrganizationWorkspacePlanManager plans={data.plans} />
        </Panel>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel
            id="users"
            title="사용자"
            description="이름과 이메일만 수정합니다. 비밀번호와 로그인 계정 처리는 인증 영역에서만 다룹니다."
          >
            {data.users.map((user) => (
              <form
                key={user.id}
                action={updateUser}
                className="grid gap-3 border-b py-3 last:border-b-0 md:grid-cols-[1fr_1fr_auto]"
              >
                <input type="hidden" name="id" value={user.id} />
                <Field label={user.id.slice(0, 8)}>
                  <Input name="email" defaultValue={user.email} required />
                </Field>
                <Field label="이름">
                  <Input name="name" defaultValue={user.name} required />
                </Field>
                <div className="flex items-end">
                  <Button type="submit" size="sm" variant="outline">
                    저장
                  </Button>
                </div>
              </form>
            ))}
          </Panel>

          <Panel
            id="organizations"
            title="조직"
            description="조직명과 기본 SSO 상태를 수정합니다. 삭제 대신 비활성화 흐름을 별도로 두는 방향입니다."
          >
            {data.organizations.map((organization) => (
              <form
                key={organization.id}
                action={updateOrganization}
                className="space-y-3 border-b py-3 last:border-b-0"
              >
                <input type="hidden" name="id" value={organization.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={`${organization.memberCount}명`}>
                    <Input
                      name="name"
                      defaultValue={organization.name}
                      required
                    />
                  </Field>
                  <Field
                    label={`${organization.workspaceCount}개 워크스페이스`}
                  >
                    <Input
                      name="oidcIssuer"
                      defaultValue={organization.oidcIssuer ?? ""}
                      placeholder="OIDC issuer"
                    />
                  </Field>
                  <Field label="OIDC client ID">
                    <Input
                      name="oidcClientId"
                      defaultValue={organization.oidcClientId ?? ""}
                    />
                  </Field>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex gap-4 pb-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          name="useSso"
                          type="checkbox"
                          defaultChecked={organization.useSso}
                        />
                        SSO 사용
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          name="forceSSO"
                          type="checkbox"
                          defaultChecked={organization.forceSSO}
                        />
                        SSO 강제
                      </label>
                    </div>
                    <Button type="submit" size="sm" variant="outline">
                      저장
                    </Button>
                  </div>
                </div>
              </form>
            ))}
          </Panel>
        </section>

        <Panel
          id="workspaces"
          title="워크스페이스"
          description="워크스페이스 이름, 소속 조직, 적용 플랜을 수정합니다. 새로 적용할 플랜은 활성 플랜만 선택할 수 있습니다."
        >
          <div className="space-y-3">
            {data.workspaces.map((workspace) => (
              <form
                key={workspace.id}
                action={updateWorkspace}
                className="grid gap-3 border-b py-3 last:border-b-0 lg:grid-cols-[1fr_1fr_180px_auto]"
              >
                <input type="hidden" name="id" value={workspace.id} />
                <Field label={workspace.id.slice(0, 8)}>
                  <Input name="name" defaultValue={workspace.name} required />
                </Field>
                <Field label="조직">
                  <Select
                    name="organizationId"
                    defaultValue={workspace.organization.id}
                  >
                    {data.organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="플랜">
                  <Select name="plan" defaultValue={workspace.plan}>
                    {data.plans.map((plan) => (
                      <option
                        key={plan.code}
                        value={plan.code}
                        disabled={!plan.isActive}
                      >
                        {plan.code}
                        {plan.isActive ? "" : " (비활성)"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button type="submit" size="sm" variant="outline">
                    저장
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </Panel>

        <Panel
          id="roadmap"
          title="운영 TODO"
          description="첨부 기획서 기준으로 어드민에서 다음에 다룰 관리 기능입니다."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {TODO_ITEMS.map((item) => (
              <div key={item.title} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckSquare className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function CreatePlanForm() {
  return (
    <form
      action={createPlan}
      className="mb-5 rounded-lg border border-dashed p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Plus className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">새 요금제 추가</h3>
        <Badge>SUPER_ADMIN</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-[120px_1fr_100px_150px_150px_150px_1.4fr_auto]">
        <Field label="코드">
          <Input name="code" placeholder="PILOT" required />
        </Field>
        <Field label="이름">
          <Input name="name" placeholder="Pilot" required />
        </Field>
        <Field label="보존일">
          <Input
            name="retentionDays"
            type="number"
            defaultValue={30}
            min={1}
            required
          />
        </Field>
        <Field label="월 이벤트 한도">
          <Input name="monthlyEventLimit" type="number" min={1} />
        </Field>
        <Field label="월 포함 로그 수">
          <Input name="includedLogCount" type="number" min={1} />
        </Field>
        <Field label="초과 로그 단가">
          <Input
            name="logOverageUnitPrice"
            type="number"
            step="0.000001"
            defaultValue="0.000001"
            min={0}
          />
        </Field>
        <Field label="기능 JSON">
          <Textarea
            name="features"
            defaultValue={JSON.stringify({
              demo: true,
              advancedDebug: true,
              promptVersioning: false,
              policies: false,
            })}
          />
        </Field>
        <div className="flex items-end gap-2">
          <input type="hidden" name="isActive" value="on" />
          <Button type="submit" size="sm">
            추가
          </Button>
        </div>
      </div>
    </form>
  );
}

function PlanForm({ plan }: { plan: AdminPlan }) {
  return (
    <form
      action={updatePlan}
      className="grid gap-3 border-b py-3 last:border-b-0 lg:grid-cols-[110px_1fr_100px_150px_150px_150px_1.4fr_88px]"
    >
      <Field label="코드">
        <Input name="code" defaultValue={plan.code} readOnly />
      </Field>
      <Field label="이름">
        <Input name="name" defaultValue={plan.name} required />
      </Field>
      <Field label="보존일">
        <Input
          name="retentionDays"
          type="number"
          defaultValue={plan.retentionDays}
          min={1}
          required
        />
      </Field>
      <Field label="월 이벤트 한도">
        <Input
          name="monthlyEventLimit"
          type="number"
          defaultValue={plan.monthlyEventLimit ?? ""}
          min={1}
          placeholder="미설정"
        />
      </Field>
      <Field label="월 포함 로그 수">
        <Input
          name="includedLogCount"
          type="number"
          defaultValue={plan.includedLogCount ?? ""}
          min={1}
          placeholder="무제한"
        />
      </Field>
      <Field label="초과 로그 단가">
        <Input
          name="logOverageUnitPrice"
          type="number"
          step="0.000001"
          defaultValue={plan.logOverageUnitPrice ?? ""}
          min={0}
          placeholder="미설정"
        />
      </Field>
      <Field label="기능 JSON">
        <Textarea
          name="features"
          defaultValue={JSON.stringify(plan.features)}
        />
      </Field>
      <div className="flex items-end gap-2">
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={plan.isActive}
          />
          활성
        </label>
        <Button type="submit" size="sm">
          저장
        </Button>
      </div>
    </form>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold tracking-normal">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function Panel({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-lg border bg-background p-4"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-normal">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-md border bg-background px-3 py-1.5 text-muted-foreground transition hover:text-foreground"
    >
      {children}
    </a>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function Select({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </select>
  );
}

function Textarea({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  return (
    <textarea
      name={name}
      className="min-h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      defaultValue={defaultValue}
    />
  );
}
