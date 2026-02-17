/**
 * In-Season Trade System
 * Converted from Swift InSeasonTradeSystem.swift
 * Comprehensive trade management with franchise state analysis, NTC enforcement, and player personalities
 */

import { Position } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team } from "./team";

// ============================================================================
// TRADE SYSTEM CONSTANTS
// ============================================================================

/** Trade deadline is Week 39 (approximately Week 8 of the regular season) */
export const TRADE_SYSTEM_DEADLINE_WEEK = 39;

// ============================================================================
// FRANCHISE STATE & TIER SYSTEM
// ============================================================================

export enum FranchiseTier {
  CONTENDER = "Contender (Window Open)",
  REBUILDER = "Rebuilder (Tank Mode)",
  PURGATORY = "Purgatory (Desperate)",
  HOARDER = "Hoarder (Draft Capital)",
  MEDIOCRE = "Mediocre",
}

export interface FranchiseState {
  tier: FranchiseTier;
  winPercentage: number;
  squadStrength: number; // Average overall rating of roster
  averageAge: number;
  capSpace: number;
  draftCapital: number; // Count of draft picks
  desperation: number; // 0.0 to 1.0 scale
}

/**
 * Analyze team's franchise state based on multiple factors
 */
export function analyzeFranchiseState(
  team: Team,
  allPlayers: Player[],
  currentWeek: number
): FranchiseState {
  const record = getTeamRecord(team, currentWeek);
  const winPercentage =
    record.wins > 0 ? record.wins / (record.wins + record.losses) : 0;

  const squadStrength = calculateSquadStrength(team, allPlayers);
  const averageAge = calculateAverageAge(team, allPlayers);
  const draftCapital = countDraftPicks(team);

  // Determine tier
  if (winPercentage >= 0.65 && squadStrength >= 80) {
    return {
      tier: FranchiseTier.CONTENDER,
      winPercentage,
      squadStrength,
      averageAge,
      capSpace: team.capSpace,
      draftCapital,
      desperation: 0.3,
    };
  }

  if (winPercentage <= 0.35 && (averageAge > 28 || squadStrength < 70)) {
    return {
      tier: FranchiseTier.REBUILDER,
      winPercentage,
      squadStrength,
      averageAge,
      capSpace: team.capSpace,
      draftCapital,
      desperation: 0.1,
    };
  }

  if (
    winPercentage < 0.45 &&
    team.capSpace < 10_000_000 &&
    draftCapital < 7 &&
    squadStrength < 75
  ) {
    return {
      tier: FranchiseTier.PURGATORY,
      winPercentage,
      squadStrength,
      averageAge,
      capSpace: team.capSpace,
      draftCapital,
      desperation: 0.9, // High desperation!
    };
  }

  if (averageAge < 26 && draftCapital > 9) {
    return {
      tier: FranchiseTier.HOARDER,
      winPercentage,
      squadStrength,
      averageAge,
      capSpace: team.capSpace,
      draftCapital,
      desperation: 0.2,
    };
  }

  // Mediocre
  return {
    tier: FranchiseTier.MEDIOCRE,
    winPercentage,
    squadStrength,
    averageAge,
    capSpace: team.capSpace,
    draftCapital,
    desperation: 0.5,
  };
}

/**
 * Get franchise state trade modifier
 * Affects how much they value players vs picks
 */
export function getFranchiseStateModifier(
  state: FranchiseState,
  isBuying: boolean
): number {
  switch (state.tier) {
    case FranchiseTier.CONTENDER:
      return isBuying ? 1.3 : 0.7; // Overvalue players, undervalue picks
    case FranchiseTier.REBUILDER:
      return isBuying ? 0.7 : 1.3; // Undervalue players, overvalue picks
    case FranchiseTier.PURGATORY:
      return isBuying ? 1.5 : 0.6; // Desperate - terrible trades
    case FranchiseTier.HOARDER:
      return isBuying ? 0.8 : 1.2; // Only want young players and picks
    case FranchiseTier.MEDIOCRE:
      return 1.0; // Neutral
  }
}

// ============================================================================
// TRADE OFFER MODELS
// ============================================================================

export enum OfferStatus {
  PENDING = "Pending",
  ACCEPTED = "Accepted",
  REJECTED = "Rejected",
  WITHDRAWN = "Withdrawn",
}

