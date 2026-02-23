/**
 * Dashboard Screen — war room glanceable overview
 * Shows: team status, phase, cap, key players, finances
 * Data comes from real CSV-parsed players — no mock data.
 */

import { COLORS, FONT, fmtCurrency } from "../ui/theme";
import {
  RatingBadge, Section, CapBar, PhaseTag, PosTag, MoraleMeter,
  AlertDot, FinancialHealthBadge,
} from "../ui/components";
import { AlertTriangle } from "lucide-react";
import { Player } from "../types/player";
import { TeamMeta, GMProfile } from "./TeamSelectScreen";
import type { GameStateManager, ActionItem } from "../types/GameStateManager";
import { gameStore } from "../stores/GameStore";

// ─── Season phase table ───────────────────────────────────────────────────────

const SEASON_PHASES = [
  { id: "offseason",     label: "Offseason",           weeks: [1,  4],  color: "#9990A0" },
  { id: "freeAgency",    label: "Free Agency",         weeks: [5,  10], color: "#D7F171" },
  { id: "postFreeAgency",label: "Post-Free Agency",    weeks: [11, 14], color: "#811765" },
  { id: "draft",         label: "NFL Draft",           weeks: [15, 15], color: "#F0EEF2" },
  { id: "postDraft",     label: "Post-Draft / UDFA",   weeks: [16, 20], color: "#8D246E" },
  { id: "trainingCamp",  label: "Training Camp",       weeks: [21, 24], color: "#811765" },
  { id: "preseason",     label: "Preseason",           weeks: [25, 28], color: "#740056" },
  { id: "regularSeason", label: "Regular Season",      weeks: [29, 46], color: "#D7F171" },
  { id: "playoffs",      label: "Playoffs",            weeks: [47, 51], color: "#8D246E" },
  { id: "superBowl",     label: "Super Bowl",          weeks: [52, 52], color: "#F0EEF2" },
];

