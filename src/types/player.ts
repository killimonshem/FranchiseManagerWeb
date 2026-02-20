/**
 * Player model with attributes, contract, personality, and career statistics
 * Converted from Swift Player.swift
 */

import {
  Position,
  PlayerAttributes,
  PlayerPersonality,
  PlayerContract,
  PlayerDepthChart,
  InjuryStatus,
  getPositionMarketMultiplier,
  getPositionScarcity,
  createEmptyPlayerAttributes,
  createRandomPlayerPersonality,
} from "./nfl-types";

// ============================================================================
// PLAYER STATS
// ============================================================================

export interface PlayerStats {
  // Passing Stats
  passingYards: number;
  passingTDs: number;
  interceptions: number;
  completions: number;
  attempts: number;

  // Rushing Stats
  rushingYards: number;
  rushingTDs: number;
  rushingAttempts: number;

  // Receiving Stats
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  targets: number;

  // Offensive Line Stats
  sacksAllowed: number;
  pancakeBlocks: number;

  // Defensive Stats
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptionsDef: number;
  passesDefended: number;
  forcedFumbles: number;
  fumblesRecovered: number;
  safeties: number;
  defensiveTDs: number;

  // Special Teams Stats
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  longestFieldGoal: number;
  extraPointsMade: number;
  extraPointsAttempted: number;
  punts: number;
  puntYards: number;
  puntsInside20: number;

  // Game Info
  gamesPlayed: number;
  gamesStarted: number;
}

/**
 * Create empty player stats
 */
export function createEmptyPlayerStats(): PlayerStats {
  return {
    passingYards: 0,
    passingTDs: 0,
    interceptions: 0,
    completions: 0,
    attempts: 0,
    rushingYards: 0,
    rushingTDs: 0,
    rushingAttempts: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    targets: 0,
    sacksAllowed: 0,
    pancakeBlocks: 0,
    tackles: 0,
    tacklesForLoss: 0,
    sacks: 0,
    interceptionsDef: 0,
    passesDefended: 0,
    forcedFumbles: 0,
    fumblesRecovered: 0,
    safeties: 0,
    defensiveTDs: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    longestFieldGoal: 0,
    extraPointsMade: 0,
    extraPointsAttempted: 0,
    punts: 0,
    puntYards: 0,
    puntsInside20: 0,
    gamesPlayed: 0,
    gamesStarted: 0,
  };
}

/**
 * Get computed properties from stats
 */
export function getPlayerStatsComputedProps(stats: PlayerStats) {
  return {
    passingYardsPerGame:
      stats.attempts > 0
        ? stats.passingYards / Math.max(1, stats.gamesPlayed)
        : 0,
    rushingYardsPerCarry:
      stats.rushingAttempts > 0
        ? stats.rushingYards / stats.rushingAttempts
        : 0,
    yardsPerReception:
      stats.receptions > 0 ? stats.receivingYards / stats.receptions : 0,
    totalTouchdowns:
      stats.passingTDs +
      stats.rushingTDs +
      stats.receivingTDs +
      stats.defensiveTDs,
    totalYards:
      stats.passingYards + stats.rushingYards + stats.receivingYards,
    fieldGoalPercentage:
      stats.fieldGoalsAttempted > 0
        ? (stats.fieldGoalsMade / stats.fieldGoalsAttempted) * 100
        : 0,
    completionPercentage:
      stats.attempts > 0 ? (stats.completions / stats.attempts) * 100 : 0,
    puntAverage: stats.punts > 0 ? stats.puntYards / stats.punts : 0,
  };
}

/**
 * Add stats together (accumulate)
 */
