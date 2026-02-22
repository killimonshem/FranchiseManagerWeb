/**
 * TradeSystem.ts
 *
 * Context-Aware Trade Valuation Engine.
 * Evaluates trades, generates counter-offers, and classifies franchise tiers.
 *
 * Rules:
 *  - Pure TypeScript class, zero React imports.
 *  - Injected into GameStateManager.
 *  - All mutation happens in GameStateManager — this class is read-only math.
 */

import type { Player } from '../types/player';
import type { Team } from '../types/team';
import type { TeamDraftPick } from '../types/GameStateManager';
import { Position } from '../types/nfl-types';
import { ShoppingStatus, TradeRequestState } from '../types/player';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/** ID-based payload sent from the UI — GSM resolves to live references. */
export interface TradeOfferPayloadUI {
  offeringTeamId: string;
  receivingTeamId: string;
  offeringPlayerIds: string[];
  receivingPlayerIds: string[];
  /** Compound key format: "${year}-${round}-${originalTeamId}" */
  offeringPickIds: string[];
  receivingPickIds: string[];
}

/** Resolved-object payload used internally by evaluateTradeOffer() for math. */
export interface TradeEvaluationInput {
  offeringTeam: Team;
  receivingTeam: Team;
  offeringPlayers: Player[];
  receivingPlayers: Player[];
  offeringPicks: TeamDraftPick[];
  receivingPicks: TeamDraftPick[];
}

export interface TradeEvaluation {
  accepted: boolean;
  reason: string;
  fairnessScore: number;
  counterOffer?: TradeOfferPayloadUI;
  errorState?: 'CAP_VIOLATION' | 'DEADLINE_PASSED' | 'ASSET_INVALID' | null;
  /** Exposed so GSM can compute counter-offer deficit without duplicating valuation math. */
  perceivedValues?: { userValue: number; aiValue: number };
}

export enum FranchiseTier {
  CONTENDER = 'Contender',
  REBUILDER = 'Rebuilder',
  NEUTRAL   = 'Neutral',
}

// ─── TradeSystem ──────────────────────────────────────────────────────────────

export class TradeSystem {

  // ─── Module 1: Base Asset Valuation ───────────────────────────────────────

  public getBasePlayerValue(player: Player): number {
    let value = Math.pow(player.overall, 2) * 10;

    if (player.age < 25)      value *= 1.3;
    else if (player.age > 30) value *= 0.6;

    switch (player.position) {
      case Position.QB:
        value *= 2.5;
        break;
      case Position.OL:
      case Position.DL:
      case Position.CB:
        value *= 1.5;
        break;
      default:
        break;
    }

    // Apply PUBLIC_BLOCK penalty: -15% when team is desperate to dump player
    if (player.shoppingStatus === ShoppingStatus.PUBLIC_BLOCK) {
      value *= 0.85;
    }

    return value;
  }

  public getBasePickValue(pick: TeamDraftPick): number {
    // Simplified Jimmy Johnson trade chart
    const roundValues = [0, 3000, 1200, 500, 200, 100, 50, 20];
    const round = Math.max(1, Math.min(7, pick.round));
    return roundValues[round] || 0;
  }

  // ─── Module 1b: Trade Block Psychology ────────────────────────────────────

  /**
   * Set a player's shopping status with morale consequences.
   * PUBLIC_BLOCK triggers a -10 morale hit and awareness flag.
   * If morale drops below 30, player escalates to PUBLIC_DEMAND.
   *
   * @param player The player being placed on the block
   * @param newStatus The new shopping status
   * @returns Impact metrics for UI feedback
   */
  public setShoppingStatus(
    player: Player,
    newStatus: ShoppingStatus
  ): { moraleImpact: number; tradeValuePenalty: number } {
    const wasPublic = player.shoppingStatus === ShoppingStatus.PUBLIC_BLOCK;

    if (newStatus === ShoppingStatus.PUBLIC_BLOCK && !wasPublic) {
      // Going public: morale hit + awareness
      player.morale = Math.max(0, player.morale - 10);
      player.isAwareOfShopping = true;

      // If morale falls below 30, escalate to public demand
      if (player.morale < 30) {
        player.tradeRequestState = TradeRequestState.PUBLIC_DEMAND;
      }

      player.shoppingStatus = newStatus;
      return { moraleImpact: -10, tradeValuePenalty: -0.15 };
    } else if (newStatus === ShoppingStatus.OFF_BLOCK) {
      // Off block: no morale penalty, clear awareness
      player.isAwareOfShopping = false;
      player.shoppingStatus = newStatus;
      return { moraleImpact: 0, tradeValuePenalty: 0 };
    } else {
      // Quiet shopping: no morale impact, no awareness
      player.shoppingStatus = newStatus;
      return { moraleImpact: 0, tradeValuePenalty: 0 };
    }
  }

