import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { CheckCircle, TriangleAlert } from "lucide-react";

export function IssueTrackerItemContextInput() {
  return (
    <div className="mt-10 mb-5">
      <h3 className="font-bold">업데이트를 추가하세요</h3>
      <div className="bg-background p-3 rounded-md mt-3">
        <Textarea />
        <div className="flex items-center mt-2 justify-end gap-1">
          <Button variant={"outline"}>
            <CheckCircle />
            <p>해결됨으로 표시</p>
          </Button>
          {/* <Button variant={"destructive"}>
            <TriangleAlert />
            <p>해결되지 않음으로 표시</p>
          </Button> */}
          <Button>작성</Button>
        </div>
      </div>
    </div>
  );
}