export function addPlayerStats(a: PlayerStats, b: PlayerStats): PlayerStats {
  return {
    passingYards: a.passingYards + b.passingYards,
    passingTDs: a.passingTDs + b.passingTDs,
    interceptions: a.interceptions + b.interceptions,
    completions: a.completions + b.completions,
    attempts: a.attempts + b.attempts,
    rushingYards: a.rushingYards + b.rushingYards,
    rushingTDs: a.rushingTDs + b.rushingTDs,
    rushingAttempts: a.rushingAttempts + b.rushingAttempts,
    receptions: a.receptions + b.receptions,
    receivingYards: a.receivingYards + b.receivingYards,
    receivingTDs: a.receivingTDs + b.receivingTDs,
    targets: a.targets + b.targets,
    sacksAllowed: a.sacksAllowed + b.sacksAllowed,
    pancakeBlocks: a.pancakeBlocks + b.pancakeBlocks,
    tackles: a.tackles + b.tackles,
    tacklesForLoss: a.tacklesForLoss + b.tacklesForLoss,
    sacks: a.sacks + b.sacks,
    interceptionsDef: a.interceptionsDef + b.interceptionsDef,
    passesDefended: a.passesDefended + b.passesDefended,
    forcedFumbles: a.forcedFumbles + b.forcedFumbles,
    fumblesRecovered: a.fumblesRecovered + b.fumblesRecovered,
    safeties: a.safeties + b.safeties,
    defensiveTDs: a.defensiveTDs + b.defensiveTDs,
    fieldGoalsMade: a.fieldGoalsMade + b.fieldGoalsMade,
    fieldGoalsAttempted: a.fieldGoalsAttempted + b.fieldGoalsAttempted,
    longestFieldGoal: Math.max(a.longestFieldGoal, b.longestFieldGoal),
    extraPointsMade: a.extraPointsMade + b.extraPointsMade,
    extraPointsAttempted: a.extraPointsAttempted + b.extraPointsAttempted,
    punts: a.punts + b.punts,
    puntYards: a.puntYards + b.puntYards,
    puntsInside20: a.puntsInside20 + b.puntsInside20,
    gamesPlayed: a.gamesPlayed + b.gamesPlayed,
    gamesStarted: a.gamesStarted + b.gamesStarted,
  };
}

// ============================================================================
// EVALUATION CHIP & PROSPECT EVALUATION
// ============================================================================

export interface EvaluationChip {
  id: string;
  label: string; // e.g., "Interviews", "Workouts", "Scheme Fit", "Character"
  value: string; // e.g., "Strong", "Elite", "Perfect", "Leader"
  isPositive: boolean;
}

export interface ProspectEvaluation {
  pffGrade: string; // e.g., "A-", "B+"
  pffPercentile: number;
  clubGrade: string;
  confidence: number; // 1-3
  evidence: EvaluationChip[];
}

/**
 * Calculate tier delta between club grade and PFF grade
 */
export function calculateProspectTierDelta(evaluation: ProspectEvaluation): number {
  const gradeToTier = (grade: string): number => {
    const map: Record<string, number> = {
      "A+": 13,
      A: 12,
      "A-": 11,
      "B+": 10,
      B: 9,
      "B-": 8,
      "C+": 7,
      C: 6,
      "C-": 5,
      "D+": 4,
      D: 3,
      "D-": 2,
      F: 1,
    };
    return map[grade.toUpperCase()] || 6;
  };

  return gradeToTier(evaluation.clubGrade) - gradeToTier(evaluation.pffGrade);
}

/**
 * Get tier delta description
 */
export function getProspectTierDeltaDescription(evaluation: ProspectEvaluation): string {
  const delta = calculateProspectTierDelta(evaluation);
  if (delta === 0) return "Same Tier";
  if (delta === 1 || delta === -1) {
    return delta > 0 ? "+1 Tier" : "-1 Tier";
  }
  return delta > 0 ? `+${delta} Tiers` : `${delta} Tiers`;
}

/**
 * Check if club rates player higher than PFF
 */
export function clubRatesHigher(evaluation: ProspectEvaluation): boolean {
  return calculateProspectTierDelta(evaluation) > 0;
}

// ============================================================================
// PLAYER ENUM - STATUS
// ============================================================================

export enum PlayerStatus {
  ACTIVE = "Active",
  FREE_AGENT = "Free Agent",
  PRACTICE_SQUAD = "Practice Squad",
  INJURED_RESERVE = "Injured Reserve",
  INJURED = "Injured",
  RETIRED = "Retired",
  DRAFT_PROSPECT = "Draft Prospect",
  SUSPENDED = "Suspended",
}

/**
 * Check if player status allows playing
 */
export function canPlayerPlay(status: PlayerStatus): boolean {
  return status === PlayerStatus.ACTIVE;
}

/**
 * Check if player status counts against roster
 */
export function playerStatusCountsAgainstRoster(status: PlayerStatus): boolean {
  return [PlayerStatus.ACTIVE, PlayerStatus.INJURED].includes(status);
}

/**
 * Get display color for player status
 */
