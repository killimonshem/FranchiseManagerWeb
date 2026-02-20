/**
 * Roster Screen — active roster & practice squad tables
 * Data comes from real CSV-parsed players — no mock data.
 * Progressive disclosure: click row → full profile
 *
 * Responsive: Pot and Morale columns hidden below 640 px.
 */

import { useState } from "react";
import { COLORS } from "../ui/theme";
import {
  RatingBadge, PosTag, Section, DataRow, Pill, TabBtn, MoraleMeter,
  ShieldAlert, Lock, AlertTriangle, Clock,
} from "../ui/components";
import { Player, PlayerStatus } from "../types/player";
import { InjuryStatus } from "../types/nfl-types";

const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

const RESPONSIVE_CSS = `
  @media (max-width: 640px) {
    .roster-pot   { display: none !important; }
    .roster-morale { display: none !important; }
  }
`;

export function RosterScreen({
  setScreen, setDetail, players,
}: {
  setScreen: (s: string) => void;
  setDetail: (d: any) => void;
  players: Player[];
}) {
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort]     = useState("ovr");
  const [tab, setTab]       = useState("active");

  const active   = players.filter(p => p.status !== PlayerStatus.PRACTICE_SQUAD);
  const practice = players.filter(p => p.status === PlayerStatus.PRACTICE_SQUAD);
  const list     = tab === "practice" ? practice : active;

  const filtered = filter === "ALL" ? list : list.filter(p => p.position === filter);
  const sorted   = [...filtered].sort((a, b) =>
    sort === "ovr"  ? b.overall - a.overall :
    sort === "sal"  ? (b.contract?.currentYearCap ?? 0) - (a.contract?.currentYearCap ?? 0) :
    sort === "age"  ? a.age - b.age :
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <style>{RESPONSIVE_CSS}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Roster Management</h2>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
            {active.length}/53 Active · {practice.length}/16 Practice Squad
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill active={tab === "active"}   onClick={() => setTab("active")}>Active Roster</Pill>
          <Pill active={tab === "practice"} onClick={() => setTab("practice")}>Practice Squad</Pill>
        </div>
      </div>

      {/* Position filter */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {["ALL", ...POSITIONS].map(p => (
          <Pill key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Pill>
        ))}
      </div>

      {/* Sort */}
      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
        {[{ k: "ovr", l: "Rating" }, { k: "sal", l: "Salary" }, { k: "age", l: "Age" }, { k: "name", l: "Name" }].map(s => (
          <TabBtn key={s.k} active={sort === s.k} onClick={() => setSort(s.k)}>{s.l}</TabBtn>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: COLORS.muted, fontSize: 13, padding: "32px 0", textAlign: "center" }}>
          No players on this roster yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <Section pad={false}>
            {/* Header row */}
            <DataRow header>
              <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Player</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Pos</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Age</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Rating</span>
              <span className="roster-pot"    style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Pot</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Salary</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Yrs</span>
              <span className="roster-morale" style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Morale</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Alerts</span>
            </DataRow>

            {sorted.map((p, i) => {
              const salary   = p.contract?.currentYearCap ?? 0;
              const years    = p.contract?.yearsRemaining ?? 0;
              const hasNTC   = p.contract?.hasNoTradeClause ?? false;
              const expiring = years === 1;
              const injured  = p.injuryStatus !== InjuryStatus.HEALTHY;
              const tradeReq = p.tradeRequestState === "Requested";

              return (
                <DataRow key={p.id} even={i % 2 === 0} hover onClick={() => { setDetail(p); setScreen("playerProfile"); }}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.light }}>
                      {p.firstName} {p.lastName}
                    </div>
                    <div style={{ fontSize: 9, color: COLORS.muted }}>#{p.jerseyNumber}</div>
                  </div>
                  <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                  <span style={{ flex: 1, fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>{p.age}</span>
                  <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
                  <span className="roster-pot"    style={{ flex: 1 }}><RatingBadge value={p.potential} size="sm" /></span>
                  <span style={{ flex: 1, fontSize: 10, color: COLORS.lime, fontFamily: "monospace", fontWeight: 600 }}>
                    {salary > 0 ? `${(salary / 1e6).toFixed(1)}M` : "—"}
                  </span>
                  <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>
                    {years > 0 ? `${years}yr` : "FA"}
                  </span>
                  <span className="roster-morale" style={{ flex: 1 }}><MoraleMeter value={p.morale} /></span>
                  <span style={{ flex: 1, display: "flex", gap: 4, alignItems: "center" }}>
                    {injured  && <span title={p.injuryStatus}><ShieldAlert   size={14} color={COLORS.magenta} /></span>}
                    {hasNTC   && <span title="NTC"><Lock          size={12} color={COLORS.midMagenta} /></span>}
                    {tradeReq && <span title="Trade Request"><AlertTriangle size={13} color={COLORS.magenta} /></span>}
                    {expiring && <span title="Expiring"><Clock         size={13} color={COLORS.muted} /></span>}
                  </span>
                </DataRow>
              );
            })}
          </Section>
        </div>
      )}
    </div>
  );
}
