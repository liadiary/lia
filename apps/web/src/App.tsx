import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Activity, CircleDollarSign, Database, FileCheck2, LayoutDashboard, RefreshCw, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const nav = [
  ["/", "今日工作台", LayoutDashboard], ["/creators", "达人中心", Users], ["/reviews", "提审任务", FileCheck2],
  ["/daily", "日报中心", Activity], ["/settlement", "月度结算", CircleDollarSign],
  ["/repurchase", "复投达人", RefreshCw], ["/sources", "数据源管理", Database]
] as const;

const apiBase = window.location.hostname.endsWith("github.io") ? "https://lia-workcenter-api.onrender.com" : "";

function Dashboard() {
  const demo = { tasks: [{key:"scripts",label:"待审脚本",count:0,tone:"orange"},{key:"videos",label:"待审视频",count:0,tone:"orange"},{key:"unsynced",label:"WA 已提交、Tracker 未同步",count:0,tone:"red"},{key:"conflicts",label:"多来源版本冲突",count:0,tone:"red"},{key:"settlement",label:"待确认结算",count:0,tone:"blue"}], today:{confirmedCreators:0,confirmedVideos:0,confirmedAmount:0,publishedCreators:0,publishedVideos:0,publishedAmount:0}, syncSources:["内部 Tracker","对客日常表","月度结算表","复投达人表","Tripo KOL 中台"].map(name=>({name,status:"尚未连接",lastSync:null})) };
  const { data = demo, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], retry: false, queryFn: async () => { try { const r = await fetch(`${apiBase}/api/dashboard`, { credentials: "include" }); return r.ok ? await r.json() : demo; } catch { return demo; } } });
  if (isLoading) return <p>正在加载工作台…</p>;
  return <>
    <header><div><h1>你好，Lia</h1><p>按需读取最新在线数据，需要时再计算和核对。</p></div><div className="header-actions"><span className="date">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date())}</span><button onClick={()=>refetch()}>读取最新数据</button></div></header>
    <div className="notice">演示环境尚未连接飞书。接入后，只有点击“读取最新数据”时才会使用只读权限访问在线表格。</div>
    <h2>今日待办</h2><section className="task-grid">{data.tasks.map((t: any) => <article className={`card task ${t.tone}`} key={t.key}><strong>{t.count}</strong><span>{t.label}</span><small>{t.count ? "需要处理" : "目前没有待办"}</small></article>)}</section>
    <div className="columns"><section><h2>今日数据</h2><div className="card metrics"><div><b>{data.today.confirmedCreators}</b><span>确认合作达人</span></div><div><b>{data.today.confirmedVideos}</b><span>确认合作视频</span></div><div><b className="client">${data.today.confirmedAmount}</b><span>对客合作金额</span></div><div><b>{data.today.publishedVideos}</b><span>今日发布视频</span></div></div></section>
    <section><h2>数据源状态</h2><div className="card sources">{data.syncSources.map((s: any) => <div key={s.name}><span>{s.name}</span><em>{s.status}</em></div>)}</div></section></div>
  </>;
}

function Placeholder({ title }: { title: string }) { return <><header><div><h1>{title}</h1><p>功能骨架已就位，将在下一开发阶段接入数据和操作。</p></div></header><div className="card empty"><Database size={36}/><h2>暂无数据</h2><p>可先从数据源管理导入 Excel 或 CSV。</p></div></>; }

function LiveDataPage({ type, title, description }: { type: "daily"|"settlement"|"repurchase"; title: string; description: string }) {
  const [month, setMonth] = React.useState(String(new Date().getMonth()+1));
  const [data, setData] = React.useState<any>(null); const [loading,setLoading]=React.useState(false); const [error,setError]=React.useState("");
  const read = async () => { setLoading(true); setError(""); try { const r=await fetch(`${apiBase}/api/live/${type}?month=${month}`,{credentials:"include"}); const body=await r.json(); if(!body.ok) throw new Error(body.error); setData(body); } catch(e){setError(e instanceof Error?e.message:"读取失败");} finally{setLoading(false);} };
  const copy = async () => { if(!data) return; const text=data.tables.map((t:any)=>[t.name,...t.values.map((r:any[])=>r.map(v=>String(v??"")).join("\t"))].join("\n")).join("\n\n"); await navigator.clipboard.writeText(text); };
  return <><header><div><h1>{title}</h1><p>{description}</p></div><div className="header-actions">{type!=="daily"?<select value={month} onChange={e=>setMonth(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}月</option>)}</select>:null}<button onClick={read} disabled={loading}>{loading?"正在读取…":"读取最新数据"}</button>{data?<button onClick={copy}>复制结果</button>:null}</div></header>{type==="settlement"?<div className="notice">月度结算用于汇总当月发布、结算金额、播放量、CPM 和确认状态；数据来源为“Tripo 完结链接”。</div>:null}{error?<div className="error">{error}</div>:null}{data?<><div className="notice">读取时间：{new Date(data.readAt).toLocaleString("zh-CN")} · 数据来自飞书在线原表</div>{data.tables.map((t:any)=><section key={t.id}><h2>{t.name}（{Math.max(0,t.values.length-1)} 行）</h2><div className="card live-table-wrap"><table><tbody>{t.values.slice(0,101).map((row:any[],i:number)=><tr key={i}>{row.map((cell:any,j:number)=>i===0?<th key={j}>{String(cell??"")}</th>:<td key={j}>{String(cell??"")}</td>)}</tr>)}</tbody></table></div></section>)}</>:<div className="card empty"><Database size={36}/><h2>等待按需读取</h2><p>点击“读取最新数据”，不会持续同步或修改飞书。</p></div>}</>;
}

