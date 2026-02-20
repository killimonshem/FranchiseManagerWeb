/**
 * AgentPersonalitySystem.ts
 *
 * Free agents are not fungible units. Every player entering free agency is
 * assigned an AgentArchetype derived from their personality traits. The archetype
 * governs how they evaluate offers, when they walk away, and whether they take
 * a discount for the right situation.
 *
 * Rules:
 *  - Pure TypeScript class, zero React imports.
 *  - Injected into GameStateManager — never instantiated by the UI.
 *  - Hard lockouts push a ProcessingInterrupt to the engine's queue.
 */

import type { Player } from '../types/player';

// ─── Agent Archetypes ─────────────────────────────────────────────────────────

export enum AgentArchetype {
  /**
   * The Shark — maximises guaranteed money at all costs.
   * Requires >85% guaranteed. Locks out after 2 lowball offers.
   */
  SHARK = 'SHARK',

  /**
   * The Uncle / Family Friend — values happiness and fit over salary.
   * Takes up to a 10% discount for a contender or a guaranteed starting spot.
   */
  UNCLE_FAMILY = 'UNCLE_FAMILY',

  /**
   * The Brand Builder — refuses contracts >2 years.
   * Wants short deals to hit free agency again quickly.
   */
  BRAND_BUILDER = 'BRAND_BUILDER',

  /**
   * Self-Represented — volatile and unpredictable.
   * 30% chance to randomly break off negotiations if the offer isn't
   * strictly above market value.
   */
  SELF_REPRESENTED = 'SELF_REPRESENTED',
}

// ─── Offer evaluation types ───────────────────────────────────────────────────

export interface FAOffer {
  totalValue: number;
  guaranteedMoney: number;
  years: number;
  averageYearlyValue: number;
  signingBonus: number;
  isContender: boolean;             // Is the offering team a contender?
  guaranteesStartingSpot: boolean;  // Is a depth-1 start guaranteed?
}

export interface FANegotiationResult {
  outcome: 'ACCEPTED' | 'REJECTED' | 'COUNTER' | 'LOCKED_OUT';
  counterOffer?: Partial<FAOffer>;
  lockoutReason?: string;
}

// ─── Negotiation state per player ─────────────────────────────────────────────

export interface NegotiationState {
  playerId: string;
  agentArchetype: AgentArchetype;
  lowballStrikesReceived: number;  // Tracks cumulative lowball count for SHARK
  isLockedOut: boolean;
  lockoutReason?: string;
}

// ─── System class ─────────────────────────────────────────────────────────────

export class AgentPersonalitySystem {
  private negotiations = new Map<string, NegotiationState>();

  // ── Archetype assignment ────────────────────────────────────────────────────

  /**
   * Deterministically assign an archetype from a player's personality traits.
   * Called once when a player enters free agency.
   */
  assignArchetype(player: Player): AgentArchetype {
    const { personality } = player;
    if (!personality) return AgentArchetype.UNCLE_FAMILY;

    // Shark: high ego + low loyalty + high marketability
    if (personality.ego >= 75 && personality.loyalty <= 30 && personality.marketability >= 60) {
      return AgentArchetype.SHARK;
    }

    // Brand Builder: high marketability, low loyalty, discipline doesn't matter
    if (personality.marketability >= 80 && personality.loyalty <= 40) {
      return AgentArchetype.BRAND_BUILDER;
    }

    // Self-Represented: very high ego AND very low discipline (volatile combo)
    if (personality.ego >= 80 && personality.discipline <= 25) {
      return AgentArchetype.SELF_REPRESENTED;
    }

    // Uncle / Family Friend: high team player + high loyalty
    return AgentArchetype.UNCLE_FAMILY;
  }

  /**
   * Initialise negotiation state for a player entering FA.
   * Call this when the FA window opens for each eligible player.
   */
  beginNegotiation(player: Player): NegotiationState {
    const state: NegotiationState = {
      playerId: player.id,
      agentArchetype: this.assignArchetype(player),
      lowballStrikesReceived: 0,
      isLockedOut: false,
    };
    this.negotiations.set(player.id, state);
    return state;
  }

  getNegotiationState(playerId: string): NegotiationState | undefined {
    return this.negotiations.get(playerId);
  }

  clearNegotiation(playerId: string): void {
    this.negotiations.delete(playerId);
  }

  // ── Offer evaluation ────────────────────────────────────────────────────────

