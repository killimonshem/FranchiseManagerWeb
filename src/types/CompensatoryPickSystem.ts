// CompensatoryPickSystem.ts
// NFL Compensatory Pick System - "Net Loss" Formula Implementation
// Allocates rounds 3-7 compensatory picks to teams based on free agent losses and gains

import { Position } from './nfl-types';

/**
 * MARK: - Compensatory System Types
 * Represents a Free Agency move to be evaluated for Comp Picks
 */
export interface FreeAgencyTransaction {
  id: string;
  playerId: string;
  playerPosition: Position;
  oldTeamId: string;
  newTeamId: string;

  // Contract Details used for valuation
  averageYearlyValue: number; // APY in dollars
  snapPercentage: number; // 0.0 to 1.0 (played last season)
  isAllPro: boolean; // Postseason honors
  isProBowl: boolean;

  // Eligibility Flags
  isUnrestrictedFreeAgent: boolean;
  contractExpiredNaturally: boolean; // False if cut/released
  signedBeforeDeadline: boolean; // Usually early May
  transactionDate: Date;
}

/**
 * Internal wrapper to track value and round assignment
 */
interface CompensatoryCFA {
  transaction: FreeAgencyTransaction;
  value: number;
  projectedRound: number | null; // 3 through 7, or null if not qualified
}

/**
 * Final compensatory pick output
 */
export interface CompPick {
  teamId: string;
  round: number; // 3-7
  overallRank: number; // Used for sorting within the round
  playerId: string; // Source player for tracking
  playerName: string; // For display purposes
}

/**
 * MARK: - CompensatoryPickSystem Service Class
 * Implements the NFL's "Net Loss" formula for compensatory pick allocation
 *
 * Rules Summary:
 * - UFAs who sign elsewhere (lost by old team) generate comp picks for that team
 * - UFAs who sign with you (gained by new team) cancel out your comp pick losses
 * - Max 4 comp picks per team, max 32 total league-wide
 * - Comp picks allocated in rounds 3-7 based on contract value and honors
 * - High-value players signed = cancellation of high-value losses
 */
export class CompensatoryPickSystem {
  // Configuration constants based on NFL averages
  private readonly round3CutoffPercentile = 0.95; // Top 5% of FA contracts
  private readonly round4CutoffPercentile = 0.90;
  private readonly round5CutoffPercentile = 0.85;
  private readonly round6CutoffPercentile = 0.75;
  private readonly round7CutoffPercentile = 0.65;

  // Minimum salary to qualify for any comp pick (prevents 750k minimum salaries from counting)
  private readonly minimumQualifyingSalary = 1_500_000;

