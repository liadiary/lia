import { describe, expect, it } from "vitest";
import { buildRepurchaseCandidates, calculateSummary } from "./App";

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

  it("完结链接中的补录发布全部计入当月累计", () => {
    const tables = [
      {
        name: "确认合作达人",
        values: [["合作时间", "达人 ID", "合作数量", "合作总额"]],
      },
      {
        name: "完结链接-11月",
        values: [
          ["发布时间", "达人名称", "发布链接", "相关费用"],
          ["2026-11-05", "A", "https://instagram.com/reel/one", "$500"],
          ["2026-10-20", "B", "https://tiktok.com/@b/video/2", "$300"],
          ["2026-09-01", "未完结", "", "$9,999"],
        ],
      },
    ];
    const result = Object.fromEntries(
      calculateSummary("daily", tables, "2026-11-05").map((item) => [
        item.label,
        item.value,
      ]),
    );
    expect(result["今日发布视频"]).toBe(1);
    expect(result["今日发布金额"]).toBe(500);
    expect(result["本月发布视频"]).toBe(2);
    expect(result["本月发布金额"]).toBe(800);
  });

  it("月度结算只统计所选月份对客发布表中的有效发布记录", () => {
    const tables = [
      {
        name: "发布表",
        values: [
          ["发布时间", "达人名称", "视频链接", "花费"],
          [
            "2026-10-03",
            "A",
            "https://instagram.com/reel/one https://x.com/a/status/100",
            "$800",
          ],
          ["2026-10-20", "A", "https://tiktok.com/@a/video/2", "$400"],
          ["2026-10-21", "B", "", "$9,999"],
          ["2026-11-01", "C", "https://youtube.com/shorts/three", "$300"],
        ],
      },
    ];
    const result = Object.fromEntries(
      calculateSummary("settlement", tables, "2026-10-31").map((item) => [
        item.label,
        item.value,
      ]),
    );
    expect(result["发布达人"]).toBe(1);
    expect(result["发布视频"]).toBe(2);
    expect(result["结算金额"]).toBe("$1,200");
    expect(result["缺发布链接"]).toBe(1);
  });

  it("按照当月画像筛选、合并并排序复投候选", () => {
    const tables = [
      {
        name: "发布表",
        values: [
          [
            "发布时间",
            "达人名称",
            "达人主页",
            "视频链接",
            "国家",
            "语言",
            "内容垂类",
            "平台",
            "播放量",
            "CPM",
            "备注",
          ],
          [
            "2026-09-01",
            "A",
            "https://instagram.com/a",
            "https://instagram.com/reel/1",
            "美国",
            "英语",
            "科技",
            "Instagram",
            "100000",
            "$12",
            "合作顺利",
          ],
          [
            "2026-10-01",
            "A",
            "https://instagram.com/a",
            "https://instagram.com/reel/2",
            "美国",
            "英语",
            "科技",
            "Instagram",
            "200000",
            "$10",
            "",
          ],
          [
            "2026-10-02",
            "B",
            "https://instagram.com/b",
            "https://instagram.com/reel/3",
            "美国",
            "英语",
            "科技",
            "Instagram",
            "300000",
            "$8",
            "不推荐，交付体验差",
          ],
          [
            "2026-10-03",
            "C",
            "https://tiktok.com/@c",
            "https://tiktok.com/@c/video/4",
            "法国",
            "法语",
            "美妆",
            "TikTok",
            "50000",
            "$20",
            "",
          ],
        ],
      },
    ];
    const candidates = buildRepurchaseCandidates(tables, {
      month: "11月",
      countries: "美国",
      languages: "英语",
      niches: "科技",
      platforms: "Instagram",
      styles: "",
      notes: "",
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].creator).toBe("A");
    expect(candidates[0].historyCount).toBe(2);
    expect(candidates[0].match).toBe("高");
    expect(candidates[0].platformType).toBe("IG");
    expect(candidates[0].views).toBe("150,000");
    expect(candidates[0].cpm).toBe("$11.00");
  });
});
