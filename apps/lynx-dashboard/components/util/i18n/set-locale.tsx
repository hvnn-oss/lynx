"use client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@repo/ui/components/ui/dropdown-menu";
import { Button } from "@repo/ui/components/ui/button";

export default function SetLocaleButton() {
  const changeLanguage = (locale: string) => {
    // 쿠키에 새 언어 저장
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000;`;
    // 서버 구성요소를 다시 불러오기 위해 새로고침
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Change Locale</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => changeLanguage("ko")}>
          한국어
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