export interface TradePick {
  year: number;
  round: number;
  originalTeamId: string;
  currentTeamId: string;
}

export interface UnifiedTradeOffer {
  id: string;
  offeringTeamId: string;
  receivingTeamId: string;
  offeringPlayers: string[]; // Player IDs
  offeringPicks: TradePick[];
  receivingPlayers: string[]; // Player IDs
  receivingPicks: TradePick[];
  status: OfferStatus;
  timestamp: Date;
  timeSubmitted?: number; // Unix timestamp
}

export interface TradeEvaluation {
  isAcceptable: boolean;
  reason: string;
  fairnessScore: number;
  offeringValue?: number;
  receivingValue?: number;
  ntcBlocked?: boolean;
  ntcPlayer?: Player;
  ntcWaiveChance?: number;
  requiresNTCWaiver?: boolean;
}

export interface NTCWaiverResult {
  waived: boolean;
  reason: string;
  player: Player;
  waiveChance?: number;
}

export interface TradeRumor {
  id: string;
  playerId: string;
  playerName: string;
  interestedTeamIds: string[];
  likelihood: number;
}

// ============================================================================
// TRADE EVALUATION LOGIC
// ============================================================================

/**
 * Evaluate if a trade should be accepted
 * Checks value parity, NTC clauses, and player personalities
 */
export function evaluateTrade(
  offer: UnifiedTradeOffer,
  allTeams: Team[],
  allPlayers: Player[],
  currentWeek: number
): TradeEvaluation {
  // Guard: Reject all trades after deadline
  if (currentWeek > TRADE_SYSTEM_DEADLINE_WEEK) {
    return {
      isAcceptable: false,
      reason: `Trade deadline has passed (Week ${TRADE_SYSTEM_DEADLINE_WEEK})`,
      fairnessScore: 0,
    };
  }

  const offeringTeam = allTeams.find((t) => t.id === offer.offeringTeamId);
  const receivingTeam = allTeams.find((t) => t.id === offer.receivingTeamId);

  if (!offeringTeam || !receivingTeam) {
    return {
      isAcceptable: false,
      reason: "Invalid teams",
      fairnessScore: 0,
    };
  }

  const offeringState = analyzeFranchiseState(offeringTeam, allPlayers, currentWeek);
  const receivingState = analyzeFranchiseState(receivingTeam, allPlayers, currentWeek);

  // Calculate value for both sides
  const offeringValue = calculateOfferValue(
    offer.offeringPlayers,
    offer.offeringPicks,
    offeringTeam,
    allPlayers,
    currentWeek
  );
  const receivingValue = calculateOfferValue(
    offer.receivingPlayers,
    offer.receivingPicks,
    receivingTeam,
    allPlayers,
    currentWeek
  );

  // Apply franchise state modifiers
  const offeringModifier = getFranchiseStateModifier(offeringState, false);
  const receivingModifier = getFranchiseStateModifier(receivingState, true);

  const adjustedOfferingValue = offeringValue * offeringModifier;
  const adjustedReceivingValue = receivingValue * receivingModifier;

  // Check player personalities for rejections
  for (const playerId of offer.receivingPlayers) {
    const player = allPlayers.find((p) => p.id === playerId);
    if (player) {
      const rejection = checkPlayerRejection(player, receivingTeam, allPlayers, currentWeek);
      if (rejection) {
        return {
          isAcceptable: false,
          reason: rejection,
          fairnessScore: 0,
        };
      }
    }
  }

  // Check No-Trade Clauses and blocked destinations
  for (const playerId of offer.offeringPlayers) {
    const player = allPlayers.find((p) => p.id === playerId);
    if (player) {
      const ntcResult = checkNoTradeClause(player, offer.receivingTeamId);
      if (ntcResult) {
        return {
          isAcceptable: false,
          reason: ntcResult.reason,
          fairnessScore: 0,
          ntcBlocked: true,
          ntcPlayer: player,
          requiresNTCWaiver: ntcResult.waiveChance > 0,
        };
      }

      if (
        player.contract?.approvedTradeDestinations &&
        !player.contract.approvedTradeDestinations.includes(offer.receivingTeamId)
      ) {
        return {
          isAcceptable: false,
          reason: `${player.firstName} ${player.lastName} refuses to be traded to this team`,
          fairnessScore: 0,
        };
      }
    }
  }

  for (const playerId of offer.receivingPlayers) {
    const player = allPlayers.find((p) => p.id === playerId);
    if (player) {
      const ntcResult = checkNoTradeClause(player, offer.offeringTeamId);
      if (ntcResult) {
        return {
          isAcceptable: false,
          reason: ntcResult.reason,
          fairnessScore: 0,
          ntcBlocked: true,
          ntcPlayer: player,
          requiresNTCWaiver: ntcResult.waiveChance > 0,
        };
      }

      if (
        player.contract?.approvedTradeDestinations &&
        !player.contract.approvedTradeDestinations.includes(offer.offeringTeamId)
      ) {
        return {
          isAcceptable: false,
          reason: `${player.firstName} ${player.lastName} refuses to be traded to this team`,
          fairnessScore: 0,
        };
      }
    }
  }

  // Calculate fairness
  const fairness =
    Math.min(adjustedOfferingValue, adjustedReceivingValue) /
    Math.max(adjustedOfferingValue, adjustedReceivingValue);
  const isAcceptable = fairness >= 0.75; // Need at least 75% value parity

  return {
    isAcceptable,
    reason: isAcceptable ? "Trade accepted" : `Uneven value (${Math.round(fairness * 100)}% fair)`,
    fairnessScore: fairness,
    offeringValue: adjustedOfferingValue,
    receivingValue: adjustedReceivingValue,
  };
}

