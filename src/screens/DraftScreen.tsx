import { COLORS } from "../ui/theme";
import { Section, RatingBadge, DataRow, PosTag, Pill } from "../ui/components";
import { useState } from "react";
import type { GameStateManager, DraftProspect } from "../types/GameStateManager";

// ─── Draft pick computation from ledger ──────────────────────────────────────

interface DraftPick {
  year: number;
  round: number;
  originalTeam: string;
  isOwn: boolean;
  notes?: string;
}

const DRAFT_YEARS = [2026, 2027, 2028];
const TOTAL_ROUNDS = 7;
const ROUND_LABEL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

/** Compute which picks a given team currently owns after applying all trades. */
function computeTeamPicks(teamAbbr: string, gsm: GameStateManager): DraftPick[] {
  if (!teamAbbr) return [];

  return gsm.draftPicks.filter(p => p.currentTeamId === teamAbbr).map(p => ({
    year: p.year,
    round: p.round,
    originalTeam: p.originalTeamId,
    isOwn: p.originalTeamId === teamAbbr,
    notes: p.notes
  })).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.round - b.round
  );
}

// ─── Fog-of-war OVR renderer (three tiers) ───────────────────────────────────

function renderOvr(p: DraftProspect): JSX.Element {
  if (p.scoutingPointsSpent >= 2) {
    // Fully revealed
    return <RatingBadge value={p.overall} size="sm" />;
  }
  if (p.scoutingPointsSpent === 1) {
    // Narrowed — tighter range in accent color
    return (
      <span style={{ fontSize: 10, color: COLORS.lime, fontWeight: 600 }}>
        {p.scoutingRange.min}–{p.scoutingRange.max}
      </span>
    );
  }
  // Full fog — wide range, muted italic
  return (
    <span style={{ fontSize: 9, color: COLORS.muted, fontStyle: "italic" }}>
      {p.scoutingRange.min}–{p.scoutingRange.max}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftScreen({
  userTeamAbbr,
  gsm,
  refresh,
}: {
  userTeamAbbr: string;
  gsm: GameStateManager;
  refresh: () => void;
}) {
  const [tab, setTab] = useState("board");

  const myPicks = computeTeamPicks(userTeamAbbr, gsm);
  const byYear  = DRAFT_YEARS.map(yr => ({
    year: yr,
    picks: myPicks.filter(p => p.year === yr),
  }));

  const prospects = gsm.draftProspects;
  const scoutPtsLeft = gsm.scoutingPointsAvailable;

  function handleScout(prospectId: string) {
    gsm.spendScoutingPoints(prospectId, 1);
    refresh();
  }

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 8 }}>
        {gsm.currentGameDate.season} NFL Draft
      </h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Pill active={tab === "board"}  onClick={() => setTab("board")}>Big Board</Pill>
        <Pill active={tab === "picks"}  onClick={() => setTab("picks")}>My Picks</Pill>
        <Pill active={tab === "needs"}  onClick={() => setTab("needs")}>Team Needs</Pill>
      </div>

      {tab === "board" && (
        <Section title={`Prospect Board — Scout Pts: ${scoutPtsLeft}`} pad={false}>
          {prospects.length === 0 ? (
            <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>
              Draft class generates when you enter Draft Prep phase.
            </div>
          ) : (
            <>
              <DataRow header>
                {["#", "Name", "Pos", "College", "OVR", "Proj", "Scout"].map(h =>
                  <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, flex: h === "Name" ? 2 : 1 }}>
                    {h}
                  </span>
                )}
              </DataRow>
              {prospects.map((p, i) => {
                const canScout = scoutPtsLeft >= 1 && p.scoutingPointsSpent < 2;
                return (
                  <DataRow key={p.id} even={i % 2 === 0} hover>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{i + 1}</span>
                    <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
                    <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                    <span style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
                    <span style={{ flex: 1 }}>{renderOvr(p)}</span>
                    <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projectedRound === 8 ? "UDFA" : p.projectedRound}</span>
                    <span style={{ flex: 1 }}>
                      <button
                        onClick={() => canScout && handleScout(p.id)}
                        disabled={!canScout}
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 3,
                          border: "none",
                          cursor: canScout ? "pointer" : "default",
                          background: canScout ? "rgba(215,241,113,0.15)" : "transparent",
                          color: canScout ? COLORS.lime : COLORS.muted,
                          fontWeight: 600,
                        }}
                      >
                        {p.scoutingPointsSpent >= 2 ? "Done" : "Scout"}
                      </button>
                    </span>
                  </DataRow>
                );
              })}
            </>
          )}
        </Section>
      )}

      {tab === "picks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {byYear.map(({ year, picks }) => (
            <Section key={year} title={`${year} Draft Picks (${picks.length})`} pad={false}>
              {picks.length === 0 ? (
                <div style={{ padding: "14px", fontSize: 11, color: COLORS.muted }}>No picks in {year}.</div>
              ) : (
                <>
                  <DataRow header>
                    {["Round", "From", "Via Trade", "Notes"].map(h =>
                      <span key={h} style={{ flex: h === "Notes" ? 3 : 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8 }}>{h}</span>
                    )}
                  </DataRow>
                  {picks.map((pick, i) => (
                    <DataRow key={`${pick.year}-${pick.round}-${pick.originalTeam}`} even={i % 2 === 0}>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: pick.round === 1 ? COLORS.lime : COLORS.light }}>
                        {ROUND_LABEL[pick.round]}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
                        {pick.originalTeam}
                      </span>
                      <span style={{ flex: 1 }}>
                        {!pick.isOwn ? (
                          <span style={{ fontSize: 9, color: COLORS.lime, background: "rgba(215,241,113,0.1)", padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>
                            Acquired
                          </span>
                        ) : (
                          <span style={{ fontSize: 9, color: COLORS.muted }}>Own</span>
                        )}
                      </span>
                      <span style={{ flex: 3, fontSize: 9, color: COLORS.muted, lineHeight: 1.3 }}>
                        {pick.notes || "—"}
                      </span>
                    </DataRow>
                  ))}
                </>
              )}
            </Section>
          ))}

          {myPicks.length === 0 && (
            <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
              {userTeamAbbr ? `No pick data found for ${userTeamAbbr}.` : "No team selected."}
            </div>
          )}
        </div>
      )}

      {tab === "needs" && (
        <Section title="Team Needs">
          <div style={{ fontSize: 12, color: COLORS.muted, padding: "12px 0" }}>
            Team needs analysis coming soon.
          </div>
        </Section>
      )}
    </div>
  );
}
