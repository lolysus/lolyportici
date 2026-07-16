"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CoversChart({ data }: { data: Array<{ time: string; covers: number; capacity: number }> }) {
  return <div role="img" aria-label={`Andamento coperti: massimo ${Math.max(...data.map((item) => item.covers))} coperti`} className="h-56 w-full">
    <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -24 }}><defs><linearGradient id="coversFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--popover-foreground)" }} /><Area type="monotone" dataKey="capacity" stroke="var(--muted-foreground)" strokeDasharray="4 4" fill="transparent" /><Area type="monotone" dataKey="covers" stroke="var(--chart-2)" strokeWidth={2} fill="url(#coversFill)" /></AreaChart></ResponsiveContainer>
  </div>;
}