// ============================================================================
// NO-TRADE CLAUSE ENFORCEMENT
// ============================================================================

export interface NTCCheckResult {
  isBlocked: boolean;
  reason: string;
  waiveChance: number;
  player: Player;
}

/**
 * Check if a player's No-Trade Clause blocks a trade
 */
export function checkNoTradeClause(
  player: Player,
  toTeamId: string
): NTCCheckResult | null {
  const contract = player.contract;
  if (!contract || !contract.hasNoTradeClause) {
    return null; // No NTC, trade allowed
  }

  // Check if this team is on the approved list
  if (
    contract.approvedTradeDestinations &&
    !contract.approvedTradeDestinations.includes(toTeamId)
  ) {
    // NTC blocks this trade - calculate waive chance
    const waiveChance = calculateNTCWaiveChance(player, toTeamId);

    return {
      isBlocked: true,
      reason: `${player.firstName} ${player.lastName} has a No-Trade Clause and can veto this trade`,
      waiveChance,
      player,
    };
  }

  return null; // Trade to approved destination, no block
}

/**
 * Calculate probability player will waive their NTC for a specific trade
 */
export function calculateNTCWaiveChance(player: Player, toTeamId: string): number {
  // Base chance depends on player personality
  let waiveChance = 0.3; // 30% base

  // Loyalty affects NTC waiver
  if (player.personality && player.personality.loyalty > 70) {
    waiveChance *= 0.5; // Very loyal players less likely to waive
  }

  // Motivation affects willingness
  if (player.personality && player.personality.motivation > 80) {
    waiveChance *= 1.3; // Motivated players more likely to go places
  }

  // Age factor
  if (player.age > 32) {
    waiveChance *= 1.2; // Older players more willing to chase rings
  }

  // Clamp to valid range
  return Math.min(0.9, Math.max(0.1, waiveChance));
}

/**
 * Request player to waive their NTC for a specific trade
 */
export function requestNTCWaiver(
  player: Player,
  toTeamId: string,
  allTeams: Team[]
): NTCWaiverResult {
  const contract = player.contract;
  if (!contract || !contract.hasNoTradeClause) {
    return {
      waived: true,
      reason: "No NTC to waive",
      player,
    };
  }

  const destinationTeam = allTeams.find((t) => t.id === toTeamId);
  if (!destinationTeam) {
    return {
      waived: false,
      reason: "Invalid destination team",
      player,
    };
  }

  const waiveChance = calculateNTCWaiveChance(player, toTeamId);
  const roll = Math.random();

  if (roll < waiveChance) {
    // Player agrees to waive NTC
    return {
      waived: true,
      reason: `${player.firstName} ${player.lastName} has agreed to waive their No-Trade Clause`,
      player,
      waiveChance,
    };
  }

  // Player vetoes the trade
  const vetoReason = generateNTCVetoReason(player, destinationTeam);
  return {
    waived: false,
    reason: vetoReason,
    player,
    waiveChance,
  };
}

