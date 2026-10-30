import { z } from "zod";
import { db } from "./db.js";

const tokenResponse = z.object({ code: z.number(), msg: z.string().optional(), tenant_access_token: z.string().optional(), expire: z.number().optional() });
const wikiResponse = z.object({ code: z.number(), msg: z.string().optional(), data: z.object({ node: z.object({ obj_type: z.string(), obj_token: z.string(), title: z.string().optional() }) }).optional() });

export const dataSources = [
  { key: "tracker", name: "内部 Tracker", kind: "wiki", url: "https://flourishculture.feishu.cn/wiki/VemdwziMAihpGDkrijWcWjZ2nzd", wikiToken: "VemdwziMAihpGDkrijWcWjZ2nzd" },
  { key: "client-daily", name: "对客日常表", kind: "wiki", url: "https://my.feishu.cn/wiki/ObXqwDvvBiwsrrk2u4ncemPWn6c?sheet=DPziUh", wikiToken: "ObXqwDvvBiwsrrk2u4ncemPWn6c" },
  { key: "settlement", name: "月度结算表", kind: "wiki", url: "https://flourishculture.feishu.cn/wiki/QK82wK1mwifSsskFyVScvwonnwe", wikiToken: "QK82wK1mwifSsskFyVScvwonnwe" },
  { key: "repurchase", name: "复投达人表", kind: "wiki", url: "https://flourishculture.feishu.cn/wiki/UCrkwhr8jiMwpQkiRFGclXBUnDd?sheet=Lbkt7J", wikiToken: "UCrkwhr8jiMwpQkiRFGclXBUnDd" }
] as const;

export function hasFeishuCredentials() { return Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET); }

export async function getTenantToken() {
  if (!hasFeishuCredentials()) throw new Error("尚未配置飞书只读连接凭证");
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ app_id: process.env.FEISHU_APP_ID, app_secret: process.env.FEISHU_APP_SECRET })
  });
  if (!response.ok) throw new Error(`飞书鉴权网络错误（${response.status}）`);
  const result = tokenResponse.parse(await response.json());
  if (result.code !== 0 || !result.tenant_access_token) throw new Error(`飞书鉴权失败：${result.msg ?? result.code}`);
  return result.tenant_access_token;
}

export async function resolveWikiNode(wikiToken: string, userToken?: string) {
  const token = userToken ?? await getTenantToken();
  const response = await fetch(`https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const raw = await response.json() as unknown;
  if (!response.ok) {
    const detail = z.object({ code: z.number().optional(), msg: z.string().optional() }).safeParse(raw);
    const message = detail.success ? `${detail.data.code ?? response.status} · ${detail.data.msg ?? "未知原因"}` : String(response.status);
    throw new Error(`Wiki 节点解析失败：${message}`);
  }
  const result = wikiResponse.parse(raw);
  if (result.code !== 0 || !result.data?.node) throw new Error(`Wiki 节点解析失败：${result.msg ?? result.code}`);
  return result.data.node;
}

const userTokenResponse = z.object({ code: z.number(), msg: z.string().optional(), data: z.object({ access_token: z.string(), expires_in: z.number(), refresh_token: z.string().optional(), refresh_expires_in: z.number().optional() }).optional() });

export type FeishuUserTokens = { accessToken: string; refreshToken?: string; expiresAt: number; refreshExpiresAt?: number };

export function saveUserTokens(tokens: FeishuUserTokens) {
  db.prepare(`INSERT OR REPLACE INTO oauth_tokens(provider,access_token,refresh_token,expires_at,refresh_expires_at,updated_at) VALUES('feishu',?,?,?,?,CURRENT_TIMESTAMP)`)
    .run(tokens.accessToken, tokens.refreshToken ?? null, tokens.expiresAt, tokens.refreshExpiresAt ?? null);
}

export async function exchangeAuthorizationCode(code: string) {
  const tenantToken = await getTenantToken();
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v1/access_token", {
    method: "POST", headers: { authorization: `Bearer ${tenantToken}`, "content-type": "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code", code })
  });
  const result = userTokenResponse.parse(await response.json());
  if (!response.ok || result.code !== 0 || !result.data) throw new Error(`飞书用户授权失败：${result.code} · ${result.msg ?? "未知原因"}`);
  const now = Date.now();
  const tokens: FeishuUserTokens = { accessToken: result.data.access_token, refreshToken: result.data.refresh_token, expiresAt: now + result.data.expires_in * 1000, refreshExpiresAt: result.data.refresh_expires_in ? now + result.data.refresh_expires_in * 1000 : undefined };
  saveUserTokens(tokens);
  return tokens;
}

export function getStoredUserToken() {
  const row = db.prepare("SELECT access_token accessToken, expires_at expiresAt FROM oauth_tokens WHERE provider='feishu'").get() as { accessToken: string; expiresAt: number } | undefined;
  return row && row.expiresAt > Date.now() + 60_000 ? row.accessToken : null;
}

async function feishuGet(url: string, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json() as { code?: number; msg?: string; data?: unknown };
  if (!response.ok || body.code !== 0) throw new Error(`飞书读取失败：${body.code ?? response.status} · ${body.msg ?? "未知原因"}`);
  return body.data;
}

export async function readObjectStructure(objectType: string, objectToken: string, token: string) {
  if (objectType === "bitable") {
    const data = await feishuGet(`https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(objectToken)}/tables?page_size=100`, token);
    const parsed = z.object({ items: z.array(z.object({ table_id: z.string(), name: z.string() })) }).parse(data);
    return { objectType, items: parsed.items.map(item => ({ id: item.table_id, name: item.name })) };
  }
  if (objectType === "sheet") {
    const data = await feishuGet(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${encodeURIComponent(objectToken)}/sheets/query`, token);
    const parsed = z.object({ sheets: z.array(z.object({ sheet_id: z.string(), title: z.string(), row_count: z.number().optional(), column_count: z.number().optional() })) }).parse(data);
    return { objectType, items: parsed.sheets.map(sheet => ({ id: sheet.sheet_id, name: sheet.title, rows: sheet.row_count, columns: sheet.column_count })) };
  }
  throw new Error(`暂不支持的数据类型：${objectType}`);
}

export async function readSheetValues(spreadsheetToken: string, sheetId: string, token: string) {
  const range = encodeURIComponent(`${sheetId}!A1:ZZ5000`);
  const data = await feishuGet(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${encodeURIComponent(spreadsheetToken)}/values/${range}?valueRenderOption=FormattedValue&dateTimeRenderOption=FormattedString`, token);
  const parsed = z.object({ valueRange: z.object({ values: z.array(z.array(z.unknown())).optional() }) }).parse(data);
  return parsed.valueRange.values ?? [];
}
