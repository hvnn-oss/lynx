"use client";
import Link from "next/link";

export function SessionItem({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  return (
    <Link
      href={`/dashboard/session/detail/${sessionId}`}
      className="flex items-center justify-between px-8 p-3 hover:bg-surface cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <p className="font-bold">{title}</p>
      </div>
      <div></div>
    </Link>
  );
}