/**
 * Generate personalized NTC veto reason based on player personality
 */
export function generateNTCVetoReason(player: Player, team: Team): string {
  if (team.fanBase.marketSize === "Small") {
    return `${player.firstName} ${player.lastName} vetoed the trade: "I've earned the right to play in a bigger market."`;
  }

  if (player.personality && player.personality.loyalty > 70) {
    return `${player.firstName} ${player.lastName} vetoed the trade: "This team gave me my start. I'm not leaving."`;
  }

  return `${player.firstName} ${player.lastName} vetoed the trade: "That's not the right fit for me and my family."`;
}

// ============================================================================
// TRADE DRAMA MODIFIERS
// ============================================================================

export enum TradePersonalityArchetype {
  RING_CHASER = "Ring Chaser",
  MERCENARY = "Mercenary",
  LOYALIST = "Loyalist",
}

/**
 * Determine player's trade personality archetype
 */
export function getPlayerArchetype(player: Player): TradePersonalityArchetype {
  if (player.age >= 30 && player.overall >= 85) {
    return TradePersonalityArchetype.RING_CHASER; // Old star wants a ring
  }

  if (
    player.personality &&
    player.personality.loyalty < 30 &&
    player.personality.ego > 70
  ) {
    return TradePersonalityArchetype.MERCENARY; // Low loyalty + high ego = money-driven
  }

  if (player.personality && player.personality.loyalty > 60) {
    return TradePersonalityArchetype.LOYALIST; // High loyalty player
  }

  return TradePersonalityArchetype.MERCENARY; // Default
}

/**
 * Check if player personality will reject a trade
 */
export function checkPlayerRejection(
  player: Player,
  toTeam: Team,
  allPlayers: Player[],
  currentWeek: number
): string | null {
  const archetype = getPlayerArchetype(player);

  if (archetype === TradePersonalityArchetype.RING_CHASER) {
    // Won't go to weak teams
    const toTeamState = calculateSquadStrength(toTeam, allPlayers);
    if (toTeamState < 80) {
      return `${player.firstName} ${player.lastName} refuses trade - Ring Chaser trait (team strength grade below B+)`;
    }
  }

  // Mercenaries and loyalists don't reject based on personality
  return null;
}

/**
 * Apply post-trade effects to a player (morale, personality impact)
 */
export function applyPostTradeEffects(
  player: Player,
  toTeam: Team
): Player {
  const archetype = getPlayerArchetype(player);
  let updated = { ...player };

  if (archetype === TradePersonalityArchetype.LOYALIST) {
    // Homesickness penalty
    updated.overall = Math.max(40, updated.overall - 5);
    updated.morale = Math.max(0, updated.morale - 30);
    // Would schedule recovery in 4 weeks in full game state
  }

  return updated;
}

/**
 * Apply trade drama modifiers based on trade request/shopping status
 */
export function applyTradeDramaModifiers(
  player: Player,
  baseValue: number
): number {
  let modifiedValue = baseValue;

  // Public trade demands reduce value
  if (player.tradeRequestState === "publicDemand") {
    modifiedValue *= 0.7; // 30% reduction
  } else if (player.tradeRequestState === "formalRequest") {
    modifiedValue *= 0.85; // 15% reduction
  } else if (player.tradeRequestState === "privateRumblings") {
    modifiedValue *= 0.95; // Minimal impact
  }

  return modifiedValue;
}

// ============================================================================
// TRADE VALUE CALCULATION
// ============================================================================

/**
 * Calculate total value of assets in a trade
 */
export function calculateOfferValue(
  playerIds: string[],
  picks: TradePick[],
  team: Team,
  allPlayers: Player[],
  currentWeek: number
): number {
  let totalValue = 0;

  // Player values
  for (const playerId of playerIds) {
    const player = allPlayers.find((p) => p.id === playerId);
    if (player) {
      totalValue += calculatePlayerTradeValue(player, team, allPlayers);
    }
  }

  // Pick values
  for (const pick of picks) {
    totalValue += calculatePickValue(pick, currentWeek);
  }

  return totalValue;
}

/**
 * Calculate market value of a player in a trade
 */
