/**
 * FinanceSystem.ts
 *
 * Separates "Salary Cap" (league accounting) from "Cash Reserves"
 * (the owner's actual bank account). Creates real financial tension:
 * a team can be cap-rich but cash-poor, blocking large signing bonuses.
 *
 * Rules:
 *  - Pure TypeScript class, zero React imports.
 *  - Injected into GameStateManager.
 *  - `processWeeklyFinances()` is called inside the engine's RECAP time slot
 *    during regular season weeks (29–46).
 */

import type { Team } from '../types/team';
import type { Player } from '../types/player';

// ─── Cash Reserve Tiers ───────────────────────────────────────────────────────

export enum CashReserveTier {
  /** >$100M. Can afford massive signing bonuses to restructure the cap. */
  WEALTHY     = 'WEALTHY',
  /** $50M–$100M. Standard operations, modest bonus flexibility. */
  COMFORTABLE = 'COMFORTABLE',
  /**
   * $10M–$50M. Must structure contracts carefully.
   * UI should warn the user before large signing bonuses.
   */
  TIGHT       = 'TIGHT',
  /**
   * <$10M. HARD BLOCK: user cannot offer contracts with a signing bonus.
   * Only base-salary-heavy structures are available.
   */
  CRISIS      = 'CRISIS',
}

// ─── Weekly finance snapshot ──────────────────────────────────────────────────

export interface WeeklyFinanceReport {
  teamId: string;
  week: number;
  openingBalance: number;
  ticketRevenue: number;
  merchandiseRevenue: number;
  tvRevenue: number;
  weeklyBaseSalaries: number;
  weeklyCapHit: number;
  signingBonusesPaid: number;
  closingBalance: number;
  tier: CashReserveTier;
}

// ─── System class ─────────────────────────────────────────────────────────────

export class FinanceSystem {
  // Signing bonus payments staged in the current week (cleared each week)
  private _pendingSigningBonuses = new Map<string, number>(); // teamId → amount

  // ── Tier classification ─────────────────────────────────────────────────────

  getCashReserveTier(team: Team): CashReserveTier {
    const reserves = team.cashReserves ?? 0;
    if (reserves > 100_000_000) return CashReserveTier.WEALTHY;
    if (reserves > 50_000_000)  return CashReserveTier.COMFORTABLE;
    if (reserves > 10_000_000)  return CashReserveTier.TIGHT;
    return CashReserveTier.CRISIS;
  }

  /**
   * Returns true if the team can afford the requested signing bonus.
   * CRISIS teams are hard-blocked (returns false regardless of bonus size).
   */
  canAffordSigningBonus(team: Team, signingBonusAmount: number): boolean {
    const tier = this.getCashReserveTier(team);
    if (tier === CashReserveTier.CRISIS) return false;

    // Bonus must leave at least $10M in reserve after payment
    const postBonusReserves = (team.cashReserves ?? 0) - signingBonusAmount;
    return postBonusReserves > 10_000_000;
  }

  /**
   * Stage a signing bonus payment. The amount is deducted from cashReserves
   * immediately when the contract is signed (not prorated like the cap hit).
   */
  stageSigningBonus(team: Team, bonusAmount: number): boolean {
    if (!this.canAffordSigningBonus(team, bonusAmount)) return false;
    const current = this._pendingSigningBonuses.get(team.id) ?? 0;
    this._pendingSigningBonuses.set(team.id, current + bonusAmount);
    return true;
  }

  /**
   * Apply all staged signing bonuses to cashReserves.
   * Called once per contract signing — not on the weekly tick.
   */
  applySigningBonus(team: Team, bonusAmount: number): void {
    team.cashReserves = Math.max(0, (team.cashReserves ?? 0) - bonusAmount);
    this._pendingSigningBonuses.delete(team.id);
  }

  // ── Weekly tick ─────────────────────────────────────────────────────────────