  /**
   * Evaluate an offer against the player's archetype rules.
   * Returns the outcome and optional counter offer or lockout reason.
   */
  evaluateOffer(
    player: Player,
    offer: FAOffer,
    marketValue: number,
  ): FANegotiationResult {
    let state = this.negotiations.get(player.id);
    if (!state) {
      state = this.beginNegotiation(player);
    }

    if (state.isLockedOut) {
      return { outcome: 'LOCKED_OUT', lockoutReason: state.lockoutReason };
    }

    switch (state.agentArchetype) {
      case AgentArchetype.SHARK:
        return this._evaluateShark(player, offer, marketValue, state);
      case AgentArchetype.UNCLE_FAMILY:
        return this._evaluateUncle(player, offer, marketValue, state);
      case AgentArchetype.BRAND_BUILDER:
        return this._evaluateBrandBuilder(player, offer, marketValue, state);
      case AgentArchetype.SELF_REPRESENTED:
        return this._evaluateSelfRepresented(player, offer, marketValue, state);
    }
  }

  // ── Archetype-specific evaluators ──────────────────────────────────────────

  private _evaluateShark(
    _player: Player,
    offer: FAOffer,
    marketValue: number,
    state: NegotiationState,
  ): FANegotiationResult {
    const guaranteedPct = offer.totalValue > 0 ? offer.guaranteedMoney / offer.totalValue : 0;
    const isLowball = offer.averageYearlyValue < marketValue * 0.9;

    // Must have >85% guaranteed
    if (guaranteedPct < 0.85) {
      if (isLowball) {
        state.lowballStrikesReceived++;
        if (state.lowballStrikesReceived >= 2) {
          state.isLockedOut = true;
          state.lockoutReason = "Player's agent has cut off negotiations after repeated lowball offers.";
          return { outcome: 'LOCKED_OUT', lockoutReason: state.lockoutReason };
        }
      }
      return {
        outcome: 'COUNTER',
        counterOffer: {
          guaranteedMoney: offer.totalValue * 0.87, // demands 87% guaranteed
          averageYearlyValue: Math.max(offer.averageYearlyValue, marketValue),
        },
      };
    }

    // Offer meets guaranteed threshold — accept if at or above market
    if (offer.averageYearlyValue >= marketValue * 0.95) {
      return { outcome: 'ACCEPTED' };
    }

    return {
      outcome: 'COUNTER',
      counterOffer: { averageYearlyValue: marketValue * 1.05 },
    };
  }

  private _evaluateUncle(
    _player: Player,
    offer: FAOffer,
    marketValue: number,
    _state: NegotiationState,
  ): FANegotiationResult {
    // Discount factor: contender or starting spot = 10% off
    const discountFactor = (offer.isContender || offer.guaranteesStartingSpot) ? 0.90 : 1.0;
    const adjustedMarket = marketValue * discountFactor;

    if (offer.averageYearlyValue >= adjustedMarket * 0.92) {
      return { outcome: 'ACCEPTED' };
    }

    return {
      outcome: 'COUNTER',
      counterOffer: { averageYearlyValue: adjustedMarket },
    };
  }

  private _evaluateBrandBuilder(
    _player: Player,
    offer: FAOffer,
    marketValue: number,
    _state: NegotiationState,
  ): FANegotiationResult {
    // Refuses contracts longer than 2 years
    if (offer.years > 2) {
      return {
        outcome: 'COUNTER',
        counterOffer: { years: 2, averageYearlyValue: offer.averageYearlyValue * 1.15 },
      };
    }

    if (offer.averageYearlyValue >= marketValue * 0.95) {
      return { outcome: 'ACCEPTED' };
    }

    return {
      outcome: 'COUNTER',
      counterOffer: { averageYearlyValue: marketValue * 1.1, years: 1 },
    };
  }

  private _evaluateSelfRepresented(
    _player: Player,
    offer: FAOffer,
    marketValue: number,
    state: NegotiationState,
  ): FANegotiationResult {
    // Must be strictly above market value
    if (offer.averageYearlyValue <= marketValue) {
      // 30% chance of random walkout
      if (Math.random() < 0.30) {
        state.isLockedOut = true;
        state.lockoutReason = 'Player broke off negotiations unexpectedly.';
        return { outcome: 'LOCKED_OUT', lockoutReason: state.lockoutReason };
      }
      return {
        outcome: 'COUNTER',
        counterOffer: { averageYearlyValue: marketValue * 1.05 },
      };
    }

    return { outcome: 'ACCEPTED' };
  }
}
