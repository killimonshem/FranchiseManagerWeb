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
    await new Promise<void>(resolve => setTimeout(resolve, 1500));

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
      `${team.fullName} takes ${selectedProspect.name} (${selectedProspect.position}) in round ${round}.`,
      'draft',
      'medium',
    );
  }

  private async _handleUserPick(pickNumber: number, round: number): Promise<void> {
    // 5% chance of a mid-draft trade-up offer before the user picks
    if (Math.random() < 0.05) {
      const tradingTeam = this._findTradeUpCandidate(pickNumber);
      if (tradingTeam) {
        this._host.pushEngineInterrupt(
          HardStopReason.TRADE_OFFER_RECEIVED,
          {
            offerId: `draft-trade-${pickNumber}`,
            pickNumber,
            round,
            tradingTeamId: tradingTeam.id,
            description: `Trade-up offer: ${tradingTeam.fullName} wants to move up to pick #${pickNumber}.`,
          },
          `Trade-Up Offer — Pick #${pickNumber}`,
          `${tradingTeam.fullName} is offering a 2nd and 4th round pick to move up to your spot.`,
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
    const prospects = this._host.draftProspects;
    if (prospects.length === 0) return null;

    // Simple AI: pick the first available prospect
    // (A real implementation would check positional need — left for CoachingSystem)
    return prospects[0] ?? null;
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
