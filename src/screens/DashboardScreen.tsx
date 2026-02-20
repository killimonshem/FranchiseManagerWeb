/**
 * Dashboard Screen — war room glanceable overview
 * Shows: team status, phase, cap, key players, finances
 * Data comes from real CSV-parsed players — no mock data.
 */

import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import {
  RatingBadge, Section, CapBar, PhaseTag, PosTag, MoraleMeter,
  AlertDot,
} from "../ui/components";
import { Player } from "../types/player";
import { TeamMeta, GMProfile } from "./TeamSelectScreen";

// ─── Season phase table ───────────────────────────────────────────────────────

const SEASON_PHASES = [
  { id: "offseason",     label: "Offseason",           weeks: [1,  4],  color: "#9990A0" },
  { id: "combine",       label: "Scouting Combine",    weeks: [5,  7],  color: "#811765" },
  { id: "freeAgency",    label: "Free Agency",         weeks: [8,  11], color: "#D7F171" },
  { id: "draftPrep",     label: "Draft Preparation",   weeks: [12, 20], color: "#9990A0" },
  { id: "draft",         label: "NFL Draft",           weeks: [21, 21], color: "#F0EEF2" },
  { id: "postDraft",     label: "Post-Draft / UDFA",   weeks: [22, 29], color: "#8D246E" },
  { id: "trainingCamp",  label: "Training Camp",       weeks: [30, 30], color: "#811765" },
  { id: "preseason",     label: "Preseason",           weeks: [31, 33], color: "#740056" },
  { id: "regularSeason", label: "Regular Season",      weeks: [34, 49], color: "#D7F171" },
  { id: "playoffs",      label: "Playoffs",            weeks: [50, 51], color: "#8D246E" },
  { id: "superBowl",     label: "Super Bowl",          weeks: [52, 52], color: "#F0EEF2" },
];

const SALARY_CAP = 255_400_000;

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardScreen({
  week, season, setScreen, setDetail, players, userTeam, gm,
}: {
  week: number;
  season: number;
  setScreen: (s: string) => void;
  setDetail: (d: any) => void;
  players: Player[];
  userTeam: TeamMeta;
  gm: GMProfile;
}) {
  const phase = SEASON_PHASES.find(p => week >= p.weeks[0] && week <= p.weeks[1]) ?? SEASON_PHASES[0];

  // Cap from real contracts
  const totalCap = players.reduce((sum, p) => sum + (p.contract?.currentYearCap ?? 0), 0);
  const capPct   = SALARY_CAP > 0 ? (totalCap / SALARY_CAP) * 100 : 0;

  // Top 3 players by overall for the "key players" widget
  const keyPlayers = [...players]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "fadeIn .4s" }}>

      {/* Hero */}
      <div style={{
        gridColumn: "1/-1",
        background: `linear-gradient(135deg, ${COLORS.darkMagenta}, ${COLORS.bg})`,
        borderRadius: 12, padding: 22, border: `1px solid ${COLORS.magenta}`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <PhaseTag phase={phase.label} color={phase.color} />
              <span style={{ fontSize: 10, color: COLORS.muted }}>Week {week} of 52 · {season} Season</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: COLORS.light, letterSpacing: -0.5 }}>
              {userTeam.city} {userTeam.name}
            </h1>
            <div style={{ color: COLORS.muted, marginTop: 4, fontSize: 12 }}>
              {userTeam.conf} {userTeam.div} · GM{" "}
              <span style={{ color: COLORS.lime, fontWeight: 700 }}>{gm.firstName} {gm.lastName}</span>
              <span style={{ color: COLORS.muted }}> · {gm.style}</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Cap used:{" "}
                <span style={{ color: capPct > 95 ? COLORS.magenta : COLORS.lime, fontWeight: 700 }}>
                  {capPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Space:{" "}
                <span style={{ color: COLORS.lime, fontWeight: 700 }}>{fmtCurrency(SALARY_CAP - totalCap)}</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Roster:{" "}
                <span style={{ color: COLORS.lime, fontWeight: 700 }}>{players.length}</span> players
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: 600 }}>SALARY CAP UTILIZATION</div>
          <CapBar used={totalCap} total={SALARY_CAP} />
        </div>
      </div>

      {/* Key Players */}
      <Section title="Key Players">
        {keyPlayers.length === 0 ? (
          <div style={{ fontSize: 12, color: COLORS.muted, padding: "12px 0" }}>No players on roster</div>
        ) : keyPlayers.map(p => (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 0", borderBottom: `1px solid rgba(116,0,86,0.4)`, cursor: "pointer",
            }}
            onClick={() => { setDetail(p); setScreen("playerProfile"); }}
          >
            <RatingBadge value={p.overall} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.light }}>
                {p.firstName} {p.lastName}{" "}
                <span style={{ fontSize: 9, color: COLORS.muted }}>#{p.jerseyNumber}</span>
              </div>
              <div style={{ fontSize: 9, color: COLORS.muted }}>
                Age {p.age} · {fmtCurrency(p.contract?.currentYearCap ?? 0)}/yr
              </div>
            </div>
            <PosTag pos={p.position} />
            <MoraleMeter value={p.morale} />
          </div>
        ))}
      </Section>

      {/* Financial Snapshot */}
      <Section title="Financial Health">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "Cap Used",  v: fmtCurrency(totalCap),             c: COLORS.light },
            { l: "Cap Space", v: fmtCurrency(SALARY_CAP - totalCap), c: COLORS.lime  },
          ].map((s, i) => (
            <div key={i} style={{
              background: "rgba(116,0,86,0.2)", borderRadius: 6, padding: 10, textAlign: "center",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: FONT.mono }}>{s.v}</div>
              <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
