/**
 * Draft System: Draft logic, prospect generation, and draft order
 * Converted from Swift GameStateManager+Draft.swift
 * Handles pre-draft audits, draft flow, and outcome probabilities
 */

import { Position, DraftProspect } from "./nfl-types";
import { Player, PlayerStatus, createPlayer } from "./player";
import { Team } from "./team";
import type { PlayerContract } from "./nfl-types";
import { CompPick } from "./CompensatoryPickSystem";

// ============================================================================
// DRAFT AUDIT RESULT
// ============================================================================

export interface DraftAuditResult {
  canEnterDraft: boolean;
  currentRosterCount: number;
  maxRosterSize: number;
  availableSpots: number;
  userDraftPicksCount: number;
  spotsNeeded: number;
  recommendations: string[];
}

// ============================================================================
// DRAFT COMPLETION STATE
// ============================================================================

export interface DraftCompletionManager {
  isDraftCompleted: boolean;
  draftIsLocked: boolean;
}

/**
 * Initialize draft completion manager
 */
export function initializeDraftCompletionManager(): DraftCompletionManager {
  return {
    isDraftCompleted: false,
    draftIsLocked: false,
  };
}

// ============================================================================
// DRAFT AUDIT LOGIC
// ============================================================================

export interface GameStateDraftContext {
  currentSeason: number;
  allPlayers: Player[];
  draftPicks: Array<{
    year: number;
    round: number;
    originalTeamId: string;
    currentTeamId: string;
    overallPick?: number;
  }>;
}

/**
 * Perform comprehensive pre-draft roster audit
 * Checks if team has enough roster space for all draft picks
 */
export function performPreDraftAudit(
  userTeam: Team | undefined,
  context: GameStateDraftContext
): DraftAuditResult {
  const maxRosterSize = 90;

  // No team selected
  if (!userTeam) {
    return {
      canEnterDraft: false,
      currentRosterCount: 0,
      maxRosterSize,
      availableSpots: 0,
      userDraftPicksCount: 0,
      spotsNeeded: 0,
      recommendations: ["⚠️ No team selected"],
    };
  }

  // Count current roster
  const currentRoster = context.allPlayers.filter(
    (p) => p.teamId === userTeam.id && p.status === PlayerStatus.ACTIVE
  );
  const currentRosterCount = currentRoster.length;
  const availableSpots = maxRosterSize - currentRosterCount;

  // Count user's draft picks for current season
  const userDraftPicks = context.draftPicks.filter(
    (p) => p.currentTeamId === userTeam.id && p.year === context.currentSeason
  );
  const userDraftPicksCount = userDraftPicks.length;

  // Calculate spots needed
  const spotsNeeded = Math.max(0, userDraftPicksCount - availableSpots);
  const canEnterDraft = spotsNeeded === 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (!canEnterDraft) {
    recommendations.push(
      `❌ Need to free up ${spotsNeeded} roster spot${spotsNeeded === 1 ? "" : "s"} before draft`
    );
    recommendations.push("• Cut low-rated players from your roster");
    recommendations.push("• Trade players to other teams");
    recommendations.push("• Release players nearing retirement");
  } else {
    const spotsAfterDraft = availableSpots - userDraftPicksCount;
    recommendations.push("✅ Ready to enter draft");
    recommendations.push(
      `• ${spotsAfterDraft} spot${spotsAfterDraft === 1 ? "" : "s"} will remain after draft`
    );
    if (spotsAfterDraft < 5) {
      recommendations.push(
        "⚠️ Consider freeing more space for post-draft flexibility"
      );
    }
  }

  // Add position-specific recommendations
  const positions: Position[] = [
    Position.QB,
    Position.RB,
    Position.WR,
    Position.TE,
    Position.OL,
    Position.DL,
    Position.LB,
    Position.CB,
    Position.S,
    Position.K,
    Position.P,
  ];

  for (const position of positions) {
    const positionCount = currentRoster.filter(
      (p) => p.position === position
    ).length;
    if (positionCount === 0) {
      recommendations.push(`⚠️ No ${position}s on roster - consider drafting one`);
    }
  }

  return {
    canEnterDraft,
    currentRosterCount,
    maxRosterSize,
    availableSpots,
    userDraftPicksCount,
    spotsNeeded,
    recommendations,
  };
}

