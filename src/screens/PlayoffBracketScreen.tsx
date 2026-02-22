/**
 * Playoff Bracket Screen
 * Visual AFC/NFC bracket tournament display with seed progression
 * Supports round simulation and real-time matchup updates
 */

import { useState, useMemo } from "react";
import { COLORS, FONT } from "../ui/theme";
import { RatingBadge, Section } from "../ui/components";
import { ChevronRight, Trophy } from "../ui/components";
import type { GameStateManager, PlayoffBracket, PlayoffSeed, PlayoffMatchup } from "../types/GameStateManager";

interface PlayoffBracketScreenProps {
  gsm: GameStateManager;
  refresh: () => void;
}

// ─── Playoff Simulation Utilities ───────────────────────────────────────────

/**
 * Simulate a playoff matchup between two seeded teams.
 * Higher seed typically has an advantage, modified by team ratings.
 */
function simulatePlayoffMatchup(higher: PlayoffSeed, lower: PlayoffSeed, gsm: GameStateManager): {
  winnerId: string;
  higherScore: number;
  lowerScore: number;
} {
  const higherTeam = gsm.teams.find(t => t.id === higher.teamId);
  const lowerTeam = gsm.teams.find(t => t.id === lower.teamId);

  if (!higherTeam || !lowerTeam) {
    // Fallback: higher seed wins
    return {
      winnerId: higher.teamId,
      higherScore: Math.floor(Math.random() * 10) + 24,
      lowerScore: Math.floor(Math.random() * 10) + 17,
    };
  }

  // Base ratings (offense + defense + ST)
  const higherRating = higherTeam.offenseRating + higherTeam.defenseRating + higherTeam.specialTeamsRating;
  const lowerRating = lowerTeam.offenseRating + lowerTeam.defenseRating + lowerTeam.specialTeamsRating;

  // Home field advantage for higher seed (typically)
  const higherAdj = higherRating + (higher.seed <= 2 ? 5 : higher.seed <= 4 ? 2 : 0);
  const lowerAdj = lowerRating;

  const totalAdj = higherAdj + lowerAdj;
  const higherWinChance = higherAdj / totalAdj;

  // Generate score
  const roll = Math.random();
  const winner = roll < higherWinChance ? higher.teamId : lower.teamId;

  // Score variance (20-31 range for losers, 17-28 for winners is realistic NFL playoff range)
  const baseWinScore = 24 + Math.floor(Math.random() * 8);
  const baseLooseScore = 18 + Math.floor(Math.random() * 10);

  const higherScore = winner === higher.teamId ? baseWinScore : baseLooseScore;
  const lowerScore = winner === lower.teamId ? baseWinScore : baseLooseScore;

  return {
    winnerId: winner,
    higherScore,
    lowerScore,
  };
}

/**
 * Simulate all pending matchups in a round and advance winners to next round.
 */
async function simulateRound(
  bracket: PlayoffBracket,
  roundType: "wildCard" | "divisional" | "conference" | "superBowl",
  gsm: GameStateManager
): Promise<PlayoffBracket> {
  const updated = { ...bracket };

  let matchupsToSimulate: PlayoffMatchup[] = [];
  switch (roundType) {
    case "wildCard":
      matchupsToSimulate = updated.wildCardMatchups.filter(m => !m.isComplete);
      break;
    case "divisional":
      matchupsToSimulate = updated.divisionalMatchups.filter(m => !m.isComplete);
      break;
    case "conference":
      matchupsToSimulate = updated.conferenceMatchups.filter(m => !m.isComplete);
      break;
    case "superBowl":
      if (updated.superBowlMatchup && !updated.superBowlMatchup.isComplete) {
        matchupsToSimulate = [updated.superBowlMatchup];
      }
      break;
  }

  // Simulate each pending matchup
  for (const matchup of matchupsToSimulate) {
    const higherSeed = [...updated.afcSeeds, ...updated.nfcSeeds].find(s => s.id === matchup.higherSeedId);
    const lowerSeed = [...updated.afcSeeds, ...updated.nfcSeeds].find(s => s.id === matchup.lowerSeedId);

    if (!higherSeed || !lowerSeed) continue;

    const result = simulatePlayoffMatchup(higherSeed, lowerSeed, gsm);

    matchup.winnerId = result.winnerId;
    matchup.higherSeedScore = result.higherScore;
    matchup.lowerSeedScore = result.lowerScore;
    matchup.isComplete = true;

    // Mark eliminated team
    if (result.winnerId === higherSeed.teamId) {
      lowerSeed.isEliminated = true;
    } else {
      higherSeed.isEliminated = true;
    }
  }

  // Update array references to trigger React updates
  if (roundType === "wildCard") {
    updated.wildCardMatchups = [...updated.wildCardMatchups];
  } else if (roundType === "divisional") {
    updated.divisionalMatchups = [...updated.divisionalMatchups];
  } else if (roundType === "conference") {
    updated.conferenceMatchups = [...updated.conferenceMatchups];
  }

  // Check if entire bracket is complete
  const allComplete =
    updated.wildCardMatchups.every(m => m.isComplete) &&
    updated.divisionalMatchups.every(m => m.isComplete) &&
    updated.conferenceMatchups.every(m => m.isComplete) &&
    (!updated.superBowlMatchup || updated.superBowlMatchup.isComplete);

  updated.isComplete = allComplete;

  // Persist to storage
  await gsm.savePlayoffBracket(updated);

  return updated;
}

