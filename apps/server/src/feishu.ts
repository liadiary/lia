import { z } from "zod";

const tokenResponse = z.object({ code: z.number(), msg: z.string().optional(), tenant_access_token: z.string().optional(), expire: z.number().optional() });
const wikiResponse = z.object({ code: z.number(), msg: z.string().optional(), data: z.object({ node: z.object({ obj_type: z.string(), obj_token: z.string(), title: z.string().optional() }) }).optional() });

export const dataSources = [
  { key: "tracker", name: "内部 Tracker", kind: "wiki", url: "https://flourishculture.feishu.cn/wiki/VemdwziMAihpGDkrijWcWjZ2nzd", wikiToken: "VemdwziMAihpGDkrijWcWjZ2nzd" },
  { key: "client-daily", name: "对客日常表", kind: "wiki", url: "https://my.feishu.cn/wiki/ObXqwDvvBiwsrrk2u4ncemPWn6c?sheet=DPziUh", wikiToken: "ObXqwDvvBiwsrrk2u4ncemPWn6c" },
  { key: "settlement", name: "月度结算表", kind: "wiki", url: "https://flourishculture.feishu.cn/wiki/QK82wK1mwifSsskFyVScvwonnwe", wikiToken: "QK82wK1mwifSsskFyVScvwonnwe" },
  { key: "repurchase", name: "复投达人表", kind: "wiki", url: "https://flourishculture.feishu.cn/wiki/UCrkwhr8jiMwpQkiRFGclXBUnDd?sheet=Lbkt7J", wikiToken: "UCrkwhr8jiMwpQkiRFGclXBUnDd" }
] as const;

export function hasFeishuCredentials() { return Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET); }

async function getTenantToken() {
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

export async function resolveWikiNode(wikiToken: string) {
  const token = await getTenantToken();
  const response = await fetch(`https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Wiki 节点解析网络错误（${response.status}）`);
  const result = wikiResponse.parse(await response.json());
  if (result.code !== 0 || !result.data?.node) throw new Error(`Wiki 节点解析失败：${result.msg ?? result.code}`);
  return result.data.node;
}
