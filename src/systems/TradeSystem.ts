/**
 * TradeSystem.ts
 *
 * AI teams evaluate trades through the lens of their current FranchiseTier.
 * A Rebuilder overvalues picks; a Contender overpays for veteran starters.
 * A team in Purgatory is desperate — it will trade away talent just to clear cap.
 *
 * Rules:
 *  - Pure TypeScript class, zero React imports.
 *  - Injected into GameStateManager.
 *  - A trade is only accepted if OfferingValue >= ReceivingValue * 0.85.
 */

import type { Player } from '../types/player';
import type { Team } from '../types/team';
import type { Position } from '../types/nfl-types';
import type { TeamDraftPick } from '../types/GameStateManager';

// ─── Franchise Tiers ──────────────────────────────────────────────────────────

export enum FranchiseTier {
  /** Win% > 65%, avg OVR > 80. Overvalues veterans, undervalues picks. */
  CONTENDER  = 'CONTENDER',
  /** Win% < 35%. Overvalues picks and youth (<25). Trades expensive veterans. */
  REBUILDER  = 'REBUILDER',
  /** Bad record + bad cap space. Will trade value to clear salary. */
  PURGATORY  = 'PURGATORY',
  /** Everyone else — roughly balanced valuations. */
  NEUTRAL    = 'NEUTRAL',
}

// ─── Position multipliers (PRD §2.3) ─────────────────────────────────────────

const POSITION_MULTIPLIER: Partial<Record<string, number>> = {
  QB: 2.5, EDGE: 2.0, DL: 1.8, WR: 1.6, CB: 1.6, LT: 1.5, RT: 1.4,
  TE: 1.3, S: 1.3, LB: 1.2, RB: 1.1, OL: 1.0, C: 1.0, LG: 1.0, RG: 1.0,
  FB: 0.8, P: 0.6, K: 0.5,
};

/** Base pick values by round (PRD §2.3). */
const BASE_PICK_VALUE: Record<number, number> = {
  1: 5000, 2: 2500, 3: 1200, 4: 600, 5: 300, 6: 150, 7: 75,
};

// ─── Trade offer shape ────────────────────────────────────────────────────────

export interface TradeOfferValuation {
  offeringTeamValue: number;
  receivingTeamValue: number;
  isAcceptable: boolean;          // offeringValue >= receivingValue * 0.85
  offeringSurplus: number;        // positive = offering team overpaid
}

export interface EvaluatedPick {
  pick: TeamDraftPick;
  value: number;
}

// ─── System class ─────────────────────────────────────────────────────────────

export class TradeSystem {

  // ── Franchise tier classification ──────────────────────────────────────────

  /**
   * Classify a team's current state based on win rate and roster quality.
   */
  getFranchiseTier(team: Team, allPlayers: Player[]): FranchiseTier {
    const totalGames = team.wins + team.losses + team.ties;
    const winPct = totalGames > 0 ? team.wins / totalGames : 0.5;
    const capSpace = (team.salaryCap ?? 255_000_000) - this._getCapHit(team, allPlayers);
    const capPct = capSpace / (team.salaryCap ?? 255_000_000);

    // Roster quality: average overall of top 22 players
    const rosterOvr = this._getRosterRating(team, allPlayers);

    if (winPct >= 0.65 && rosterOvr >= 80) return FranchiseTier.CONTENDER;
    if (winPct <= 0.35) return FranchiseTier.REBUILDER;
    if (winPct <= 0.45 && capPct < 0.15) return FranchiseTier.PURGATORY;
    return FranchiseTier.NEUTRAL;
  }

  // ── Player valuation ────────────────────────────────────────────────────────

  /**
   * Calculate a player's trade value adjusted for the receiving team's tier.
   */
  calculatePlayerValue(
    player: Player,
    forTier: FranchiseTier,
    currentWeek: number,
  ): number {
    const posMultiplier = POSITION_MULTIPLIER[player.position] ?? 1.0;
    let base = player.overall * posMultiplier;

    // Age penalty (>30 years old)
    if (player.age > 30) {
      const agePenalty = (player.age - 30) * 0.05;
      base *= Math.max(0.5, 1 - agePenalty);
    }

    // Contract penalty: if the player has <1 year left they're worth less
    const yearsRemaining = player.contract?.yearsRemaining ?? 1;
    if (yearsRemaining < 1) base *= 0.75;

    // Tier-specific adjustments
    switch (forTier) {
      case FranchiseTier.CONTENDER:
        // Overvalues veterans (age >28, OVR >80) by 20%
        if (player.age >= 28 && player.overall >= 80) base *= 1.20;
        break;
      case FranchiseTier.REBUILDER:
        // Undervalues veterans, boosts youth (<25)
        if (player.age >= 28) base *= 0.75;
        if (player.age < 25) base *= 1.25;
        break;
      case FranchiseTier.PURGATORY:
        // Cuts value on expensive players (cap dumps)
        if ((player.contract?.currentYearCap ?? 0) > 15_000_000) base *= 0.70;
        break;
      case FranchiseTier.NEUTRAL:
        break;
    }

    // Mid-season modifier: values veterans more in season, rookies more in offseason
    if (currentWeek >= 29 && currentWeek <= 46) {
      if (player.age >= 28) base *= 1.10;
    }

    return Math.round(base);
  }

