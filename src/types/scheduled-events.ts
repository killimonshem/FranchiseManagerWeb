/**
 * scheduled-events.ts — Static NFL calendar registry.
 *
 * `hasMajorEventThisWeek()` is not guesswork. It checks this registry to determine
 * whether a week can be batch-skipped in the dead zone (weeks 1–24).
 *
 * Rule: the engine ONLY consults this registry via `hasMajorEventThisWeek()` and
 * `getScheduledEvent()`. No sub-module checks its own clock.
 */

import { HardStopReason } from './engine-types';

export interface ScheduledEvent {
  week: number;
  name: string;
  triggerInterrupt?: HardStopReason; // If set, this event produces a hard stop
}

/** Authoritative list of every significant NFL calendar event by week. */
export const NFL_CALENDAR: ScheduledEvent[] = [
  { week: 3,  name: 'Franchise Tag Window Opens' },
  { week: 4,  name: 'League Year Ends / Contracts Expire',   triggerInterrupt: HardStopReason.LEAGUE_YEAR_RESET },
  { week: 5,  name: 'Free Agency Opens',                     triggerInterrupt: HardStopReason.FREE_AGENCY_OPEN  },
  { week: 9,  name: 'Scouting Combine' },
  { week: 14, name: 'Pre-Draft Trade Window Peak' },
  { week: 15, name: 'NFL Draft',                             triggerInterrupt: HardStopReason.DRAFT_PICK_READY  },
  { week: 16, name: 'UDFA Signing Period' },
  { week: 25, name: 'Preseason Begins' },
  { week: 28, name: '53-Man Roster Cutdown',                 triggerInterrupt: HardStopReason.ROSTER_CUTS_REQUIRED },
  { week: 29, name: 'Regular Season Begins' },
  { week: 42, name: 'Trade Deadline' },
  { week: 47, name: 'Wild Card Weekend' },
];

/**
 * Returns true if the given week has a major scheduled event that prevents
 * the engine from batch-skipping it in the dead zone.
 */
export function hasMajorEventThisWeek(week: number): boolean {
  return NFL_CALENDAR.some(event => event.week === week);
}

/**
 * Returns the scheduled event for a given week, if one exists.
 * Used by `checkForEngineInterrupts()` to surface calendar-driven hard stops.
 */
export function getScheduledEvent(week: number): ScheduledEvent | undefined {
  return NFL_CALENDAR.find(event => event.week === week);
}
