"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Brain,
  BugOff,
  ChartArea,
  ChevronLast,
  ChevronDown,
  ChevronRight,
  PanelsTopLeft,
  //   Scale,
  Settings,
  //   SquareTerminal,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type MenuConfig = {
  title: string;
  groups?: NavGroup[];
  items?: NavItem[];
};

const menuConfig: Record<string, MenuConfig> = {
  dashboard: {
    title: "대시보드",
    groups: [
      {
        label: "개요",
        items: [
          { label: "홈", href: "/dashboard" },
          { label: "시스템 상태", href: "/dashboard/status" },
          { label: "주요 지표", href: "/dashboard/metrics" },
          { label: "사용량 현황", href: "/dashboard/usage" },
          { label: "비용 분석", href: "/dashboard/cost" },
        ],
      },
      {
        label: "실시간 모니터링",
        items: [
          { label: "라이브 피드", href: "/dashboard/live" },
          { label: "활성 에이전트", href: "/dashboard/active-agents" },
          { label: "이상 행동 알림", href: "/dashboard/alerts" },
        ],
      },
    ],
  },
  agents: {
    title: "에이전트",
    groups: [
      {
        label: "에이전트 관리",
        items: [
          { label: "전체 에이전트", href: "/agents/overview" },
          { label: "활동 중", href: "/agents/active" },
          { label: "비활성", href: "/agents/inactive" },
          { label: "그룹 관리", href: "/agents/groups" },
        ],
      },
      {
        label: "행동 분석",
        items: [
          { label: "의도 분석", href: "/agents/intent" },
          { label: "도구 사용 현황", href: "/agents/tools" },
          { label: "SaaS 접근 추적", href: "/agents/saas" },
          { label: "행동 이력", href: "/agents/history" },
        ],
      },
      {
        label: "성능",
        items: [
          { label: "응답 시간", href: "/agents/perf/latency" },
          { label: "토큰 효율", href: "/agents/perf/tokens" },
          { label: "성공률", href: "/agents/perf/success-rate" },
          { label: "비용 현황", href: "/agents/perf/cost" },
        ],
      },
    ],
  },
  session: {
    title: "세션",
    groups: [
      {
        label: "세션 목록",
        items: [
          { label: "전체 세션", href: "/session/overview" },
          { label: "진행 중", href: "/session/live" },
          { label: "완료", href: "/session/completed" },
          { label: "실패", href: "/session/failed" },
          { label: "이상 감지됨", href: "/session/anomaly" },
        ],
      },
      {
        label: "상세 분석",
        items: [
          { label: "타임라인 뷰어", href: "/session/timeline" },
          { label: "세션 리플레이", href: "/session/replay" },
          { label: "멀티 에이전트 뷰", href: "/session/multi-agent" },
          { label: "컨텍스트 스냅샷", href: "/session/context" },
        ],
      },
      {
        label: "사용량",
        items: [
          { label: "토큰 사용량", href: "/session/tokens" },
          { label: "호출 횟수", href: "/session/calls" },
          { label: "세션별 비용", href: "/session/cost" },
        ],
      },
    ],
  },
  debug: {
    title: "디버깅",
    groups: [
      {
        label: "추적 도구",
        items: [
          { label: "실행 로그", href: "/debug/logs" },
          { label: "추론 트레이스", href: "/debug/trace" },
          { label: "도구 호출 기록", href: "/debug/tool-calls" },
          { label: "LLM 요청/응답", href: "/debug/llm-io" },
        ],
      },
      {
        label: "오류 분석",
        items: [
          { label: "에러 리포트", href: "/debug/errors" },
          { label: "원인 에이전트 식별", href: "/debug/root-cause" },
          { label: "실패 패턴", href: "/debug/failure-patterns" },
          { label: "재현 환경", href: "/debug/reproduce" },
        ],
      },
      {
        label: "성능 진단",
        items: [
          { label: "병목 구간 분석", href: "/debug/bottleneck" },
          { label: "지연 시간 분포", href: "/debug/latency" },
          { label: "메모리 사용", href: "/debug/memory" },
        ],
      },
    ],
  },
  //   politics: {
  //     title: "정책 관리",
  //     groups: [
  //       {
  //         label: "행동 제어",
  //         items: [
  //           { label: "행동 제한 정책", href: "/policy/rules" },
  //           { label: "허용 도구 목록", href: "/policy/allowed-tools" },
  //           { label: "이상 패턴 임계값", href: "/policy/thresholds" },
  //           { label: "자동 차단 설정", href: "/policy/auto-block" },
  //         ],
  //       },
  //       {
  //         label: "거버넌스",
  //         items: [
  //           { label: "역할 기반 접근 제어", href: "/policy/rbac" },
  //           { label: "데이터 접근 정책", href: "/policy/data-access" },
  //           { label: "모델 사용 정책", href: "/policy/model-policy" },
  //         ],
  //       },
  //       {
  //         label: "감사",
  //         items: [
  //           { label: "감사 로그", href: "/policy/audit" },
  //           { label: "데이터 접근 기록", href: "/policy/data-log" },
  //           { label: "정책 변경 이력", href: "/policy/change-log" },
  //           { label: "컴플라이언스 리포트", href: "/policy/compliance" },
  //         ],
  //       },
  //     ],
  //   },
  //   prompts: {
  //     title: "프롬프트",
  //     groups: [
  //       {
  //         label: "템플릿",
  //         items: [
  //           { label: "내 템플릿", href: "/prompt/templates" },
  //           { label: "템플릿 생성", href: "/prompt/new" },
  //         ],
  //       },
  //       {
  //         label: "설정",
  //         items: [
  //           { label: "기본 설정", href: "/prompt/defaults" },
  //           { label: "변수 관리", href: "/prompt/variables" },
  //         ],
  //       },
  //     ],
  //   },
  settings: {
    title: "설정",
    groups: [
      {
        label: "워크스페이스",
        items: [
          { label: "일반", href: "/settings/general" },
          { label: "멤버 관리", href: "/settings/members" },
          { label: "역할 및 권한", href: "/settings/roles" },
          { label: "플랜 및 결제", href: "/settings/billing" },
        ],
      },
      {
        label: "연동",
        items: [
          { label: "API 키", href: "/settings/api-keys" },
          { label: "SDK 설정", href: "/settings/sdk" },
          { label: "Webhook", href: "/settings/webhooks" },
          { label: "Slack 연동", href: "/settings/slack" },
        ],
      },
      {
        label: "알림",
        items: [
          { label: "알림 채널", href: "/settings/notifications/channels" },
          { label: "알림 조건", href: "/settings/notifications/rules" },
          { label: "수신 설정", href: "/settings/notifications/preferences" },
        ],
      },
    ],
  },
};