  /**
   * Process one week of finances for a team.
   * Call from the engine's RECAP slot during weeks 29–46.
   *
   * Revenue sources: ticket sales + merchandise + TV deal (flat weekly share)
   * Expenses: 1/18th of annual base salaries (not cap hit — actual cash)
   */
  processWeeklyFinances(
    team: Team,
    allPlayers: Player[],
    week: number,
    isRegularSeason: boolean,
  ): WeeklyFinanceReport {
    const opening = team.cashReserves ?? 50_000_000;

    // ── Revenue ────────────────────────────────────────────────────────────────
    const fanMoodMultiplier = this._fanMoodFactor(team);

    // Ticket revenue scales with fan mood and stadium capacity
    const baseTicketRevenue = isRegularSeason
      ? (team.stadium ? 3_500_000 : 2_500_000) * fanMoodMultiplier
      : 0;

    // Merchandise: proportional to fan mood and market size
    const marketSizeFactor = team.fanBase?.marketSize === 'Large' ? 1.4
      : team.fanBase?.marketSize === 'Medium' ? 1.0
      : 0.7;
    const merchandiseRevenue = isRegularSeason
      ? 800_000 * fanMoodMultiplier * marketSizeFactor
      : 300_000; // Off-season licensing trickles in

    // TV deal: ~$300M/season per team, 1/18th per week
    const tvRevenue = isRegularSeason ? Math.round(300_000_000 / 18) : 0;

    // ── Expenses ───────────────────────────────────────────────────────────────
    // Base salary cash expense (NOT cap hit — guaranteed base per contract)
    const annualBaseSalaries = allPlayers
      .filter(p => p.teamId === team.id)
      .reduce((sum, p) => {
        // Base salary = cap hit minus prorated signing bonus
        const capHit = p.contract?.currentYearCap ?? 0;
        const proratedBonus = p.contract?.signingBonus
          ? p.contract.signingBonus / Math.max(1, p.contract.yearsRemaining + 1)
          : 0;
        return sum + Math.max(0, capHit - proratedBonus);
      }, 0);

    const weeklyBaseSalaries = isRegularSeason
      ? Math.round(annualBaseSalaries / 18)
      : 0;

    const weeklyCapHit = allPlayers
      .filter(p => p.teamId === team.id)
      .reduce((sum, p) => sum + (p.contract?.currentYearCap ?? 0), 0) / 18;

    // ── Net ────────────────────────────────────────────────────────────────────
    const netChange = baseTicketRevenue + merchandiseRevenue + tvRevenue - weeklyBaseSalaries;
    const closing = Math.max(0, opening + netChange);

    // Apply to the team object (mutation — intentional, this is the engine)
    team.cashReserves = closing;

    return {
      teamId: team.id,
      week,
      openingBalance: opening,
      ticketRevenue: baseTicketRevenue,
      merchandiseRevenue,
      tvRevenue,
      weeklyBaseSalaries,
      weeklyCapHit: Math.round(weeklyCapHit),
      signingBonusesPaid: 0,
      closingBalance: closing,
      tier: this.getCashReserveTier(team),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private _fanMoodFactor(team: Team): number {
    const mood = team.fanMorale ?? 50;
    // 0 mood = 0.5 revenue, 100 mood = 1.2 revenue
    return 0.5 + (mood / 100) * 0.7;
  }

  /** Formatted cash balance for display in the UI. */
  formatBalance(amount: number): string {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000)     return `$${(amount / 1_000_000).toFixed(1)}M`;
    return `$${(amount / 1_000).toFixed(0)}K`;
  }

  /** Summary label for a tier — used in finance UI banners. */
  getTierLabel(tier: CashReserveTier): string {
    switch (tier) {
      case CashReserveTier.WEALTHY:     return 'Financially Dominant';
      case CashReserveTier.COMFORTABLE: return 'Financially Stable';
      case CashReserveTier.TIGHT:       return 'Cash Constrained';
      case CashReserveTier.CRISIS:      return '⚠ Financial Crisis';
    }
  }

  getTierColor(tier: CashReserveTier): string {
    switch (tier) {
      case CashReserveTier.WEALTHY:     return '#D7F171'; // lime
      case CashReserveTier.COMFORTABLE: return '#9990A0'; // muted
      case CashReserveTier.TIGHT:       return '#F0A940'; // amber
      case CashReserveTier.CRISIS:      return '#E53E3E'; // red
    }
  }
}
