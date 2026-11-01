import React from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  Activity,
  CircleDollarSign,
  Database,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const nav = [
  ["/", "今日工作台", LayoutDashboard],
  ["/daily", "日报中心", Activity],
  ["/settlement", "月度结算", CircleDollarSign],
  ["/repurchase", "复投达人", RefreshCw],
  ["/sources", "数据源管理", Database],
] as const;

const apiBase =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("github.io")
    ? "https://lia-workcenter-api.onrender.com"
    : "";

function Dashboard() {
  const demo = {
    tasks: [
      { key: "scripts", label: "待审脚本", count: 0, tone: "orange" },
      { key: "videos", label: "待审视频", count: 0, tone: "orange" },
      {
        key: "unsynced",
        label: "WA 已提交、Tracker 未同步",
        count: 0,
        tone: "red",
      },
      { key: "conflicts", label: "多来源版本冲突", count: 0, tone: "red" },
      { key: "settlement", label: "待确认结算", count: 0, tone: "blue" },
    ],
    today: {
      confirmedCreators: 0,
      confirmedVideos: 0,
      confirmedAmount: 0,
      publishedCreators: 0,
      publishedVideos: 0,
      publishedAmount: 0,
    },
    syncSources: [
      "内部 Tracker",
      "对客日常表",
      "月度结算表",
      "复投达人表",
      "Tripo KOL 中台",
    ].map((name) => ({ name, status: "尚未连接", lastSync: null })),
  };
  const {
    data = demo,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["dashboard"],
    retry: false,
    queryFn: async () => {
      try {
        const r = await fetch(`${apiBase}/api/dashboard`, {
          credentials: "include",
        });
        return r.ok ? await r.json() : demo;
      } catch {
        return demo;
      }
    },
  });
  if (isLoading) return <p>正在加载工作台…</p>;
  return (
    <>
      <header>
        <div>
          <h1>你好，Lia</h1>
          <p>按需读取最新在线数据，需要时再计算和核对。</p>
        </div>
        <div className="header-actions">
          <span className="date">
            {new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(
              new Date(),
            )}
          </span>
          <button onClick={() => refetch()}>读取最新数据</button>
        </div>
      </header>
      <div className="notice">
        演示环境尚未连接飞书。接入后，只有点击“读取最新数据”时才会使用只读权限访问在线表格。
      </div>
      <h2>今日待办</h2>
      <section className="task-grid">
        {data.tasks.map((t: any) => (
          <article className={`card task ${t.tone}`} key={t.key}>
            <strong>{t.count}</strong>
            <span>{t.label}</span>
            <small>{t.count ? "需要处理" : "目前没有待办"}</small>
          </article>
        ))}
      </section>
      <div className="columns">
        <section>
          <h2>今日数据</h2>
          <div className="card metrics">
            <div>
              <b>{data.today.confirmedCreators}</b>
              <span>确认合作达人</span>
            </div>
            <div>
              <b>{data.today.confirmedVideos}</b>
              <span>确认合作视频</span>
            </div>
            <div>
              <b className="client">${data.today.confirmedAmount}</b>
              <span>对客合作金额</span>
            </div>
            <div>
              <b>{data.today.publishedVideos}</b>
              <span>今日发布视频</span>
            </div>
          </div>
        </section>
        <section>
          <h2>数据源状态</h2>
          <div className="card sources">
            {data.syncSources.map((s: any) => (
              <div key={s.name}>
                <span>{s.name}</span>
                <em>{s.status}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <header>
        <div>
          <h1>{title}</h1>
          <p>功能骨架已就位，将在下一开发阶段接入数据和操作。</p>
        </div>
      </header>
      <div className="card empty">
        <Database size={36} />
        <h2>暂无数据</h2>
        <p>可先从数据源管理导入 Excel 或 CSV。</p>
      </div>
    </>
  );
}

const text = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    return text(
      item.text ?? item.name ?? item.link ?? item.url ?? item.value ?? "",
    );
  }
  return String(value).trim();
};
const amount = (value: unknown) =>
  Number(text(value).replace(/[^0-9.-]/g, "")) || 0;
