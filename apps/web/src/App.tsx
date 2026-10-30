import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Activity, BookOpenCheck, CircleDollarSign, Database, FileCheck2, LayoutDashboard, RefreshCw, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const nav = [
  ["/", "今日工作台", LayoutDashboard], ["/creators", "达人中心", Users], ["/reviews", "提审任务", FileCheck2],
  ["/hub", "团队中台", BookOpenCheck], ["/daily", "日报中心", Activity], ["/settlement", "结算中心", CircleDollarSign],
  ["/repurchase", "复投达人", RefreshCw], ["/sources", "数据源管理", Database]
] as const;

const apiBase = window.location.hostname.endsWith("github.io") ? "https://lia-workcenter-api.onrender.com" : "";

function Dashboard() {
  const demo = { tasks: [{key:"scripts",label:"待审脚本",count:0,tone:"orange"},{key:"videos",label:"待审视频",count:0,tone:"orange"},{key:"unsynced",label:"WA 已提交、Tracker 未同步",count:0,tone:"red"},{key:"conflicts",label:"多来源版本冲突",count:0,tone:"red"},{key:"settlement",label:"待确认结算",count:0,tone:"blue"}], today:{confirmedCreators:0,confirmedVideos:0,confirmedAmount:0,publishedCreators:0,publishedVideos:0,publishedAmount:0}, syncSources:["内部 Tracker","对客日常表","月度结算表","复投达人表","Tripo KOL 中台"].map(name=>({name,status:"尚未连接",lastSync:null})) };
  const { data = demo, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], retry: false, queryFn: async () => { try { const r = await fetch(`${apiBase}/api/dashboard`); return r.ok ? await r.json() : demo; } catch { return demo; } } });
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

type Source = { key: string; name: string; url: string; status: string };
function SourcesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["sources"], queryFn: () => fetch(`${apiBase}/api/data-sources`).then(r => r.json()) });
  const [results, setResults] = React.useState<Record<string,string>>({});
  const test = async (key: string) => {
    setResults(v => ({...v,[key]:"正在读取…"}));
    try { const r = await fetch(`${apiBase}/api/data-sources/${key}/test`); const body = await r.json(); setResults(v => ({...v,[key]:body.ok ? `连接成功 · ${body.objectType}${body.title ? ` · ${body.title}` : ""}` : body.error})); }
    catch { setResults(v => ({...v,[key]:"连接失败，请稍后重试"})); }
  };
  return <><header><div><h1>数据源管理</h1><p>只有点击测试或读取时才访问飞书，不持续同步。</p></div></header>
    <div className="notice">当前为只读模式，不会修改飞书原表。</div>
    <section className="source-grid">{isLoading ? <p>正在加载数据源…</p> : data?.sources?.map((s: Source) => <article className="card source-card" key={s.key}><div><h2>{s.name}</h2><a href={s.url} target="_blank" rel="noreferrer">打开飞书原表</a></div><p>{results[s.key] ?? (s.key === "client-daily" && !data.userAuthorized ? "需要 Lia 完成一次用户只读授权" : s.status)}</p>{s.key === "client-daily" && !data.userAuthorized ? <a className="auth-button" href={`${apiBase}/api/auth/feishu/start`}>授权读取对客表</a> : <button onClick={()=>test(s.key)}>测试只读连接</button>}</article>)}</section>
  </>;
}

export function App() { return <div className="shell"><aside><div className="brand"><div>L</div><span>Lia Workcenter<small>工作中心</small></span></div><nav>{nav.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"}><Icon size={19}/>{label}</NavLink>)}</nav><footer><span className="online"></span>只读服务已连接</footer></aside><main><Routes><Route path="/" element={<Dashboard/>}/>{nav.slice(1,-1).map(([to,label]) => <Route key={to} path={to} element={<Placeholder title={label}/>}/>)}<Route path="/sources" element={<SourcesPage/>}/></Routes></main></div>; }