export function calculatePlayerTradeValue(
  player: Player,
  team: Team,
  allPlayers: Player[]
): number {
  let value = player.overall * 100;

  // Age factor
  if (player.age < 25) {
    value *= 1.2; // Young players more valuable
  } else if (player.age > 30) {
    value *= 0.7; // Older players less valuable
  }

  // Contract factor
  const yearsLeft = player.contract?.yearsRemaining ?? 0;
  if (yearsLeft <= 1) {
    value *= 0.6; // Expiring contracts less valuable
  }

  // Position need
  if (hasPositionalNeed(team, player.position, allPlayers)) {
    value *= 1.5; // Premium for position need
  }

  // Apply trade drama modifiers
  value = applyTradeDramaModifiers(player, value);

  return value;
}

/**
 * Calculate value of a draft pick
 */
export function calculatePickValue(pick: TradePick, currentWeek: number): number {
  // Base value by round
  const baseValues: Record<number, number> = {
    1: 5000,
    2: 2500,
    3: 1200,
    4: 600,
    5: 300,
    6: 150,
    7: 75,
  };

  const baseValue = baseValues[pick.round] ?? 50;

  // Adjust based on current week (can estimate draft position later in season)
  if (currentWeek >= 8) {
    // Rough estimate - would need actual team records
    // For now, return base value
    // In a real implementation, would look at team's current record
  }

  return baseValue;
}

// ============================================================================
// POSITION NEEDS & ROSTER ANALYSIS
// ============================================================================

/**
 * Check if team has a positional need for a specific position
 */
export function hasPositionalNeed(
  team: Team,
  position: Position,
  allPlayers: Player[]
): boolean {
  const roster = allPlayers.filter(
    (p) => p.teamId === team.id && p.position === position
  );
  const minRequired = getMinimumRequired(position);

  if (roster.length < minRequired) {
    return true; // Not enough players at position
  }

  const maxOverall = Math.max(...roster.map((p) => p.overall), 0);
  return maxOverall < 70; // All positions weak at this position
}

/**
 * Get minimum roster requirement for a position
 */
export function getMinimumRequired(position: Position): number {
  switch (position) {
    case "QB":
      return 2;
    case "RB":
      return 3;
    case "WR":
      return 5;
    case "TE":
      return 2;
    case "OL":
      return 7;
    case "DL":
      return 6;
    case "LB":
      return 5;
    case "CB":
      return 5;
    case "S":
      return 3;
    case "K":
    case "P":
      return 1;
    default:
      return 1;
  }
}

/**
 * Calculate desperation tax for team at specific positions
 */
export function calculateDesperationTax(
  team: Team,
  allPlayers: Player[]
): Record<Position, number> {
  const taxes: Record<Position, number> = {};
  const roster = allPlayers.filter((p) => p.teamId === team.id);

  const positions: Position[] = [
    "QB",
    "RB",
    "WR",
    "TE",
    "OL",
    "DL",
    "LB",
    "CB",
    "S",
    "K",
    "P",
  ];

  for (const position of positions) {
    const positionPlayers = roster.filter((p) => p.position === position);
    const averageOverall =
      positionPlayers.length > 0
        ? positionPlayers.map((p) => p.overall).reduce((a, b) => a + b, 0) /
          positionPlayers.length
        : 0;
    const minRequired = getMinimumRequired(position);

    if (positionPlayers.length < minRequired || averageOverall < 60) {
      // Desperate at this position
      const desperation = 1.0 - averageOverall / 100;
      taxes[position] = 1.0 + desperation * 0.5; // Up to 50% tax
    }
  }

  return taxes;
}

// ============================================================================
// TRADE DEADLINE MANAGEMENT
// ============================================================================

export interface TradeDeadlineState {
  isActive: boolean;
  timeRemaining: number; // In seconds
  onTheBlock: string[]; // Player IDs
  tradeRumors: TradeRumor[];
}

/**
 * Generate list of "on the block" players as deadline approaches
 */
export function generateBlockList(
  allTeams: Team[],
  allPlayers: Player[]
): string[] {
  const onTheBlock: string[] = [];

  for (const team of allTeams) {
    const state = analyzeFranchiseState(team, allPlayers, 0);

    if (
      state.tier === FranchiseTier.REBUILDER ||
      state.tier === FranchiseTier.PURGATORY
    ) {
      // Teams selling assets
      const roster = allPlayers.filter((p) => p.teamId === team.id);
      const tradeable = roster.filter((p) => p.overall >= 75 && p.age <= 32);

      if (tradeable.length > 0) {
        const randomPlayer = tradeable[Math.floor(Math.random() * tradeable.length)];
        onTheBlock.push(randomPlayer.id);
      }
    }
  }

  return onTheBlock;
}

