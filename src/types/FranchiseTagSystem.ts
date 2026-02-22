/**
 * Franchise Tag & Contract Deadline Day System
 * Converted from Swift FranchiseTagSystem.swift
 * PRD: Inescapable full-screen interrupt for expiring contracts
 */

import { Position, getPositionMarketMultiplier } from "./nfl-types";
import { Player, PlayerStatus } from "./player";
import { Team, calculateTeamCapSpace } from "./team";
import { PlayerContract } from "./nfl-types";
import { storage } from "../services/StorageService";

// ============================================================================
// FRANCHISE TAG MODELS
// ============================================================================

export interface FranchiseTag {
  id: string;
  playerId: string;
  playerName: string;
  position: Position;
  teamId: string;
  season: number;
  tagValue: number; // Calculated from top 5 salaries
  timestamp: Date;
}

export function getFranchiseTagDescription(tag: FranchiseTag): string {
  return `Franchise Tag: ${tag.playerName} (${tag.position}) - $${formatMoney(tag.tagValue)}`;
}

export interface ContractDeadlineDecision {
  id: string;
  playerId: string;
  decision: DecisionType;
  timestamp: Date;
}

export enum DecisionType {
  EXTEND = "Extended",
  TAG = "Franchise Tagged",
  RELEASE = "Released",
  PENDING = "Pending",
}

// ============================================================================
// FRANCHISE TAG VALUE CALCULATION
// ============================================================================

/**
 * Calculate franchise tag value for a position
 * Based on average of top 5 salaries at that position
 */
export function calculateFranchiseTagValue(
  position: Position,
  allPlayers: Player[]
): number {
  const positionPlayers = allPlayers.filter(
    (p) =>
      p.position === position &&
      p.status === PlayerStatus.ACTIVE &&
      p.contract !== undefined
  );

  const top5Salaries = positionPlayers
    .map((p) => p.contract?.currentYearCap ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 5);

  if (top5Salaries.length === 0) {
    // Fallback: Use position multiplier if no data
    return 500_000.0 * getPositionMarketMultiplier(position);
  }

  const average = top5Salaries.reduce((a, b) => a + b, 0) / top5Salaries.length;
  return average;
}

/**
 * Check if team can afford franchise tag
 */
export function canTeamAffordTag(
  player: Player,
  team: Team,
  allPlayers: Player[]
): {
  canAfford: boolean;
  tagValue: number;
  reason: string;
} {
  const tagValue = calculateFranchiseTagValue(player.position, allPlayers);
  const capSpace = calculateTeamCapSpace(team, allPlayers);

  if (tagValue <= capSpace) {
    return {
      canAfford: true,
      tagValue,
      reason: "Tag approved",
    };
  }

  const deficit = tagValue - capSpace;
  const deficitStr = `$${(deficit / 1_000_000).toFixed(1)}M`;

  return {
    canAfford: false,
    tagValue,
    reason: `Insufficient cap space. Need ${deficitStr} more.`,
  };
}

/**
 * Check if team has already used franchise tag this season
 */
export function hasTeamUsedFranchiseTag(
  teamId: string,
  season: number,
  tags: FranchiseTag[]
): boolean {
  return tags.some((tag) => tag.teamId === teamId && tag.season === season);
}

// ============================================================================
// APPLY FRANCHISE TAG
// ============================================================================

export enum TagError {
  ALREADY_USED_TAG = "Team has already used franchise tag this season",
  INSUFFICIENT_CAP_SPACE = "Insufficient cap space for franchise tag",
  PLAYER_NOT_ELIGIBLE = "Player is not eligible for franchise tag",
}

/**
 * Apply franchise tag to a player
 * Creates 1-year, fully guaranteed contract
 */
