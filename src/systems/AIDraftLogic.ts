/**
 * AIDraftLogic.ts
 *
 * AI team draft selection based on fog-of-war scouting ranges and team needs.
 * AI does NOT see true overall values — it uses public scouting data (consensus grades,
 * medical evaluations, elite school recognition) to make realistic but imperfect picks.
 *
 * This ensures the draft board feels predictable (scouting range consensus) while
 * allowing AI to make mistakes (by valuing lower-ranked prospects over higher-ranked ones
 * if they fill team needs or fit other visible criteria).
 */

import type { DraftProspect } from '../types/GameStateManager';
import type { Team } from '../types/team';
import type { Player } from '../types/player';
import { Position } from '../types/nfl-types';

interface ProspectScore {
  prospect: DraftProspect;
  score: number;
}

/**
 * Analyze AI team's current roster and identify positional needs.
 * Returns array of positions that are under-filled.
 */
function analyzeTeamNeeds(team: Team, allPlayers: Player[]): Position[] {
  const rosters: Record<Position, number> = {
    [Position.QB]: 0,
    [Position.RB]: 0,
    [Position.WR]: 0,
    [Position.TE]: 0,
    [Position.OL]: 0,
    [Position.DL]: 0,
    [Position.LB]: 0,
    [Position.CB]: 0,
    [Position.S]: 0,
    [Position.K]: 0,
    [Position.P]: 0,
  };

  // Count current roster by position
  const teamRoster = allPlayers.filter(p => p.teamId === team.id && p.overall > 0);
  for (const player of teamRoster) {
    rosters[player.position]++;
  }

  // Define minimum roster requirements
  const MIN_ROSTER: Record<Position, number> = {
    [Position.QB]: 2,
    [Position.RB]: 3,
    [Position.WR]: 4,
    [Position.TE]: 2,
    [Position.OL]: 7,
    [Position.DL]: 6,
    [Position.LB]: 4,
    [Position.CB]: 4,
    [Position.S]: 2,
    [Position.K]: 1,
    [Position.P]: 1,
  };

  // Identify positions below minimum
  const needs: Position[] = [];
  for (const [pos, min] of Object.entries(MIN_ROSTER) as [Position, number][]) {
    if ((rosters[pos] ?? 0) < min) {
      needs.push(pos);
    }
  }

  return needs;
}

/**
 * Select the best prospect for an AI team based on scouting consensus, needs, and risk factors.
 * AI cannot see true overall — it only sees the public scouting range (min/max).
 */
export function selectProspectForAITeam(
  team: Team,
  prospects: DraftProspect[],
  allPlayers: Player[]
): DraftProspect | null {
  if (prospects.length === 0) return null;

  // 1. Analyze team's positional needs
  const needs = analyzeTeamNeeds(team, allPlayers);

  // 2. Score each prospect based on public information only
  const scoredProspects: ProspectScore[] = prospects.map(p => {
    let score = 0;

    // Base score: midpoint of scouting range (what scouts publicly agree on)
    const scoutingMidpoint = (p.scoutingRange.min + p.scoutingRange.max) / 2;
    score = scoutingMidpoint;

    // Big bonus (+15) if prospect fills a critical need
    if (needs.includes(p.position)) {
      score += 15;
    }

    // Medium bonus (+8) for elite schools (public recruitment data)
    const eliteSchools = [
      'Alabama',
      'Georgia',
      'Ohio State',
      'LSU',
      'Clemson',
      'Texas',
      'Michigan',
      'USC',
    ];
    if (eliteSchools.includes(p.college)) {
      score += 8;
    }

    // Penalty for poor medical grades (public combine data)
    if (p.medicalGrade === 'C') {
      score -= 8;
    } else if (p.medicalGrade === 'D') {
      score -= 15;
    }

    // Small penalty for UDFA tier (round 8)
    if (p.projectedRound === 8) {
      score -= 5;
    }

    // Slight recency bonus: later draft picks may prioritize bye-week fills
    // This prevents AI from reaching too far up the board early
    if (p.projectedRound > 3) {
      score -= 3; // Mild discount for later rounds
    }

    // Add controlled randomness (±5) so AI doesn't draft perfectly deterministically
    // This creates variance in board order while keeping it mostly predictable
    score += Math.random() * 10 - 5;

    return { prospect: p, score };
  });

  // 3. Sort by score descending and return the highest-scored prospect
  scoredProspects.sort((a, b) => b.score - a.score);
  return scoredProspects[0]?.prospect ?? null;
}