/**
 * Generate trade rumors for star players
 */
export function generateTradeRumors(
  allTeams: Team[],
  allPlayers: Player[]
): TradeRumor[] {
  const rumors: TradeRumor[] = [];
  const stars = allPlayers.filter((p) => p.overall >= 88);

  for (const star of stars.slice(0, 5)) {
    const currentTeam = allTeams.find((t) => t.id === star.teamId);
    if (!currentTeam) continue;

    const state = analyzeFranchiseState(currentTeam, allPlayers, 0);

    if (
      state.tier === FranchiseTier.REBUILDER ||
      state.winPercentage < 0.3
    ) {
      // Generate rumor about this star
      const interestedTeams = allTeams
        .filter(
          (t) =>
            analyzeFranchiseState(t, allPlayers, 0).tier ===
            FranchiseTier.CONTENDER
        )
        .slice(0, 3)
        .map((t) => t.id);

      const rumor: TradeRumor = {
        id: Math.random().toString(36).substr(2, 9),
        playerId: star.id,
        playerName: `${star.firstName} ${star.lastName}`,
        interestedTeamIds: interestedTeams,
        likelihood: state.desperation,
      };

      rumors.push(rumor);
    }
  }

  return rumors;
}

// ============================================================================
// TRADE EXECUTION
// ============================================================================

export interface ExecuteTradeResult {
  success: boolean;
  updatedTeams?: Team[];
  updatedPlayers?: Player[];
  message: string;
}

/**
 * Execute a trade, transferring players and picks
 */
export function executeTrade(
  offer: UnifiedTradeOffer,
  teams: Team[],
  players: Player[]
): ExecuteTradeResult {
  const offeringTeam = teams.find((t) => t.id === offer.offeringTeamId);
  const receivingTeam = teams.find((t) => t.id === offer.receivingTeamId);

  if (!offeringTeam || !receivingTeam) {
    return {
      success: false,
      message: "Invalid teams",
    };
  }

  let updatedPlayers = [...players];

  // Transfer offering players to receiving team
  for (const playerId of offer.offeringPlayers) {
    const index = updatedPlayers.findIndex((p) => p.id === playerId);
    if (index >= 0) {
      const player = updatedPlayers[index];
      const updated = applyPostTradeEffects(player, receivingTeam);
      updated.teamId = offer.receivingTeamId;
      clearTradeDramaState(updated);
      updatedPlayers[index] = updated;
    }
  }

  // Transfer receiving players to offering team
  for (const playerId of offer.receivingPlayers) {
    const index = updatedPlayers.findIndex((p) => p.id === playerId);
    if (index >= 0) {
      const player = updatedPlayers[index];
      const updated = applyPostTradeEffects(player, offeringTeam);
      updated.teamId = offer.offeringTeamId;
      clearTradeDramaState(updated);
      updatedPlayers[index] = updated;
    }
  }

  return {
    success: true,
    updatedPlayers,
    message: `✅ Trade executed between ${offeringTeam.abbreviation} and ${receivingTeam.abbreviation}`,
  };
}

/**
 * Clear all trade drama state after a successful trade
 */
