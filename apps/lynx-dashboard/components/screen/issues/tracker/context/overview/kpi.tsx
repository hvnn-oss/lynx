export function IssueTrackerItemOverviewKPI() {
  return (
    <div className="p-5 grid grid-cols-4">
      <div className="">
        <p className="text-sm text-foreground/50">발생 횟수</p>
        <p>
          15<span>회</span>
        </p>
      </div>
      <div className="">
        <p className="text-sm text-foreground/50">영향받은 세션</p>
        <p>
          13<span>개</span>
        </p>
      </div>
      <div className="">
        <p className="text-sm text-foreground/50">영향받은 에이전트</p>
        <p>
          5<span>개</span>
        </p>
      </div>
      <div className="">
        <p className="text-sm text-foreground/50">차단된 도구 사용</p>
        <p>
          15<span>회</span>
        </p>
      </div>
    </div>
  );
}
