"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MainNavBar } from "./sidebar/main-nav-bar";
import { SubMenuHeader } from "./sidebar/sub-menu-header";
import { SubMenu } from "./sidebar/sub-menu";
import { menuConfig } from "./sidebar/constants";

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

  const isOpen = isPinned || isHoverOpen;

  useEffect(() => {
    if (!(sidebarRef.current && mainRef.current)) return;
    setMainWidth(mainRef.current.offsetWidth);
  }, []);

  useEffect(() => {
    const target = hoveredMenu ?? activeMenu;
    if (target === displayMenu) return;
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setDisplayMenu(target);
      setIsAnimating(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [hoveredMenu, activeMenu, displayMenu]);

  const handleMouseEnter = useCallback(() => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    if (!isPinned) setHoverOpen(true);
  }, [isPinned]);

  const handleMouseLeave = useCallback(() => {
    if (!isPinned) {
      hoverCloseTimer.current = setTimeout(() => {
        setHoverOpen(false);
        setHoveredMenu(null);
      }, 200);
    }
  }, [isPinned]);

  const handleNavClick = useCallback((key: string) => {
    setActiveMenu(key);
    if (!isPinned) {
      setHoverOpen(false);
      setHoveredMenu(null);
    }
  }, [isPinned]);

  const handleHoverMenu = useCallback((key: string) => {
    setHoveredMenu(key);
  }, []);

  const handleTogglePin = useCallback(() => {
    setPinned((prev) => !prev);
    setHoverOpen(false);
  }, []);

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
        <MainNavBar
          activeMenu={activeMenu}
          onNavClick={handleNavClick}
          onHoverMenu={handleHoverMenu}
        />
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
            <SubMenuHeader
              titleKey={menuConfig[displayMenu].title}
              isPinned={isPinned}
              onTogglePin={handleTogglePin}
            />
            <SubMenu config={menuConfig[displayMenu]} />
          </div>
        )}
      </section>
    </div>
  );
}