// ============================================================================
// DRAFT ORDER MANAGEMENT
// ============================================================================

/**
 * Calculate overall pick number (1-224) from round and pick
 */
export function calculateOverallPick(round: number, pick: number): number {
  return (round - 1) * 32 + pick;
}

/**
 * Get team on the clock
 */
export function getCurrentDraftingTeam(
  round: number,
  pick: number,
  draftOrder: string[],
  teams: Team[]
): Team | undefined {
  const overallPick = calculateOverallPick(round, pick);
  const index = (pick - 1) % 32;

  if (index < draftOrder.length) {
    return teams.find((t) => t.id === draftOrder[index]);
  }

  return undefined;
}

/**
 * Establish draft order based on team records
 * Worst record picks first (ascending win percentage)
 */
export function establishDraftOrder(teams: Team[]): string[] {
  console.log("📋 Establishing draft order...");

  // Sort teams by record (worst to best)
  const sortedTeams = [...teams].sort((team1, team2) => {
    // 1. Win Percentage (Ascending - worse record picks first)
    const wp1 =
      (team1.wins + team1.ties * 0.5) /
      (team1.wins + team1.losses + team1.ties || 1);
    const wp2 =
      (team2.wins + team2.ties * 0.5) /
      (team2.wins + team2.losses + team2.ties || 1);

    if (wp1 !== wp2) return wp1 - wp2;

    // 2. Wins (Ascending)
    if (team1.wins !== team2.wins) return team1.wins - team2.wins;

    // 3. Losses (Descending - more losses is worse)
    if (team1.losses !== team2.losses) return team2.losses - team1.losses;

    // 4. Power Ranking (Descending)
    if (team1.powerRanking !== team2.powerRanking)
      return team2.powerRanking - team1.powerRanking;

    // 5. Final fallback
    return team1.name.localeCompare(team2.name);
  });

  // Debug output
  console.log("  📊 Draft Order (First 5 picks):");
  for (let i = 0; i < Math.min(5, sortedTeams.length); i++) {
    const team = sortedTeams[i];
    console.log(
      `    ${i + 1}. ${team.abbreviation} (Record: ${team.wins}-${team.losses}, Power Rank: ${team.powerRanking})`
    );
  }

  // Build draft order for all 7 rounds (224 picks total)
  const draftOrder: string[] = [];

  for (let round = 1; round <= 7; round++) {
    // Standard NFL order (fixed, not snake draft)
    for (const team of sortedTeams) {
      draftOrder.push(team.id);
    }
  }

  console.log(`✅ Draft order established with ${draftOrder.length} picks`);

  return draftOrder;
}

// ============================================================================
// DRAFT VALIDATION & FLOW
// ============================================================================

export function validateDraftAccess(
  isDraftCompleted: boolean,
  currentWeek: number
): {
  allowed: boolean;
  reason: string;
} {
  if (isDraftCompleted) return { allowed: false, reason: "Draft already completed" };
  if (currentWeek !== 15) return { allowed: false, reason: "Draft not available (Week 15 only)" };
  return { allowed: true, reason: "" };
}

export function startDraftWithValidation(
  isDraftActive: boolean,
  isDraftCompleted: boolean,
  currentWeek: number
): {
  success: boolean;
  error?: string;
} {
  const check = validateDraftAccess(isDraftCompleted, currentWeek);
  if (!check.allowed) return { success: false, error: check.reason };
  if (isDraftActive) return { success: false, error: "Draft already active" };

  return { success: true };
}

/**
 * Advance draft pick with full validation
 * Accounts for compensatory picks in rounds 3-7
 *
 * Note: This function works with a conceptual "virtual pick" system:
 * - Picks 1-32: Regular draft picks
 * - Picks 33+: Compensatory picks (variable count per round)
 */