const SALARY_CAP = 255_400_000;

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardScreen({
  week, season, setScreen, setDetail, players, userTeam, gm, gsm,
}: {
  week: number;
  season: number;
  setScreen: (s: string) => void;
  setDetail: (d: any) => void;
  players: Player[];
  userTeam: TeamMeta;
  gm: GMProfile;
  gsm?: GameStateManager;
}) {
  const phase = SEASON_PHASES.find(p => week >= p.weeks[0] && week <= p.weeks[1]) ?? SEASON_PHASES[0];

  // Cap from real contracts
  const totalCap = players.reduce((sum, p) => sum + (p.contract?.currentYearCap ?? 0), 0);
  const capPct   = SALARY_CAP > 0 ? (totalCap / SALARY_CAP) * 100 : 0;
  
  // Owner & Fanbase (from backend)
  const fullUserTeam = gsm?.userTeam;
  const cashReserves = fullUserTeam?.cashReserves ?? 0;

  // Smart "Key Players" logic: Attention needed > Stars
  // Priority: Injured > Expiring (High OVR) > Low Morale > Top OVR
  const attentionPlayers = players.filter(p =>
    p.injuryStatus !== 'Healthy' ||
    (p.contract && p.contract.yearsRemaining <= 1 && p.overall > 75) ||
    p.morale < 45
  ).sort((a, b) => {
    const getScore = (p: Player) => {
      let score = 0;
      if (p.injuryStatus !== 'Healthy') score += 100;
      if (p.contract?.yearsRemaining === 1) score += 50 + (p.overall / 2);
      if (p.morale < 45) score += 20 + (100 - p.morale);
      return score;
    };
    return getScore(b) - getScore(a);
  });

  const topStars = [...players].sort((a, b) => b.overall - a.overall);
  // Merge: Take up to 3 attention players, fill rest with stars (deduplicated)
  const keyPlayers = Array.from(new Set([...attentionPlayers, ...topStars])).slice(0, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "fadeIn .4s" }}>
      <style>{`@media (max-width: 640px) { .dash-morale { display: none !important; } }`}</style>

      {/* Hero */}
      <div style={{
        gridColumn: "1/-1",
        background: `linear-gradient(135deg, ${COLORS.darkMagenta}, ${COLORS.bg})`,
        borderRadius: 12, padding: 22, border: `1px solid ${COLORS.magenta}`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: 1 }}>
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
                <div style={{ fontSize: 10, color: COLORS.muted }}>Cap used</div>
                <div style={{ fontSize: 18, color: capPct > 95 ? COLORS.magenta : COLORS.lime, fontWeight: 900 }}>
                  {capPct.toFixed(1)}% used
                </div>
              </div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Space
                <div style={{ fontSize: 18, color: COLORS.lime, fontWeight: 900 }}>{fmtCurrency(SALARY_CAP - totalCap)}</div>
              </div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Cash
                <div style={{ fontSize: 14, color: COLORS.light, fontWeight: 700 }}>{fmtCurrency(cashReserves)}</div>
              </div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Roster:{" "}
                <span style={{ color: COLORS.lime, fontWeight: 700 }}>{players.length}</span> players
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-start", gap: 4 }}>
            <div style={{ fontSize: 9, color: COLORS.muted }}>Auto-Saved</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.light }}>{gameStore.saveTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: 600 }}>SALARY CAP UTILIZATION</div>
          <CapBar used={totalCap} total={SALARY_CAP} />
        </div>
      </div>

      {/* Owner & Fanbase Pulse */}
      {fullUserTeam && fullUserTeam.owner && fullUserTeam.fanBase && (
        <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Section title="Owner Sentiment">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: COLORS.muted }}>Patience</span>
                <span style={{ color: (fullUserTeam.owner?.patience ?? 50) < 30 ? COLORS.coral : COLORS.lime, fontWeight: 700 }}>{fullUserTeam.owner?.patience ?? 50}/100</span>
              </div>
              <CapBar used={fullUserTeam.owner?.patience ?? 50} total={100} />
              <div style={{ fontSize: 10, color: COLORS.muted }}>
                Status: {(fullUserTeam.owner?.patience ?? 50) > 70 ? "Satisfied" : (fullUserTeam.owner?.patience ?? 50) > 45 ? "Neutral" : (fullUserTeam.owner?.patience ?? 50) > 30 ? "On The Edge" : "Nervous"}
              </div>
            </div>
          </Section>
          <Section title="Fanbase Pulse">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
              <span style={{ color: COLORS.muted }}>Loyalty</span>
              <span style={{ color: COLORS.light, fontWeight: 700 }}>{fullUserTeam.fanBase?.loyalty ?? 50}/100</span>
            </div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>Mood: {(fullUserTeam.fanBase?.mood ?? 50) > 60 ? "Optimistic" : "Restless"}</div>
          </Section>
        </div>
      )}

      {/* Action Items Alert */}
      {gsm && gsm.actionItemQueue.length > 0 && (
        <div style={{
          gridColumn: "1/-1",
          background: "rgba(255, 100, 100, 0.1)",
          border: "1px solid rgba(255, 100, 100, 0.3)",
          borderRadius: 8,
          padding: 14,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={18} color="#ff6464" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.light, marginBottom: 8 }}>
                {gsm.actionItemQueue.length === 1 ? "Action Required" : "Multiple Issues"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {gsm.actionItemQueue.map((item: ActionItem) => (
                  <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: COLORS.light }}>{item.description}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => setScreen(item.resolution.route.replace("/", ""))}
                        style={{
                          fontSize: 10, padding: "4px 8px", borderRadius: 4,
                          border: `1px solid ${COLORS.magenta}`, background: "transparent",
                          color: COLORS.magenta, cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => gsm?.deferActionItem(item.id)}
                        style={{
                          fontSize: 10, padding: "4px 8px", borderRadius: 4,
                          border: `1px solid ${COLORS.muted}`, background: "transparent",
                          color: COLORS.muted, cursor: "pointer",
                        }}
                      >
                        Defer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Players */}
      <Section
        title="Key Players"
        right={attentionPlayers.length > 3 && (
          <button
            onClick={() => setScreen("roster")}
            style={{
              fontSize: 9, color: COLORS.lime, background: "none", border: "none",
              cursor: "pointer", textDecoration: "underline", padding: 0, fontWeight: 600,
            }}
          >
            See all {attentionPlayers.length} at-risk
          </button>
        )}
      >
        {keyPlayers.length === 0 ? (
          <div style={{ fontSize: 12, color: COLORS.muted, padding: "12px 0" }}>No players on roster</div>
        ) : keyPlayers.map(p => {
          let statusText = `Age ${p.age} · ${fmtCurrency(p.contract?.currentYearCap ?? 0)}/yr`;
          let statusColor: string = COLORS.muted;

          if (p.injuryStatus !== 'Healthy') {
            statusText = `${p.injuryStatus} Injury`;
            statusColor = COLORS.coral;
          } else if (p.contract?.yearsRemaining === 1) {
            statusText = "Contract Expiring";
            statusColor = COLORS.gold;
          } else if (p.morale < 45) {
            statusText = "Low Morale";
            statusColor = COLORS.coral;
          } else {
            statusColor = COLORS.lavender;
          }

          return (
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
                <div style={{ fontSize: 9, color: statusColor, fontWeight: statusColor !== COLORS.muted ? 600 : 400 }}>
                  {statusText}
                </div>
              </div>
              <PosTag pos={p.position} />
              <span className="dash-morale"><MoraleMeter value={p.morale} /></span>
            </div>
          );
        })}
      </Section>

      {/* Expiring Contracts Widget */}
      {(() => {
        const expiringContracts = players.filter(p => p.contract && p.contract.yearsRemaining <= 1).sort((a, b) => b.overall - a.overall);
        return expiringContracts.length > 0 ? (
          <Section
            title="Expiring Contracts"
            right={
              <button
                onClick={() => setScreen("roster")}
                style={{
                  fontSize: 9, color: COLORS.gold, background: "none", border: "none",
                  cursor: "pointer", textDecoration: "underline", padding: 0, fontWeight: 600,
                }}
              >
                Manage
              </button>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {expiringContracts.slice(0, 3).map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px",
                    background: "rgba(215, 241, 113, 0.05)",
                    borderRadius: 4,
                    border: `1px solid ${COLORS.gold}20`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.light }}>
                      {p.firstName} {p.lastName}
                    </div>
                    <div style={{ fontSize: 9, color: COLORS.gold }}>
                      Expires: {new Date().getFullYear() + (p.contract?.yearsRemaining || 0)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <RatingBadge value={p.overall} size="sm" />
                    <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
                      {fmtCurrency(p.contract?.currentYearCap || 0)}/yr
                    </div>
                  </div>
                </div>
              ))}
              {expiringContracts.length > 3 && (
                <div style={{ fontSize: 10, color: COLORS.muted, textAlign: "center", marginTop: 4 }}>
                  +{expiringContracts.length - 3} more expiring
                </div>
              )}
            </div>
          </Section>
        ) : null;
      })()}

      {/* Financial Snapshot */}
      <Section title="Financial Health">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "Cap Used",  v: fmtCurrency(totalCap),             c: COLORS.light },
            { l: "Cap Space", v: fmtCurrency(SALARY_CAP - totalCap), c: COLORS.lime  },
            { l: "Cash Reserves", v: fmtCurrency(cashReserves), c: cashReserves < 10000000 ? COLORS.coral : COLORS.lime },
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