export function applyFranchiseTag(
  player: Player,
  teamId: string,
  season: number,
  allPlayers: Player[],
  existingTags: FranchiseTag[]
): {
  success: boolean;
  tag?: FranchiseTag;
  error?: TagError;
} {
  // Validation: Check if player is eligible
  if (
    player.status !== PlayerStatus.ACTIVE &&
    player.status !== PlayerStatus.FREE_AGENT
  ) {
    console.log(
      `❌ Cannot tag ${player.firstName} ${player.lastName}: Player status is ${player.status}`
    );
    return {
      success: false,
      error: TagError.PLAYER_NOT_ELIGIBLE,
    };
  }

  // Check: Only one tag per team per season
  if (hasTeamUsedFranchiseTag(teamId, season, existingTags)) {
    console.log("❌ Team has already used their franchise tag this season");
    return {
      success: false,
      error: TagError.ALREADY_USED_TAG,
    };
  }

  // Calculate tag value
  const tagValue = calculateFranchiseTagValue(player.position, allPlayers);
  console.log(
    `💰 Franchise tag value for ${player.position}: ${formatMoney(tagValue)}`
  );

  // Create franchise tag contract (1 year, fully guaranteed)
  const tagContract: PlayerContract = {
    totalValue: tagValue,
    yearsRemaining: 1,
    guaranteedMoney: tagValue, // Fully guaranteed
    currentYearCap: tagValue,
    signingBonus: 0, // No signing bonus on tag
    incentives: 0,
    canRestructure: false,
    canCut: false,
    deadCap: 0,
    hasNoTradeClause: false,
    approvedTradeDestinations: [],
  };

  // Create franchise tag record
  const tag: FranchiseTag = {
    id: Math.random().toString(36).substr(2, 9),
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    position: player.position,
    teamId,
    season,
    tagValue,
    timestamp: new Date(),
  };

  console.log("🏷️ ✅ Franchise tag successfully applied!");
  console.log(`   Player: ${player.firstName} ${player.lastName}`);
  console.log(`   Position: ${player.position}`);
  console.log(`   Value: ${formatMoney(tagValue)}`);
  console.log(`   Contract: 1 year, fully guaranteed`);

  return {
    success: true,
    tag,
  };
}

// ============================================================================
// CONTRACT DEADLINE DAY LOGIC
// ============================================================================

/**
 * Get all players with expiring contracts on a team
 */
export function getExpiringPlayers(
  teamId: string,
  allPlayers: Player[]
): Player[] {
  return allPlayers.filter(
    (p) =>
      p.teamId === teamId &&
      p.status === PlayerStatus.ACTIVE &&
      (p.contract?.yearsRemaining ?? 0) === 0
  );
}

/**
 * Check if all expiring contracts are resolved
 */
