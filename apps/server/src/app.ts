import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { dataSources, hasFeishuCredentials, resolveWikiNode } from "./feishu.js";

export const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lia-workcenter", database: "connected" }));

app.get("/api/data-sources", (_req, res) => res.json({
  configured: hasFeishuCredentials(),
  mode: "manual-read-only",
  sources: dataSources.map(({ wikiToken: _wikiToken, ...source }) => ({ ...source, status: hasFeishuCredentials() ? "可测试连接" : "等待配置只读凭证" }))
}));

app.post("/api/data-sources/:key/test", async (req, res) => {
  const source = dataSources.find(item => item.key === req.params.key);
  if (!source) return res.status(404).json({ ok: false, error: "未知数据源" });
  try {
    const node = await resolveWikiNode(source.wikiToken);
    return res.json({ ok: true, source: source.name, objectType: node.obj_type, title: node.title ?? source.name });
  } catch (error) {
    return res.status(hasFeishuCredentials() ? 502 : 503).json({ ok: false, error: error instanceof Error ? error.message : "连接失败" });
  }
});

app.get("/api/dashboard", (_req, res) => {
  const count = (sql: string) => Number((db.prepare(sql).get() as { count: number }).count);
  res.json({
    tasks: [
      { key: "scripts", label: "待审脚本", count: count("SELECT COUNT(*) count FROM submissions WHERE material_type='script' AND review_status='待审核'"), tone: "orange" },
      { key: "videos", label: "待审视频", count: count("SELECT COUNT(*) count FROM submissions WHERE material_type='video' AND review_status='待审核'"), tone: "orange" },
      { key: "unsynced", label: "WA 已提交、Tracker 未同步", count: count("SELECT COUNT(*) count FROM submissions WHERE source='whatsapp' AND tracker_synced=0"), tone: "red" },
      { key: "conflicts", label: "多来源版本冲突", count: count("SELECT COUNT(*) count FROM submissions WHERE conflict_status!='无冲突'"), tone: "red" },
      { key: "settlement", label: "待确认结算", count: count("SELECT COUNT(*) count FROM publications WHERE settlement_status='待确认'"), tone: "blue" }
    ],
    today: { confirmedCreators: 0, confirmedVideos: 0, confirmedAmount: 0, publishedCreators: 0, publishedVideos: 0, publishedAmount: 0 },
    syncSources: ["内部 Tracker", "对客日常表", "月度结算表", "复投达人表", "Tripo KOL 中台"].map(name => ({ name, status: "尚未连接", lastSync: null }))
  });
});

app.get("/api/creators", (_req, res) => {
  const rows = db.prepare(`SELECT c.id, c.creator_name creatorName, c.platform, c.operator,
    COUNT(co.id) cooperationCount, CASE WHEN c.suspected_fake=1 THEN '疑似假号' ELSE '正常' END status
    FROM creators c LEFT JOIN collaborations co ON co.creator_id=c.id GROUP BY c.id ORDER BY c.updated_at DESC`).all();
  res.json(rows);
});