  /**
   * Main entry point: Takes all FA moves from the offseason and returns the specific comp picks
   * to add to the draft order.
   *
   * Parameters:
   *   - transactions: All free agency signings from the completed FA period
   *   - playerNames: Map of playerId -> name for display purposes
   *
   * Returns: Array of CompPick objects to inject at end of rounds 3-7
   */
  calculateCompensatoryPicks(
    transactions: FreeAgencyTransaction[],
    playerNames: Map<string, string> = new Map(),
    debug: boolean = false
  ): CompPick[] {
    if (debug) console.log(`📊 [CompPicks] Processing ${transactions.length} free agency transactions...`);

    // ----------------------------
    // 1. Identify Qualifying CFAs
    // ----------------------------
    const cfas: CompensatoryCFA[] = transactions
      .filter((move) => {
        return (
          move.isUnrestrictedFreeAgent &&
          move.contractExpiredNaturally &&
          move.signedBeforeDeadline &&
          move.averageYearlyValue >= this.minimumQualifyingSalary
        );
      })
      .map((transaction) => ({
        transaction,
        value: 0,
        projectedRound: null
      }));

    if (debug) console.log(`✅ [CompPicks] Identified ${cfas.length} qualifying CFAs (UFA, expired, >= $1.5M APY)`);

    if (cfas.length === 0) {
      if (debug) console.log('ℹ️ [CompPicks] No qualifying CFAs - no comp picks generated');
      return [];
    }

    // ---------------------------------------------------
    // 2. Compute Value & Assign Rounds
    // ---------------------------------------------------
    for (const cfa of cfas) {
      cfa.value = this.calculateCFAValue(cfa.transaction);
    }

    // Sort by value descending (Highest value players first)
    cfas.sort((a, b) => b.value - a.value);

    // Assign Rounds based on percentile
    const totalCFAs = cfas.length;

    for (let index = 0; index < cfas.length; index++) {
      const percentile = 1.0 - index / totalCFAs;

      if (percentile >= this.round3CutoffPercentile) {
        cfas[index].projectedRound = 3;
      } else if (percentile >= this.round4CutoffPercentile) {
        cfas[index].projectedRound = 4;
      } else if (percentile >= this.round5CutoffPercentile) {
        cfas[index].projectedRound = 5;
      } else if (percentile >= this.round6CutoffPercentile) {
        cfas[index].projectedRound = 6;
      } else if (percentile >= this.round7CutoffPercentile) {
        cfas[index].projectedRound = 7;
      } else {
        cfas[index].projectedRound = null; // Does not qualify
      }
    }

    // Filter out those that didn't make the cut
    const qualifiedCFAs = cfas.filter((cfa) => cfa.projectedRound !== null);
    if (debug) console.log(`✅ [CompPicks] ${qualifiedCFAs.length} CFAs assigned to rounds 3-7`);

    // ------------------------------------------
    // 3. Group by Team (Lost vs Gained)
    // ------------------------------------------
    interface TeamLedger {
      lost: CompensatoryCFA[];
      gained: CompensatoryCFA[];
    }

    const teamLedgers = new Map<string, TeamLedger>();

    for (const cfa of qualifiedCFAs) {
      // Add to Old Team's LOST list
      const oldTeamId = cfa.transaction.oldTeamId;
      if (!teamLedgers.has(oldTeamId)) {
        teamLedgers.set(oldTeamId, { lost: [], gained: [] });
      }
      teamLedgers.get(oldTeamId)!.lost.push(cfa);

      // Add to New Team's GAINED list
      const newTeamId = cfa.transaction.newTeamId;
      if (!teamLedgers.has(newTeamId)) {
        teamLedgers.set(newTeamId, { lost: [], gained: [] });
      }
      teamLedgers.get(newTeamId)!.gained.push(cfa);
    }

    if (debug) console.log(`✅ [CompPicks] Grouped into ${teamLedgers.size} teams with gains/losses`);

    // ---------------------------------------------
    // 4. Cancellation Formula
    // ---------------------------------------------
    const preliminaryPicks: CompPick[] = [];

    for (const [teamId, ledger] of teamLedgers.entries()) {
      // Sort lists by value descending to optimize cancellation strategy
      const sortedLost = ledger.lost.sort((a, b) => b.value - a.value);
      const sortedGained = ledger.gained.sort((a, b) => b.value - a.value);

      let uncancelledLost = [...sortedLost];

      // Iterate through every player gained to cancel out a lost player
      for (const gainedPlayer of sortedGained) {
        const gainedRound = gainedPlayer.projectedRound;
        if (gainedRound === null) continue;

        // Rule A: Cancel highest value lost player of the SAME round
        const sameRoundIndex = uncancelledLost.findIndex(
          (cfa) => cfa.projectedRound === gainedRound
        );
        if (sameRoundIndex !== -1) {
          uncancelledLost.splice(sameRoundIndex, 1);
          if (debug) console.log(
            `  📋 [Cancel] Team ${teamId}: Gained round ${gainedRound} player cancels lost round ${gainedRound} pick`
          );
          continue;
        }

        // Rule B: Cancel highest value lost player of a LOWER round
        // (Lower value = higher round number, e.g., round 4 is lower than round 3)
        const lowerRoundIndex = uncancelledLost.findIndex(
          (cfa) => (cfa.projectedRound ?? 8) > gainedRound
        );
        if (lowerRoundIndex !== -1) {
          const cancelledRound = uncancelledLost[lowerRoundIndex].projectedRound;
          uncancelledLost.splice(lowerRoundIndex, 1);
          if (debug) console.log(
            `  📋 [Cancel] Team ${teamId}: Gained round ${gainedRound} player cancels lost round ${cancelledRound} pick`
          );
          continue;
        }

        // Rule C: If neither A nor B applies, cancel the highest available lost player
        // (Prevents team manipulation of the system)
        if (uncancelledLost.length > 0) {
          const cancelledRound = uncancelledLost[0].projectedRound;
          uncancelledLost.splice(0, 1);
          if (debug) console.log(
            `  📋 [Cancel] Team ${teamId}: Gained player cancels highest remaining lost round ${cancelledRound} pick`
          );
        }
      }

      // ---------------------------------------------------------
      // 5. Create Preliminary Picks (Max 4 per team)
      // ---------------------------------------------------------
      const eligiblePicks = uncancelledLost.slice(0, 4); // Max 4 per team

      for (const cfa of eligiblePicks) {
        if (cfa.projectedRound !== null) {
          const playerName = playerNames.get(cfa.transaction.playerId) || 'Unknown Player';
          preliminaryPicks.push({
            teamId: cfa.transaction.oldTeamId,
            round: cfa.projectedRound,
            overallRank: Math.floor(cfa.value),
            playerId: cfa.transaction.playerId,
            playerName
          });
        }
      }
      if (debug && eligiblePicks.length > 0) {
        console.log(`  ✅ Team ${teamId} awarded ${eligiblePicks.length} comp picks`);
      }
    }

    // ---------------------------------------------------------
    // 6. League Limits (Max 32 Total) & Final Output
    // ---------------------------------------------------------

    // Sort all picks league-wide by value (highest value gets priority in round placement)
    preliminaryPicks.sort((a, b) => b.overallRank - a.overallRank);

    // Hard cap of 32 picks
    const finalPicks = preliminaryPicks.slice(0, 32);

    if (debug) {
      console.log(`✅ [CompPicks] Generated ${finalPicks.length} total compensatory picks (max 32)`);
      const byRound = new Map<number, number>();
      for (const pick of finalPicks) {
        byRound.set(pick.round, (byRound.get(pick.round) || 0) + 1);
      }
      for (const [round, count] of byRound.entries()) {
        console.log(`  Round ${round}: ${count} picks`);
      }
    }

    return finalPicks;
  }