export function areAllContractsResolved(
  teamId: string,
  allPlayers: Player[],
  decisions: Record<string, ContractDeadlineDecision>
): boolean {
  const expiringPlayers = getExpiringPlayers(teamId, allPlayers);

  for (const player of expiringPlayers) {
    if (!decisions[player.id]) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate total cap impact of deadline decisions
 */
export function calculateDeadlineCapImpact(
  teamId: string,
  allPlayers: Player[],
  decisions: Record<string, ContractDeadlineDecision>,
  tags: FranchiseTag[]
): {
  extensions: number;
  tags: number;
  total: number;
} {
  let extensionCap = 0;
  let tagCap = 0;

  for (const [playerId, decision] of Object.entries(decisions)) {
    const player = allPlayers.find(
      (p) => p.id === playerId && p.teamId === teamId
    );
    if (!player) continue;

    switch (decision.decision) {
      case DecisionType.EXTEND:
        if (player.contract) {
          extensionCap += player.contract.currentYearCap;
        }
        break;

      case DecisionType.TAG:
        const tag = tags.find((t) => t.playerId === playerId);
        if (tag) {
          tagCap += tag.tagValue;
        }
        break;

      case DecisionType.RELEASE:
      case DecisionType.PENDING:
        break;
    }
  }

  return {
    extensions: extensionCap,
    tags: tagCap,
    total: extensionCap + tagCap,
  };
}

// ============================================================================
// SOCIAL MEDIA & ANNOUNCEMENTS
// ============================================================================

/**
 * Generate social feed post for franchise tag
 */
export function generateFranchiseTagSocialPost(
  tag: FranchiseTag,
  teamName: string
): string {
  return `🚨 BREAKING: ${teamName} has officially placed the Franchise Tag on ${tag.playerName}. 1 year, ${formatMoney(tag.tagValue)} guaranteed. #DeadlineDay`;
}

// ============================================================================
// RELEASE & DECISION RECORDING
// ============================================================================

/**
 * Release a player to free agency
 */
export function releasePlayerToFreeAgency(player: Player): Player {
  return {
    ...player,
    contract: undefined,
    status: PlayerStatus.FREE_AGENT,
    teamId: undefined,
  };
}

/**
 * Record extension decision
 */
export function recordExtensionDecision(playerId: string): ContractDeadlineDecision {
  return {
    id: Math.random().toString(36).substr(2, 9),
    playerId,
    decision: DecisionType.EXTEND,
    timestamp: new Date(),
  };
}

/**
 * Record franchise tag decision
 */
export function recordTagDecision(playerId: string): ContractDeadlineDecision {
  return {
    id: Math.random().toString(36).substr(2, 9),
    playerId,
    decision: DecisionType.TAG,
    timestamp: new Date(),
  };
}

/**
 * Record release decision
 */
export function recordReleaseDecision(playerId: string): ContractDeadlineDecision {
  return {
    id: Math.random().toString(36).substr(2, 9),
    playerId,
    decision: DecisionType.RELEASE,
    timestamp: new Date(),
  };
}

// ============================================================================
// AI TEAM PROCESSING
// ============================================================================

/**
 * AI team franchise tag decision
 * Tags best expiring player if overall >= 85 and cap allows
 */
export function processAITeamFranchiseTag(
  team: Team,
  expiringPlayers: Player[],
  allPlayers: Player[],
  season: number,
  existingTags: FranchiseTag[]
): {
  tagged?: FranchiseTag;
  tagError?: string;
} {
  // Skip if already tagged this season
  if (hasTeamUsedFranchiseTag(team.id, season, existingTags)) {
    return {};
  }

  // Find best expiring player
  const bestPlayer = expiringPlayers.sort((a, b) => b.overall - a.overall)[0];
  if (!bestPlayer || bestPlayer.overall < 85) {
    return {};
  }

  // Check if team can afford
  const afford = canTeamAffordTag(bestPlayer, team, allPlayers);
  if (!afford.canAfford) {
    return {
      tagError: afford.reason,
    };
  }

  // Apply tag
  const result = applyFranchiseTag(
    bestPlayer,
    team.id,
    season,
    allPlayers,
    existingTags
  );

  if (result.success && result.tag) {
    console.log(`🤖 AI ${team.abbreviation} tagged ${result.tag.playerName}`);
    return {
      tagged: result.tag,
    };
  }

  return {
    tagError: "Failed to apply tag",
  };
}

/**
 * AI team contract extension/release decision
 * Extends if overall >= 80, releases otherwise
 */
export function processAITeamContractDecision(
  team: Team,
  player: Player,
  season: number,
  existingTags: FranchiseTag[]
): {
  decision: DecisionType;
  reason: string;
} {
  // Skip if already tagged
  if (existingTags.some((t) => t.playerId === player.id && t.season === season)) {
    return {
      decision: DecisionType.PENDING,
      reason: "Player is franchise tagged",
    };
  }

  // AI logic: Extend if overall >= 80, release otherwise
  if (player.overall >= 80) {
    console.log(
      `🤖 AI ${team.abbreviation} extended ${player.firstName} ${player.lastName}`
    );
    return {
      decision: DecisionType.EXTEND,
      reason: "High overall rating warrants extension",
    };
  }

  console.log(
    `🤖 AI ${team.abbreviation} released ${player.firstName} ${player.lastName}`
  );
  return {
    decision: DecisionType.RELEASE,
    reason: "Low overall rating - not worth extending",
  };
}

// ============================================================================
// CONTRACT EXTENSION HELPER
// ============================================================================

/**
 * Generate extension contract based on player market value
 */
export function generateContractExtension(
  player: Player,
  years: number,
  totalValue: number
): PlayerContract {
  const annualValue = totalValue / years;
  const signingBonus = totalValue * 0.15;
  const guaranteedMoney = totalValue * 0.6;

  return {
    totalValue,
    yearsRemaining: years,
    guaranteedMoney,
    currentYearCap: annualValue,
    signingBonus,
    incentives: totalValue * 0.05,
    canRestructure: true,
    canCut: true,
    deadCap: guaranteedMoney * 0.3,
    hasNoTradeClause: false,
    approvedTradeDestinations: [],
  };
}

// ============================================================================
// PERSISTENCE & UTILITIES
// ============================================================================

const FRANCHISE_TAGS_KEY = "FranchiseTagsData";

/**
 * Save franchise tags to IndexedDB
 */
export async function saveFranchiseTagsToStorage(tags: FranchiseTag[], season: number = new Date().getFullYear()): Promise<void> {
  try {
    const data = JSON.stringify(tags);
    await storage.saveFranchiseTags(season, data);
  } catch (e) {
    console.error("Failed to save franchise tags:", e);
  }
}

/**
 * Load franchise tags from IndexedDB
 */
export async function loadFranchiseTagsFromStorage(season: number = new Date().getFullYear()): Promise<FranchiseTag[]> {
  try {
    const data = await storage.loadFranchiseTags(season);
    if (data) {
      const tags = JSON.parse(data) as FranchiseTag[];
      // Convert timestamp strings back to Date objects
      return tags.map((tag) => ({
        ...tag,
        timestamp: new Date(tag.timestamp),
      }));
    }
  } catch (e) {
    console.error("Failed to load franchise tags:", e);
  }
  return [];
}

/**
 * Format currency for display
 */
function formatMoney(amount: number): string {
  const millions = amount / 1_000_000;
  return `$${millions.toFixed(2)}M`;
}

// ============================================================================
// STATE MANAGEMENT INTERFACES
// ============================================================================

export interface FranchiseTagManagerState {
  franchiseTags: FranchiseTag[];
  deadlineDecisions: Record<string, ContractDeadlineDecision>;
}

/**
 * Initialize franchise tag manager state (empty; loads asynchronously via loadFranchiseTagsFromStorage)
 */
export function initializeFranchiseTagManager(): FranchiseTagManagerState {
  return {
    franchiseTags: [],
    deadlineDecisions: {},
  };
}

/**
 * Update franchise tags in state (saves asynchronously)
 */
export function addFranchiseTag(
  state: FranchiseTagManagerState,
  tag: FranchiseTag,
  season?: number
): FranchiseTagManagerState {
  const updated = {
    ...state,
    franchiseTags: [...state.franchiseTags, tag],
  };
  // Fire-and-forget save
  saveFranchiseTagsToStorage(updated.franchiseTags, season).catch(err =>
    console.error('Failed to save franchise tags:', err)
  );
  return updated;
}

/**
 * Record contract decision in state
 */
export function recordDecision(
  state: FranchiseTagManagerState,
  decision: ContractDeadlineDecision
): FranchiseTagManagerState {
  return {
    ...state,
    deadlineDecisions: {
      ...state.deadlineDecisions,
      [decision.playerId]: decision,
    },
  };
}

/**
 * Get decision for a player
 */
export function getPlayerDecision(
  state: FranchiseTagManagerState,
  playerId: string
): ContractDeadlineDecision | undefined {
  return state.deadlineDecisions[playerId];
}

/**
 * Clear all decisions for new season
 */
export function clearSeasonDecisions(
  state: FranchiseTagManagerState
): FranchiseTagManagerState {
  return {
    ...state,
    deadlineDecisions: {},
  };
}
