export function IssueTrackerItemInfoLabel() {
  return (
    <div>
      <p className="text-sm mb-2 text-foreground/50">라벨</p>
      <div className="flex flex-wrap gap-1 select-none font-semibold">
        <div className="text-sm flex gap-1 bg-yellow-500 text-white w-fit rounded-full px-2">
          <p>🛠️</p>
          <p>도구 사용 실패</p>
        </div>
        <div className="text-sm flex gap-1 bg-destructive text-white w-fit rounded-full px-2">
          <p>결제 시도</p>
        </div>
        <div className="text-sm flex gap-1 bg-primary text-white w-fit rounded-full px-2">
          <p>비정상 결제 금액</p>
        </div>
      </div>
    </div>
  );
}
