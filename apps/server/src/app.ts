import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { dataSources, exchangeAuthorizationCode, getStoredUserToken, getTenantToken, hasFeishuCredentials, readObjectStructure, readSheetValues, resolveWikiNode, saveUserTokens, type FeishuUserTokens } from "./feishu.js";

export const app = express();
app.use(cors({ origin: [process.env.WEB_ORIGIN ?? "http://localhost:5173", "https://liadiary.github.io"], credentials: true }));
app.use(express.json({ limit: "10mb" }));

const cookieName = "lia_feishu_session";
const cookieKey = () => createHash("sha256").update(process.env.FEISHU_APP_SECRET ?? "development-only").digest();
function sealTokens(tokens: FeishuUserTokens) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", cookieKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function openTokens(value: string) {
  try { const raw = Buffer.from(value, "base64url"); const decipher = createDecipheriv("aes-256-gcm", cookieKey(), raw.subarray(0,12)); decipher.setAuthTag(raw.subarray(12,28)); return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as FeishuUserTokens; } catch { return null; }
}
app.use((req, _res, next) => {
  const match = req.headers.cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`));
  if (match) { const tokens = openTokens(match.slice(cookieName.length + 1)); if (tokens && tokens.expiresAt > Date.now() + 60_000) saveUserTokens(tokens); }
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lia-workcenter", database: "connected" }));

app.get("/api/data-sources", (_req, res) => res.json({
  configured: hasFeishuCredentials(),
  userAuthorized: Boolean(getStoredUserToken()),
  mode: "manual-read-only",
  sources: dataSources.map(({ wikiToken: _wikiToken, ...source }) => ({ ...source, status: hasFeishuCredentials() ? "可测试连接" : "等待配置只读凭证" }))
}));

const testDataSource = async (req: express.Request, res: express.Response) => {
  const source = dataSources.find(item => item.key === req.params.key);
  if (!source) return res.status(404).json({ ok: false, error: "未知数据源" });
  try {
    const userToken = source.key === "client-daily" ? getStoredUserToken() : null;
    if (source.key === "client-daily" && !userToken) return res.status(401).json({ ok: false, needsUserAuthorization: true, error: "对客日常表需要 Lia 完成一次飞书用户授权" });
    const node = await resolveWikiNode(source.wikiToken, userToken ?? undefined);
    return res.json({ ok: true, source: source.name, objectType: node.obj_type, title: node.title ?? source.name });
  } catch (error) {
    return res.status(hasFeishuCredentials() ? 502 : 503).json({ ok: false, error: error instanceof Error ? error.message : "连接失败" });
  }
};
app.get("/api/data-sources/:key/test", testDataSource);
app.post("/api/data-sources/:key/test", testDataSource);

app.get("/api/data-sources/:key/structure", async (req, res) => {
  const source = dataSources.find(item => item.key === req.params.key);
  if (!source) return res.status(404).json({ ok: false, error: "未知数据源" });
  try {
    const token = source.key === "client-daily" ? getStoredUserToken() : await getTenantToken();
    if (!token) return res.status(401).json({ ok: false, needsUserAuthorization: true, error: "需要重新完成飞书用户授权" });
    const node = await resolveWikiNode(source.wikiToken, token);
    const structure = await readObjectStructure(node.obj_type, node.obj_token, token);
    return res.json({ ok: true, source: source.name, title: node.title ?? source.name, ...structure });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "读取结构失败" });
  }
});

async function readNamedSheets(sourceKey: string, names: string[]) {
  const source = dataSources.find(item => item.key === sourceKey);
  if (!source) throw new Error("未知数据源");
  const token = source.key === "client-daily" ? getStoredUserToken() : await getTenantToken();
  if (!token) throw new Error("需要重新完成飞书用户授权");
  const node = await resolveWikiNode(source.wikiToken, token);
  if (node.obj_type !== "sheet") throw new Error("该数据源不是电子表格");
  const structure = await readObjectStructure(node.obj_type, node.obj_token, token);
  const selected = structure.items.filter(item => names.some(name => item.name === name || item.name.includes(name)));
  const tables = [];
  for (const sheet of selected) tables.push({ id: sheet.id, name: sheet.name, values: await readSheetValues(node.obj_token, sheet.id, token, "rows" in sheet && typeof sheet.rows === "number" ? sheet.rows : undefined, "columns" in sheet && typeof sheet.columns === "number" ? sheet.columns : undefined) });
  return tables;
}

app.get("/api/live/:type", async (req, res) => {
  try {
    const month = typeof req.query.month === "string" ? req.query.month.replace(/[^0-9]/g, "") : String(new Date().getMonth() + 1);
    let tables;
    if (req.params.type === "daily") tables = await readNamedSheets("client-daily", ["确认合作达人", "发布表"]);
    else if (req.params.type === "settlement") tables = await readNamedSheets("settlement", [`${month}月`]);
    else if (req.params.type === "repurchase") tables = await readNamedSheets("repurchase", [`${month}月复投达人推荐`]);
    else return res.status(404).json({ ok: false, error: "未知实时数据类型" });
    return res.json({ ok: true, readAt: new Date().toISOString(), tables });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "读取实时数据失败" });
  }
});

const oauthStates = new Map<string, number>();
app.get("/api/auth/feishu/start", (_req, res) => {
  if (!process.env.FEISHU_APP_ID) return res.status(503).send("飞书应用尚未配置");
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now() + 10 * 60_000);
  const callback = `${process.env.PUBLIC_API_URL ?? "https://lia-workcenter-api.onrender.com"}/api/auth/feishu/callback`;
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("app_id", process.env.FEISHU_APP_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "wiki:wiki:readonly sheets:spreadsheet:readonly bitable:app:readonly");
  res.redirect(url.toString());
});

app.get("/api/auth/feishu/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const expires = oauthStates.get(state);
  oauthStates.delete(state);
  if (!expires || expires < Date.now()) return res.status(400).send("授权请求已过期，请返回 Lia Workcenter 重新开始");
  if (typeof req.query.code !== "string") return res.status(400).send("飞书未返回授权码");
  try {
    const tokens = await exchangeAuthorizationCode(req.query.code);
    const maxAge = Math.max(3600, Math.floor(((tokens.refreshExpiresAt ?? tokens.expiresAt) - Date.now()) / 1000));
    res.setHeader("Set-Cookie", `${cookieName}=${sealTokens(tokens)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None`);
    res.redirect("https://liadiary.github.io/lia/#/sources?auth=success");
  } catch (error) {
    res.status(502).send(error instanceof Error ? error.message : "飞书授权失败");
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
    syncSources: [
      { name: "内部 Tracker", status: hasFeishuCredentials() ? "可按需读取" : "尚未配置", lastSync: null },
      { name: "对客日常表", status: getStoredUserToken() ? "已完成用户授权" : "需要用户授权", lastSync: null },
      { name: "月度结算表", status: hasFeishuCredentials() ? "可按需读取" : "尚未配置", lastSync: null },
      { name: "复投达人表", status: hasFeishuCredentials() ? "可按需读取" : "尚未配置", lastSync: null }
    ]
  });
});

app.get("/api/creators", (_req, res) => {
  const rows = db.prepare(`SELECT c.id, c.creator_name creatorName, c.platform, c.operator,
    COUNT(co.id) cooperationCount, CASE WHEN c.suspected_fake=1 THEN '疑似假号' ELSE '正常' END status
    FROM creators c LEFT JOIN collaborations co ON co.creator_id=c.id GROUP BY c.id ORDER BY c.updated_at DESC`).all();
  res.json(rows);
});