export function advanceDraftPick(
  currentRound: number,
  currentPick: number,
  compPicksPerRound: Map<number, number> = new Map() // round -> count
): {
  newRound: number;
  newPick: number;
  draftComplete: boolean;
} {
  let round = currentRound;
  let pick = currentPick;

  // Get comp pick count for current round (if round 3-7)
  const compCountThisRound = (round >= 3 && round <= 7) ? (compPicksPerRound.get(round) || 0) : 0;
  const maxPickThisRound = 32 + compCountThisRound;

  // Check if this is the last pick of round 7
  const round7CompCount = compPicksPerRound.get(7) || 0;
  const round7LastPick = 32 + round7CompCount;

  if (round === 7 && pick === round7LastPick) {
    console.log(`🛑 CRITICAL: This is pick 7.${pick} - DRAFT MUST END NOW`);
    return { newRound: 7, newPick: pick, draftComplete: true };
  }

  // Advance pick
  pick += 1;

  // Check if we need to advance round
  if (pick > maxPickThisRound) {
    pick = 1;
    round += 1;

    console.log(`📈 Advanced to Round ${round}`);

    // Fail-safe: Check if we exceeded 7 rounds
    if (round > 7) {
      console.log("🚨 EMERGENCY: Draft exceeded 7 rounds - forcing completion");
      return { newRound: 7, newPick: round7LastPick, draftComplete: true };
    }
  }

  return { newRound: round, newPick: pick, draftComplete: false };
}

// ============================================================================
// DRAFT OUTCOME PROBABILITY SYSTEM
// ============================================================================

export interface DraftOutcomeCalculation {
  outcome: "bust" | "gem" | "normal";
  potentialBoost: number;
  finalPotential: number;
  reasoning: string;
}

/**
 * Calculate draft outcome using sophisticated probability weighting
 * Based on NFL data (2000-2019): Success rates and star rates by round
 *
 * Factors:
 * - Draft round (primary)
 * - Player position (secondary)
 * - Personality traits (work ethic, motivation)
 * - Medical grade
 * - Scouting grade vs draft position (value analysis)
 * - School prestige
 * - Combine performance
 * - Character grade
 * - Age at draft
 */