function tableRecords(values: unknown[][], keywords: string[]) {
  let headerIndex = 0,
    best = -1;
  values.slice(0, 30).forEach((row, i) => {
    const score = row.reduce<number>(
      (n, c) => n + (keywords.some((k) => text(c).includes(k)) ? 1 : 0),
      0,
    );
    if (score > best) {
      best = score;
      headerIndex = i;
    }
  });
  const headers = (values[headerIndex] ?? []).map(text);
  const rows = values
    .slice(headerIndex + 1)
    .filter((row) => row.some((v) => text(v)))
    .map((row) =>
      Object.fromEntries(headers.map((h, i) => [h || `列${i + 1}`, row[i]])),
    );
  return { headers, rows };
}
const pick = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find((header) => header.includes(alias));
    if (key) return row[key];
  }
  return "";
};
const sameDate = (value: unknown, date: string) => {
  const s = text(value);
  if (!s) return false;
  const [y, m, d] = date.split("-").map(Number);
  return (
    s.includes(date) ||
    s.includes(`${y}/${m}/${d}`) ||
    s.includes(`${m}/${d}`) ||
    s.includes(`${m}月${d}日`) ||
    s.includes(`${m}-${d}`)
  );
};
const monthToDate = (value: unknown, date: string) => {
  const s = text(value);
  const [y, m, d] = date.split("-").map(Number);
  const match =
    s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/) ??
    s.match(/(\d{1,2})[-/.月](\d{1,2})/);
  if (!match) return false;
  const yy = match.length === 4 ? Number(match[1]) : y,
    mm = match.length === 4 ? Number(match[2]) : Number(match[1]),
    dd = match.length === 4 ? Number(match[3]) : Number(match[2]);
  return yy === y && mm === m && dd <= d;
};
const extractLinks = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(extractLinks);
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    return [item.link, item.url, item.href, item.text].flatMap(extractLinks);
  }
  return String(value).match(/https?:\/\/[^\s,，;；]+/g) ?? [];
};
const linkCount = (value: unknown) => new Set(extractLinks(value)).size;
const normalizeLink = (value: string) => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/$/, "");
    const instagram = path.match(/\/(reel|p|tv)\/([^/]+)/i);
    if (host.includes("instagram.com") && instagram)
      return `instagram.com/${instagram[1].toLowerCase()}/${instagram[2]}`;
    const tiktok = path.match(/\/video\/(\d+)/i);
    if (host.includes("tiktok.com") && tiktok)
      return `tiktok.com/video/${tiktok[1]}`;
    const youtube =
      host === "youtu.be"
        ? path.match(/^\/([^/]+)/)?.[1]
        : (url.searchParams.get("v") ??
          path.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1]);
    if ((host.includes("youtube.com") || host === "youtu.be") && youtube)
      return `youtube.com/video/${youtube}`;
    const status = path.match(/\/status\/(\d+)/i);
    if ((host === "x.com" || host.endsWith("twitter.com")) && status)
      return `x.com/status/${status[1]}`;
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "igshid",
    ].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
};
const publicationAudit = (tables: any[], date: string) => {
  const publication = tables.find((table) => table.name.includes("发布表"));
  const parsed = tableRecords(publication?.values ?? [], [
    "发布时间",
    "达人",
    "视频链接",
    "花费",
  ]);
  const entries: Array<{ creator: string; date: string; link: string }> = [];
  for (const row of parsed.rows.filter((item) =>
    monthToDate(pick(item, ["发布时间", "发布日期"]), date),
  )) {
    const links = [
      ...new Set(
        extractLinks(pick(row, ["视频链接", "发布链接"]))
          .map(normalizeLink)
          .filter(Boolean),
      ),
    ];
    if (!links.length) continue;
    entries.push({
      creator: text(pick(row, ["达人名称", "达人"])),
      date: text(pick(row, ["发布时间", "发布日期"])),
      link: links.join(" · "),
    });
  }
  return entries;
};
const publicationTotals = (rows: Record<string, unknown>[]) => {
  let videos = 0;
  let amountTotal = 0;
  for (const row of rows) {
    const links = new Set(
      extractLinks(pick(row, ["视频链接", "发布链接"]))
        .map(normalizeLink)
        .filter(Boolean),
    );
    // 一个发布表记录代表一条合作视频；同一格里的多个链接只是跨平台分发。
    if (links.size) {
      videos += 1;
      amountTotal += amount(pick(row, ["花费", "对客金额"]));
    }
  }
  return { videos, amount: amountTotal };
};

type RepurchaseProfile = {
  month: string;
  countries: string;
  languages: string;
  niches: string;
  platforms: string;
  styles: string;
  notes: string;
};

type RepurchaseCandidate = {
  creator: string;
  homepage: string;
  operator: string;
  niche: string;
  countryLanguage: string;
  platformType: string;
  historyCount: number;
  publishLinks: string;
  publishDates: string;
  views: string;
  cpm: string;
  match: string;
  reason: string;
  risk: string;
  confirmed: string;
  score: number;
};