function SubMenu({ config }: { config: MenuConfig }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  if (config.items) {
    return (
      <ul className="mt-1 space-y-0.5">
        {config.items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="block px-3 py-1.5 text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (config.groups) {
    return (
      <ul className="mt-1 space-y-1">
        {config.groups.map((group) => {
          const isOpen = openGroups[group.label] ?? true;
          return (
            <li key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center cursor-pointer justify-between px-3 py-1.5 font-semibold text-foreground rounded-md hover:bg-accent transition-colors"
              >
                <span>{group.label}</span>
                {isOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </button>
              {isOpen && (
                <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="block px-2 py-1.5 text-sm text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return null;
}

export function DashboardSidebar() {
  const [isPinned, setPinned] = useState(false);
  const [isHoverOpen, setHoverOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string>("dashboard");
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [displayMenu, setDisplayMenu] = useState<string>("dashboard");
  const [isAnimating, setIsAnimating] = useState(false);
  const [mainWidth, setMainWidth] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const isOpen = isPinned || isHoverOpen;

  useEffect(() => {
    if (!(sidebarRef.current && mainRef.current)) return;
    setMainWidth(mainRef.current.offsetWidth);
  }, []);

  const switchMenu = (key: string) => {
    if (key === displayMenu) return;
    setIsAnimating(true);
    setTimeout(() => {
      setDisplayMenu(key);
      setIsAnimating(false);
    }, 120);
  };

  useEffect(() => {
    const target = hoveredMenu ?? activeMenu;
    switchMenu(target);
  }, [hoveredMenu, activeMenu]);

  const handleMouseEnter = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    if (!isPinned) setHoverOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      hoverCloseTimer.current = setTimeout(() => {
        setHoverOpen(false);
        setHoveredMenu(null);
      }, 200);
    }
  };

  const handleNavClick = (key: string) => {
    setActiveMenu(key);
    if (!isPinned) {
      setHoverOpen(false);
      setHoveredMenu(null);
    }
  };

  const handleToggle = () => {
    if (isPinned) {
      setPinned(false);
      setHoverOpen(false);
    } else {
      setPinned(true);
      setHoverOpen(false);
    }
  };

  return (
    <div
      ref={sidebarRef}
      className="sticky h-screen top-0 border-r flex w-fit transition-all duration-300 overflow-hidden"
      style={{
        width: isOpen ? `${mainWidth + 240}px` : `${mainWidth}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <section
        className="h-full flex flex-col justify-between items-center z-10 bg-background border-r pt-10"
        style={{
          position: isPinned ? "initial" : "relative",
        }}
        ref={mainRef}
      >
        <div className="flex-1 flex flex-col">
          {[
            { icon: ChartArea, label: "대시보드", key: "dashboard" },
            { icon: Brain, label: "에이전트", key: "agents" },
            { icon: PanelsTopLeft, label: "세션", key: "session" },
            { icon: BugOff, label: "디버깅", key: "debug" },
            // { icon: Scale, label: "정책 관리", key: "politics" },
            // { icon: SquareTerminal, label: "프롬프트", key: "prompts" },
            { icon: Settings, label: "설정", key: "settings" },
          ].map(({ icon: Icon, label, key }) => (
            <Button
              key={key}
              variant={"ghost"}
              className={`size-16 h-fit aspect-square flex flex-col gap-1 ${
                pathname.startsWith(`/${key}`) ? "bg-card" : ""
              }`}
              onClick={() => handleNavClick(key)}
              onMouseEnter={() => setHoveredMenu(key)}
            >
              <Icon className="size-6 stroke-[1.5]" />
              <p className="text-xs">{label}</p>
            </Button>
          ))}
        </div>
        <div className="w-10 m-5 aspect-square bg-primary flex items-center justify-center text-primary-foreground font-semibold rounded-md">
          <p>SB</p>
        </div>
      </section>
      <section
        className="px-3 w-60 bg-card relative transition-all duration-300 z-0 overflow-y-auto"
        style={{
          translate: !isOpen ? `-240px` : "",
        }}
      >
        {menuConfig[displayMenu] && (
          <div
            style={{
              opacity: isAnimating ? 0 : 1,
              transform: isAnimating ? "translateY(4px)" : "translateY(0)",
              transition: "opacity 120ms ease, transform 120ms ease",
            }}
          >
            <div className="w-full flex justify-between items-center mt-10 mb-5 px-2">
              <h2 className="font-semibold">{menuConfig[displayMenu].title}</h2>
              <Button
                className={`w-3 h-3 p-3`}
                onClick={handleToggle}
                variant={isPinned ? "default" : "outline"}
              >
                <ChevronLast
                  className="size-4"
                  strokeWidth={isPinned ? 3 : 2}
                />
              </Button>
            </div>
            <SubMenu config={menuConfig[displayMenu]} />
          </div>
        )}
      </section>
    </div>
  );
}
