"use client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { clearStoredAccessToken, requestContract } from "@/lib/api";
import { authContract } from "@repo/contract";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function SidebarUserAvatar() {
  const [isOpen, setOpen] = useState(false);
  const [avatarHeight, setAvatarHeight] = useState(0);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("layout.sidebar");

  const handleLogout = async () => {
    try {
      await requestContract({
        basePath: authContract.basePath,
        endpoint: authContract.logout,
        request: {},
      });
    } finally {
      clearStoredAccessToken();
      window.location.href = "/login";
    }
  };

  // 아바타 크기 측정
  useEffect(() => {
    if (!avatarRef.current) return;
    setAvatarHeight(avatarRef.current.offsetHeight);
  }, [avatarRef]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative z-50" ref={containerRef}>
      <button
        className="cursor-pointer"
        ref={avatarRef}
        onClick={() => setOpen(!isOpen)}
      >
        <Avatar size="lg">
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </button>
      {isOpen && (
        <div
          className="bg-background text-foreground border border-border rounded-md absolute w-fit min-w-50"
          style={{ bottom: `${avatarHeight + 20}px` }}
        >
          <div className="flex gap-3 items-center p-3">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <p className="font-semibold">Dan Lee</p>
          </div>
          <div className="w-full h-px bg-border mb-1.5"></div>
          <Link
            href="/settings/personal/general"
            className="flex gap-3 text-sm items-center p-3 cursor-pointer font-semibold hover:bg-foreground/5 w-full"
          >
            {t("avatar.account_settings")}
          </Link>
          <button className="flex gap-3 text-sm items-center p-3 cursor-pointer font-semibold hover:bg-foreground/5 w-full">
            {t("avatar.product_feedback")}
          </button>
          <div className="w-full h-px bg-border my-1.5"></div>
          <button
            className="text-destructive flex gap-3 text-sm items-center p-3 cursor-pointer font-semibold hover:bg-foreground/5 w-full"
            onClick={handleLogout}
          >
            {t("avatar.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
