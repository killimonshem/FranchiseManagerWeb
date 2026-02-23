/**
 * DraftEngine.ts
 *
 * The Draft is an active, interrupt-driven state machine — not a static screen
 * where the user clicks 7 times. This engine:
 *
 *  1. Runs an async clock (`startDraftClock`) that advances pick-by-pick.
 *  2. AI teams auto-pick after a realistic 1.5s pause.
 *  3. Before the user's pick, rolls a 5% chance for a mid-draft trade-up offer.
 *     If triggered, pushes a ProcessingInterrupt to the GameStateManager and pauses.
 *  4. Applies hidden potential (Gem/Bust) to drafted players using round-based
 *     hit rates. The true potential is NOT revealed to the user immediately.
 *
 * Rules:
 *  - Pure TypeScript class, zero React imports.
 *  - Injected into GameStateManager — never instantiated by the UI.
 *  - The UI reads draft state from gameStateManager.draftProspects and the
 *    interrupt queue; it never calls this class directly.
 */

import type { Player } from '../types/player';
import type { Team } from '../types/team';
import { HardStopReason } from '../types/engine-types';
import type { DraftProspect, TradeOffer } from '../types/GameStateManager';
import { Position } from '../types/nfl-types';
import bigboardJson from '../../bigboard.json';
import { selectProspectForAITeam } from './AIDraftLogic';

// ─── Gem / Bust constants (PRD §4.3) ─────────────────────────────────────────

/** Round-based success hit rates. Round 1 = 70%, Round 6 = 9%. */
const ROUND_HIT_RATES: Record<number, number> = {
  1: 0.70, 2: 0.55, 3: 0.40, 4: 0.25, 5: 0.15, 6: 0.09, 7: 0.07,
};

export enum DraftOutcome {
  BUST   = 'BUST',    // Potential capped a few points above current OVR
  NORMAL = 'NORMAL',  // Potential bumped +8 to +15
  GEM    = 'GEM',     // Rare: potential +20 to +25 — late-round superstar
}

// ─── Draft pick result ────────────────────────────────────────────────────────

export interface DraftPickResult {
  pickNumber: number;
  round: number;
  teamId: string;
  playerId: string;
  outcome: DraftOutcome;   // Hidden from UI until rookie season concludes
  potentialGranted: number;
}

// ─── Inject-style interface (avoids circular import) ─────────────────────────

export interface DraftEngineHost {
  // State reads
  allPlayers: Player[];
  teams: Team[];
  userTeamId: string | null;
  draftProspects: DraftProspect[];
  draftOrder: string[];       // Array of team IDs in pick order
  currentDraftRound: number;
  currentDraftPick: number;
  isDraftActive: boolean;

  // State mutations
  pushEngineInterrupt(reason: HardStopReason, payload: Record<string, unknown>, title: string, description: string): void;
  onDraftPickMade(result: DraftPickResult): void;
  onDraftComplete(): void;
  addHeadline(title: string, body: string, category: string, importance: string): void;
}

// ─── System class ─────────────────────────────────────────────────────────────

export class DraftEngine {
  private _host: DraftEngineHost;
  private _running = false;
  private _paused = false;
  private _pickResults: DraftPickResult[] = [];
  private _simulatingToNextUserPick = false;

  constructor(host: DraftEngineHost) {
    this._host = host;
  }

  get isRunning(): boolean { return this._running; }
  get pickResults(): DraftPickResult[] { return this._pickResults; }

  // ── Public controls ─────────────────────────────────────────────────────────

