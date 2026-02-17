/**
 * Cash Flow Management: Cap Rich vs Cash Poor
 * Converted from Swift CashFlowSystem.swift
 * Enables realistic financial constraints beyond salary cap
 */

import { Team } from "./team";
import { PlayerContract } from "./nfl-types";

// ============================================================================
// FINANCIAL HEALTH & CASH FLOW MODELS
// ============================================================================

export enum FinancialHealthTier {
  WEALTHY = "Wealthy",
  COMFORTABLE = "Comfortable",
  TIGHT = "Tight",
  STRAINED = "Strained",
  CRISIS = "Cash Crisis",
}

export function getFinancialHealthTierDescription(
  tier: FinancialHealthTier
): string {
  const descriptions: Record<FinancialHealthTier, string> = {
    [FinancialHealthTier.WEALTHY]:
      "💰 Wealthy: Can afford high signing bonuses and stadium upgrades",
    [FinancialHealthTier.COMFORTABLE]:
      "💵 Comfortable: Normal financial flexibility",
    [FinancialHealthTier.TIGHT]:
      "💸 Tight: Limited cash for big bonuses",
    [FinancialHealthTier.STRAINED]:
      "⚠️ Strained: Struggling to pay upfront costs",
    [FinancialHealthTier.CRISIS]:
      "🚨 CRISIS: Cannot afford signing bonuses or facility upgrades",
  };
  return descriptions[tier];
}

export function getFinancialHealthTierColor(tier: FinancialHealthTier): string {
  const colors: Record<FinancialHealthTier, string> = {
    [FinancialHealthTier.WEALTHY]: "#52C41A",
    [FinancialHealthTier.COMFORTABLE]: "#1890FF",
    [FinancialHealthTier.TIGHT]: "#FA8C16",
    [FinancialHealthTier.STRAINED]: "#FF6B00",
    [FinancialHealthTier.CRISIS]: "#F5222D",
  };
  return colors[tier];
}

export interface FinancialState {
  cashReserves: number;
}

/**
 * Check if team is in liquidity crisis
 */
export function isInLiquidityCrisis(state: FinancialState): boolean {
  return state.cashReserves < 10_000_000; // Less than $10M is crisis
}

/**
 * Calculate available cash for signing bonuses (up to 20% of reserves)
 */
export function getAvailableCashForBonuses(state: FinancialState): number {
  return state.cashReserves * 0.2;
}

/**
 * Get financial health tier based on cash reserves
 */
export function getFinancialHealthTier(state: FinancialState): FinancialHealthTier {
  if (state.cashReserves >= 100_000_000) {
    return FinancialHealthTier.WEALTHY;
  } else if (state.cashReserves >= 50_000_000) {
    return FinancialHealthTier.COMFORTABLE;
  } else if (state.cashReserves >= 20_000_000) {
    return FinancialHealthTier.TIGHT;
  } else if (state.cashReserves >= 10_000_000) {
    return FinancialHealthTier.STRAINED;
  }
  return FinancialHealthTier.CRISIS;
}

/**
 * Get financial state from team
 */
export function getTeamFinancialState(team: Team): FinancialState {
  return {
    cashReserves: team.cashReserves,
  };
}

// ============================================================================
// CASH AFFORDABILITY CHECKS
// ============================================================================

/**
 * Check if team can afford a signing bonus
 */
export function canAffordSigningBonus(
  team: Team,
  amount: number
): {
  canAfford: boolean;
  reason: string;
} {
  const financialState = getTeamFinancialState(team);
  const availableCash = getAvailableCashForBonuses(financialState);

  if (amount <= availableCash) {
    return {
      canAfford: true,
      reason: "Signing bonus approved",
    };
  }

  if (isInLiquidityCrisis(financialState)) {
    return {
      canAfford: false,
      reason: `🚨 CASH CRISIS: Cannot afford any signing bonuses. Cash reserves: ${formatCurrency(financialState.cashReserves)}`,
    };
  }

  const deficit = amount - availableCash;
  return {
    canAfford: false,
    reason: `Insufficient cash reserves. Need ${formatCurrency(deficit)} more. Current reserves: ${formatCurrency(financialState.cashReserves)}`,
  };
}

/**
 * Check if team can afford a stadium upgrade
 */
