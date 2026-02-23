/**
 * DraftTradeProcessor.ts
 * Processes draft trade data and applies trades to draft order
 *
 * Converts the drafttrade.json dataset into a usable structure for the draft system.
 * Tracks which teams own which picks for each year.
 */

import draftTradeData from '../../public/data/drafttrade.json';

export interface DraftTrade {
  year: number;
  round: number;
  originalTeamId: string;
  newOwnerId: string;
  notes?: string;
}

export interface DraftPickOwnership {
  year: number;
  round: number;
  pickNumber: number; // 1-32 (or 33+ for comp picks)
  originalTeamId: string;
  currentOwnerId: string;
  notes?: string;
}

/**
 * Parse draft trade JSON data into a typed structure
 */
export function parseDraftTradeData(): DraftTrade[] {
  const trades: DraftTrade[] = [];

  if (!draftTradeData.traded_picks) {
    console.warn('⚠️ No traded_picks found in draft trade data');
    return trades;
  }

  for (const pick of draftTradeData.traded_picks) {
    trades.push({
      year: pick.year,
      round: pick.round,
      originalTeamId: pick.original_team,
      newOwnerId: pick.new_owner,
      notes: pick.notes,
    });
  }

  console.log(`✅ Loaded ${trades.length} draft trades from data`);
  return trades;
}

/**
 * Get the base draft order for a specific year
 * (worst team picks first, 1-32 for each round)
 */
export function getBaseTeamOrderForYear(year: number): string[] {
  // Use the 2026 order if available, otherwise return empty
  if (year === 2026 && draftTradeData.base_draft_order_2026) {
    return draftTradeData.base_draft_order_2026;
  }

  // For future years, would need to recalculate based on season results
  // For now, return a default order
  return draftTradeData.base_draft_order_2026 || [];
}

/**
 * Build a complete pick ownership map for a specific year
 * Shows which team owns each pick (accounting for trades)
 */
export function buildDraftPickOwnershipMap(year: number): Map<string, string> {
  const baseOrder = getBaseTeamOrderForYear(year);
  const trades = parseDraftTradeData().filter((t) => t.year === year);

  // Initialize: each team owns their base picks in all rounds
  const ownership = new Map<string, string>();

  // Build pick identifier for all 7 rounds
  for (let round = 1; round <= 7; round++) {
    for (let pick = 1; pick <= 32; pick++) {
      const pickId = `${year}-${round}-${pick}`;
      const teamIndex = (pick - 1) % baseOrder.length;
      const originalOwner = baseOrder[teamIndex] || '';
      ownership.set(pickId, originalOwner);
    }
  }

  // Apply trades: update ownership for traded picks
  for (const trade of trades) {
    // Find all picks from originalTeamId in this round and reassign to newOwnerId
    // Each team trades away exactly one pick per round
    const basePickId = `${year}-${trade.round}-${trade.originalTeamId}`;

    // Find the pick number for this team in this round
    for (let pick = 1; pick <= 32; pick++) {
      const pickId = `${year}-${trade.round}-${pick}`;
      const owner = ownership.get(pickId);

      if (owner === trade.originalTeamId) {
        // Found this team's pick in this round - reassign to new owner
        ownership.set(pickId, trade.newOwnerId);
        console.log(
          `  🔄 ${trade.year} R${trade.round}P${pick}: ${trade.originalTeamId} → ${trade.newOwnerId}`
        );
        break;
      }
    }
  }

  return ownership;
}

/**
 * Get the draft order for a specific round, accounting for all trades
 * Returns an array of team IDs in pick order (1-32, potentially + comp picks)
 */
export function getDraftOrderForRound(year: number, round: number): string[] {
  const baseOrder = getBaseTeamOrderForYear(year);
  const trades = parseDraftTradeData().filter(
    (t) => t.year === year && t.round === round
  );

  // Start with base order
  let roundOrder = [...baseOrder];

  // Apply trades for this round
  // Trades swap positions in the order
  for (const trade of trades) {
    const originalIndex = roundOrder.findIndex(
      (t) => t === trade.originalTeamId
    );
    if (originalIndex !== -1) {
      roundOrder[originalIndex] = trade.newOwnerId;
      console.log(
        `  📍 ${trade.year} R${round}: Position ${originalIndex + 1} now owned by ${trade.newOwnerId}`
      );
    }
  }

  return roundOrder;
}

/**
 * Get all trades affecting a specific team for a given year
 */
export function getTeamTradesForYear(teamId: string, year: number): DraftTrade[] {
  const trades = parseDraftTradeData().filter((t) => t.year === year);

  return trades.filter(
    (t) => t.originalTeamId === teamId || t.newOwnerId === teamId
  );
}

/**
 * Summary of draft trades for the game
 */
export function getTradesSummary(): {
  years: number[];
  totalTrades: number;
  tradesByYear: Record<number, number>;
} {
  const trades = parseDraftTradeData();
  const years = [...new Set(trades.map((t) => t.year))].sort();
  const tradesByYear: Record<number, number> = {};

  for (const year of years) {
    tradesByYear[year] = trades.filter((t) => t.year === year).length;
  }

  return {
    years,
    totalTrades: trades.length,
    tradesByYear,
  };
}

/**
 * Log a summary of draft trades to console
 */
export function logDraftTradesSummary(): void {
  const summary = getTradesSummary();
  console.log('📋 Draft Trades Summary');
  console.log(`   Total trades: ${summary.totalTrades}`);
  console.log(`   Years: ${summary.years.join(', ')}`);
  for (const year of summary.years) {
    console.log(
      `   ${year}: ${summary.tradesByYear[year]} trade${summary.tradesByYear[year] === 1 ? '' : 's'}`
    );
  }
}
