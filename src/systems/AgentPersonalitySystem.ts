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
 *  - All negotiation state lives in this system; UI observes via engine callback.
 */

import type { Player } from '../types/player';
import { InjuryStatus } from '../types/nfl-types';
import {
  AgentArchetype,
  AgentPersonality,
  AgentMood,
  ContractOffer,
  NegotiationLeverage,
  NegotiationResponse,
  PressLeak,
  ShadowAdvisorEvent,
  generateAgentPersonality,
  calculateMarketValueForContract,
  getContractOfferAveragePerYear,
  getContractOfferGuaranteedPercentage,
} from '../types/ContractSystem';

// ─── Negotiation State Types ──────────────────────────────────────────────────

export interface PlayerNegotiationState {
  playerId: string;
  agent: AgentPersonality;
  currentOffer?: ContractOffer;
  counterOffer?: ContractOffer;
  leverage: NegotiationLeverage;
  lowballCount: number;
  isLockedOut: boolean;
  lockoutReason?: string;
  negotiationRound: number;
  agentMood: AgentMood;
  marketValue: number;
  teamFriendlyTarget: number;
  holdoutStatus: 'NONE' | 'THREATENING' | 'HOLDING' | 'RESOLVED';
  pressLeaks: PressLeak[];
  pendingShadowEvent?: ShadowAdvisorEvent;
  phoneDeadUntilRound?: number;
}

// ─── System class ─────────────────────────────────────────────────────────────

export class AgentPersonalitySystem {
  private negotiations = new Map<string, PlayerNegotiationState>();

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Begin a negotiation with a free agent.
   * Generates agent personality, calculates leverage, initializes state.
   */
  beginPlayerNegotiation(
    player: Player,
    capSpace: number,
    positionDepth: number,
    isContender: boolean
  ): PlayerNegotiationState {
    const agent = generateAgentPersonality(player);
    const marketValue = calculateMarketValueForContract(player);
    const teamFriendlyTarget = marketValue * 0.85;
    const leverage = this._calculateLeverage(
      player,
      marketValue,
      capSpace,
      positionDepth,
      isContender
    );

    const state: PlayerNegotiationState = {
      playerId: player.id,
      agent,
      leverage,
      lowballCount: 0,
      isLockedOut: false,
      negotiationRound: 0,
      agentMood: AgentMood.NEUTRAL,
      marketValue,
      teamFriendlyTarget,
      holdoutStatus: 'NONE',
      pressLeaks: [],
    };

    // Check for shadow advisor event
    if (agent.hasShadowAdvisor && agent.shadowAdvisorName) {
      const shadowEvent: ShadowAdvisorEvent = {
        id: `shadow_${player.id}_${Date.now()}`,
        playerId: player.id,
        playerName: player.firstName + ' ' + player.lastName,
        advisorName: agent.shadowAdvisorName,
        demand: marketValue * 1.2,
        deadline: 24,
        phoneNumber: 'Blocked Number',
      };
      state.pendingShadowEvent = shadowEvent;
    }

    this.negotiations.set(player.id, state);
    return state;
  }