export function canAffordStadiumUpgrade(
  team: Team,
  cost: number
): {
  canAfford: boolean;
  reason: string;
} {
  if (cost <= team.cashReserves) {
    return {
      canAfford: true,
      reason: "Upgrade approved",
    };
  }

  const deficit = cost - team.cashReserves;
  return {
    canAfford: false,
    reason: `Need ${formatCurrency(deficit)} more cash reserves`,
  };
}

// ============================================================================
// CASH FLOW OPERATIONS
// ============================================================================

/**
 * Add revenue to team cash reserves
 */
export function addRevenueToTeam(team: Team, amount: number): Team {
  const updated = { ...team };
  updated.cashReserves += amount;
  console.log(
    `💵 ${updated.abbreviation} cash reserves: ${formatCurrency(updated.cashReserves)}`
  );
  return updated;
}

/**
 * Deduct cash for expense
 */
export function deductCashFromTeam(
  team: Team,
  amount: number,
  reason: string
): {
  success: boolean;
  updatedTeam?: Team;
} {
  if (amount <= team.cashReserves) {
    const updated = { ...team };
    updated.cashReserves -= amount;
    console.log(
      `💸 ${updated.abbreviation} paid ${formatCurrency(amount)} for ${reason}`
    );
    return {
      success: true,
      updatedTeam: updated,
    };
  }

  console.log(
    `❌ ${team.abbreviation} cannot afford ${formatCurrency(amount)} for ${reason}`
  );
  return {
    success: false,
  };
}

// ============================================================================
// CONTRACT STRUCTURE - CASH FRIENDLY
// ============================================================================

/**
 * Check if contract structure is cash-friendly
 * Cash-friendly = low upfront bonus, backloaded guarantees
 */
export function isCashFriendlyContract(contract: PlayerContract): boolean {
  return contract.signingBonus < contract.totalValue * 0.15;
}

/**
 * Get upfront cash required for contract
 */
export function getContractUpfrontCashRequired(contract: PlayerContract): number {
  return contract.signingBonus;
}

/**
 * Generate cash-friendly contract structure
 * Low signing bonus, but higher guaranteed money spread over years
 */
export function generateCashFriendlyContract(
  totalValue: number,
  years: number
): PlayerContract {
  const signingBonus = totalValue * 0.05; // Only 5% upfront
  const annualSalary = (totalValue - signingBonus) / years;
  const guaranteedMoney = totalValue * 0.6; // Still 60% guaranteed total

  return {
    totalValue,
    yearsRemaining: years,
    guaranteedMoney,
    currentYearCap: annualSalary,
    signingBonus,
    incentives: totalValue * 0.05,
    canRestructure: true,
    canCut: true,
    deadCap: guaranteedMoney * 0.5,
    hasNoTradeClause: false,
    approvedTradeDestinations: [],
  };
}

// ============================================================================
// FREE AGENCY CONSTRAINTS
// ============================================================================

export interface FreeAgentConstraints {
  capSpace: number;
  cashReserves: number;
  financialTier: FinancialHealthTier;
}

/**
 * Calculate maximum signing bonus based on financial tier
 */
export function getMaxSigningBonus(constraints: FreeAgentConstraints): number {
  switch (constraints.financialTier) {
    case FinancialHealthTier.WEALTHY:
      return Math.min(constraints.cashReserves * 0.3, 50_000_000);
    case FinancialHealthTier.COMFORTABLE:
      return Math.min(constraints.cashReserves * 0.2, 30_000_000);
    case FinancialHealthTier.TIGHT:
      return Math.min(constraints.cashReserves * 0.1, 15_000_000);
    case FinancialHealthTier.STRAINED:
      return Math.min(constraints.cashReserves * 0.05, 5_000_000);
    case FinancialHealthTier.CRISIS:
      return 0; // Cannot offer any signing bonus
  }
}

/**
 * Get user-facing message about cash constraints
 */
export function getConstraintMessage(
  constraints: FreeAgentConstraints
): string {
  const maxBonus = getMaxSigningBonus(constraints);

  switch (constraints.financialTier) {
    case FinancialHealthTier.WEALTHY:
      return `💰 You can offer competitive signing bonuses up to ${formatCurrency(maxBonus)}`;
    case FinancialHealthTier.COMFORTABLE:
      return `💵 Normal financial flexibility. Max signing bonus: ${formatCurrency(maxBonus)}`;
    case FinancialHealthTier.TIGHT:
      return `💸 Limited cash for bonuses. Max: ${formatCurrency(maxBonus)}. Consider cash-friendly structures.`;
    case FinancialHealthTier.STRAINED:
      return `⚠️ Cash strained. Max bonus: ${formatCurrency(maxBonus)}. Heavily backload contracts.`;
    case FinancialHealthTier.CRISIS:
      return `🚨 CASH CRISIS: Cannot offer signing bonuses. Only minimum contracts until cash improves.`;
  }
}

