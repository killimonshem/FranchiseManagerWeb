/**
 * Roster Screen — active roster & practice squad tables
 * Shows: player OVR as descriptor, morale as bar, injury/contract alerts
 * Progressive disclosure: click row → full profile
 */

import { useState } from "react";
import { COLORS } from "../ui/theme";
import {
  RatingBadge, PosTag, Section, DataRow, Pill, TabBtn, MoraleMeter,
  ShieldAlert, Lock, AlertTriangle, Clock,
} from "../ui/components";

export function RosterScreen({ setScreen, setDetail }: { setScreen: (s: string) => void; setDetail: (d: any) => void }) {
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("ovr");
  const [tab, setTab] = useState("active");

  const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];
  const REAL_PLAYERS = [
    { name: "Patrick Mahomes", pos: "QB", ovr: 99, pot: 99, age: 29, sal: 45000000, yrs: 8, depth: 1, morale: 95, jersey: 15, status: "Active", hasNTC: false, isTradeRequest: false, expiring: false },
    { name: "Travis Kelce", pos: "TE", ovr: 95, pot: 95, age: 35, sal: 14300000, yrs: 2, depth: 1, morale: 92, jersey: 87, status: "Active", hasNTC: false, isTradeRequest: false, expiring: true },
    { name: "Chris Jones", pos: "DL", ovr: 96, pot: 96, age: 30, sal: 31750000, yrs: 4, depth: 1, morale: 88, jersey: 95, status: "Active", hasNTC: false, isTradeRequest: false, expiring: false },
    { name: "Rashee Rice", pos: "WR", ovr: 83, pot: 91, age: 24, sal: 1800000, yrs: 3, depth: 1, morale: 70, jersey: 4, status: "Active", hasNTC: false, isTradeRequest: true, expiring: false, injury: "Questionable" },
    { name: "Blaine Gabbert", pos: "QB", ovr: 68, pot: 68, age: 34, sal: 2000000, yrs: 1, depth: 2, morale: 72, jersey: 11, status: "Active", hasNTC: false, isTradeRequest: false, expiring: false },
    { name: "Kadarius Toney", pos: "WR", ovr: 72, pot: 82, age: 25, sal: 1200000, yrs: 1, depth: 3, morale: 55, jersey: 19, status: "Practice", hasNTC: false, isTradeRequest: false, expiring: false },
  ];

  const list = tab === "practice" ? REAL_PLAYERS.filter(p => p.status === "Practice") : REAL_PLAYERS.filter(p => p.status !== "Practice");
  const filtered = filter === "ALL" ? list : list.filter(p => p.pos === filter);
  const sorted = [...filtered].sort((a, b) =>
    sort === "ovr" ? b.ovr - a.ovr :
    sort === "sal" ? b.sal - a.sal :
    sort === "age" ? a.age - b.age :
    a.name.localeCompare(b.name)
  );

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Roster Management</h2>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
            {REAL_PLAYERS.filter(p => p.status !== "Practice").length}/53 Active · {REAL_PLAYERS.filter(p => p.status === "Practice").length}/16 Practice Squad
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill active={tab === "active"} onClick={() => setTab("active")}>Active Roster</Pill>
          <Pill active={tab === "practice"} onClick={() => setTab("practice")}>Practice Squad</Pill>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {["ALL", ...POSITIONS].map(p => <Pill key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Pill>)}
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
        {[{ k: "ovr", l: "Rating" }, { k: "sal", l: "Salary" }, { k: "age", l: "Age" }, { k: "name", l: "Name" }].map(s =>
          <TabBtn key={s.k} active={sort === s.k} onClick={() => setSort(s.k)}>{s.l}</TabBtn>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <Section pad={false}>
          <DataRow header>
            {["Player", "Pos", "Age", "Rating", "Pot", "Salary", "Yrs", "Morale", "Alerts"].map(h =>
              <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, flex: h === "Player" ? 2 : 1 }}>
                {h}
              </span>
            )}
          </DataRow>

          {sorted.map((p, i) => (
            <DataRow key={p.name} even={i % 2 === 0} hover onClick={() => { setDetail(p); setScreen("playerProfile"); }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.light }}>{p.name}</div>
                <div style={{ fontSize: 9, color: COLORS.muted }}>#{p.jersey}</div>
              </div>
              <span style={{ flex: 1 }}><PosTag pos={p.pos} /></span>
              <span style={{ flex: 1, fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>{p.age}</span>
              <span style={{ flex: 1 }}><RatingBadge value={p.ovr} size="sm" /></span>
              <span style={{ flex: 1 }}><RatingBadge value={p.pot} size="sm" /></span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.lime, fontFamily: "monospace", fontWeight: 600 }}>{(p.sal / 1e6).toFixed(1)}M</span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{p.yrs}yr</span>
              <span style={{ flex: 1 }}><MoraleMeter value={p.morale} /></span>
              <span style={{ flex: 1, display: "flex", gap: 4, alignItems: "center" }}>
                {p.injury && <ShieldAlert size={14} color={COLORS.magenta} title={p.injury} />}
                {p.hasNTC && <Lock size={12} color={COLORS.midMagenta} title="NTC" />}
                {p.isTradeRequest && <AlertTriangle size={13} color={COLORS.magenta} title="Trade Request" />}
                {p.expiring && <Clock size={13} color={COLORS.muted} title="Expiring" />}
              </span>
            </DataRow>
          ))}
        </Section>
      </div>
    </div>
  );
}