export function calculateDraftOutcome(
  prospect: DraftProspect,
  draftRound: number,
  baseOverall: number
): DraftOutcomeCalculation {
  // Step 1: Compute base calibrated probabilities by round
  const baseSuccessRate: Record<number, number> = {
    1: 0.7, // 70% of R1 picks become quality players
    2: 0.49, // 49%
    3: 0.3, // 30%
    4: 0.2, // 20%
    5: 0.15, // 15%
    6: 0.09, // 9%
    7: 0.06, // 6%
  };

  const baseStarRate: Record<number, number> = {
    1: 0.25, // ~25% All-Pro/Pro Bowl
    2: 0.1, // ~10%
    3: 0.01, // ~1%
    4: 0.007, // 0.7%
    5: 0.004, // 0.4%
    6: 0.003, // 0.3%
    7: 0.002, // 0.2%
  };

  let successRate = baseSuccessRate[draftRound] || 0.1;
  let starRate = baseStarRate[draftRound] || 0.005;

  // Step 1.5: Apply position-specific modifiers
  const positionModifiers: Record<
    Position,
    { successMult: number; starMult: number }
  > = {
    [Position.QB]: { successMult: 0.95, starMult: 1.15 },
    [Position.OL]: { successMult: 0.95, starMult: 1.15 },
    [Position.RB]:
      draftRound >= 4
        ? { successMult: 1.1, starMult: 1.25 }
        : { successMult: 1.0, starMult: 1.0 },
    [Position.WR]:
      draftRound >= 4
        ? { successMult: 1.1, starMult: 1.25 }
        : { successMult: 1.0, starMult: 1.0 },
    [Position.LB]:
      draftRound >= 4
        ? { successMult: 1.1, starMult: 1.25 }
        : { successMult: 1.0, starMult: 1.0 },
    [Position.TE]: { successMult: 1.05, starMult: 0.95 },
    [Position.DL]: { successMult: 1.05, starMult: 0.95 },
    [Position.CB]: { successMult: 1.0, starMult: 1.0 },
    [Position.S]: { successMult: 1.0, starMult: 1.0 },
    [Position.K]: { successMult: 1.0, starMult: 1.0 },
    [Position.P]: { successMult: 1.0, starMult: 1.0 },
  };

  const mods = positionModifiers[prospect.position] || {
    successMult: 1.0,
    starMult: 1.0,
  };
  successRate *= mods.successMult;
  starRate *= mods.starMult;

  // Derive three outcome bands from base rates
  let bustChance = 1.0 - successRate;
  let gemChance = starRate;
  let normalChance = successRate - gemChance;

  // Step 1.75: Apply personality modifiers
  const personality = prospect.personality;
  if (personality.workEthic > 80 && personality.motivation > 80) {
    gemChance *= 1.25;
    bustChance *= 0.9;
  }

  // Step 1.8: Apply medical grade modifiers
  if (prospect.medicalGrade === "C" || prospect.medicalGrade === "D") {
    bustChance *= 1.2;
  }

  // Step 1.9: Apply scouting grade / draft position value modifier
  if (
    (prospect.scoutingGrade === "A+" || prospect.scoutingGrade === "A") &&
    draftRound > (prospect.projectedRound || 7) + 1
  ) {
    gemChance *= 1.3; // High grade but fell in draft
  }

  // Step 1.91: Apply school pedigree modifier
  const eliteSchools = [
    "Alabama",
    "Georgia",
    "Ohio State",
    "LSU",
    "Clemson",
    "Michigan",
    "Texas",
    "Oklahoma",
    "Penn State",
    "Notre Dame",
  ];
  if (eliteSchools.includes(prospect.college)) {
    bustChance *= 0.9;
    normalChance *= 1.15;
  }

  // Step 1.92: Apply combine performance modifier
  if (prospect.combineResults) {
    const combine = prospect.combineResults;
    const exceptionalAthlete: boolean = (() => {
      switch (prospect.position) {
        case Position.QB:
        case Position.RB:
        case Position.WR:
        case Position.CB:
          // Speed positions: elite 40-yard and vertical
          return (combine.fortyYard ?? 5.0) < 4.4 && (combine.verticalJump ?? 30) > 38;
        case Position.TE:
        case Position.LB:
        case Position.S:
          // Hybrid positions
          return (combine.fortyYard ?? 5.0) < 4.6 && (combine.verticalJump ?? 30) > 36;
        case Position.OL:
        case Position.DL:
          // Power positions
          return (combine.benchPress ?? 15) > 30 && (combine.threeCone ?? 8.0) < 7.5;
        default:
          return false;
      }
    })();

    if (exceptionalAthlete) {
      gemChance *= 1.1;
      normalChance *= 1.05;
      bustChance *= 0.9;
    }
  }

  // Step 1.93: Apply character grade modifier
  if (prospect.characterGrade === "A") {
    bustChance *= 0.85;
    normalChance *= 1.1;
  } else if (prospect.characterGrade === "D") {
    bustChance *= 1.3;
    gemChance *= 0.8;
  }

  // Step 1.95: Renormalize probabilities
  const total = bustChance + gemChance + normalChance;
  bustChance /= total;
  gemChance /= total;
  normalChance /= total;

  // Step 2: Roll outcome
  const roll = Math.random();
  let outcome: "bust" | "gem" | "normal";
  let reasoning = "";

  if (roll < bustChance) {
    outcome = "bust";
    reasoning = "Failed to meet expectations";
  } else if (roll < bustChance + gemChance) {
    outcome = "gem";
    reasoning = "Exceeded expectations - star potential";
  } else {
    outcome = "normal";
    reasoning = "Solid starter quality";
  }

  // Step 3: Choose potential boost based on outcome + round + age
  let potentialBoost: number;

  switch (outcome) {
    case "bust":
      switch (draftRound) {
        case 1:
          potentialBoost = Math.floor(Math.random() * 6);
          break;
        case 2:
          potentialBoost = Math.floor(Math.random() * 8);
          break;
        case 3:
          potentialBoost = Math.floor(Math.random() * 9);
          break;
        default:
          potentialBoost = Math.floor(Math.random() * 11);
      }
      break;

    case "gem":
      switch (draftRound) {
        case 1:
          potentialBoost = 15 + Math.floor(Math.random() * 11); // 15-25
          break;
        case 2:
          potentialBoost = 14 + Math.floor(Math.random() * 9); // 14-22
          break;
        case 3:
          potentialBoost = 18 + Math.floor(Math.random() * 9); // 18-26
          break;
        default:
          potentialBoost = 22 + Math.floor(Math.random() * 11); // 22-32 (late-round gems)
      }
      break;

    default: // "normal"
      switch (draftRound) {
        case 1:
          potentialBoost = 10 + Math.floor(Math.random() * 11); // 10-20
          break;
        case 2:
          potentialBoost = 8 + Math.floor(Math.random() * 9); // 8-16
          break;
        case 3:
          potentialBoost = 6 + Math.floor(Math.random() * 9); // 6-14
          break;
        case 4:
          potentialBoost = 5 + Math.floor(Math.random() * 8); // 5-12
          break;
        case 5:
        case 6:
        case 7:
          potentialBoost = 3 + Math.floor(Math.random() * 8); // 3-10
          break;
        default:
          potentialBoost = 2 + Math.floor(Math.random() * 7); // 2-8
      }
  }

  // Step 3.5: Apply age-based modifiers
  const ageModifier: number = (() => {
    if (prospect.age <= 20) return 1.15; // Young: +15%
    if (prospect.age === 21) return 1.08; // +8%
    if (prospect.age === 22) return 1.0; // Typical
    if (prospect.age === 23) return 0.92; // -8%
    return 0.85; // Very old: -15%
  })();

  potentialBoost = Math.floor(potentialBoost * ageModifier);

  // Step 4: Calculate final potential (clamped)
  const rawPotential = baseOverall + potentialBoost;
  const finalPotential = Math.min(99, Math.max(baseOverall, rawPotential));

  return {
    outcome,
    potentialBoost,
    finalPotential,
    reasoning,
  };
}

