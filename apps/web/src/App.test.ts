import { describe, expect, it } from "vitest";
import { calculateSummary } from "./App";

describe("日报计算", () => {
  it("分别计算当天和本月至今的合作及发布数据", () => {
    const tables = [
      {
        name: "确认合作达人",
        values: [
          ["合作时间", "达人 ID", "合作数量", "合作价格", "合作总额"],
          ["2026-10-30", "A", 2, "$500", "$1,000"],
          ["2026-10-29", "B", 1, "$500", "$500"],
        ],
      },
      {
        name: "发布表",
        values: [
          ["发布时间", "达人名称", "视频链接", "花费"],
          [
            "2026-10-30",
            "A",
            "https://instagram.com/reel/one https://x.com/a/status/100",
            "$800",
          ],
          ["2026-10-30", "未发布达人", "", "$9,999"],
          [
            "2026-10-30",
            "A的第二条合作视频",
            "https://www.tiktok.com/@a/video/123?_r=1",
            "$400",
          ],
          ["2026-10-29", "B", "https://x/3", "$300"],
        ],
      },
    ];
    const result = Object.fromEntries(
      calculateSummary("daily", tables, "2026-10-30").map((item) => [
        item.label,
        item.value,
      ]),
    );
    expect(result["今日确认达人"]).toBe(1);
    expect(result["今日确认视频"]).toBe(2);
    expect(result["今日发布视频"]).toBe(2);
    expect(result["今日发布金额"]).toBe(1200);
    expect(result["本月确认达人"]).toBe(2);
    expect(result["本月确认金额"]).toBe(1500);
    expect(result["本月发布视频"]).toBe(3);
    expect(result["本月发布金额"]).toBe(1500);
  });
});