  // ─── Module 2: Franchise State Analysis ───────────────────────────────────

  public determineFranchiseTier(team: Team, currentWeek: number): FranchiseTier {
    if (currentWeek <= 4) return FranchiseTier.NEUTRAL;
    if (team.wins >= 10)  return FranchiseTier.CONTENDER;
    if (team.wins <= 4)   return FranchiseTier.REBUILDER;
    return FranchiseTier.NEUTRAL;
  }

  // ─── Module 3: Contextual Modifiers ───────────────────────────────────────

  private getContextualPlayerValue(player: Player, tier: FranchiseTier): number {
    let value = this.getBasePlayerValue(player);

    if (tier === FranchiseTier.REBUILDER) {
      value *= player.age <= 26 ? 1.2 : 0.5;
    } else if (tier === FranchiseTier.CONTENDER) {
      if (player.overall >= 80) value *= 1.3;
    }

    return value;
  }

  private getContextualPickValue(pick: TeamDraftPick, tier: FranchiseTier): number {
    let value = this.getBasePickValue(pick);

    if (tier === FranchiseTier.REBUILDER)      value *= 1.5;
    else if (tier === FranchiseTier.CONTENDER) value *= 0.8;

    return value;
  }

  // ─── Module 4: Trade Evaluation ───────────────────────────────────────────