type Source = { key: string; name: string; url: string; status: string };
function SourcesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["sources"], queryFn: () => fetch(`${apiBase}/api/data-sources`, { credentials: "include" }).then(r => r.json()) });
  const [results, setResults] = React.useState<Record<string,string>>({});
  const [structures, setStructures] = React.useState<Record<string,Array<{id:string;name:string;rows?:number;columns?:number}>>>({});
  const test = async (key: string) => {
    setResults(v => ({...v,[key]:"正在读取…"}));
    try { const r = await fetch(`${apiBase}/api/data-sources/${key}/test`, { credentials: "include" }); const body = await r.json(); setResults(v => ({...v,[key]:body.ok ? `连接成功 · ${body.objectType}${body.title ? ` · ${body.title}` : ""}` : body.error})); }
    catch { setResults(v => ({...v,[key]:"连接失败，请稍后重试"})); }
  };
  const readStructure = async (key: string) => {
    setResults(v => ({...v,[key]:"正在读取表格结构…"}));
    try { const r = await fetch(`${apiBase}/api/data-sources/${key}/structure`, { credentials: "include" }); const body = await r.json(); if (!body.ok) throw new Error(body.error); setStructures(v => ({...v,[key]:body.items})); setResults(v => ({...v,[key]:`已读取 ${body.items.length} 个工作表`})); }
    catch (error) { setResults(v => ({...v,[key]:error instanceof Error ? error.message : "结构读取失败"})); }
  };
  return <><header><div><h1>数据源管理</h1><p>只有点击测试或读取时才访问飞书，不持续同步。</p></div></header>
    <div className="notice">当前为只读模式，不会修改飞书原表。</div>
    <section className="source-grid">{isLoading ? <p>正在加载数据源…</p> : data?.sources?.map((s: Source) => <article className="card source-card" key={s.key}><div><h2>{s.name}</h2><a href={s.url} target="_blank" rel="noreferrer">打开飞书原表</a></div><p>{results[s.key] ?? (s.key === "client-daily" && !data.userAuthorized ? "需要 Lia 完成一次用户只读授权" : s.status)}</p>{structures[s.key]?.length ? <ul>{structures[s.key].map(item=><li key={item.id}><span>{item.name}</span>{item.rows ? <small>{item.rows} 行 · {item.columns} 列</small>:null}</li>)}</ul>:null}<div className="source-actions">{s.key === "client-daily" && !data.userAuthorized ? <a className="auth-button" href={`${apiBase}/api/auth/feishu/start`}>授权读取对客表</a> : <><button onClick={()=>test(s.key)}>测试连接</button><button className="secondary" onClick={()=>readStructure(s.key)}>读取工作表</button></>}</div></article>)}</section>
  </>;
}

export function App() { return <div className="shell"><aside><div className="brand"><div>L</div><span>Lia Workcenter<small>工作中心</small></span></div><nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"}><Icon size={19}/>{label}</NavLink>)}</nav><footer><span className="online"></span>只读服务已连接</footer></aside><main><Routes><Route path="/" element={<Dashboard/>}/><Route path="/daily" element={<LiveDataPage type="daily" title="日报中心" description="每天按需读取确认合作达人和发布表，生成当日汇总。"/>}/><Route path="/settlement" element={<LiveDataPage type="settlement" title="月度结算" description="按月份读取完结链接表，核对发布、金额、播放量和 CPM。"/>}/><Route path="/repurchase" element={<LiveDataPage type="repurchase" title="复投达人" description="按月份读取复投达人推荐名单。"/>}/>{nav.filter(([to])=>!["/","/daily","/settlement","/repurchase","/sources"].includes(to)).map(([to,label]) => <Route key={to} path={to} element={<Placeholder title={label}/>}/>)}<Route path="/sources" element={<SourcesPage/>}/></Routes></main></div>; }
