import { COLORS } from "../ui/theme";
import { Section, RatingBadge, DataRow, PosTag, Pill } from "../ui/components";
import { useState } from "react";
import draftTradeData from "../../drafttrade.json";

// ─── Draft pick computation from ledger ──────────────────────────────────────

interface TradedPick {
  year: number;
  round: number;
  original_team: string;
  new_owner: string;
  notes: string;
}

interface DraftPick {
  year: number;
  round: number;
  originalTeam: string;
  isOwn: boolean; // true if original_team === owning team
  notes?: string;
}

const ALL_TEAMS = [
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN",
  "DET","GB","HOU","IND","JAX","KC","LAC","LAR","LV","MIA",
  "MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS",
];

const DRAFT_YEARS = [2026, 2027, 2028];
const TOTAL_ROUNDS = 7;

const tradedPicks: TradedPick[] = draftTradeData.traded_picks as TradedPick[];

/** Compute which picks a given team currently owns after applying all trades. */
function computeTeamPicks(teamAbbr: string): DraftPick[] {
  if (!teamAbbr) return [];

  const tradedAway = new Set<string>();
  const received: DraftPick[] = [];

  for (const tp of tradedPicks) {
    if (tp.new_owner === tp.original_team) continue; // no-op
    const key = `${tp.year}-${tp.round}-${tp.original_team}`;
    if (tp.new_owner === teamAbbr) {
      received.push({ year: tp.year, round: tp.round, originalTeam: tp.original_team, isOwn: false, notes: tp.notes });
    }
    if (tp.original_team === teamAbbr) {
      tradedAway.add(key);
    }
  }

  const ownPicks: DraftPick[] = [];
  for (const year of DRAFT_YEARS) {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const key = `${year}-${round}-${teamAbbr}`;
      if (!tradedAway.has(key)) {
        ownPicks.push({ year, round, originalTeam: teamAbbr, isOwn: true });
      }
    }
  }

  const all = [...ownPicks, ...received].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.round - b.round
  );
  return all;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PROSPECTS = [
  { id: 1, name: "Cam Ward",         pos: "QB", college: "Miami",    overall: 90, projRound: 1 },
  { id: 2, name: "Travis Hunter",    pos: "CB", college: "Colorado", overall: 88, projRound: 1 },
  { id: 3, name: "Abdul Carter",     pos: "LB", college: "Penn St",  overall: 87, projRound: 1 },
  { id: 4, name: "Will Johnson",     pos: "CB", college: "Michigan", overall: 86, projRound: 1 },
  { id: 5, name: "Mason Graham",     pos: "DL", college: "Michigan", overall: 85, projRound: 1 },
];

const ROUND_LABEL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

export function DraftScreen({ userTeamAbbr }: { userTeamAbbr: string }) {
  const [tab, setTab] = useState("board");

  const myPicks = computeTeamPicks(userTeamAbbr);
  const byYear  = DRAFT_YEARS.map(yr => ({
    year: yr,
    picks: myPicks.filter(p => p.year === yr),
  }));

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 8 }}>2026 NFL Draft</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Pill active={tab === "board"}  onClick={() => setTab("board")}>Big Board</Pill>
        <Pill active={tab === "picks"}  onClick={() => setTab("picks")}>My Picks</Pill>
        <Pill active={tab === "needs"}  onClick={() => setTab("needs")}>Team Needs</Pill>
      </div>

      {tab === "board" && (
        <Section title="Prospect Board" pad={false}>
          <DataRow header>
            {["#", "Name", "Pos", "College", "Rating", "Proj"].map(h =>
              <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, flex: h === "Name" ? 2 : 1 }}>
                {h}
              </span>
            )}
          </DataRow>
          {PROSPECTS.map((p, i) => (
            <DataRow key={p.id} even={i % 2 === 0} hover>
              <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: COLORS.muted }}>{i + 1}</span>
              <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.name}</span>
              <span style={{ flex: 1 }}><PosTag pos={p.pos} /></span>
              <span style={{ flex: 1.5, fontSize: 10, color: COLORS.muted }}>{p.college}</span>
              <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
              <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>Rd {p.projRound}</span>
            </DataRow>
          ))}
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