const preferenceTokens = (value: string) =>
  value
    .split(/[，,、/；;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const platformTypes = (platforms: string[]) => {
  const normalized = platforms.join(" ").toLowerCase();
  const result: string[] = [];
  if (/instagram|\big\b/.test(normalized)) result.push("IG");
  if (/youtube|youtu\.be|\byb\b/.test(normalized)) result.push("YB");
  if (/twitter|x\.com|\bx\b/.test(normalized)) result.push("X");
  if (/tiktok|\btk\b/.test(normalized)) result.push("TK");
  return result.join(" / ") || "待补充";
};

export function buildRepurchaseCandidates(
  tables: any[],
  profile: RepurchaseProfile,
): RepurchaseCandidate[] {
  const publication = tables.find((table) => table.name.includes("发布表"));
  const parsed = tableRecords(publication?.values ?? [], [
    "达人",
    "视频链接",
    "发布时间",
    "播放量",
    "CPM",
  ]);
  const groups = new Map<string, any>();
  for (const row of parsed.rows) {
    const publishLinks = extractLinks(pick(row, ["视频链接", "发布链接"]));
    if (!publishLinks.length) continue;
    const creator = text(pick(row, ["达人名称", "达人", "博主名称", "账号"]));
    const homepageCell = pick(row, [
      "达人主页",
      "主页链接",
      "达人链接",
      "账号链接",
    ]);
    const homepage = extractLinks(homepageCell)[0] ?? text(homepageCell);
    if (!creator && !homepage) continue;
    const key = (homepage || creator).trim().toLowerCase();
    const current = groups.get(key) ?? {
      creator,
      homepage,
      operator: "",
      niche: "",
      country: "",
      language: "",
      style: "",
      platforms: new Set<string>(),
      publishLinks: new Set<string>(),
      publishDates: new Set<string>(),
      historyCount: 0,
      views: 0,
      viewRecords: 0,
      cpmTotal: 0,
      cpmRecords: 0,
      notes: new Set<string>(),
    };
    current.creator ||= creator;
    current.homepage ||= homepage;
    current.operator ||= text(pick(row, ["对接运营", "运营", "负责人", "BD"]));
    current.niche ||= text(pick(row, ["内容垂类", "达人垂类", "垂类", "类型"]));
    current.country ||= text(pick(row, ["国家", "地区", "达人国家"]));
    current.language ||= text(pick(row, ["语言", "达人语言"]));
    current.style ||= text(pick(row, ["达人风格", "内容风格", "风格"]));
    const rowPlatform = text(pick(row, ["平台", "发布平台"]));
    if (rowPlatform) current.platforms.add(rowPlatform);
    publishLinks.forEach((link) => {
      current.publishLinks.add(link);
      try {
        current.platforms.add(new URL(link).hostname.replace(/^www\./, ""));
      } catch {
        // 保留表格已有的平台字段即可。
      }
    });
    const publishDate = text(pick(row, ["发布时间", "发布日期"]));
    if (publishDate) current.publishDates.add(publishDate);
    current.historyCount += 1;
    const rowViews = amount(pick(row, ["播放量", "浏览量", "Views", "view"]));
    if (rowViews > 0) {
      current.views += rowViews;
      current.viewRecords += 1;
    }
    const rowCpm = amount(pick(row, ["CPM", "cpm"]));
    if (rowCpm > 0) {
      current.cpmTotal += rowCpm;
      current.cpmRecords += 1;
    }
    const note = text(
      pick(row, ["备注", "评价", "合作体验", "风险", "是否推荐", "账号状态"]),
    );
    if (note) current.notes.add(note);
    groups.set(key, current);
  }

  const preferences = [
    ["国家", preferenceTokens(profile.countries)],
    ["语言", preferenceTokens(profile.languages)],
    ["垂类", preferenceTokens(profile.niches)],
    ["平台", preferenceTokens(profile.platforms)],
    ["风格", preferenceTokens(profile.styles)],
  ] as const;
  const preferenceCount = preferences.filter(
    ([, tokens]) => tokens.length,
  ).length;
  const hardRisk = /假号|不推荐|拉黑|数据异常|内容质量差|交付体验差|拒绝复投/i;

  return [...groups.values()]
    .filter((group) => !hardRisk.test([...group.notes].join(" ")))
    .map((group): RepurchaseCandidate => {
      const searchable: Record<string, string> = {
        国家: group.country,
        语言: group.language,
        垂类: group.niche,
        平台: [...group.platforms].join(" "),
        风格: group.style,
      };
      const matched = preferences
        .filter(([, tokens]) => tokens.length)
        .filter(([label, tokens]) =>
          tokens.some((token) =>
            searchable[label].toLowerCase().includes(token),
          ),
        )
        .map(([label]) => label);
      const ratio = preferenceCount ? matched.length / preferenceCount : 0;
      const score =
        matched.length * 4 +
        Math.min(group.historyCount, 5) * 2 +
        (group.viewRecords ? 1 : 0) +
        (group.cpmRecords ? 1 : 0);
      const averageViews = group.viewRecords
        ? Math.round(group.views / group.viewRecords).toLocaleString("en-US")
        : "数据待补充";
      const averageCpm = group.cpmRecords
        ? `$${(group.cpmTotal / group.cpmRecords).toFixed(2)}`
        : "数据待补充";
      const risk: string[] = [];
      if (!group.homepage) risk.push("缺达人主页");
      if (!group.viewRecords) risk.push("缺播放量");
      if (!group.cpmRecords) risk.push("缺CPM");
      return {
        creator: group.creator || "待补充",
        homepage: group.homepage || "待补充",
        operator: group.operator || "待补充",
        niche: group.niche || "待补充",
        countryLanguage:
          [group.country, group.language].filter(Boolean).join(" / ") ||
          "待补充",
        platformType: platformTypes([...group.platforms]),
        historyCount: group.historyCount,
        publishLinks: [...group.publishLinks].join("\n"),
        publishDates: [...group.publishDates].sort().join("、") || "待补充",
        views: averageViews,
        cpm: averageCpm,
        match: preferenceCount
          ? ratio >= 0.6
            ? "高"
            : matched.length
              ? "中"
              : "低"
          : "待填写画像",
        reason: [
          matched.length ? `匹配${matched.join("、")}` : "历史合作候选",
          `历史发布${group.historyCount}次`,
        ].join("；"),
        risk: risk.join("；") || "暂无明显风险",
        confirmed: "待 Lia 确认",
        score,
      };
    })
    .filter((candidate) =>
      preferenceCount
        ? candidate.match !== "低" || candidate.historyCount >= 2
        : candidate.historyCount >= 1,
    )
    .sort((a, b) => b.score - a.score || b.historyCount - a.historyCount)
    .slice(0, 30);
}

export function calculateSummary(type: string, tables: any[], date: string) {
  if (type === "daily") {
    const cooperation = tables.find((t) => t.name.includes("确认合作"));
    const publication = tables.find((t) => t.name.includes("发布表"));
    const c = tableRecords(cooperation?.values ?? [], [
      "合作时间",
      "达人",
      "合作数量",
      "合作总额",
    ]);
    const p = tableRecords(publication?.values ?? [], [
      "发布时间",
      "达人",
      "视频链接",
      "花费",
    ]);
    const cr = c.rows.filter((r) =>
      sameDate(pick(r, ["合作时间", "合作日期"]), date),
    );
    const pr = p.rows.filter((r) =>
      sameDate(pick(r, ["发布时间", "发布日期"]), date),
    );
    const cm = c.rows.filter((r) =>
      monthToDate(pick(r, ["合作时间", "合作日期"]), date),
    );
    const pm = p.rows.filter((r) =>
      monthToDate(pick(r, ["发布时间", "发布日期"]), date),
    );
    const publishedToday = pr.filter(
      (r) => linkCount(pick(r, ["视频链接", "发布链接"])) > 0,
    );
    const publishedMonth = pm.filter(
      (r) => linkCount(pick(r, ["视频链接", "发布链接"])) > 0,
    );
    const todayPublication = publicationTotals(publishedToday);
    const monthPublication = publicationTotals(publishedMonth);
    const unique = (rows: any[], aliases: string[]) =>
      new Set(rows.map((r) => text(pick(r, aliases))).filter(Boolean)).size;
    return [
      {
        label: "今日确认达人",
        value: unique(cr, ["达人 ID", "达人名称", "达人"]),
      },
      {
        label: "今日确认视频",
        value: cr.reduce((n, r) => n + amount(pick(r, ["合作数量"])), 0),
      },
      {
        label: "今日发布视频",
        value: todayPublication.videos,
      },
      {
        label: "今日发布金额",
        value: todayPublication.amount,
      },
      {
        label: "本月确认达人",
        value: unique(cm, ["达人 ID", "达人名称", "达人"]),
      },
      {
        label: "本月确认视频",
        value: cm.reduce((n, r) => n + amount(pick(r, ["合作数量"])), 0),
      },
      {
        label: "本月确认金额",
        value: cm.reduce(
          (n, r) => n + amount(pick(r, ["合作总额", "合作价格", "对客金额"])),
          0,
        ),
      },
      {
        label: "本月发布视频",
        value: monthPublication.videos,
      },
      {
        label: "本月发布金额",
        value: monthPublication.amount,
      },
    ];
  }
  const table = tables[0];
  const parsed = tableRecords(
    table?.values ?? [],
    type === "settlement"
      ? ["发布时间", "达人名称", "视频链接", "花费"]
      : ["推荐达人", "达人链接", "推荐理由", "视频数据"],
  );
  const rows =
    type === "settlement"
      ? parsed.rows.filter((row) =>
          monthToDate(pick(row, ["发布时间", "发布日期"]), date),
        )
      : parsed.rows;
  if (type === "settlement") {
    const published = rows.filter(
      (row) => extractLinks(pick(row, ["视频链接", "发布链接"])).length > 0,
    );
    const totals = publicationTotals(published);
    const normalizedLinks = published.flatMap((row) =>
      extractLinks(pick(row, ["视频链接", "发布链接"]))
        .map(normalizeLink)
        .filter(Boolean),
    );
    const duplicates = normalizedLinks.length - new Set(normalizedLinks).size;
    return [
      {
        label: "发布达人",
        value: new Set(
          published
            .map((r) => text(pick(r, ["达人名称", "达人"])))
            .filter(Boolean),
        ).size,
      },
      { label: "发布视频", value: totals.videos },
      {
        label: "结算金额",
        value: `$${totals.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      },
      {
        label: "缺发布链接",
        value: rows.length - published.length,
      },
      { label: "重复链接", value: duplicates },
    ];
  }
  const published = rows.filter((r) => text(pick(r, ["视频链接", "发布链接"])));
  return [
    {
      label: "已发布达人",
      value: new Set(
        published
          .map((r) => text(pick(r, ["达人名称", "达人"])))
          .filter(Boolean),
      ).size,
    },
    { label: "历史发布视频", value: published.length },
    {
      label: "缺达人主页",
      value: published.filter((r) => !text(pick(r, ["达人主页", "主页链接"])))
        .length,
    },
  ];
}

function LiveDataPage({
  type,
  title,
  description,
}: {
  type: "daily" | "settlement" | "repurchase";
  title: string;
  description: string;
}) {
  const [month, setMonth] = React.useState(String(new Date().getMonth() + 1));
  const [reportDate, setReportDate] = React.useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [needsAuthorization, setNeedsAuthorization] = React.useState(false);
  const [manual, setManual] = React.useState({
    todayProposal: "",
    pendingReview: "",
    monthProposal: "",
  });
  const [profile, setProfile] = React.useState(() =>
    JSON.parse(
      localStorage.getItem("lia-repurchase-profile") ||
        '{"month":"11月","countries":"","languages":"","niches":"","platforms":"","styles":"","notes":""}',
    ),
  );
  const [history, setHistory] = React.useState<any[]>(() =>
    JSON.parse(localStorage.getItem("lia-daily-snapshots") || "[]"),
  );
  const read = async () => {
    setLoading(true);
    setError("");
    setNeedsAuthorization(false);
    try {
      const r = await fetch(`${apiBase}/api/live/${type}?month=${month}`, {
        credentials: "include",
      });
      const body = await r.json();
      if (!body.ok) {
        if (
          body.needsUserAuthorization ||
          String(body.error).includes("授权")
        ) {
          setNeedsAuthorization(true);
          const returnTo = window.location.hash.split("?")[0] || "#/repurchase";
          window.location.assign(
            `${apiBase}/api/auth/feishu/start?return_to=${encodeURIComponent(returnTo)}`,
          );
          return;
        }
        throw new Error(body.error);
      }
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      setLoading(false);
    }
  };
  const calculationDate =
    type === "settlement"
      ? `${reportDate.slice(0, 4)}-${String(month).padStart(2, "0")}-31`
      : reportDate;
  const summary = data
    ? calculateSummary(type, data.tables, calculationDate)
    : [];
  const candidates =
    data && type === "repurchase"
      ? buildRepurchaseCandidates(data.tables, profile)
      : [];
  const displayedSummary =
    type === "repurchase" && data
      ? [{ label: "本月复投候选", value: candidates.length }, ...summary]
      : summary;
  const audit =
    data && type === "daily" ? publicationAudit(data.tables, reportDate) : [];
  const metric = (label: string) =>
    summary.find((item: any) => item.label === label)?.value ?? 0;
  const money = (value: unknown) =>
    `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const dailyText = `【合作日报】\n\n${reportDate.slice(5).replace("-", "")}进展：今日提报量${manual.todayProposal || "待填写"}（后台待审核${manual.pendingReview || "待填写"}），确认合作${metric("今日确认达人")}位，确认合作${metric("今日确认视频")}条；今日发布量${metric("今日发布视频")}，发布金额${money(metric("今日发布金额"))}\n\n本月合作进展：\n➡️ 截至目前本月总共提报量${manual.monthProposal || "待填写"}，确定合作数${metric("本月确认达人")}位达人&${metric("本月确认视频")}条视频\n\n➡️ 本月确定合作金额${money(metric("本月确认金额"))}\n\n➡️ 本月发布量${metric("本月发布视频")}，发布金额${money(metric("本月发布金额"))}`;
  const copy = async () => {
    if (!data) return;
    const candidateHeaders = [
      "推荐达人",
      "达人主页",
      "对接运营",
      "内容垂类",
      "国家和语言",
      "平台类型",
      "历史发布链接",
      "播放量",
      "CPM",
      "推荐依据",
      "Lia 是否确认",
    ];
    const output =
      type === "daily"
        ? dailyText
        : type === "repurchase"
          ? [
              candidateHeaders.join("\t"),
              ...candidates.map((candidate) =>
                [
                  candidate.creator,
                  candidate.homepage,
                  candidate.operator,
                  candidate.niche,
                  candidate.countryLanguage,
                  candidate.platformType,
                  candidate.publishLinks.replace(/\n/g, " "),
                  candidate.views,
                  candidate.cpm,
                  candidate.reason,
                  candidate.confirmed,
                ].join("\t"),
              ),
            ].join("\n")
          : data.tables
              .map((t: any) =>
                [
                  t.name,
                  ...t.values.map((r: any[]) => r.map(text).join("\t")),
                ].join("\n"),
              )
              .join("\n\n");
    await navigator.clipboard.writeText(output);
  };
  const saveSnapshot = () => {
    const next = [
      {
        date: reportDate,
        savedAt: new Date().toISOString(),
        manual,
        summary,
        body: dailyText,
      },
      ...history.filter((item) => item.date !== reportDate),
    ];
    localStorage.setItem("lia-daily-snapshots", JSON.stringify(next));
    setHistory(next);
  };
  const saveProfile = () =>
    localStorage.setItem("lia-repurchase-profile", JSON.stringify(profile));
  return (
    <>
      <header>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="header-actions">
          {type === "daily" ? (
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          ) : type === "settlement" ? (
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}月
                </option>
              ))}
            </select>
          ) : null}
          <button onClick={read} disabled={loading}>
            {loading ? "正在读取…" : "读取最新数据"}
          </button>
          {data ? <button onClick={copy}>复制结果</button> : null}
        </div>
      </header>
      {type === "daily" ? (
        <section className="card form-card">
          <h2>手动填写</h2>
          <div className="form-grid">
            <label>
              今日提报量
              <input
                value={manual.todayProposal}
                onChange={(e) =>
                  setManual({ ...manual, todayProposal: e.target.value })
                }
              />
            </label>
            <label>
              后台待审核
              <input
                value={manual.pendingReview}
                onChange={(e) =>
                  setManual({ ...manual, pendingReview: e.target.value })
                }
              />
            </label>
            <label>
              本月累计提报量
              <input
                value={manual.monthProposal}
                onChange={(e) =>
                  setManual({ ...manual, monthProposal: e.target.value })
                }
              />
            </label>
          </div>
          {data ? (
            <>
              <div className="report-preview">
                <pre>{dailyText}</pre>
              </div>
              <button onClick={saveSnapshot}>保存当日快照</button>
              <small>已保存 {history.length} 份历史日报</small>
            </>
          ) : null}
        </section>
      ) : type === "repurchase" ? (
        <section className="card form-card">
          <h2>当月客户重点画像</h2>
          <div className="form-grid">
            <label>
              月份
              <input
                value={profile.month}
                onChange={(e) =>
                  setProfile({ ...profile, month: e.target.value })
                }
              />
            </label>
            <label>
              重点国家
              <input
                value={profile.countries}
                onChange={(e) =>
                  setProfile({ ...profile, countries: e.target.value })
                }
              />
            </label>
            <label>
              重点语言
              <input
                value={profile.languages}
                onChange={(e) =>
                  setProfile({ ...profile, languages: e.target.value })
                }
              />
            </label>
            <label>
              重点垂类
              <input
                value={profile.niches}
                onChange={(e) =>
                  setProfile({ ...profile, niches: e.target.value })
                }
              />
            </label>
            <label>
              重点平台
              <input
                value={profile.platforms}
                onChange={(e) =>
                  setProfile({ ...profile, platforms: e.target.value })
                }
              />
            </label>
            <label>
              重点达人风格
              <input
                value={profile.styles}
                onChange={(e) =>
                  setProfile({ ...profile, styles: e.target.value })
                }
              />
            </label>
            <label className="wide">
              其他说明
              <textarea
                value={profile.notes}
                onChange={(e) =>
                  setProfile({ ...profile, notes: e.target.value })
                }
              />
            </label>
          </div>
          <button onClick={saveProfile}>保存本月画像</button>
        </section>
      ) : null}
      {type === "daily" ? (
        <div className="notice">
          数据来源：对客日常表。“确认合作达人”用于合作数据，“发布表”用于发布数据；不读取
          Tracker 内部成本。
        </div>
      ) : type === "settlement" ? (
        <div className="notice">
          月度结算只读取对客日常表的“发布表”。按所选月份统计有有效发布链接的达人、视频和对客发布金额；同一条视频的多个平台链接只计算一次。
        </div>
      ) : type === "repurchase" ? (
        <div className="notice">
          系统从对客“发布表”合并历史达人，排除明确不推荐或存在严重风险的记录，再结合当月客户重点画像自动筛选并排序。这里只展示前30位候选，不再展示全部发布明细；你在此基础上做二次确认。
        </div>
      ) : null}
      {needsAuthorization ? (
        <div className="error">
          飞书授权已失效。
          <a
            className="auth-button"
            href={`${apiBase}/api/auth/feishu/start?return_to=${encodeURIComponent(window.location.hash.split("?")[0] || "#/repurchase")}`}
          >
            立即授权飞书
          </a>
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      {data ? (
        <>
          <div className="notice">
            读取时间：{new Date(data.readAt).toLocaleString("zh-CN")} ·
            数据来自飞书在线原表
          </div>
          <section className="summary-grid">
            {displayedSummary.map((item) => (
              <article className="card" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </section>
          {type === "daily" ? (
            <details className="card audit">
              <summary>核对本月计入的发布记录（{audit.length}条视频）</summary>
              <table>
                <thead>
                  <tr>
                    <th>发布时间</th>
                    <th>达人</th>
                    <th>该视频的发布平台链接</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((item, index) => (
                    <tr key={`${item.link}-${index}`}>
                      <td>{item.date}</td>
                      <td>{item.creator}</td>
                      <td>{item.link}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
          {type === "repurchase" ? (
            <section>
              <h2>系统初筛复投候选（最多30位）</h2>
              <div className="card live-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>推荐达人</th>
                      <th>达人主页</th>
                      <th>对接运营</th>
                      <th>内容垂类</th>
                      <th>国家和语言</th>
                      <th>平台类型</th>
                      <th>历史发布链接</th>
                      <th>播放量</th>
                      <th>CPM</th>
                      <th>推荐依据</th>
                      <th>Lia 是否确认</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr key={`${candidate.homepage}-${candidate.creator}`}>
                        <td>{candidate.creator}</td>
                        <td>{candidate.homepage}</td>
                        <td>{candidate.operator}</td>
                        <td>{candidate.niche}</td>
                        <td>{candidate.countryLanguage}</td>
                        <td>{candidate.platformType}</td>
                        <td>{candidate.publishLinks}</td>
                        <td>{candidate.views}</td>
                        <td>{candidate.cpm}</td>
                        <td>{candidate.reason}</td>
                        <td>{candidate.confirmed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!candidates.length ? (
                <div className="notice">
                  暂无符合当前画像的候选，请补充或放宽上方重点画像后重新查看。
                </div>
              ) : null}
            </section>
          ) : (
            data.tables.map((t: any) => (
              <section key={t.id}>
                <h2>
                  {t.name}（{Math.max(0, t.values.length - 1)} 行）
                </h2>
                <div className="card live-table-wrap">
                  <table>
                    <tbody>
                      {t.values.slice(0, 101).map((row: any[], i: number) => (
                        <tr key={i}>
                          {row.map((cell: any, j: number) =>
                            i === 0 ? (
                              <th key={j}>{text(cell)}</th>
                            ) : (
                              <td key={j}>{text(cell)}</td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </>
      ) : (
        <div className="card empty">
          <Database size={36} />
          <h2>等待按需读取</h2>
          <p>点击“读取最新数据”，不会持续同步或修改飞书。</p>
        </div>
      )}
    </>
  );
}

type Source = { key: string; name: string; url: string; status: string };
function SourcesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: () =>
      fetch(`${apiBase}/api/data-sources`, { credentials: "include" }).then(
        (r) => r.json(),
      ),
  });
  const [results, setResults] = React.useState<Record<string, string>>({});
  const [structures, setStructures] = React.useState<
    Record<
      string,
      Array<{ id: string; name: string; rows?: number; columns?: number }>
    >
  >({});
  const test = async (key: string) => {
    setResults((v) => ({ ...v, [key]: "正在读取…" }));
    try {
      const r = await fetch(`${apiBase}/api/data-sources/${key}/test`, {
        credentials: "include",
      });
      const body = await r.json();
      setResults((v) => ({
        ...v,
        [key]: body.ok
          ? `连接成功 · ${body.objectType}${body.title ? ` · ${body.title}` : ""}`
          : body.error,
      }));
    } catch {
      setResults((v) => ({ ...v, [key]: "连接失败，请稍后重试" }));
    }
  };
  const readStructure = async (key: string) => {
    setResults((v) => ({ ...v, [key]: "正在读取表格结构…" }));
    try {
      const r = await fetch(`${apiBase}/api/data-sources/${key}/structure`, {
        credentials: "include",
      });
      const body = await r.json();
      if (!body.ok) throw new Error(body.error);
      setStructures((v) => ({ ...v, [key]: body.items }));
      setResults((v) => ({
        ...v,
        [key]: `已读取 ${body.items.length} 个工作表`,
      }));
    } catch (error) {
      setResults((v) => ({
        ...v,
        [key]: error instanceof Error ? error.message : "结构读取失败",
      }));
    }
  };
  return (
    <>
      <header>
        <div>
          <h1>数据源管理</h1>
          <p>只有点击测试或读取时才访问飞书，不持续同步。</p>
        </div>
      </header>
      <div className="notice">当前为只读模式，不会修改飞书原表。</div>
      <section className="source-grid">
        {isLoading ? (
          <p>正在加载数据源…</p>
        ) : (
          data?.sources?.map((s: Source) => (
            <article className="card source-card" key={s.key}>
              <div>
                <h2>{s.name}</h2>
                <a href={s.url} target="_blank" rel="noreferrer">
                  打开飞书原表
                </a>
              </div>
              <p>
                {results[s.key] ??
                  (s.key === "client-daily" && !data.userAuthorized
                    ? "需要 Lia 完成一次用户只读授权"
                    : s.status)}
              </p>
              {structures[s.key]?.length ? (
                <ul>
                  {structures[s.key].map((item) => (
                    <li key={item.id}>
                      <span>{item.name}</span>
                      {item.rows ? (
                        <small>
                          {item.rows} 行 · {item.columns} 列
                        </small>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="source-actions">
                {s.key === "client-daily" && !data.userAuthorized ? (
                  <a
                    className="auth-button"
                    href={`${apiBase}/api/auth/feishu/start`}
                  >
                    授权读取对客表
                  </a>
                ) : (
                  <>
                    <button onClick={() => test(s.key)}>测试连接</button>
                    <button
                      className="secondary"
                      onClick={() => readStructure(s.key)}
                    >
                      读取工作表
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}

export function App() {
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div>L</div>
          <span>
            Lia Workcenter<small>工作中心</small>
          </span>
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <footer>
          <span className="online"></span>只读服务已连接
        </footer>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/hub" element={<Navigate to="/" replace />} />
          <Route path="/creators" element={<Navigate to="/" replace />} />
          <Route path="/reviews" element={<Navigate to="/" replace />} />
          <Route
            path="/daily"
            element={
              <LiveDataPage
                type="daily"
                title="日报中心"
                description="按日期读取对客日常表，生成当天及本月至今的合作日报。"
              />
            }
          />
          <Route
            path="/settlement"
            element={
              <LiveDataPage
                type="settlement"
                title="月度结算"
                description="按月份读取对客发布表，核对已发布达人、视频和发布金额。"
              />
            }
          />
          <Route
            path="/repurchase"
            element={
              <LiveDataPage
                type="repurchase"
                title="复投达人"
                description="读取历史发布表，汇总复投候选供 Lia 人工确认。"
              />
            }
          />
          {nav
            .filter(
              ([to]) =>
                ![
                  "/",
                  "/daily",
                  "/settlement",
                  "/repurchase",
                  "/sources",
                ].includes(to),
            )
            .map(([to, label]) => (
              <Route
                key={to}
                path={to}
                element={<Placeholder title={label} />}
              />
            ))}
          <Route path="/sources" element={<SourcesPage />} />
        </Routes>
      </main>
    </div>
  );
}
