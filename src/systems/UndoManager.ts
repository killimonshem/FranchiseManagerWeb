/**
 * UndoManager.ts
 *
 * Simple 1-level undo system for destructive actions (release, trade, draft pick).
 * Tracks action snapshots with auto-expire after 5 seconds.
 */

import type { Player } from '../types/player';
import type { Team } from '../types/team';

export interface UndoSnapshot {
  actionType: 'release' | 'trade' | 'draftPick';
  timestamp: number;
  expiresAt: number;
  affectedPlayerIds: string[];
  affectedTeamIds: string[];

  // Snapshot data
  playerSnapshots: Map<string, Partial<Player>>;
  teamSnapshots: Map<string, Partial<Team>>;

  // User-friendly description
  description: string;
}

export class UndoManager {
  private lastSnapshot: UndoSnapshot | null = null;
  private expiryTimer: NodeJS.Timeout | null = null;

  /**
   * Create and store a snapshot before a destructive action.
   * Auto-expires after 5 seconds.
   */
  captureSnapshot(
    actionType: 'release' | 'trade' | 'draftPick',
    affectedPlayers: Player[],
    affectedTeams: Team[],
    description: string
  ): void {
    // Clear previous timer if one exists
    if (this.expiryTimer) clearTimeout(this.expiryTimer);

    const now = Date.now();
    const expiresAt = now + 5000; // 5 second window

    const playerSnapshots = new Map<string, Partial<Player>>();
    const teamSnapshots = new Map<string, Partial<Team>>();

    // Snapshot player state
    for (const player of affectedPlayers) {
      playerSnapshots.set(player.id, {
        id: player.id,
        teamId: player.teamId,
        status: player.status,
        morale: player.morale,
        contract: player.contract ? { ...player.contract } : undefined,
      });
    }

    // Snapshot team state (cap space, players list)
    for (const team of affectedTeams) {
      teamSnapshots.set(team.id, {
        id: team.id,
        // If we need to restore roster, we track this separately
      });
    }

    this.lastSnapshot = {
      actionType,
      timestamp: now,
      expiresAt,
      affectedPlayerIds: affectedPlayers.map(p => p.id),
      affectedTeamIds: affectedTeams.map(t => t.id),
      playerSnapshots,
      teamSnapshots,
      description,
    };

    // Auto-expire after 5 seconds
    this.expiryTimer = setTimeout(() => {
      this.lastSnapshot = null;
    }, 5000);
  }

  /**
   * Check if an undo is currently available (not expired).
   */
  canUndo(): boolean {
    if (!this.lastSnapshot) return false;
    return Date.now() < this.lastSnapshot.expiresAt;
  }

  /**
   * Get the current snapshot (if available).
   */
  getSnapshot(): UndoSnapshot | null {
    if (this.canUndo()) return this.lastSnapshot;
    return null;
  }

  /**
   * Clear the snapshot and timer.
   */
  clearSnapshot(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.lastSnapshot = null;
  }

  /**
   * Get remaining time in milliseconds for undo window.
   */
  getRemainingMs(): number {
    if (!this.lastSnapshot) return 0;
    const remaining = this.lastSnapshot.expiresAt - Date.now();
    return Math.max(0, remaining);
  }
}
