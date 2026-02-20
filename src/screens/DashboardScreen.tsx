/**
 * Dashboard Screen — war room glanceable overview
 * Shows: team status, phase, cap, next event, inbox, key players, transactions, finances, upcoming game
 */

import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import {
  COLORS, FONT, fmtCurrency, moraleColor, tierColor,
} from "../ui/theme";
import {
  RatingBadge, Section, CapBar, PhaseTag, PosTag, MoraleMeter,
  DataRow, IconBtn, AlertDot,
} from "../ui/components";

export function DashboardScreen({ week, season, setScreen, setDetail }: {
  week: number; season: number; setScreen: (s: string) => void; setDetail: (d: any) => void;
}) {
  // Mock data — phase, events, team status, etc.
  const SEASON_PHASES = [
    { id: "offseason", label: "Offseason", weeks: [1,4], color: "#9990A0" },
    { id: "combine", label: "Scouting Combine", weeks: [5,7], color: "#811765" },
    { id: "freeAgency", label: "Free Agency", weeks: [8,11], color: "#D7F171" },
    { id: "draftPrep", label: "Draft Preparation", weeks: [12,20], color: "#9990A0" },
    { id: "draft", label: "NFL Draft", weeks: [21,21], color: "#F0EEF2" },
    { id: "postDraft", label: "Post-Draft / UDFA", weeks: [22,29], color: "#8D246E" },
    { id: "trainingCamp", label: "Training Camp", weeks: [30,30], color: "#811765" },
    { id: "preseason", label: "Preseason", weeks: [31,33], color: "#740056" },
    { id: "regularSeason", label: "Regular Season", weeks: [34,49], color: "#D7F171" },
    { id: "playoffs", label: "Playoffs", weeks: [50,51], color: "#8D246E" },
    { id: "superBowl", label: "Super Bowl", weeks: [52,52], color: "#F0EEF2" },
  ];

  const USER_TEAM = { city: "Kansas City", name: "Chiefs", abbr: "KC", conf: "AFC", div: "West", off: 93, def: 86, st: 82 };
  const phase = SEASON_PHASES.find(p => week >= p.weeks[0] && week <= p.weeks[1]) || SEASON_PHASES[0];
  const REAL_PLAYERS = [
    { name: "Patrick Mahomes", pos: "QB", ovr: 99, age: 29, sal: 45000000, jersey: 15, morale: 95 },
    { name: "Travis Kelce", pos: "TE", ovr: 95, age: 35, sal: 14300000, jersey: 87, morale: 92 },
    { name: "Chris Jones", pos: "DL", ovr: 96, age: 30, sal: 31750000, jersey: 95, morale: 88 },
  ];

  const totalCap = REAL_PLAYERS.reduce((s, p) => s + p.sal, 0);
  const SALARY_CAP = 255400000;

  const INBOX_ITEMS = [
    { id: 1, cat: "owner", sender: "Clark Hunt", title: "Season Expectations", time: "1h ago", read: false, priority: "urgent" },
    { id: 2, cat: "agent", sender: "Drew Rosenhaus", title: "Rashee Rice — Contract", time: "3h ago", read: false, priority: "high" },
  ];

  const unread = INBOX_ITEMS.filter(i => !i.read).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "fadeIn .4s" }}>
      {/* Hero */}
      <div style={{ gridColumn: "1/-1", background: `linear-gradient(135deg, ${COLORS.darkMagenta}, ${COLORS.bg})`, borderRadius: 12, padding: 22, border: `1px solid ${COLORS.magenta}`, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <PhaseTag phase={phase.label} color={phase.color} />
              <span style={{ fontSize: 10, color: COLORS.muted }}>Week {week} of 52 · {season} Season</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: COLORS.light, letterSpacing: -0.5 }}>
              {USER_TEAM.city} {USER_TEAM.name}
            </h1>
            <div style={{ color: COLORS.muted, marginTop: 4, fontSize: 12 }}>
              {USER_TEAM.conf} {USER_TEAM.div} · Off <span style={{ color: COLORS.lime, fontWeight: 700 }}>{USER_TEAM.off}</span> / Def <span style={{ color: COLORS.lime, fontWeight: 700 }}>{USER_TEAM.def}</span> / ST <span style={{ color: COLORS.lime, fontWeight: 700 }}>{USER_TEAM.st}</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 10, color: COLORS.muted }}>Cap: <span style={{ color: (totalCap / SALARY_CAP) * 100 > 95 ? COLORS.magenta : COLORS.lime, fontWeight: 700 }}>{((totalCap / SALARY_CAP) * 100).toFixed(1)}%</span></div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>Space: <span style={{ color: COLORS.lime, fontWeight: 700 }}>{fmtCurrency(SALARY_CAP - totalCap)}</span></div>
            </div>
          </div>
          <IconBtn icon={ArrowRight} label="Advance Week" variant="accent" onClick={() => {}} />
        </div>
        {/* Cap bar */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: 600 }}>SALARY CAP UTILIZATION</div>
          <CapBar used={totalCap} total={SALARY_CAP} />
        </div>
      </div>

      {/* Inbox preview */}
      <Section title="Inbox" right={unread > 0 ? <AlertDot priority="urgent" /> : undefined}>
        {INBOX_ITEMS.slice(0, 2).map(item => (
          <div key={item.id} onClick={() => setScreen("inbox")} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(116,0,86,0.4)", cursor: "pointer", opacity: item.read ? 0.6 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: item.read ? 400 : 700, color: COLORS.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ fontSize: 9, color: COLORS.muted }}>{item.sender} · {item.time}</div>
            </div>
          </div>
        ))}
      </Section>

      {/* Key players */}
      <Section title="Key Players">
        {REAL_PLAYERS.slice(0, 3).map(p => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(116,0,86,0.4)", cursor: "pointer" }} onClick={() => { setDetail(p); setScreen("playerProfile"); }}>
            <RatingBadge value={p.ovr} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name} <span style={{ fontSize: 9, color: COLORS.muted }}>#{p.jersey}</span></div>
              <div style={{ fontSize: 9, color: COLORS.muted }}>Age {p.age} · {fmtCurrency(p.sal)}/yr</div>
            </div>
            <PosTag pos={p.pos} />
            <MoraleMeter value={p.morale} />
          </div>
        ))}
      </Section>

      {/* Financial snapshot */}
      <Section title="Financial Health">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "Cap Used", v: fmtCurrency(totalCap), c: COLORS.light },
            { l: "Cap Space", v: fmtCurrency(SALARY_CAP - totalCap), c: COLORS.lime },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(116,0,86,0.2)", borderRadius: 6, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: FONT.mono }}>{s.v}</div>
              <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