// ─── Matchup Card Component ─────────────────────────────────────────────────

interface MatchupCardProps {
  matchup: PlayoffMatchup;
  higherSeed: PlayoffSeed;
  lowerSeed: PlayoffSeed;
  isPending: boolean;
}

function MatchupCard({ matchup, higherSeed, lowerSeed, isPending }: MatchupCardProps) {
  const higherWon = matchup.winnerId === higherSeed.teamId;
  const lowerWon = matchup.winnerId === lowerSeed.teamId;
  const isComplete = matchup.isComplete;

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.darkMagenta}`,
        borderRadius: 8,
        overflow: "hidden",
        minWidth: 220,
        boxShadow: isComplete ? "0 4px 12px rgba(213, 36, 110, 0.15)" : "none",
      }}
    >
      {/* Higher Seed */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid ${COLORS.darkMagenta}`,
          background: higherWon
            ? "rgba(215, 241, 113, 0.1)"
            : isComplete
              ? "rgba(100, 100, 100, 0.1)"
              : "transparent",
          opacity: higherSeed.isEliminated ? 0.4 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.light }}>
            #{higherSeed.seed} {higherSeed.teamAbbreviation}
          </div>
          <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
            {higherSeed.teamName}
          </div>
        </div>
        {isComplete && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: higherWon ? COLORS.lime : COLORS.muted,
              minWidth: 30,
              textAlign: "right",
            }}
          >
            {matchup.higherSeedScore}
          </div>
        )}
      </div>

      {/* Lower Seed */}
      <div
        style={{
          padding: "10px 12px",
          background: lowerWon
            ? "rgba(215, 241, 113, 0.1)"
            : isComplete
              ? "rgba(100, 100, 100, 0.1)"
              : "transparent",
          opacity: lowerSeed.isEliminated ? 0.4 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.light }}>
            #{lowerSeed.seed} {lowerSeed.teamAbbreviation}
          </div>
          <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
            {lowerSeed.teamName}
          </div>
        </div>
        {isComplete && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: lowerWon ? COLORS.lime : COLORS.muted,
              minWidth: 30,
              textAlign: "right",
            }}
          >
            {matchup.lowerSeedScore}
          </div>
        )}
      </div>

      {/* Pending Indicator */}
      {isPending && (
        <div
          style={{
            padding: "6px 12px",
            background: "rgba(245, 166, 35, 0.1)",
            borderTop: `1px solid ${COLORS.darkMagenta}`,
            fontSize: 9,
            color: "#f5a623",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Pending
        </div>
      )}
    </div>
  );
}

// ─── Bracket Round Section ──────────────────────────────────────────────────

interface BracketRoundProps {
  roundLabel: string;
  matchups: PlayoffMatchup[];
  allSeeds: PlayoffSeed[];
  isComplete: boolean;
  hasPending: boolean;
  roundType: "wildCard" | "divisional" | "conference" | "superBowl";
  onSimulateRound: (roundType: "wildCard" | "divisional" | "conference" | "superBowl") => void;
  isSimulating: boolean;
}