// ============================================================================
// DRAFT PICK PROCESSING
// ============================================================================

export interface DraftPickResult {
  success: boolean;
  player?: Player;
  error?: string;
}

/**
 * Create player from draft prospect with calculated potential
 */
export function createDraftedPlayer(
  prospect: DraftProspect,
  teamId: string,
  draftRound: number,
  draftPick: number,
  currentSeason: number,
  outcome: DraftOutcomeCalculation
): Player {
  const contract = PlayerContract.rookie(
    prospect.position,
    draftRound
  );

  return {
    id: Math.random().toString(36).substr(2, 9),
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    position: prospect.position,
    jerseyNumber: 0,
    age: prospect.age,
    height: prospect.height,
    weight: prospect.weight,
    birthDate: new Date(),
    college: prospect.college,
    draftYear: currentSeason,
    draftRound: draftRound,
    draftPick: draftPick,
    teamId,
    status: PlayerStatus.ACTIVE,
    overall: prospect.overall,
    potential: outcome.finalPotential,
    attributes: prospect.attributes,
    currentSeasonStats: { ...require("./player").createEmptyPlayerStats() },
    careerTotalStats: { ...require("./player").createEmptyPlayerStats() },
    gameLog: {},
    seasonHistory: {},
    careerStats: {},
    seasonStats: {},
    personality: prospect.personality,
    injuryStatus: "Healthy" as any,
    morale: 75,
    fatigue: 0,
    depthChart: undefined,
    contract,
    experiencePoints: 0,
    developmentFocus: undefined,
    preseasonStats: undefined,
    preseasonRating: undefined,
    accruedSeasons: 0,
    weeksOnIR: 0,
    isProtectedOnPS: false,
    irPlacementWeek: undefined,
    tradeRequestState: "None",
    shoppingStatus: "Off Block",
    tradeRequestWeek: undefined,
    tradeRequestReason: undefined,
    isAwareOfShopping: false,
    preferredDestinations: [],
    blockedDestinations: [],
    prospectEvaluation: {
      pffGrade: prospect.pffGrade,
      pffPercentile: prospect.pffPercentile,
      clubGrade: prospect.clubGrade,
      confidence: prospect.scoutingConfidence,
      evidence: [],
    },
  };
}

