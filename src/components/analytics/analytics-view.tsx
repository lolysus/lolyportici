"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RestaurantLocation } from "@/config/brand";

const sources = [
  { name: "Web", value: 56, fill: "var(--chart-1)" }, { name: "AI vocale", value: 24, fill: "var(--chart-2)" },
  { name: "Staff", value: 13, fill: "var(--chart-3)" }, { name: "Walk-in", value: 7, fill: "var(--chart-4)" },
];

export function AnalyticsView({ location }: { location: RestaurantLocation }) {
  const factor = location.slug === "kousushi" ? 0.76 : 1;
  const bookings = [
    { day: "Lun", web: 18, phone: 7 }, { day: "Mar", web: 22, phone: 8 }, { day: "Mer", web: 24, phone: 12 },
    { day: "Gio", web: 27, phone: 11 }, { day: "Ven", web: 34, phone: 16 }, { day: "Sab", web: 42, phone: 21 }, { day: "Dom", web: 31, phone: 14 },
  ].map((item) => ({ ...item, web: Math.round(item.web * factor), phone: Math.round(item.phone * factor) }));
  const monthlyCovers = Math.round(1284 * factor).toLocaleString("it-IT");
  return <>
    <div className="mb-6 flex justify-end"><Button asChild variant="outline"><Link href="/api/admin/v1/analytics/export"><Download />Esporta CSV</Link></Button></div>
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4"><Metric label="Coperti" value={monthlyCovers} change="+12,4%" positive /><Metric label="Occupazione" value={location.slug === "kousushi" ? "72%" : "78%"} change="+4,1%" positive /><Metric label="No-show" value="2,8%" change="−0,6%" positive /><Metric label="Conversione AI" value="64%" change="−2,1%" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <Card><CardHeader><CardTitle className="font-heading text-xl">Prenotazioni per canale</CardTitle></CardHeader><CardContent><div role="img" aria-label="Prenotazioni della settimana divise tra web e telefono" className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={bookings}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10 }} /><Bar dataKey="web" stackId="a" fill="var(--chart-1)" /><Bar dataKey="phone" stackId="a" fill="var(--chart-2)" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="font-heading text-xl">Mix acquisizione</CardTitle></CardHeader><CardContent><div role="img" aria-label="56% web, 24% AI vocale, 13% staff, 7% walk-in" className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sources} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} strokeWidth={0}>{sources.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10 }} /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-3">{sources.map((source) => <div key={source.name} className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{ background: source.fill }} />{source.name}<span className="ml-auto font-mono">{source.value}%</span></div>)}</div></CardContent></Card>
    </div>
  </>;
}

function Metric({ label, value, change, positive }: { label: string; value: string; change: string; positive?: boolean }) {
  return <div className="bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className={positive ? "mt-2 flex items-center gap-1 text-xs text-emerald-300" : "mt-2 flex items-center gap-1 text-xs text-amber-300"}>{positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{change} vs periodo precedente</p></div>;
}