function BracketRound({
  roundLabel, matchups, allSeeds, isComplete, hasPending, roundType, onSimulateRound, isSimulating
}: BracketRoundProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: COLORS.lime,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {roundLabel}
        </div>

        {hasPending && !isComplete && (
          <button
            onClick={() => onSimulateRound(roundType)}
            disabled={isSimulating}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: 4,
              background: isSimulating
                ? "rgba(141,36,110,0.2)"
                : `linear-gradient(135deg, ${COLORS.magenta}, rgba(116,0,86,0.8))`,
              border: `1px solid ${isSimulating ? COLORS.darkMagenta : COLORS.magenta}`,
              color: isSimulating ? COLORS.muted : COLORS.light,
              cursor: isSimulating ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isSimulating ? "Simulating..." : `Simulate ${roundLabel}`}
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {matchups.map((m) => {
          const higher = allSeeds.find((s) => s.id === m.higherSeedId);
          const lower = allSeeds.find((s) => s.id === m.lowerSeedId);
          if (!higher || !lower) return null;

          return (
            <MatchupCard
              key={m.id}
              matchup={m}
              higherSeed={higher}
              lowerSeed={lower}
              isPending={!m.isComplete}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Seeding Panel (Seeds 1-7 per conference) ──────────────────────────────

interface SeedsPanelProps {
  seeds: PlayoffSeed[];
  conferenceName: string;
}

function SeedsPanel({ seeds, conferenceName }: SeedsPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: COLORS.magenta,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {conferenceName} Seeds
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {seeds.map((seed) => (
          <div
            key={seed.id}
            style={{
              padding: "8px 12px",
              background: seed.isEliminated ? "rgba(100,100,100,0.1)" : "rgba(141,36,110,0.2)",
              border: `1px solid ${seed.isEliminated ? COLORS.darkMagenta : COLORS.magenta}`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: seed.isEliminated ? 0.5 : 1,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: `rgba(215, 241, 113, 0.2)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: COLORS.lime,
              }}
            >
              {seed.seed}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.light }}>
                {seed.teamAbbreviation} {seed.teamName}
              </div>
              <div style={{ fontSize: 9, color: COLORS.muted }}>
                {seed.wins}-{seed.losses}
              </div>
            </div>
            {seed.isEliminated && (
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: COLORS.muted,
                  whiteSpace: "nowrap",
                }}
              >
                Eliminated
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export function PlayoffBracketScreen({ gsm, refresh }: PlayoffBracketScreenProps) {
  const [bracket, setBracket] = useState<PlayoffBracket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  // Load bracket on mount
  useMemo(() => {
    gsm.loadPlayoffBracket().then((loaded) => {
      if (loaded) {
        setBracket(loaded);
      }
      setIsLoading(false);
    });
  }, [gsm]);

  // Handle round simulation
  const handleSimulateRound = async (roundType: "wildCard" | "divisional" | "conference" | "superBowl") => {
    if (!bracket || isSimulating) return;
    setIsSimulating(true);
    try {
      // Small delay for UI feedback
      await new Promise(r => setTimeout(r, 300));
      const updated = await simulateRound(bracket, roundType, gsm);
      setBracket(updated);
    } catch (error) {
      console.error("Failed to simulate round:", error);
    } finally {
      setIsSimulating(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ color: COLORS.muted }}>Loading playoff bracket...</div>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ color: COLORS.muted }}>
          Playoff bracket will be available once the regular season ends.
        </div>
      </div>
    );
  }

  const afcSeeded = bracket.afcSeeds;
  const nfcSeeded = bracket.nfcSeeds;
  const hasWildCard = bracket.wildCardMatchups.length > 0;
  const hasDivisional = bracket.divisionalMatchups.length > 0;
  const hasConference = bracket.conferenceMatchups.length > 0;
  const hasSuperBowl = bracket.superBowlMatchup !== undefined;

  const wildCardComplete = bracket.wildCardMatchups.every((m) => m.isComplete);
  const divisionalComplete = bracket.divisionalMatchups.every((m) => m.isComplete);
  const conferenceComplete = bracket.conferenceMatchups.every((m) => m.isComplete);
  const superBowlComplete = bracket.superBowlMatchup?.isComplete ?? false;

  // Determine current round status
  const allComplete = bracket.isComplete;

  return (
    <div>
      <Section>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: COLORS.light,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Trophy size={28} color={COLORS.magenta} />
            Playoff Bracket
          </h1>
          <div
            style={{
              fontSize: 11,
              color: COLORS.muted,
            }}
          >
            {allComplete
              ? `Season ${bracket.season} champion crowned!`
              : `Season ${bracket.season} playoff progression`}
          </div>
        </div>

        {/* Status Badge */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {hasWildCard && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 6,
                background: wildCardComplete ? "rgba(215, 241, 113, 0.2)" : "rgba(245, 166, 35, 0.2)",
                color: wildCardComplete ? COLORS.lime : "#f5a623",
                border: `1px solid ${wildCardComplete ? COLORS.lime : "rgba(245, 166, 35, 0.4)"}`,
              }}
            >
              ✓ Wild Card
            </div>
          )}
          {hasDivisional && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 6,
                background: divisionalComplete ? "rgba(215, 241, 113, 0.2)" : "rgba(245, 166, 35, 0.2)",
                color: divisionalComplete ? COLORS.lime : "#f5a623",
                border: `1px solid ${divisionalComplete ? COLORS.lime : "rgba(245, 166, 35, 0.4)"}`,
              }}
            >
              ✓ Divisional
            </div>
          )}
          {hasConference && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 6,
                background: conferenceComplete ? "rgba(215, 241, 113, 0.2)" : "rgba(245, 166, 35, 0.2)",
                color: conferenceComplete ? COLORS.lime : "#f5a623",
                border: `1px solid ${conferenceComplete ? COLORS.lime : "rgba(245, 166, 35, 0.4)"}`,
              }}
            >
              ✓ Conference
            </div>
          )}
          {hasSuperBowl && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 6,
                background: superBowlComplete ? "rgba(215, 241, 113, 0.2)" : "rgba(245, 166, 35, 0.2)",
                color: superBowlComplete ? COLORS.lime : "#f5a623",
                border: `1px solid ${superBowlComplete ? COLORS.lime : "rgba(245, 166, 35, 0.4)"}`,
              }}
            >
              ✓ Super Bowl
            </div>
          )}
        </div>
      </Section>

      {/* Dual Bracket Layout: AFC | NFC */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 30,
          marginBottom: 30,
        }}
      >
        {/* AFC Side */}
        <div>
          <div
            style={{
              marginBottom: 30,
              paddingBottom: 20,
              borderBottom: `1px solid ${COLORS.darkMagenta}`,
            }}
          >
            <SeedsPanel seeds={afcSeeded} conferenceName="AFC" />
          </div>

          {/* AFC Rounds */}
          {hasWildCard && (
            <div style={{ marginBottom: 30 }}>
              <BracketRound
                roundLabel="Wild Card"
                matchups={bracket.wildCardMatchups.filter((m) => {
                  const hs = afcSeeded.find((s) => s.id === m.higherSeedId);
                  return hs !== undefined;
                })}
                allSeeds={afcSeeded}
                isComplete={wildCardComplete}
                hasPending={!wildCardComplete}
                roundType="wildCard"
                onSimulateRound={handleSimulateRound}
                isSimulating={isSimulating}
              />
            </div>
          )}

          {hasDivisional && (
            <div style={{ marginBottom: 30 }}>
              <BracketRound
                roundLabel="Divisional"
                matchups={bracket.divisionalMatchups.filter((m) => {
                  const hs = afcSeeded.find((s) => s.id === m.higherSeedId);
                  return hs !== undefined;
                })}
                allSeeds={afcSeeded}
                isComplete={divisionalComplete}
                hasPending={!divisionalComplete}
                roundType="divisional"
                onSimulateRound={handleSimulateRound}
                isSimulating={isSimulating}
              />
            </div>
          )}

          {hasConference && (
            <div style={{ marginBottom: 30 }}>
              <BracketRound
                roundLabel="Conference Championship"
                matchups={bracket.conferenceMatchups.filter((m) => {
                  const hs = afcSeeded.find((s) => s.id === m.higherSeedId);
                  return hs !== undefined;
                })}
                allSeeds={afcSeeded}
                isComplete={conferenceComplete}
                hasPending={!conferenceComplete}
                roundType="conference"
                onSimulateRound={handleSimulateRound}
                isSimulating={isSimulating}
              />
            </div>
          )}
        </div>

        {/* NFC Side */}
        <div>
          <div
            style={{
              marginBottom: 30,
              paddingBottom: 20,
              borderBottom: `1px solid ${COLORS.darkMagenta}`,
            }}
          >
            <SeedsPanel seeds={nfcSeeded} conferenceName="NFC" />
          </div>

          {/* NFC Rounds */}
          {hasWildCard && (
            <div style={{ marginBottom: 30 }}>
              <BracketRound
                roundLabel="Wild Card"
                matchups={bracket.wildCardMatchups.filter((m) => {
                  const hs = nfcSeeded.find((s) => s.id === m.higherSeedId);
                  return hs !== undefined;
                })}
                allSeeds={nfcSeeded}
                isComplete={wildCardComplete}
                hasPending={!wildCardComplete}
                roundType="wildCard"
                onSimulateRound={handleSimulateRound}
                isSimulating={isSimulating}
              />
            </div>
          )}

          {hasDivisional && (
            <div style={{ marginBottom: 30 }}>
              <BracketRound
                roundLabel="Divisional"
                matchups={bracket.divisionalMatchups.filter((m) => {
                  const hs = nfcSeeded.find((s) => s.id === m.higherSeedId);
                  return hs !== undefined;
                })}
                allSeeds={nfcSeeded}
                isComplete={divisionalComplete}
                hasPending={!divisionalComplete}
                roundType="divisional"
                onSimulateRound={handleSimulateRound}
                isSimulating={isSimulating}
              />
            </div>
          )}

          {hasConference && (
            <div style={{ marginBottom: 30 }}>
              <BracketRound
                roundLabel="Conference Championship"
                matchups={bracket.conferenceMatchups.filter((m) => {
                  const hs = nfcSeeded.find((s) => s.id === m.higherSeedId);
                  return hs !== undefined;
                })}
                allSeeds={nfcSeeded}
                isComplete={conferenceComplete}
                hasPending={!conferenceComplete}
                roundType="conference"
                onSimulateRound={handleSimulateRound}
                isSimulating={isSimulating}
              />
            </div>
          )}
        </div>
      </div>

      {/* Super Bowl - Full Width */}
      {hasSuperBowl && bracket.superBowlMatchup && (
        <Section>
          <div style={{ marginBottom: 30 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: COLORS.light,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: COLORS.magenta,
                    marginRight: 4,
                  }}
                />
                Super Bowl
              </h2>

              {!bracket.superBowlMatchup.isComplete && (
                <button
                  onClick={() => handleSimulateRound("superBowl")}
                  disabled={isSimulating}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "5px 12px",
                    borderRadius: 4,
                    background: isSimulating
                      ? "rgba(141,36,110,0.2)"
                      : `linear-gradient(135deg, ${COLORS.magenta}, rgba(116,0,86,0.8))`,
                    border: `1px solid ${isSimulating ? COLORS.darkMagenta : COLORS.magenta}`,
                    color: isSimulating ? COLORS.muted : COLORS.light,
                    cursor: isSimulating ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isSimulating ? "Simulating..." : "Simulate Super Bowl"}
                </button>
              )}
            </div>

            <div
              style={{
                maxWidth: 300,
                margin: "0 auto",
              }}
            >
              <MatchupCard
                matchup={bracket.superBowlMatchup}
                higherSeed={afcSeeded.find(
                  (s) => s.id === bracket.superBowlMatchup!.higherSeedId
                ) || nfcSeeded.find((s) => s.id === bracket.superBowlMatchup!.higherSeedId)!}
                lowerSeed={afcSeeded.find(
                  (s) => s.id === bracket.superBowlMatchup!.lowerSeedId
                ) || nfcSeeded.find((s) => s.id === bracket.superBowlMatchup!.lowerSeedId)!}
                isPending={!bracket.superBowlMatchup.isComplete}
              />
            </div>

            {superBowlComplete && bracket.superBowlMatchup.winnerId && (
              <div
                style={{
                  marginTop: 24,
                  padding: 20,
                  background: "rgba(215, 241, 113, 0.1)",
                  borderRadius: 8,
                  border: `1px solid ${COLORS.lime}`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: COLORS.lime,
                    marginBottom: 4,
                  }}
                >
                  🏆 SUPER BOWL {bracket.season} CHAMPIONS
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.light,
                  }}
                >
                  {bracket.superBowlMatchup.winnerId === bracket.superBowlMatchup.higherSeedId
                    ? bracket.superBowlMatchup.higherSeedName
                    : bracket.superBowlMatchup.lowerSeedName}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