// ============================================================================
// UNDRAFTED FREE AGENT PROCESSING
// ============================================================================

/**
 * Convert undrafted prospect to free agent
 */
export function convertProspectToUDFA(prospect: DraftProspect): Player {
  return {
    id: Math.random().toString(36).substr(2, 9),
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    position: prospect.position,
    jerseyNumber: 0,
    age: prospect.age,
    height: prospect.height,
    weight: prospect.weight,
    birthDate: new Date(),
    college: prospect.college,
    draftYear: 0,
    draftRound: undefined,
    draftPick: undefined,
    teamId: undefined,
    status: PlayerStatus.FREE_AGENT,
    overall: Math.max(50, prospect.overall - 10),
    potential: prospect.overall,
    attributes: prospect.attributes,
    currentSeasonStats: { ...require("./player").createEmptyPlayerStats() },
    careerTotalStats: { ...require("./player").createEmptyPlayerStats() },
    gameLog: {},
    seasonHistory: {},
    careerStats: {},
    seasonStats: {},
    personality: prospect.personality,
    injuryStatus: "Healthy" as any,
    morale: 50,
    fatigue: 0,
    depthChart: undefined,
    contract: undefined,
    experiencePoints: 0,
    developmentFocus: undefined,
    preseasonStats: undefined,
    preseasonRating: undefined,
    accruedSeasons: 0,
    weeksOnIR: 0,
    isProtectedOnPS: false,
    irPlacementWeek: undefined,
    tradeRequestState: "None",
    shoppingStatus: "Off Block",
    tradeRequestWeek: undefined,
    tradeRequestReason: undefined,
    isAwareOfShopping: false,
    preferredDestinations: [],
    blockedDestinations: [],
    prospectEvaluation: undefined,
  };
}

// ============================================================================
// STATE MANAGEMENT INTERFACES
// ============================================================================

export interface DraftState {
  isDraftActive: boolean;
  isDraftOrderLocked: boolean;
  currentDraftRound: number;
  currentDraftPick: number;
  draftOrder: string[]; // Array of team IDs in draft order
  draftProspects: DraftProspect[];
  draftCompletionManager: DraftCompletionManager;
  compPicks: CompPick[]; // Compensatory picks (rounds 3-7)
}

/**
 * Initialize draft state
 */
export function initializeDraftState(): DraftState {
  return {
    isDraftActive: false,
    isDraftOrderLocked: false,
    currentDraftRound: 1,
    currentDraftPick: 1,
    draftOrder: [],
    draftProspects: [],
    draftCompletionManager: initializeDraftCompletionManager(),
    compPicks: [],
  };
}

/**
 * Calculate compensatory picks per round from a DraftState
 * Returns a Map where key = round number (3-7), value = count of comp picks
 */
export function getCompPicksPerRound(draftState: DraftState): Map<number, number> {
  const compPicksPerRound = new Map<number, number>();

  for (let round = 3; round <= 7; round++) {
    const count = draftState.compPicks.filter(pick => pick.round === round).length;
    if (count > 0) {
      compPicksPerRound.set(round, count);
    }
  }

  return compPicksPerRound;
}

/**
 * Complete draft and convert remaining prospects to UDFAs
 */
export function completeDraft(
  state: DraftState,
  picksRemaining: number
): {
  updatedState: DraftState;
  undraftedFreeAgents: Player[];
} {
  const updated = { ...state };
  updated.isDraftActive = false;

  if (picksRemaining > 0) {
    console.log(
      `🧹 Cleaning up ${picksRemaining} unused/ghost draft picks`
    );
  }

  // Convert remaining prospects to UDFAs
  const undraftedFreeAgents = updated.draftProspects.map((p) =>
    convertProspectToUDFA(p)
  );

  updated.draftProspects = [];
  updated.draftCompletionManager.isDraftCompleted = true;

  console.log("🏁 Draft Complete. Processing UDFAs...");
  console.log(`📋 Created ${undraftedFreeAgents.length} UDFA players`);

  return { updatedState: updated, undraftedFreeAgents };
}
