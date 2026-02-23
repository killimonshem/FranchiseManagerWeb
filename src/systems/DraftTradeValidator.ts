/**
 * DraftTradeValidator.ts
 * Validates that draft trade data loads correctly and provides diagnostic info
 */

import {
  parseDraftTradeData,
  getTradesSummary,
  logDraftTradesSummary,
  getDraftOrderForRound,
  buildDraftPickOwnershipMap,
} from './DraftTradeProcessor';

/**
 * Run validation on draft trade data
 */
export function validateDraftTrades(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Test 1: Parse trades
    const trades = parseDraftTradeData();
    if (trades.length === 0) {
      warnings.push('No trades loaded from draft trade data');
    }

    // Test 2: Validate years
    const summary = getTradesSummary();
    if (summary.years.length === 0) {
      errors.push('No trade years found');
    }

    // Test 3: Sample round orders for 2026
    for (let round = 1; round <= 3; round++) {
      try {
        const order = getDraftOrderForRound(2026, round);
        if (order.length !== 32) {
          warnings.push(
            `2026 Round ${round} order has ${order.length} picks (expected 32)`
          );
        }
      } catch (e) {
        errors.push(
          `Failed to get draft order for 2026 Round ${round}: ${(e as Error).message}`
        );
      }
    }

    // Test 4: Validate ownership map
    try {
      const ownership = buildDraftPickOwnershipMap(2026);
      if (ownership.size < 32 * 7) {
        warnings.push(
          `2026 ownership map has ${ownership.size} picks (expected ${32 * 7})`
        );
      }
    } catch (e) {
      errors.push(
        `Failed to build ownership map: ${(e as Error).message}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (e) {
    return {
      valid: false,
      errors: [`Validation failed: ${(e as Error).message}`],
      warnings,
    };
  }
}

/**
 * Log validation results
 */
export function logValidationResults(): void {
  console.log('\n📋 Draft Trade Validation Results');
  console.log('═══════════════════════════════════');

  const result = validateDraftTrades();

  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    result.errors.forEach((e) => console.error(`   ${e}`));
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    result.warnings.forEach((w) => console.warn(`   ${w}`));
  }

  if (result.valid) {
    console.log('✅ All validations passed!');
  }

  logDraftTradesSummary();
}
