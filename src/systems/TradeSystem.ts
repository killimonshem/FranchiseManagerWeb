/**
 * TradeSystem.ts
 *
 * The Context-Aware Trade Valuation Engine.
 * Evaluates trades based on Value Arbitrage and Franchise Tiers.
 *
 * Rules:
 *  - Pure TypeScript class, zero React imports.
 *  - Injected into GameStateManager.
 *  - Implements strict valuation logic based on PRD.
 */

import type { Player } from '../types/player';
import type { Team } from '../types/team';
import type { TeamDraftPick } from '../types/GameStateManager';
import { Position } from '../types/nfl-types';

export interface TradeOfferPayload {
  offeringTeamId: string;
  receivingTeamId: string;
  // IDs only — GameStateManager resolves to live references before calling evaluateTradeOffer()
  offeringPlayerIds: string[];
  receivingPlayerIds: string[];
  offeringPickIds: string[];
  receivingPickIds: string[];
}

export interface TradeEvaluation {
  accepted: boolean;
  reason: string;
  fairnessScore: number; // Ratio of Perceived Value. 1.0 is perfectly even.
}

export enum FranchiseTier {
  CONTENDER = 'Contender', // Win now mode
  REBUILDER = 'Rebuilder', // Stockpiling assets
  NEUTRAL = 'Neutral'      // Standard valuation
}

export class TradeSystem {

  // ─── Module 1: Base Asset Valuation ─────────────────────────────────────────

  private getBasePlayerValue(player: Player): number {
    // Exponential Curve: 85 OVR is exponentially more valuable than 75 OVR
    let value = Math.pow(player.overall, 2) * 10;

    // Age Modifiers
    if (player.age < 25) {
      value *= 1.3; // Youth premium
    } else if (player.age > 30) {
      value *= 0.6; // Decline risk
    }

    // Positional Scarcity Modifiers
    switch (player.position) {
      case Position.QB:
        value *= 2.5;
        break;
      case Position.OL: // Treating OL as LT (Premium)
      case Position.DL:
      case Position.CB:
        value *= 1.5;
        break;
      default:
        // Standard positions (RB, WR, TE, LB, S, K, P) = 1.0
        break;
    }

    return value;
  }

  private getBasePickValue(pick: TeamDraftPick): number {
    // Simplified Jimmy Johnson trade chart
    // Index 0 is unused, Index 1 = Round 1
    const roundValues = [0, 3000, 1200, 500, 200, 100, 50, 20];
    const round = Math.max(1, Math.min(7, pick.round));
    return roundValues[round] || 0;
  }

  // ─── Module 2: Franchise State Analysis ─────────────────────────────────────

  /**
   * Determine the AI team's mindset based on wins and season context.
   */
  public determineFranchiseTier(team: Team, currentWeek: number): FranchiseTier {
    // Early season ambiguity check
    if (currentWeek <= 4) {
      return FranchiseTier.NEUTRAL;
    }

    if (team.wins >= 10) {
      return FranchiseTier.CONTENDER;
    } else if (team.wins <= 4) {
      return FranchiseTier.REBUILDER;
    } else {
      return FranchiseTier.NEUTRAL;
    }
  }

  // ─── Module 3: The Contextual Modifier ──────────────────────────────────────

  /**
   * Calculate value of a player distorted by the AI's Franchise Tier.
   */
  private getContextualPlayerValue(player: Player, tier: FranchiseTier): number {
    let value = this.getBasePlayerValue(player);

    if (tier === FranchiseTier.REBUILDER) {
      // Rebuilder: Wants youth, penalizes age
      if (player.age <= 26) {
        value *= 1.2;
      } else {
        value *= 0.5; // Heavily penalize expensive, aging veterans
      }
    } else if (tier === FranchiseTier.CONTENDER) {
      // Contender: Needs immediate starters
      if (player.overall >= 80) {
        value *= 1.3;
      }
    }
    // Neutral: No distortion

    return value;
  }

  /**
   * Calculate value of a pick distorted by the AI's Franchise Tier.
   */
  private getContextualPickValue(pick: TeamDraftPick, tier: FranchiseTier): number {
    let value = this.getBasePickValue(pick);

    if (tier === FranchiseTier.REBUILDER) {
      value *= 1.5; // Overvalues draft capital
    } else if (tier === FranchiseTier.CONTENDER) {
      value *= 0.8; // Doesn't care about the future
    }
    // Neutral: No distortion

    return value;
  }

  // ─── Module 4: Resolution & The "Human Tax" ─────────────────────────────────

  /**
   * Evaluate a trade offer from the perspective of the Receiving Team (AI).
   * Resolved Player[] and TeamDraftPick[] are passed by GameStateManager after
   * it looks up the live references from the ID-based payload.
   */
  public evaluateTradeOffer(
    _payload: TradeOfferPayload,
    offeringPlayers: Player[],
    receivingPlayers: Player[],
    offeringPicks: TeamDraftPick[],
    receivingPicks: TeamDraftPick[],
    receivingTeam: Team,
    currentWeek: number
  ): TradeEvaluation {
    const tier = this.determineFranchiseTier(receivingTeam, currentWeek);

    // Calculate Perceived User Value (What AI Receives)
    let perceivedUserValue = 0;
    for (const player of offeringPlayers) {
      perceivedUserValue += this.getContextualPlayerValue(player, tier);
    }
    for (const pick of offeringPicks) {
      perceivedUserValue += this.getContextualPickValue(pick, tier);
    }

    // Calculate Perceived AI Value (What AI Gives Up)
    let perceivedAiValue = 0;
    for (const player of receivingPlayers) {
      perceivedAiValue += this.getContextualPlayerValue(player, tier);
    }
    for (const pick of receivingPicks) {
      perceivedAiValue += this.getContextualPickValue(pick, tier);
    }

    // Edge Case 1: Nothing for Nothing
    if (perceivedUserValue === 0 && perceivedAiValue === 0) {
      return {
        accepted: false,
        reason: "This trade does nothing for either of us.",
        fairnessScore: 0
      };
    }

    // Edge Case 2: Donation (User gives assets for free)
    if (perceivedAiValue === 0 && perceivedUserValue > 0) {
      return {
        accepted: true,
        reason: "We gladly accept this donation.",
        fairnessScore: Infinity
      };
    }

    // Prevent division by zero
    if (perceivedAiValue === 0) perceivedAiValue = 1;

    const fairnessRatio = perceivedUserValue / perceivedAiValue;

    // The Human Tax Logic
    if (fairnessRatio >= 1.05) {
      return {
        accepted: true,
        reason: "We accept. This makes sense for our timeline.",
        fairnessScore: fairnessRatio
      };
    } else if (fairnessRatio >= 0.90) {
      return {
        accepted: false,
        reason: "It's close, but we need a little more value on our end.",
        fairnessScore: fairnessRatio
      };
    } else {
      return {
        accepted: false,
        reason: "We are too far apart. We value our assets much higher than this.",
        fairnessScore: fairnessRatio
      };
    }
  }
}