export function getPlayerStatusColor(status: PlayerStatus): string {
  const colors: Record<PlayerStatus, string> = {
    [PlayerStatus.ACTIVE]: "#52C41A",
    [PlayerStatus.FREE_AGENT]: "#1890FF",
    [PlayerStatus.PRACTICE_SQUAD]: "#722ED1",
    [PlayerStatus.INJURED_RESERVE]: "#F5222D",
    [PlayerStatus.INJURED]: "#FA8C16",
    [PlayerStatus.RETIRED]: "#8C8C8C",
    [PlayerStatus.DRAFT_PROSPECT]: "#13C2C2",
    [PlayerStatus.SUSPENDED]: "#EB2F96",
  };
  return colors[status];
}

// ============================================================================
// PLAYER INTERFACE
// ============================================================================

export interface Player {
  id: string;

  // Basic Info
  firstName: string;
  lastName: string;
  position: Position;
  jerseyNumber: number;
  age: number;
  height: string; // e.g., "6'1\""
  weight: number;
  birthDate: Date;
  college: string;
  draftYear: number;
  draftRound?: number;
  draftPick?: number;

  // Team Info
  teamId?: string;
  status: PlayerStatus;

  // Ratings & Attributes
  overall: number;
  potential: number;
  attributes: PlayerAttributes;

  // Career Stats
  currentSeasonStats: PlayerStats;
  careerTotalStats: PlayerStats;
  gameLog: Record<number, PlayerStats>; // Week -> Stats
  seasonHistory: Record<number, PlayerStats>; // Season Year -> Stats
  careerStats: Record<string, number>; // Legacy
  seasonStats: Record<string, number>; // Legacy

  // Personal
  personality: PlayerPersonality;
  injuryStatus: InjuryStatus;
  morale: number; // 0-100
  fatigue: number; // 0-100
  depthChart?: PlayerDepthChart;

  // Contract
  contract?: PlayerContract;

  // Development
  experiencePoints: number;
  developmentFocus?: string;

  // PRD v5.0: Preseason Analytics
  preseasonStats?: PlayerStats;
  preseasonRating?: number; // 0-10
  accruedSeasons: number;
  weeksOnIR: number;
  isProtectedOnPS: boolean;
  irPlacementWeek?: number;

  // Trade Drama System
  tradeRequestState: string; // TradeRequestState enum
  shoppingStatus: string; // ShoppingStatus enum
  tradeRequestWeek?: number;
  tradeRequestReason?: string;
  isAwareOfShopping: boolean;
  preferredDestinations: string[]; // Team UUIDs
  blockedDestinations: string[]; // Team UUIDs

  // Draft Prospect Evaluation
  prospectEvaluation?: ProspectEvaluation;
}

// ============================================================================
// PLAYER COMPUTED PROPERTIES & UTILITY FUNCTIONS
// ============================================================================

/**
 * Get full name (first + last)
 */