  /**
   * Submit an offer from the user and get agent response.
   * Updates negotiation state, returns response message.
   */
  submitOffer(playerId: string, offer: ContractOffer): NegotiationResponse {
    const state = this.negotiations.get(playerId);
    if (!state) {
      return {
        accepted: false,
        message: 'No active negotiation found',
        newMood: AgentMood.NEUTRAL,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    // Check if phone is dead
    if (state.phoneDeadUntilRound !== undefined && state.phoneDeadUntilRound > state.negotiationRound) {
      const daysRemaining = (state.phoneDeadUntilRound - state.negotiationRound) * 7;
      return {
        accepted: false,
        message: `Agent is not taking calls. Phone dead for ${daysRemaining} more days.`,
        newMood: AgentMood.NEUTRAL,
        isLockout: true,
        phoneDeadDays: daysRemaining,
      };
    }

    // Check for lowball
    const offerAPY = getContractOfferAveragePerYear(offer);
    const percentOfMarket = state.marketValue > 0 ? offerAPY / state.marketValue : 0;

    if (percentOfMarket < 0.9) {
      state.lowballCount++;

      if (state.lowballCount >= state.agent.lowballTolerance) {
        // Lockout!
        state.isLockedOut = true;
        state.lockoutReason = `Agent has rejected offer after ${state.lowballCount} insulting lowballs.`;
        state.agentMood = AgentMood.ANGRY;

        // Shark agents leak to press
        if (state.agent.archetype === AgentArchetype.SHARK && state.agent.willLeakToPress) {
          this._generatePressLeak(state, offer);
        }

        return {
          accepted: false,
          message: `${state.agent.name}: "We're done here. You've insulted my client ${state.lowballCount} times."`,
          newMood: AgentMood.ANGRY,
          isLockout: true,
          phoneDeadDays: 0,
        };
      } else {
        state.agentMood = AgentMood.DISAPPOINTED;
        return {
          accepted: false,
          message: `${state.agent.name}: "That's ${Math.round(percentOfMarket * 100)}% of market value. My client is insulted."`,
          newMood: AgentMood.DISAPPOINTED,
          isLockout: false,
          phoneDeadDays: 0,
        };
      }
    }

    // Route to archetype-specific evaluator
    const response = this._evaluateByArchetype(state, offer, percentOfMarket);

    // Update state after evaluation
    state.currentOffer = offer;
    state.negotiationRound++;
    state.agentMood = response.newMood;
    this.negotiations.set(playerId, state);

    return response;
  }

  /**
   * Resolve a holdout situation.
   */
  resolveHoldout(
    playerId: string,
    resolution: 'CAVE_IN' | 'FINE' | 'PROVE_IT'
  ): void {
    const state = this.negotiations.get(playerId);
    if (!state) return;

    switch (resolution) {
      case 'CAVE_IN':
        state.holdoutStatus = 'RESOLVED';
        state.leverage.agentLeverage = Math.min(
          1.0,
          state.leverage.agentLeverage + 0.3
        );
        break;
      case 'FINE':
        // Fining increases pressure but doesn't resolve
        state.agentMood = AgentMood.ANGRY;
        break;
      case 'PROVE_IT':
        state.holdoutStatus = 'RESOLVED';
        break;
    }

    this.negotiations.set(playerId, state);
  }

  /**
   * Handle shadow advisor response.
   */
  respondToShadowAdvisor(
    playerId: string,
    action: 'ENGAGE' | 'REPORT'
  ): void {
    const state = this.negotiations.get(playerId);
    if (!state) return;

    if (action === 'ENGAGE') {
      state.leverage.agentLeverage = Math.min(
        1.0,
        state.leverage.agentLeverage + 0.15
      );
    } else if (action === 'REPORT') {
      state.isLockedOut = true;
      state.lockoutReason =
        'Reported shadow advisor to League Office. Player refuses to negotiate.';
    }

    state.pendingShadowEvent = undefined;
    this.negotiations.set(playerId, state);
  }

  /**
   * Get current negotiation state for UI rendering.
   */
  getPlayerNegotiationState(
    playerId: string
  ): PlayerNegotiationState | undefined {
    return this.negotiations.get(playerId);
  }

  /**
   * Clear negotiation (called after signing or lockout resolution).
   */
  clearNegotiation(playerId: string): void {
    this.negotiations.delete(playerId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────────

  /**
   * Calculate initial leverage based on team/player state.
   */
  private _calculateLeverage(
    player: Player,
    marketValue: number,
    capSpace: number,
    positionDepth: number,
    isContender: boolean
  ): NegotiationLeverage {
    let userLeverage = 0.5;
    let agentLeverage = 0.5;

    // User leverage: cap space flexibility
    if (capSpace > marketValue * 2) {
      userLeverage += 0.15;
    }
    // User leverage: position depth
    if (positionDepth >= 3) {
      userLeverage += 0.15;
    }
    // User leverage: player is injured
    if (player.injuryStatus !== InjuryStatus.HEALTHY) {
      userLeverage += 0.2;
    }

    // Agent leverage: agent has reputation
    if (player.personality && player.personality.ego >= 80) {
      agentLeverage += 0.2;
    }
    // Agent leverage: player is marketable
    if (player.personality && player.personality.marketability >= 70) {
      agentLeverage += 0.1;
    }
    // Agent leverage: team is contender (overpays)
    if (isContender) {
      agentLeverage += 0.15;
    }

    // Clamp both to [0, 1]
    userLeverage = Math.max(0, Math.min(1, userLeverage));
    agentLeverage = Math.max(0, Math.min(1, agentLeverage));

    // Normalize so they sum to ~1
    const total = userLeverage + agentLeverage;
    if (total > 0) {
      userLeverage /= total;
      agentLeverage /= total;
    }

    return { userLeverage, agentLeverage };
  }

  /**
   * Route offer evaluation to archetype-specific handler.
   */
  private _evaluateByArchetype(
    state: PlayerNegotiationState,
    offer: ContractOffer,
    percentOfMarket: number
  ): NegotiationResponse {
    switch (state.agent.archetype) {
      case AgentArchetype.SHARK:
        return this._evaluateShark(state, offer, percentOfMarket);
      case AgentArchetype.UNCLE:
        return this._evaluateUncle(state, offer, percentOfMarket);
      case AgentArchetype.BRAND_BUILDER:
        return this._evaluateBrandBuilder(state, offer, percentOfMarket);
      case AgentArchetype.SELF_REPRESENTED:
        return this._evaluateSelfRepresented(state, offer, percentOfMarket);
      default:
        return {
          accepted: false,
          message: 'Unexpected agent archetype',
          newMood: AgentMood.NEUTRAL,
          isLockout: false,
          phoneDeadDays: 0,
        };
    }
  }

  /**
   * SHARK evaluator: demands high guaranteed money.
   */
  private _evaluateShark(
    state: PlayerNegotiationState,
    offer: ContractOffer,
    percentOfMarket: number
  ): NegotiationResponse {
    const guaranteedPct = getContractOfferGuaranteedPercentage(offer);
    const requiredGuaranteed =
      0.85 / state.agent.guaranteedMoneyWeight;

    if (guaranteedPct < requiredGuaranteed && percentOfMarket < 0.95) {
      return {
        accepted: false,
        message: `${state.agent.name}: "Only ${Math.round(guaranteedPct * 100)}% guaranteed? The Cowboys are offering more."`,
        newMood: AgentMood.ANGRY,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    if (
      guaranteedPct >= requiredGuaranteed &&
      percentOfMarket >= 0.95
    ) {
      return {
        accepted: true,
        message: `${state.agent.name}: "That's solid security. My client likes it. Deal."`,
        newMood: AgentMood.EXCITED,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    // Counter with higher guaranteed
    const counterGuaranteed = offer.totalValue * 0.85;
    return {
      accepted: false,
      message: `${state.agent.name}: "Close, but we need $${(counterGuaranteed / 1_000_000).toFixed(1)}M guaranteed."`,
      newMood: AgentMood.NEUTRAL,
      isLockout: false,
      phoneDeadDays: 0,
      counterOffer: {
        ...offer,
        guaranteedMoney: counterGuaranteed,
      },
    };
  }

  /**
   * UNCLE evaluator: willing to discount for contender/starting role.
   */
  private _evaluateUncle(
    state: PlayerNegotiationState,
    offer: ContractOffer,
    percentOfMarket: number
  ): NegotiationResponse {
    let acceptanceThreshold = 0.95;
    // Discount applied if conditions met (simplified for now)
    const appliedDiscount = state.agent.willingToDiscount || 0;
    acceptanceThreshold -= appliedDiscount;

    if (percentOfMarket >= acceptanceThreshold) {
      return {
        accepted: true,
        message: `${state.agent.name}: "Fair deal. He likes the coaches. Let's sign."`,
        newMood: AgentMood.EXCITED,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    return {
      accepted: false,
      message: `${state.agent.name}: "We want to work with you, but need a bit more."`,
      newMood: AgentMood.INTERESTED,
      isLockout: false,
      phoneDeadDays: 0,
    };
  }

  /**
   * BRAND_BUILDER evaluator: refuses long-term deals.
   */
  private _evaluateBrandBuilder(
    state: PlayerNegotiationState,
    offer: ContractOffer,
    percentOfMarket: number
  ): NegotiationResponse {
    const maxYears = state.agent.maxContractLength;

    if (offer.years > maxYears) {
      return {
        accepted: false,
        message: `${state.agent.name}: "${offer.years} years? No. We're doing ${maxYears} years MAX. My client wants to hit Free Agency again at his peak."`,
        newMood: AgentMood.ANGRY,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    if (percentOfMarket >= 1.0 && offer.years <= 2) {
      return {
        accepted: true,
        message: `${state.agent.name}: "Perfect. Short, rich contract. My client bets on himself."`,
        newMood: AgentMood.EXCITED,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    return {
      accepted: false,
      message: `${state.agent.name}: "We'll do ${maxYears} years at market rate. Non-negotiable."`,
      newMood: AgentMood.NEUTRAL,
      isLockout: false,
      phoneDeadDays: 0,
    };
  }

  /**
   * SELF_REPRESENTED evaluator: volatile and unpredictable.
   */
  private _evaluateSelfRepresented(
    state: PlayerNegotiationState,
    offer: ContractOffer,
    percentOfMarket: number
  ): NegotiationResponse {
    const volatilityRoll = Math.random() * 100;
    const volatilityThreshold = state.agent.volatility || 60;

    if (percentOfMarket < 0.95 && volatilityRoll < volatilityThreshold) {
      // BREAKDOWN!
      state.isLockedOut = true;
      state.lockoutReason =
        'Player took lowball personally. No contact for 2 weeks.';
      state.phoneDeadUntilRound = state.negotiationRound + 2;
      return {
        accepted: false,
        message: `"You think I'm worth THAT? I'm hanging up. Don't call me for two weeks."`,
        newMood: AgentMood.ANGRY,
        isLockout: true,
        phoneDeadDays: 14,
      };
    }

    if (percentOfMarket >= 1.05) {
      return {
        accepted: true,
        message: `"You respect my game. I respect that. Let's do it."`,
        newMood: AgentMood.EXCITED,
        isLockout: false,
        phoneDeadDays: 0,
      };
    }

    return {
      accepted: false,
      message: `"It's close... but I know what the Raiders are paying."`,
      newMood: AgentMood.INTERESTED,
      isLockout: false,
      phoneDeadDays: 0,
    };
  }

  /**
   * Generate a press leak when agent willLeakToPress and offer is insulting.
   */
  private _generatePressLeak(
    state: PlayerNegotiationState,
    offer: ContractOffer
  ): void {
    const leak: PressLeak = {
      id: `leak_${state.playerId}_${Date.now()}`,
      playerName: '', // Would need to pass player firstName + lastName
      teamName: 'Your Team',
      offerAmount: getContractOfferAveragePerYear(offer),
      marketValue: state.marketValue,
      headline: `Agent Calls Offer 'Disrespectful' to Free Agent - Sources`,
      timestamp: new Date(),
    };

    state.pressLeaks.push(leak);
  }
}