/**
 * Create free agent constraints from team
 */
export function createFreeAgentConstraints(
  team: Team,
  capSpace: number
): FreeAgentConstraints {
  const financialState = getTeamFinancialState(team);
  const tier = getFinancialHealthTier(financialState);

  return {
    capSpace,
    cashReserves: financialState.cashReserves,
    financialTier: tier,
  };
}

// ============================================================================
// CAP RICH VS CASH POOR DETECTION
// ============================================================================

/**
 * Check if team is "Cap Rich, Cash Poor"
 * Lots of cap space but low cash reserves
 */
export function isCapRichCashPoor(team: Team): boolean {
  const hasCapSpace = team.capSpace > 30_000_000;
  const financialState = getTeamFinancialState(team);
  const tier = getFinancialHealthTier(financialState);
  const lowCash =
    tier === FinancialHealthTier.TIGHT ||
    tier === FinancialHealthTier.STRAINED ||
    tier === FinancialHealthTier.CRISIS;

  return hasCapSpace && lowCash;
}

/**
 * Get warning message for cap rich, cash poor teams
 */
export function getCashWarningMessage(team: Team): string | null {
  if (isCapRichCashPoor(team)) {
    return `
⚠️ CAP RICH, CASH POOR
You have ${formatCurrency(team.capSpace)} in cap space, but only ${formatCurrency(team.cashReserves)} in cash reserves.

This limits your ability to:
• Offer competitive signing bonuses to free agents
• Execute stadium upgrades
• Pay upfront contract restructuring bonuses

Solution: Focus on cash-friendly contracts (low signing bonus, backloaded) or wait for revenue to accumulate.
    `.trim();
  }
  return null;
}

// ============================================================================
// FINANCIAL SCENARIOS
// ============================================================================

export interface FinancialScenario {
  name: string;
  description: string;
  tier: FinancialHealthTier;
  capSpace: number;
  cashReserves: number;
}

/**
 * Get common financial scenarios for testing
 */
export function getFinancialScenarios(): FinancialScenario[] {
  return [
    {
      name: "Wealthy",
      description: "High cap space, ample cash reserves",
      tier: FinancialHealthTier.WEALTHY,
      capSpace: 40_000_000,
      cashReserves: 120_000_000,
    },
    {
      name: "Comfortable",
      description: "Balanced cap and cash",
      tier: FinancialHealthTier.COMFORTABLE,
      capSpace: 25_000_000,
      cashReserves: 75_000_000,
    },
    {
      name: "Tight",
      description: "Good cap space, limited cash",
      tier: FinancialHealthTier.TIGHT,
      capSpace: 35_000_000,
      cashReserves: 25_000_000,
    },
    {
      name: "Strained",
      description: "Plenty of cap, very low cash",
      tier: FinancialHealthTier.STRAINED,
      capSpace: 40_000_000,
      cashReserves: 12_000_000,
    },
    {
      name: "Crisis",
      description: "Cap constrained and nearly broke",
      tier: FinancialHealthTier.CRISIS,
      capSpace: 5_000_000,
      cashReserves: 3_000_000,
    },
  ];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  const millions = amount / 1_000_000;
  if (millions >= 1) {
    return `$${millions.toFixed(2)}M`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

/**
 * Get financial health color by tier
 */
export function getFinancialHealthColor(tier: FinancialHealthTier): string {
  return getFinancialHealthTierColor(tier);
}

/**
 * Get financial summary for team
 */
export function getTeamFinancialSummary(team: Team): string {
  const state = getTeamFinancialState(team);
  const tier = getFinancialHealthTier(state);
  const maxBonus = getMaxSigningBonus({
    capSpace: team.capSpace,
    cashReserves: state.cashReserves,
    financialTier: tier,
  });

  return `
Financial Status: ${getFinancialHealthTierDescription(tier)}
Cash Reserves: ${formatCurrency(state.cashReserves)}
Cap Space: ${formatCurrency(team.capSpace)}
Max Signing Bonus: ${formatCurrency(maxBonus)}
In Crisis: ${isInLiquidityCrisis(state) ? "Yes ⚠️" : "No ✓"}
  `.trim();
}