  // ── Pick valuation ──────────────────────────────────────────────────────────

  /**
   * Calculate a draft pick's value adjusted for the originating team's tier
   * and current week (mid-season picks from Rebuilders are worth more).
   */
  calculatePickValue(
    pick: TeamDraftPick,
    currentWeek: number,
    fromTeam: Team,
    allPlayers: Player[],
  ): number {
    const round = Math.min(7, Math.max(1, pick.round));
    let value = BASE_PICK_VALUE[round] ?? 75;

    // Mid-season pick modifier: Rebuilder 1st rounds are the most valuable
    if (currentWeek >= 29) {
      const fromTier = this.getFranchiseTier(fromTeam, allPlayers);
      if (fromTier === FranchiseTier.REBUILDER && round === 1) {
        value *= 2.5; // Top-5 pick potential premium
      } else if (fromTier === FranchiseTier.CONTENDER && round === 1) {
        value *= 0.75; // Late 1st from a contender
      }
    }

    // Future year picks are slightly discounted (uncertainty)
    const currentYear = new Date().getFullYear();
    if (pick.year > currentYear + 1) {
      value *= 0.90;
    }

    return Math.round(value);
  }

  // ── Trade evaluation ────────────────────────────────────────────────────────

  /**
   * Evaluate a trade from the RECEIVING team's perspective.
   * Returns whether the offering team's side is worth at least 85% of what
   * the receiving team is giving up.
   */
  evaluateTrade(params: {
    offeringPlayers:   Player[];
    offeringPicks:     EvaluatedPick[];
    receivingPlayers:  Player[];
    receivingPicks:    EvaluatedPick[];
    receivingTeam:     Team;
    allPlayers:        Player[];
    currentWeek:       number;
  }): TradeOfferValuation {
    const receivingTier = this.getFranchiseTier(params.receivingTeam, params.allPlayers);

    // What the offering team is sending
    const offeringValue =
      params.offeringPlayers.reduce(
        (sum, p) => sum + this.calculatePlayerValue(p, receivingTier, params.currentWeek), 0
      ) +
      params.offeringPicks.reduce((sum, ep) => sum + ep.value, 0);

    // What the receiving team is sending away
    const receivingValue =
      params.receivingPlayers.reduce(
        (sum, p) => sum + this.calculatePlayerValue(p, receivingTier, params.currentWeek), 0
      ) +
      params.receivingPicks.reduce((sum, ep) => sum + ep.value, 0);

    const threshold = receivingValue * 0.85;

    return {
      offeringTeamValue: offeringValue,
      receivingTeamValue: receivingValue,
      isAcceptable: offeringValue >= threshold,
      offeringSurplus: offeringValue - receivingValue,
    };
  }

  // ── Rebuilder trade block logic ────────────────────────────────────────────

  /**
   * Determine which players a Rebuilder should actively shop.
   * Returns player IDs the AI should put on the trade block.
   */
  getTradeBlockCandidates(team: Team, allPlayers: Player[], tier: FranchiseTier): string[] {
    if (tier !== FranchiseTier.REBUILDER && tier !== FranchiseTier.PURGATORY) return [];

    const roster = allPlayers.filter(p => p.teamId === team.id);
    return roster
      .filter(p => {
        const isExpensive = (p.contract?.currentYearCap ?? 0) > 12_000_000;
        const isVeteran = p.age >= 28;
        const isNotElite = p.overall < 88;
        return isExpensive && isVeteran && isNotElite;
      })
      .map(p => p.id);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private _getCapHit(team: Team, allPlayers: Player[]): number {
    return allPlayers
      .filter(p => p.teamId === team.id)
      .reduce((sum, p) => sum + (p.contract?.currentYearCap ?? 0), 0);
  }

  private _getRosterRating(team: Team, allPlayers: Player[]): number {
    const roster = allPlayers
      .filter(p => p.teamId === team.id)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 22);
    if (roster.length === 0) return 70;
    return roster.reduce((sum, p) => sum + p.overall, 0) / roster.length;
  }
}
