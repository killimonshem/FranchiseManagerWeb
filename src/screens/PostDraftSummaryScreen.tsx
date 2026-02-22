import { useState } from "react";
import { COLORS, FONT } from "../ui/theme";
import { Section, DataRow, RatingBadge, PosTag, Pill } from "../ui/components";
import { Trophy, ArrowRight, Star, TrendingDown, TrendingUp } from "lucide-react";
import type { GameStateManager } from "../types/GameStateManager";
import { DraftGrade, getGradeColor, StandoutType, getStandoutColor } from "../types/DraftCompletionSystem";

export function PostDraftSummaryScreen({ gsm, onDismiss }: { gsm: GameStateManager; onDismiss: () => void }) {
  const [tab, setTab] = useState<"summary" | "league">("summary");
  const summary = gsm.draftCompletionManager.draftSummary;

  if (!summary) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>
        No draft summary available.
        <button
          onClick={() => {
            gsm.draftCompletionManager.showingSummaryScreen = false;
            gsm.draftCompletionManager.showOffseasonGradeScreen = true;
            onDismiss();
          }}
          style={{ display: "block", margin: "20px auto", padding: "10px 20px" }}
        >
          Continue to Offseason Grade
        </button>
      </div>
    );
  }

  // Helper to normalize draft info since Engine and CompletionSystem might use different fields
  const getDraftInfo = (p: any) => {
    if (p.draft && p.draft.year) return p.draft;
    return { year: p.draftYear, round: p.draftRound, pick: p.draftPick };
  };

  const leaguePicks = gsm.allPlayers
    .filter(p => {
      const d = getDraftInfo(p);
      return d.year === gsm.currentGameDate.season && d.round > 0;
    })
    .sort((a, b) => {
      const dA = getDraftInfo(a);
      const dB = getDraftInfo(b);
      if (dA.round !== dB.round) return dA.round - dB.round;
      return dA.pick - dB.pick;
    });

  return (
    <div style={{ animation: "fadeIn .4s", paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: COLORS.light }}>Draft Report Card</h1>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            {summary.teamName} · {summary.totalPicks} Selections
          </div>
        </div>
        <button
          onClick={() => {
            gsm.draftCompletionManager.showingSummaryScreen = false;
            gsm.draftCompletionManager.showOffseasonGradeScreen = true;
            onDismiss();
          }}
          style={{
            background: COLORS.lime, color: COLORS.bg, border: "none",
            padding: "10px 24px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}
        >
          View Offseason Grade <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Pill active={tab === "summary"} onClick={() => setTab("summary")}>My Report Card</Pill>
        <Pill active={tab === "league"} onClick={() => setTab("league")}>League Results</Pill>
      </div>

      {tab === "summary" ? (
        <>
          {/* Grades Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <GradeCard label="Team Needs" grade={summary.needsGrade} />
            <GradeCard label="Value" grade={summary.valueGrade} />
            <GradeCard label="Future Assets" grade={summary.futureAssetsGrade} />
            <GradeCard label="Overall" grade={summary.overallGrade} isOverall />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Standout Picks */}
            <Section title="Standout Selections">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {summary.standoutPicks.map((pick: any) => (
                  <div key={pick.id} style={{
                    background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12,
                    borderLeft: `4px solid ${getStandoutColor(pick.type)}`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: getStandoutColor(pick.type), textTransform: "uppercase" }}>
                        {pick.type}
                      </span>
                      <RatingBadge value={pick.player.overall} size="sm" />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.light }}>
                      {pick.player.firstName} {pick.player.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                      {pick.explanation}
                    </div>
                  </div>
                ))}
                {summary.standoutPicks.length === 0 && (
                  <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>No standout picks identified.</div>
                )}
              </div>
            </Section>

            {/* Draft Class List */}
            <Section title="Draft Class">
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <DataRow header>
                  <span style={{ flex: 0.5, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Rd</span>
                  <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Player</span>
                  <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Pos</span>
                  <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>OVR</span>
                </DataRow>
                {summary.draftedPlayers.map((p: any) => (
                  <DataRow key={p.id} even={false}>
                    <span style={{ flex: 0.5, fontSize: 10, color: COLORS.muted, fontFamily: FONT.mono }}>
                      {getDraftInfo(p).round}.{getDraftInfo(p).pick}
                    </span>
                    <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: COLORS.light }}>
                      {p.firstName} {p.lastName}
                    </span>
                    <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                    <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
                  </DataRow>
                ))}
              </div>
            </Section>
          </div>

          {/* UDFA Section */}
          <div style={{ marginTop: 20 }}>
            <Section title="Undrafted Free Agent Signings">
              <div style={{ padding: 12, fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
                The draft is over, but the work isn't. Undrafted free agents have now entered the player pool.
                Check the Free Agency hub to sign any overlooked prospects before Training Camp begins.
              </div>
            </Section>
          </div>
        </>
      ) : (
        <Section title="League Draft Results" pad={false}>
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            <DataRow header>
              <span style={{ flex: 0.5, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Pick</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Team</span>
              <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Player</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>Pos</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, fontWeight: 700 }}>OVR</span>
            </DataRow>
            {leaguePicks.map(p => {
              const d = getDraftInfo(p);
              const team = gsm.teams.find(t => t.id === p.teamId);
              return (
                <DataRow key={p.id} even={false}>
                  <span style={{ flex: 0.5, fontSize: 10, color: COLORS.muted, fontFamily: FONT.mono }}>
                    {d.round}.{d.pick}
                  </span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: team?.id === gsm.userTeamId ? COLORS.lime : COLORS.light }}>
                    {team?.abbreviation ?? "UNK"}
                  </span>
                  <span style={{ flex: 2, fontSize: 11, color: COLORS.light }}>
                    {p.firstName} {p.lastName}
                  </span>
                  <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                  <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
                </DataRow>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function GradeCard({ label, grade, isOverall }: { label: string; grade: DraftGrade; isOverall?: boolean }) {
  const color = getGradeColor(grade);
  return (
    <div style={{
      background: isOverall ? `linear-gradient(135deg, ${color}22, rgba(0,0,0,0))` : "rgba(255,255,255,0.03)",
      borderRadius: 10, padding: 16, textAlign: "center",
      border: `1px solid ${isOverall ? color : "rgba(255,255,255,0.1)"}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{ fontSize: 42, fontWeight: 900, color: color, lineHeight: 1, marginBottom: 4 }}>
        {grade}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: isOverall ? COLORS.light : COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  );
}