  /**
   * Start the draft clock. Advances pick-by-pick until all rounds are complete
   * or the draft is paused for a user decision.
   */
  async startDraftClock(totalRounds = 7): Promise<void> {
    if (this._running) return;
    this._running = true;
    this._paused = false;

    const totalPicksPerRound = this._host.draftOrder.length;

    for (let round = 1; round <= totalRounds; round++) {
      if (!this._running) break;

      for (let pickIdx = 0; pickIdx < totalPicksPerRound; pickIdx++) {
        if (!this._running) break;

        const teamId = this._host.draftOrder[pickIdx];
        const pickNumber = (round - 1) * totalPicksPerRound + pickIdx + 1;
        const isUserPick = teamId === this._host.userTeamId;

        if (isUserPick) {
          await this._handleUserPick(pickNumber, round);
          if (!this._running) break;
        } else {
          await this._handleAIPick(teamId, pickNumber, round);
        }

        // Non-blocking yield between picks
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }

    if (this._running) {
      this._running = false;
      this._host.onDraftComplete();
    }
  }

  /** Pause the clock (user pause or interrupt). */
  pause(): void {
    this._paused = true;
  }

  /**
   * Resume after the user has resolved an interrupt (trade-up accepted/rejected)
   * or manually selected their pick.
   */
  resume(): void {
    this._paused = false;
  }

  /** Hard stop — used when the game state manager stops the draft entirely. */
  stop(): void {
    this._running = false;
    this._paused = false;
  }

  /**
   * Fast-forward the draft until the user is on the clock.
   */
  simulateToNextUserPick(): void {
    this._simulatingToNextUserPick = true;
    if (this._paused) this.resume();
  }

  /**
   * Called by the UI when the user manually selects a player.
   * The clock waits for this via a polling promise.
   */
  private _pendingUserPickResolver: ((playerId: string) => void) | null = null;

  submitUserPick(playerId: string): void {
    this._pendingUserPickResolver?.(playerId);
    this._pendingUserPickResolver = null;
  }

  // ── Pick handlers ───────────────────────────────────────────────────────────

  private async _handleAIPick(
    teamId: string,
    pickNumber: number,
    round: number,
  ): Promise<void> {
    // Simulate the "on the clock" tension
    if (!this._simulatingToNextUserPick) {
      await new Promise<void>(resolve => setTimeout(resolve, 1500));
    }

    const team = this._host.teams.find(t => t.id === teamId);
    if (!team) return;

    const selectedProspect = this._selectBestProspectForTeam(team);
    if (!selectedProspect) return;

    const result = this._applyGemBust(selectedProspect.id, round, teamId, pickNumber);
    this._pickResults.push(result);
    this._host.onDraftPickMade(result);

    // Remove from prospect pool
    const idx = this._host.draftProspects.findIndex(p => p.id === selectedProspect.id);
    if (idx !== -1) this._host.draftProspects.splice(idx, 1);

    this._host.addHeadline(
      `Pick #${pickNumber}: ${team.abbreviation} selects`,
      `${team.city} ${team.name} takes ${selectedProspect.name} (${selectedProspect.position}) in round ${round}.`,
      'draft',
      'medium',
    );
  }

  private async _handleUserPick(pickNumber: number, round: number): Promise<void> {
    this._simulatingToNextUserPick = false;

    // 5% chance of a mid-draft trade-up offer before the user picks
    if (Math.random() < 0.05) {
      const tradingTeam = this._findTradeUpCandidate(pickNumber);
      if (tradingTeam) {
        // Build a minimal UI payload representing the trade-up offer so the
        // GameStateManager can execute it automatically if the user accepts.
        const year = new Date().getFullYear();
        const uiPayload = {
          offeringTeamId: tradingTeam.id,
          receivingTeamId: this._host.userTeamId ?? '',
          offeringPlayerIds: [] as string[],
          receivingPlayerIds: [] as string[],
          offeringPickIds: [`${year}-2-${tradingTeam.id}`, `${year}-4-${tradingTeam.id}`],
          receivingPickIds: [] as string[],
        };

        // Set pendingAITradeOffer on the host so resolveEngineInterrupt can
        // call executeTrade() when the user accepts the interrupt.
        try {
          (this._host as any).pendingAITradeOffer = uiPayload;
        } catch (e) {
          // Non-fatal — continue to push interrupt even if setting failed
          // eslint-disable-next-line no-console
          console.warn('Failed to set pendingAITradeOffer on host', e);
        }

        this._host.pushEngineInterrupt(
          HardStopReason.TRADE_OFFER_RECEIVED,
          {
            offerId: `draft-trade-${pickNumber}`,
            pickNumber,
            round,
            tradingTeamId: tradingTeam.id,
            description: `Trade-up offer: ${tradingTeam.city} ${tradingTeam.name} wants to move up to pick #${pickNumber}.`,
          },
          `Trade-Up Offer — Pick #${pickNumber}`,
          `${tradingTeam.city} ${tradingTeam.name} is offering a 2nd and 4th round pick to move up to your spot.`,
        );

        // Wait for the user to resolve the interrupt before continuing
        await this._waitForResume();
      }
    }

    if (!this._running) return;

    // Pause and wait for the user to call submitUserPick()
    const selectedPlayerId = await this._waitForUserSelection();
    if (!selectedPlayerId || !this._running) return;

    const result = this._applyGemBust(selectedPlayerId, round, this._host.userTeamId ?? '', pickNumber);
    this._pickResults.push(result);
    this._host.onDraftPickMade(result);

    const prospect = this._host.draftProspects.find(p => p.id === selectedPlayerId);
    if (prospect) {
      const idx = this._host.draftProspects.indexOf(prospect);
      if (idx !== -1) this._host.draftProspects.splice(idx, 1);
    }
  }

  // ── Gem / Bust generation (PRD §4.3) ───────────────────────────────────────

  /**
   * Roll the draft outcome for a player and apply their hidden potential.
   * The UI receives the player with the same visible OVR — potential is sealed.
   */
  rollDraftOutcome(round: number): DraftOutcome {
    const hitRate = ROUND_HIT_RATES[Math.min(7, Math.max(1, round))] ?? 0.07;
    const roll = Math.random();

    if (roll >= hitRate) {
      return DraftOutcome.BUST;
    }

    // Of successful picks: ~5% are Gems (any round)
    if (Math.random() < 0.05) {
      return DraftOutcome.GEM;
    }

    return DraftOutcome.NORMAL;
  }

  /**
   * Apply the outcome to the player's potential. The visible `overall` stat
   * is NOT changed here — only `potential` is updated, and it should not be
   * shown in the draft room UI.
   */
  applyHiddenPotential(player: Player, round: number): { outcome: DraftOutcome; potentialGranted: number } {
    const outcome = this.rollDraftOutcome(round);
    let potentialGrant: number;

    switch (outcome) {
      case DraftOutcome.GEM:
        potentialGrant = 20 + Math.floor(Math.random() * 6); // +20 to +25
        break;
      case DraftOutcome.NORMAL:
        potentialGrant = 8 + Math.floor(Math.random() * 8);  // +8 to +15
        break;
      case DraftOutcome.BUST:
        potentialGrant = 1 + Math.floor(Math.random() * 4);  // +1 to +4 only
        break;
    }

    // Potential is set relative to current overall, capped at 99
    player.potential = Math.min(99, player.overall + potentialGrant);

    return { outcome, potentialGranted: potentialGrant };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _applyGemBust(
    playerId: string,
    round: number,
    teamId: string,
    pickNumber: number,
  ): DraftPickResult {
    const player = this._host.allPlayers.find(p => p.id === playerId);
    let outcome = DraftOutcome.NORMAL;
    let potentialGranted = 0;

    if (player) {
      const result = this.applyHiddenPotential(player, round);
      outcome = result.outcome;
      potentialGranted = result.potentialGranted;

      // Assign player to team
      player.teamId = teamId;
      player.draftYear = new Date().getFullYear();
      player.draftRound = round;
      player.draftPick = pickNumber;
    }

    return { pickNumber, round, teamId, playerId, outcome, potentialGranted };
  }

  private _selectBestProspectForTeam(team: Team): DraftProspect | null {
    // AI uses fog-of-war logic: scouting consensus + team needs + risk factors.
    // AI does NOT see true overall — only public scouting data.
    return selectProspectForAITeam(team, this._host.draftProspects, this._host.allPlayers);
  }

  private _findTradeUpCandidate(pickNumber: number): Team | null {
    // Find a team picking after this slot that might want to move up
    const laterTeams = this._host.draftOrder
      .slice(pickNumber) // teams picking later
      .map(id => this._host.teams.find(t => t.id === id))
      .filter(Boolean) as Team[];

    if (laterTeams.length === 0) return null;
    return laterTeams[Math.floor(Math.random() * Math.min(5, laterTeams.length))];
  }

  private _waitForResume(): Promise<void> {
    return new Promise<void>(resolve => {
      const poll = () => {
        if (!this._paused || !this._running) { resolve(); return; }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  private _waitForUserSelection(): Promise<string | null> {
    return new Promise<string | null>(resolve => {
      this._pendingUserPickResolver = resolve;

      // Safety timeout: if the user takes >5 minutes, auto-pick best available
      setTimeout(() => {
        if (this._pendingUserPickResolver === resolve) {
          this._pendingUserPickResolver = null;
          const best = this._host.draftProspects[0];
          resolve(best?.id ?? null);
        }
      }, 5 * 60 * 1000);
    });
  }
}

// ─── Draft Class Hydration ────────────────────────────────────────────────────
//
// Standalone exports — called by GameStateManager at the start of each draft
// phase. These functions are pure: no side effects, no React imports.

interface BigBoardEntry {
  rank: number;
  player: string;              // "First Last"
  position: string;            // "QB", "WR", "EDGE", "IOL", etc.
  college: string;
  projection: string | null;   // "1st Round" … "7th Round" | null
  projected_team: string | null;
}

/** Maps bigboard projection string to a round number (1–7; 8 = UDFA). */
function projectionToRound(projection: string | null): number {
  if (!projection) return 8;
  const match = projection.match(/^(\d+)/);
  return match ? Math.min(7, parseInt(match[1], 10)) : 8;
}

/**
 * Maps bigboard position strings to the Position enum.
 * Bigboard uses NFL-scouting terminology ("EDGE", "IOL") that doesn't map
 * 1-to-1 to the game's simplified Position enum.
 */
function mapBigBoardPosition(pos: string): Position {
  switch (pos.toUpperCase()) {
    case 'QB':   return Position.QB;
    case 'RB':   return Position.RB;
    case 'WR':   return Position.WR;
    case 'TE':   return Position.TE;
    case 'OT':
    case 'OL':
    case 'IOL':
    case 'C':
    case 'G':    return Position.OL;
    case 'DL':
    case 'DT':
    case 'EDGE':
    case 'DE':   return Position.DL;
    case 'LB':
    case 'ILB':
    case 'OLB':  return Position.LB;
    case 'CB':   return Position.CB;
    case 'S':
    case 'SS':
    case 'FS':   return Position.S;
    case 'K':    return Position.K;
    case 'P':    return Position.P;
    default:     return Position.LB; // fallback
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMedicalGrade(): 'A' | 'B' | 'C' | 'D' {
  const roll = Math.random();
  if (roll < 0.50) return 'A';
  if (roll < 0.80) return 'B';
  if (roll < 0.95) return 'C';
  return 'D';
}

/**
 * Fog-of-war range visible to the user and AI before scouting.
 * Tighter ranges by projected round so board order feels more predictable.
 * 1st-rounders are more scrutinized, later rounds have wider variance.
 */
function computeScoutingRange(
  trueOvr: number,
  round: number,
): { min: number; max: number } {
  const halfWidth = round === 1 ? 3   // Narrower: scouts know top prospects well
    : round <= 3 ? 5   // Round 2-3: reasonable consensus
    : round <= 5 ? 7   // Round 4-5: more projection variance
    : round <= 7 ? 9   // Round 6-7: significant uncertainty
    : 12; // UDFA: very wide range
  return {
    min: Math.max(40, trueOvr - halfWidth),
    max: Math.min(99, trueOvr + halfWidth),
  };
}

function hydrateProspect(shell: BigBoardEntry): DraftProspect {
  const projectedRound = projectionToRound(shell.projection);

  let overall: number;
  let potential: number;
  switch (projectedRound) {
    case 1:
      overall   = randomInt(71, 84);
      potential = randomInt(85, 99);
      break;
    case 2:
    case 3:
      overall   = randomInt(65, 75);
      potential = randomInt(78, 90);
      break;
    default:
      overall   = randomInt(55, 68);
      potential = randomInt(65, 82);
  }

  const spaceIdx = shell.player.indexOf(' ');
  const firstName = spaceIdx > 0 ? shell.player.slice(0, spaceIdx) : shell.player;
  const lastName  = spaceIdx > 0 ? shell.player.slice(spaceIdx + 1) : '';

  return {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    name: shell.player,
    position: mapBigBoardPosition(shell.position),
    college: shell.college,
    overall: 0, // Masked for UI
    potential: 0, // Masked for UI
    trueOverall: overall,
    truePotential: potential,
    projectedRound,
    scoutingRange: computeScoutingRange(overall, projectedRound),
    scoutingPointsSpent: 0,
    medicalGrade: generateMedicalGrade(),
  };
}

// Small name pools for procedural generation (2028+)
const PROC_FIRST_NAMES = [
  'Marcus', 'DeShawn', 'Tyrell', 'Jordan', 'Elijah',
  'Malik', 'Jaylon', 'Darius', 'Cameron', 'Nathan',
  'Isaiah', 'Brendan', 'Trevon', 'Caleb', 'Derrick',
];
const PROC_LAST_NAMES = [
  'Williams', 'Johnson', 'Brown', 'Jackson', 'Davis',
  'Harris', 'Thompson', 'Moore', 'Walker', 'White',
  'Taylor', 'Anderson', 'Robinson', 'Clark', 'Mitchell',
];
// Weighted position distribution matching NFL roster composition
const PROC_POSITION_POOL: Position[] = [
  Position.QB, Position.QB,
  Position.RB, Position.RB, Position.RB,
  Position.WR, Position.WR, Position.WR, Position.WR, Position.WR,
  Position.TE, Position.TE,
  Position.OL, Position.OL, Position.OL, Position.OL, Position.OL,
  Position.DL, Position.DL, Position.DL, Position.DL,
  Position.LB, Position.LB, Position.LB,
  Position.CB, Position.CB, Position.CB, Position.CB,
  Position.S, Position.S,
  Position.K,
  Position.P,
];

/**
 * Weighted round selection for a 250-player class.
 * Targets ~32 R1, ~32 R2, ~38 R3, ~148 R4–7 to avoid league talent collapse.
 */
function pickProceduralRound(): number {
  const roll = Math.random();
  if (roll < 0.13) return 1;
  if (roll < 0.26) return 2;
  if (roll < 0.41) return 3;
  if (roll < 0.56) return 4;
  if (roll < 0.71) return 5;
  if (roll < 0.85) return 6;
  return 7;
}

function generateProceduralProspect(): DraftProspect {
  const projectedRound = pickProceduralRound();

  let overall: number;
  let potential: number;
  switch (projectedRound) {
    case 1:
      overall   = randomInt(71, 84);
      potential = randomInt(85, 99);
      break;
    case 2:
    case 3:
      overall   = randomInt(65, 75);
      potential = randomInt(78, 90);
      break;
    default:
      overall   = randomInt(55, 68);
      potential = randomInt(65, 82);
  }

  const firstName = PROC_FIRST_NAMES[Math.floor(Math.random() * PROC_FIRST_NAMES.length)];
  const lastName  = PROC_LAST_NAMES[Math.floor(Math.random() * PROC_LAST_NAMES.length)];
  const position  = PROC_POSITION_POOL[Math.floor(Math.random() * PROC_POSITION_POOL.length)];

  return {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    position,
    college: 'Unknown',
    overall: 0, // Masked for UI
    potential: 0, // Masked for UI
    trueOverall: overall,
    truePotential: potential,
    projectedRound,
    scoutingRange: computeScoutingRange(overall, projectedRound),
    scoutingPointsSpent: 0,
    medicalGrade: generateMedicalGrade(),
  };
}

/**
 * Generate the draft class for a given season year.
 * - Year matching bigboard.json (2026): hydrates all 750 real prospects.
 * - Any other year: generates 250 procedural prospects.
 *
 * Called by GameStateManager.onEnterDraftPhase().
 */
export function generateDraftClass(year: number): DraftProspect[] {
  const board = bigboardJson as { dataset_info: { year: number }; prospects: BigBoardEntry[] };
  if (year === board.dataset_info.year) {
    return board.prospects.map(hydrateProspect);
  }
  return Array.from({ length: 250 }, generateProceduralProspect);
}