export function getPlayerFullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`;
}

/**
 * Get display name (First Initial + Last Name)
 */
export function getPlayerDisplayName(player: Player): string {
  return `${player.firstName.charAt(0)}. ${player.lastName}`;
}

/**
 * Get position group (QB, RB, PASS, OL, DL, LB, DB, ST)
 */
export function getPlayerPositionGroup(player: Player): string {
  switch (player.position) {
    case Position.QB:
      return "QB";
    case Position.RB:
      return "RB";
    case Position.WR:
    case Position.TE:
      return "PASS";
    case Position.OL:
      return "OL";
    case Position.DL:
      return "DL";
    case Position.LB:
      return "LB";
    case Position.CB:
    case Position.S:
      return "DB";
    case Position.K:
    case Position.P:
      return "ST";
  }
}

/**
 * Check if player is a starter
 */
export function isPlayerStarter(player: Player): boolean {
  return player.depthChart?.depth === 1;
}

/**
 * Calculate market value for a player
 * Uses position multipliers, age adjustments, and market demand
 */
export function calculatePlayerMarketValue(player: Player): number {
  const baseValue = 500_000.0;
  const overallMultiplier = Math.pow(player.overall / 60.0, 5.0);
  const positionMultiplier = getPositionMarketMultiplier(player.position);

  let contractValue = baseValue * overallMultiplier * positionMultiplier;

  // Age adjustments
  if (player.age < 27) {
    contractValue *= 1.2; // Young player premium
  } else if (player.age > 32) {
    contractValue *= 0.7; // Veteran discount
  }

  // Market competition adjustment
  const scarcity = getPositionScarcity(player.position);
  const quality = player.overall / 100.0;
  const ageDesirability = 1.0 - ((player.age - 22) / 15.0);

  const marketDemand = scarcity * quality * ageDesirability;
  const competitionMultiplier = 0.8 + marketDemand * 0.4; // Range: 0.8 to 1.2

  return contractValue * competitionMultiplier;
}

/**
 * Calculate development rate
 */
export function calculatePlayerDevelopmentRate(player: Player): number {
  const ageFactor = player.age < 25 ? 1.5 : player.age < 30 ? 1.0 : 0.5;
  const potentialFactor = (player.potential - player.overall) / 20.0;
  const workEthicFactor = player.personality.workEthic / 100.0;

  return ageFactor * potentialFactor * workEthicFactor;
}

/**
 * Check if player is elite (90+ overall)
 */
export function isPlayerElite(player: Player): boolean {
  return player.overall >= 90;
}

/**
 * Check if player is franchise player
 */
export function isPlayerFranchisePlayer(player: Player): boolean {
  return player.overall >= 88 && player.age < 32;
}

/**
 * Get contract years remaining
 */
export function getPlayerContractYearsRemaining(player: Player): number {
  return player.contract?.yearsRemaining ?? 0;
}

/**
 * Check if player has expiring contract
 */
export function playerHasExpiringContract(player: Player): boolean {
  return getPlayerContractYearsRemaining(player) === 0;
}

/**
 * Get contract status display string
 */
export function getPlayerContractStatusDisplay(player: Player): string {
  if (playerHasExpiringContract(player)) {
    return "Expiring (FA after season)";
  }
  const years = getPlayerContractYearsRemaining(player);
  if (years === 1) {
    return "1 year remaining";
  }
  return `${years} years remaining`;
}

/**
 * Get player cap hit
 */
export function getPlayerCapHit(player: Player): number {
  return player.contract?.currentYearCap ?? 0;
}

/**
 * Check if player is rookie
 */
export function isPlayerRookie(player: Player): boolean {
  const currentYear = new Date().getFullYear();
  return currentYear - player.draftYear < 2;
}

/**
 * Check if player is PS eligible (≤3 accrued seasons)
 */
export function isPlayerPracticeSquadEligible(player: Player): boolean {
  return player.accruedSeasons <= 3;
}

/**
 * Check if player can activate from IR (4+ weeks on IR)
 */
export function canPlayerActivateFromIR(player: Player): boolean {
  return player.status === PlayerStatus.INJURED_RESERVE && player.weeksOnIR >= 4;
}

/**
 * Check if player is preseason standout (PPR ≥ 7.0 but OVR < 75)
 */
export function isPlayerPreseasonStandout(player: Player): boolean {
  return (player.preseasonRating ?? 0) >= 7.0 && player.overall < 75;
}

/**
 * Check if player is requesting trade
 */
export function isPlayerRequestingTrade(player: Player): boolean {
  return player.tradeRequestState !== "None";
}

/**
 * Check if player has public trade request
 */
export function playerHasPublicTradeRequest(player: Player): boolean {
  return player.tradeRequestState === "Public Demand";
}

/**
 * Check if player is being shopped
 */
export function isPlayerBeingShopped(player: Player): boolean {
  return player.shoppingStatus !== "Off Block";
}

/**
 * Check if player is causing locker room drama
 */
export function isPlayerCausingDrama(player: Player): boolean {
  return (
    playerHasPublicTradeRequest(player) ||
    (isPlayerRequestingTrade(player) && player.shoppingStatus === "Off Block")
  );
}

/**
 * Check if trade to team would be blocked by player preferences
 */
export function wouldPlayerVetoTrade(player: Player, toTeamId: string): boolean {
  // Check NTC
  if (player.contract) {
    const { wouldNTCBlockTrade } = require("./nfl-types");
    if (wouldNTCBlockTrade(player.contract, toTeamId)) {
      return true;
    }
  }

  // Check blocked destinations
  return player.blockedDestinations.includes(toTeamId);
}

/**
 * Get trade status summary for UI
 */
export function getPlayerTradeStatusSummary(player: Player): string {
  if (player.tradeRequestState === "Public Demand") {
    return "🔥 PUBLIC TRADE DEMAND";
  } else if (player.tradeRequestState === "Formal Request") {
    return "⚠️ Formal Trade Request";
  } else if (player.tradeRequestState === "Private Rumblings") {
    return "💭 Unhappy (Private)";
  } else if (player.shoppingStatus === "On The Block") {
    return "📢 On Trade Block";
  } else if (player.shoppingStatus === "Quiet Shopping") {
    return "🤫 Quietly Available";
  }
  return "";
}

// ============================================================================
// CALCULATE OVERALL RATING FROM ATTRIBUTES
// ============================================================================

/**
 * Calculate position-specific overall rating from player attributes
 * Uses weighted combinations of relevant attributes for each position
 * Does NOT apply potential ceiling - caller should clamp if needed
 *
 * Parameters: attributes - PlayerAttributes for the player, position - The player's position
 * Returns: Overall rating as integer (typically 1-99)
 */
export function calculateOverallFromAttributes(
  attributes: PlayerAttributes,
  position: Position
): number {
  switch (position) {
    case Position.QB: {
      const accuracy =
        (attributes.shortAccuracy + attributes.mediumAccuracy + attributes.deepAccuracy) /
        3;
      const physical =
        (attributes.throwPower + attributes.speed + attributes.agility) / 3;
      const mental = (attributes.awareness + attributes.playRecognition) / 2;
      return Math.round((accuracy * 4 + physical * 2 + mental * 4) / 10);
    }

    case Position.RB: {
      const running =
        (attributes.speed +
          attributes.acceleration +
          attributes.agility +
          attributes.carrying) /
        4;
      const power = (attributes.trucking + attributes.stiffArm) / 2;
      const receiving = attributes.catching;
      return Math.round((running * 5 + power * 3 + receiving * 2) / 10);
    }

    case Position.WR: {
      const route =
        (attributes.shortRouteRunning +
          attributes.mediumRouteRunning +
          attributes.deepRouteRunning) /
        3;
      const hands =
        (attributes.catching + attributes.catchInTraffic + attributes.spectacularCatch) /
        3;
      const physical = (attributes.speed + attributes.agility + attributes.jumping) / 3;
      return Math.round((route * 4 + hands * 4 + physical * 2) / 10);
    }

    case Position.TE: {
      const receiving =
        (attributes.catching + attributes.catchInTraffic) / 2;
      const blocking = (attributes.runBlock + attributes.passBlock) / 2;
      const physical = (attributes.strength + attributes.speed) / 2;
      return Math.round((receiving * 4 + blocking * 3 + physical * 3) / 10);
    }

    case Position.OL: {
      const blocking =
        (attributes.runBlock + attributes.passBlock + attributes.impactBlocking) / 3;
      const physical = (attributes.strength + attributes.awareness) / 2;
      return Math.round((blocking * 7 + physical * 3) / 10);
    }

    case Position.DL: {
      const rush =
        (attributes.speed + attributes.acceleration + attributes.strength) / 3;
      const technique = (attributes.blockShedding + attributes.tackle) / 2;
      return Math.round((rush * 5 + technique * 5) / 10);
    }

    case Position.LB: {
      const coverage = (attributes.manCoverage + attributes.zoneCoverage) / 2;
      const physical =
        (attributes.speed + attributes.tackle + attributes.hitPower) / 3;
      const mental =
        (attributes.playRecognitionDef + attributes.pursuit) / 2;
      return Math.round((coverage * 3 + physical * 4 + mental * 3) / 10);
    }

    case Position.CB: {
      const coverage =
        (attributes.manCoverage + attributes.zoneCoverage + attributes.press) / 3;
      const physical = (attributes.speed + attributes.agility + attributes.jumping) / 3;
      return Math.round((coverage * 6 + physical * 4) / 10);
    }

    case Position.S: {
      const coverage = (attributes.manCoverage + attributes.zoneCoverage) / 2;
      const physical =
        (attributes.speed + attributes.hitPower + attributes.tackle) / 3;
      const mental = attributes.playRecognitionDef;
      return Math.round((coverage * 4 + physical * 4 + mental * 2) / 10);
    }

    case Position.K:
      return Math.round(
        (attributes.kickPower + attributes.kickAccuracy * 2) / 3
      );

    case Position.P:
      return Math.round(
        (attributes.puntPower + attributes.puntAccuracy * 2) / 3
      );
  }
}

// ============================================================================
// PRESEASON RATING (PPR) CALCULATION
// ============================================================================

/**
 * Calculate Preseason Performance Rating (0.0-10.0) from preseason stats
 * Position-specific formula normalizing performance to 0-10 scale
 * Complex logic: Each position has unique calculation based on relevant stats
 *
 * Parameters: position - Player position, stats - PlayerStats to analyze
 * Returns: PPR rating 0-10, or null if insufficient data
 */
export function calculatePreseasonRating(
  position: Position,
  stats: PlayerStats
): number | null {
  if (stats.gamesPlayed === 0) {
    return null;
  }

  let rawRating: number;

  switch (position) {
    case Position.QB: {
      // QB Rating: completion %, TD/INT ratio, yards/attempt
      const compPct = stats.attempts > 0 ? stats.completions / stats.attempts : 0;
      const tdIntRatio =
        stats.interceptions > 0
          ? stats.passingTDs / stats.interceptions
          : stats.passingTDs + 1;
      const ypa =
        stats.attempts > 0 ? stats.passingYards / stats.attempts : 0;
      rawRating = compPct * 4.0 + Math.min(tdIntRatio, 3.0) + Math.min(ypa / 10.0, 2.0);
      break;
    }

    case Position.RB: {
      // RB Rating: YPC, TDs, receptions
      const ypc =
        stats.rushingAttempts > 0
          ? stats.rushingYards / stats.rushingAttempts
          : 0;
      const tds = stats.rushingTDs + stats.receivingTDs;
      const receptions = stats.receptions;
      rawRating =
        Math.min(ypc, 6.0) + Math.min(tds * 2.0, 4.0) + Math.min(receptions / 5.0, 2.0);
      break;
    }

    case Position.WR:
    case Position.TE: {
      // Receiver Rating: yards/reception, catch rate, TDs
      const ypr = stats.receptions > 0 ? stats.receivingYards / stats.receptions : 0;
      const catchRate = stats.targets > 0 ? stats.receptions / stats.targets : 0;
      const tds = stats.receivingTDs;
      rawRating =
        Math.min((ypr / 15.0) * 4.0, 4.0) +
        catchRate * 3.0 +
        Math.min(tds * 1.5, 3.0);
      break;
    }

    case Position.OL: {
      // OL Rating: sacks allowed (negative), pancakes
      const sacksAllowedPenalty = Math.min(stats.sacksAllowed * 1.5, 5.0);
      const pancakeBonus = Math.min(stats.pancakeBlocks / 2.0, 3.0);
      rawRating = Math.max(0, 7.0 - sacksAllowedPenalty + pancakeBonus);
      break;
    }

    case Position.DL:
    case Position.LB: {
      // Defensive Rating: tackles, sacks, TFL
      const tacklePoints = Math.min(stats.tackles / 10.0, 3.0);
      const sackPoints = Math.min(stats.sacks * 2.0, 4.0);
      const tflPoints = Math.min(stats.tacklesForLoss / 2.0, 2.0);
      const bigPlayPoints = Math.min(
        (stats.forcedFumbles + stats.interceptionsDef) * 1.5,
        2.0
      );
      rawRating = tacklePoints + sackPoints + tflPoints + bigPlayPoints;
      break;
    }

    case Position.CB:
    case Position.S: {
      // DB Rating: passes defended, INTs, tackles
      const pdPoints = Math.min(stats.passesDefended / 2.0, 3.0);
      const intPoints = Math.min(stats.interceptionsDef * 2.5, 5.0);
      const tacklePoints = Math.min(stats.tackles / 8.0, 2.0);
      rawRating = pdPoints + intPoints + tacklePoints;
      break;
    }

    case Position.K: {
      // Kicker Rating: FG%
      const fgPct =
        stats.fieldGoalsAttempted > 0
          ? stats.fieldGoalsMade / stats.fieldGoalsAttempted
          : 0;
      rawRating = fgPct * 10.0;
      break;
    }

    case Position.P: {
      // Punter Rating: average and inside-20
      const avg = stats.punts > 0 ? stats.puntYards / stats.punts : 0;
      const i20Rate = stats.punts > 0 ? stats.puntsInside20 / stats.punts : 0;
      rawRating = Math.min((avg / 45.0) * 5.0, 5.0) + i20Rate * 5.0;
      break;
    }
  }

  // Normalize to 0.0 - 10.0 range
  return Math.min(Math.max(rawRating, 0.0), 10.0);
}

// ============================================================================
// HELPER FUNCTIONS FOR PLAYER ACTIONS
// ============================================================================

/**
 * Create a player object with default values
 */
export function createPlayer(
  firstName: string,
  lastName: string,
  position: Position,
  options?: Partial<Player>
): Player {
  return {
    id: Math.random().toString(36).substr(2, 9),
    firstName,
    lastName,
    position,
    jerseyNumber: options?.jerseyNumber ?? 0,
    age: options?.age ?? 22,
    height: options?.height ?? "6'0\"",
    weight: options?.weight ?? 200,
    birthDate: options?.birthDate ?? new Date(),
    college: options?.college ?? "",
    draftYear: options?.draftYear ?? 0,
    draftRound: options?.draftRound,
    draftPick: options?.draftPick,
    teamId: options?.teamId,
    status: options?.status ?? PlayerStatus.FREE_AGENT,
    overall: options?.overall ?? 70,
    potential: options?.potential ?? 80,
    attributes: options?.attributes ?? createEmptyPlayerAttributes(),
    currentSeasonStats: options?.currentSeasonStats ?? createEmptyPlayerStats(),
    careerTotalStats: options?.careerTotalStats ?? createEmptyPlayerStats(),
    gameLog: options?.gameLog ?? {},
    seasonHistory: options?.seasonHistory ?? {},
    careerStats: options?.careerStats ?? {},
    seasonStats: options?.seasonStats ?? {},
    personality: options?.personality ?? createRandomPlayerPersonality(),
    injuryStatus: options?.injuryStatus ?? InjuryStatus.HEALTHY,
    morale: options?.morale ?? 75,
    fatigue: options?.fatigue ?? 0,
    depthChart: options?.depthChart,
    contract: options?.contract,
    experiencePoints: options?.experiencePoints ?? 0,
    developmentFocus: options?.developmentFocus,
    preseasonStats: options?.preseasonStats,
    preseasonRating: options?.preseasonRating,
    accruedSeasons: options?.accruedSeasons ?? 0,
    weeksOnIR: options?.weeksOnIR ?? 0,
    isProtectedOnPS: options?.isProtectedOnPS ?? false,
    irPlacementWeek: options?.irPlacementWeek,
    tradeRequestState: options?.tradeRequestState ?? "None",
    shoppingStatus: options?.shoppingStatus ?? "Off Block",
    tradeRequestWeek: options?.tradeRequestWeek,
    tradeRequestReason: options?.tradeRequestReason,
    isAwareOfShopping: options?.isAwareOfShopping ?? false,
    preferredDestinations: options?.preferredDestinations ?? [],
    blockedDestinations: options?.blockedDestinations ?? [],
    prospectEvaluation: options?.prospectEvaluation,
  };
}

/**
 * Generate a rookie player
 */
export function generateRookiePlayer(
  position: Position,
  draftRound: number
): Player {
  const overall = 85 - draftRound * 5 + Math.floor(Math.random() * 11) - 5;
  const potential = overall + Math.floor(Math.random() * 16) + 5;

  const { NameGenerator } = require("./nfl-types");
  const nameGen = NameGenerator.getInstance();

  return createPlayer(
    nameGen.firstName(),
    nameGen.lastName(),
    position,
    {
      age: 21 + Math.floor(Math.random() * 3),
      college: nameGen.college(),
      draftRound,
      overall: Math.max(1, overall),
      potential: Math.min(99, potential),
      attributes: createEmptyPlayerAttributes(),
      personality: createRandomPlayerPersonality(),
    }
  );
}

/**
 * Generate a free agent player
 */
export function generateFreeAgentPlayer(position: Position): Player {
  const age = 24 + Math.floor(Math.random() * 11);
  const overall = 65 + Math.floor(Math.random() * 21);

  const { NameGenerator } = require("./nfl-types");
  const nameGen = NameGenerator.getInstance();

  return createPlayer(
    nameGen.firstName(),
    nameGen.lastName(),
    position,
    {
      age,
      status: PlayerStatus.FREE_AGENT,
      overall,
      potential: overall + Math.floor(Math.random() * 11) - 5,
    }
  );
}