  /**
   * Proprietary Value Formula
   * Based on "OverTheCap" analysis of the NFL formula
   * - Salary is roughly 75-80% of the equation
   * - Snap counts and honors act as multipliers
   *
   * Parameters:
   *   - transaction: The free agency transaction to evaluate
   *
   * Returns: Normalized value score (higher = more likely to generate a comp pick)
   */
  private calculateCFAValue(transaction: FreeAgencyTransaction): number {
    let normalizedSalary = transaction.averageYearlyValue / 1_000_000; // Millions
    let score = normalizedSalary;

    // Snap count bonus (played time increases value)
    if (transaction.snapPercentage > 0.75) {
      score *= 1.1;
    } else if (transaction.snapPercentage > 0.5) {
      score *= 1.05;
    }

    // Honors bonus (significant multipliers)
    if (transaction.isAllPro) {
      score *= 1.25;
    } else if (transaction.isProBowl) {
      score *= 1.15;
    }

    return score * 100; // Scale to integer-friendly range
  }

  /**
   * Diagnostic: Print detailed breakdown of comp pick calculations
   * Useful for debugging and understanding why certain teams received picks
   */
  printCompensatoryPickDiagnostics(transactions: FreeAgencyTransaction[]): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPENSATORY PICK SYSTEM DIAGNOSTICS');
    console.log('='.repeat(70));

    const cfas = transactions
      .filter(
        (move) =>
          move.isUnrestrictedFreeAgent &&
          move.contractExpiredNaturally &&
          move.signedBeforeDeadline &&
          move.averageYearlyValue >= this.minimumQualifyingSalary
      )
      .map((transaction) => ({
        transaction,
        value: this.calculateCFAValue(transaction),
        projectedRound: null as number | null
      }))
      .sort((a, b) => b.value - a.value);

    console.log('\nTop 10 CFA Values:');
    for (let i = 0; i < Math.min(10, cfas.length); i++) {
      const cfa = cfas[i];
      console.log(
        `  ${i + 1}. Value: ${cfa.value.toFixed(0)} | ` +
          `APY: $${(cfa.transaction.averageYearlyValue / 1_000_000).toFixed(1)}M | ` +
          `Snap%: ${(cfa.transaction.snapPercentage * 100).toFixed(0)}% | ` +
          `PB: ${cfa.transaction.isProBowl} | AP: ${cfa.transaction.isAllPro}`
      );
    }

    console.log('='.repeat(70) + '\n');
  }
}