function clearTradeDramaState(player: Player): void {
  player.tradeRequestState = "none";
  player.tradeRequestWeek = undefined;
  player.shoppingStatus = "offBlock";
  player.isAwareOfShopping = false;

  // Morale boost for getting traded (fresh start)
  if (player.morale < 70) {
    player.morale = Math.min(100, player.morale + 20);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get team's record based on current week
 */
function getTeamRecord(
  team: Team,
  currentWeek: number
): { wins: number; losses: number; ties: number } {
  // Would integrate with actual game schedule
  // For now, estimate based on team strength
  const strength = calculateSquadStrength(team, []);
  const expectedWinPct = strength / 100;
  const wins = Math.round(currentWeek * expectedWinPct);
  const losses = currentWeek - wins;

  return { wins, losses, ties: 0 };
}

/**
 * Calculate average overall rating of team roster
 */
export function calculateSquadStrength(team: Team, allPlayers: Player[]): number {
  const roster = allPlayers.filter(
    (p) => p.teamId === team.id && p.status === PlayerStatus.ACTIVE
  );
  if (roster.length === 0) return 50;

  const totalOverall = roster.map((p) => p.overall).reduce((a, b) => a + b, 0);
  return totalOverall / roster.length;
}

/**
 * Calculate average age of team roster
 */
export function calculateAverageAge(team: Team, allPlayers: Player[]): number {
  const roster = allPlayers.filter((p) => p.teamId === team.id);
  if (roster.length === 0) return 27;

  const totalAge = roster.map((p) => p.age).reduce((a, b) => a + b, 0);
  return totalAge / roster.length;
}

/**
 * Count draft picks owned by team
 */
export function countDraftPicks(team: Team): number {
  // Would integrate with actual draft picks array
  // For now, return estimated value
  return 10;
}

/**
 * Get all players on team's trade block
 */
export function getUserTeamTradeBlock(
  userTeamId: string | undefined,
  allPlayers: Player[]
): Player[] {
  if (!userTeamId) return [];
  return allPlayers.filter(
    (p) => p.teamId === userTeamId && p.shoppingStatus !== "offBlock"
  );
}

/**
 * Get all players requesting trades from user's team
 */
export function getUserTeamTradeRequests(
  userTeamId: string | undefined,
  allPlayers: Player[]
): Player[] {
  if (!userTeamId) return [];
  return allPlayers.filter(
    (p) => p.teamId === userTeamId && p.tradeRequestState !== "none"
  );
}

// ============================================================================
// STATE MANAGEMENT INTERFACES
// ============================================================================

export interface InSeasonTradeManagerState {
  activeTradeOffers: UnifiedTradeOffer[];
  tradeDeadlineActive: boolean;
  deadlineTimeRemaining: number;
  onTheBlock: string[]; // Player IDs
  tradeRumors: TradeRumor[];
}

/**
 * Initialize in-season trade manager state
 */
export function initializeTradeManager(): InSeasonTradeManagerState {
  return {
    activeTradeOffers: [],
    tradeDeadlineActive: false,
    deadlineTimeRemaining: 3600, // 1 hour
    onTheBlock: [],
    tradeRumors: [],
  };
}

/**
 * Add trade offer to state
 */
export function addTradeOffer(
  state: InSeasonTradeManagerState,
  offer: UnifiedTradeOffer
): InSeasonTradeManagerState {
  return {
    ...state,
    activeTradeOffers: [...state.activeTradeOffers, offer],
  };
}

/**
 * Update trade offer status
 */
export function updateTradeOfferStatus(
  state: InSeasonTradeManagerState,
  offerId: string,
  status: OfferStatus
): InSeasonTradeManagerState {
  return {
    ...state,
    activeTradeOffers: state.activeTradeOffers.map((offer) =>
      offer.id === offerId ? { ...offer, status } : offer
    ),
  };
}

/**
 * Get pending offers
 */
export function getPendingOffers(state: InSeasonTradeManagerState): UnifiedTradeOffer[] {
  return state.activeTradeOffers.filter((offer) => offer.status === OfferStatus.PENDING);
}

/**
 * Start trade deadline with countdown
 */
export function startTradeDeadline(
  state: InSeasonTradeManagerState,
  allTeams: Team[],
  allPlayers: Player[]
): InSeasonTradeManagerState {
  return {
    ...state,
    tradeDeadlineActive: true,
    deadlineTimeRemaining: 3600,
    onTheBlock: generateBlockList(allTeams, allPlayers),
    tradeRumors: generateTradeRumors(allTeams, allPlayers),
  };
}

/**
 * End trade deadline
 */
export function endTradeDeadline(
  state: InSeasonTradeManagerState
): InSeasonTradeManagerState {
  return {
    ...state,
    tradeDeadlineActive: false,
    onTheBlock: [],
    tradeRumors: [],
  };
}

/**
 * Decrement deadline timer
 */
export function decrementDeadlineTimer(
  state: InSeasonTradeManagerState
): InSeasonTradeManagerState {
  return {
    ...state,
    deadlineTimeRemaining: Math.max(0, state.deadlineTimeRemaining - 1),
  };
}