  /**
   * Evaluate a trade from the receiving team's (AI) perspective.
   *
   * @param fairnessMultiplier Negotiation fatigue penalty. 1.0 = no penalty;
   *   grows via Fibonacci sequence per rejected offer; 2.5 = lockout.
   */
  public evaluateTradeOffer(
    _payload: TradeOfferPayloadUI,
    offeringPlayers: Player[],
    receivingPlayers: Player[],
    offeringPicks: TeamDraftPick[],
    receivingPicks: TeamDraftPick[],
    receivingTeam: Team,
    receivingTeamRoster: Player[],
    currentWeek: number,
    fairnessMultiplier: number = 1.0,
  ): TradeEvaluation {
    // Lockout after too many rejected offers
    if (fairnessMultiplier >= 2.5) {
      return {
        accepted: false,
        reason: "We're not taking any calls right now.",
        fairnessScore: 0,
      };
    }

    const tier = this.determineFranchiseTier(receivingTeam, currentWeek);

    // Calculate individual asset values for detailed feedback
    const aiAssets = [
      ...receivingPlayers.map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        val: this.getContextualPlayerValue(p, tier)
      })),
      ...receivingPicks.map(p => ({ name: `${p.year} Rd ${p.round} (${p.originalTeamId})`, val: this.getContextualPickValue(p, tier) }))
    ].sort((a, b) => b.val - a.val);

    const userAssets = [
      ...offeringPlayers.map(p => {
        let val = this.getContextualPlayerValue(p, tier);
        // Bonus if this player fills a positional need for the AI
        if (this.doesFillNeed(receivingTeamRoster, p.position)) val *= 1.25;
        return { name: `${p.firstName} ${p.lastName}`, val };
      }),
      ...offeringPicks.map(p => ({ name: `${p.year} Rd ${p.round} (${p.originalTeamId})`, val: this.getContextualPickValue(p, tier) }))
    ].sort((a, b) => b.val - a.val);

    const userValue = userAssets.reduce((sum, a) => sum + a.val, 0);
    let aiValue   = aiAssets.reduce((sum, a) => sum + a.val, 0);

    const perceivedValues = { userValue, aiValue };

    // Edge cases
    if (userValue === 0 && aiValue === 0) {
      return { accepted: false, reason: 'This trade does nothing for either of us.', fairnessScore: 0, perceivedValues };
    }
    if (aiValue === 0 && userValue > 0) {
      return { accepted: true, reason: 'We gladly accept this donation.', fairnessScore: Infinity, perceivedValues };
    }
    if (aiValue === 0) aiValue = 1;

    const fairnessRatio = userValue / aiValue;
    const acceptThreshold = 1.05 * fairnessMultiplier;
    const closeThreshold  = 0.90 * fairnessMultiplier;

    if (fairnessRatio >= acceptThreshold) {
      return {
        accepted: true,
        reason: 'We accept. This makes sense for our timeline.',
        fairnessScore: fairnessRatio,
        perceivedValues,
      };
    } else if (fairnessRatio >= closeThreshold) {
      return {
        accepted: false,
        reason: "It's close, but we need a little more value on our end.",
        fairnessScore: fairnessRatio,
        perceivedValues,
      };
    } else {
      // Dynamic rejection reason
      let reason = 'We are too far apart. We value our assets much higher than this.';
      const bestAi = aiAssets[0];
      const bestUser = userAssets[0];

      if (bestAi && (!bestUser || bestAi.val > bestUser.val * 1.3)) {
        reason = `I'm not trading ${bestAi.name} for a package centered around ${bestUser ? bestUser.name : 'scraps'}.`;
      } else if (bestAi && bestUser && bestAi.val > bestUser.val) {
        reason = `I value ${bestAi.name} more than ${bestUser.name}, and the rest of the package doesn't make up the difference.`;
      }

      return {
        accepted: false,
        reason,
        fairnessScore: fairnessRatio,
        perceivedValues,
      };
    }
  }

  // ─── Module 4b: Needs Analysis ────────────────────────────────────────────

  private doesFillNeed(roster: Player[], position: Position): boolean {
    const count = roster.filter(p => p.position === position).length;
    // Simple quantity thresholds for "Need"
    const thresholds: Record<string, number> = {
      QB: 2, RB: 3, WR: 5, TE: 3, OL: 8, DL: 6, LB: 6, CB: 5, S: 4, K: 1, P: 1
    };
    return count < (thresholds[position] || 2);
  }

  // ─── Module 5: Counter-Offer Generation ───────────────────────────────────

  /**
   * Build a counter-offer payload by finding the cheapest additional assets
   * from the offering team's unused picks/players that cover the value deficit.
   *
   * @param original         The original payload as the user submitted it.
   * @param availablePicks   User's picks not already in the offer.
   * @param availablePlayers User's OVR<=80 players not already in the offer.
   * @param deficitValue     How much more value the AI needs to accept.
   * @returns Augmented payload, or undefined if deficit can't be covered.
   */
  public generateCounterOffer(
    original: TradeOfferPayloadUI,
    availablePicks: TeamDraftPick[],
    availablePlayers: Player[],
    deficitValue: number,
  ): TradeOfferPayloadUI | undefined {
    if (deficitValue <= 0) return original;

    const sortedPicks = [...availablePicks].sort(
      (a, b) => this.getBasePickValue(a) - this.getBasePickValue(b),
    );
    const sortedPlayers = [...availablePlayers].sort(
      (a, b) => this.getBasePlayerValue(a) - this.getBasePlayerValue(b),
    );

    const addedPickIds: string[] = [];
    const addedPlayerIds: string[] = [];
    let remaining = deficitValue;

    // Step A: fill deficit with cheapest available picks
    for (const pick of sortedPicks) {
      if (remaining <= 0) break;
      addedPickIds.push(`${pick.year}-${pick.round}-${pick.originalTeamId}`);
      remaining -= this.getBasePickValue(pick);
    }

    // Step B: if still short, add cheapest eligible player (OVR <= 80)
    if (remaining > 0) {
      for (const player of sortedPlayers) {
        if (remaining <= 0) break;
        addedPlayerIds.push(player.id);
        remaining -= this.getBasePlayerValue(player);
      }
    }

    // Can't cover deficit — outright rejection
    if (remaining > 0) return undefined;

    return {
      ...original,
      offeringPickIds:   [...original.offeringPickIds, ...addedPickIds],
      offeringPlayerIds: [...original.offeringPlayerIds, ...addedPlayerIds],
    };
  }
}
