/**
 * StorageService.ts
 *
 * IndexedDB-backed persistence layer using Dexie.js.
 * Replaces localStorage which hits 5MB quota limits.
 *
 * Rules:
 * - All reads/writes are async
 * - UI must render skeleton loaders during hydration
 * - Schema version in constructor; increment on breaking changes
 */

import Dexie, { Table } from 'dexie';
import type { Player } from '../types/player';
import type { Team } from '../types/team';
import type { TeamDraftPick } from '../types/GameStateManager';

// ─── Database Schema ──────────────────────────────────────────────────────────

interface GameStateRecord {
  id: string;
  currentWeek: number;
  userTeamId: string;
  currentPhase: string;
  simulationState: string;
  snapshot: string; // JSON
  lastSaved: number;
}

interface PlayerRecord extends Player {
  teamId: string;
  status: string;
  overallRating: number;
}

interface TeamRecord extends Team {}

interface DraftPickRecord {
  id: string; // "${year}-${round}-${originalTeamId}"
  year: number;
  round: number;
  originalTeamId: string;
  currentTeamId: string;
  position?: string;
  nflTeamId?: string;
}

interface StaffRecord {
  id: string;
  teamId: string;
  role: string;
  category: 'COACHING' | 'FRONT_OFFICE';
  name: string;
}

interface SaveSlotRecord {
  slotName: string;
  timestamp: number;
  schemaVersion: number;
  snapshot: string; // Full serialized game state
}

// ─── Dexie Database ───────────────────────────────────────────────────────────

class FranchiseManagerDB extends Dexie {
  gameState!: Table<GameStateRecord>;
  players!: Table<PlayerRecord>;
  teams!: Table<TeamRecord>;
  draftPicks!: Table<DraftPickRecord>;
  staff!: Table<StaffRecord>;
  saves!: Table<SaveSlotRecord>;

  constructor() {
    super('FranchiseManager');
    this.version(1).stores({
      gameState:  'id, currentWeek, userTeamId, currentPhase',
      players:    'id, teamId, status, overallRating',
      teams:      'id, abbreviation',
      draftPicks: '[year+round+originalTeamId], currentTeamId',
      staff:      'id, teamId, role, category',
      saves:      'slotName, timestamp, schemaVersion',
    });
  }
}

const db = new FranchiseManagerDB();

// ─── StorageService API ───────────────────────────────────────────────────────

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Game State
  async saveGameState(gameState: Partial<GameStateRecord>): Promise<void> {
    const record: GameStateRecord = {
      id: 'main',
      currentWeek: gameState.currentWeek ?? 1,
      userTeamId: gameState.userTeamId ?? '',
      currentPhase: gameState.currentPhase ?? 'OFFSEASON',
      simulationState: gameState.simulationState ?? 'IDLE',
      snapshot: gameState.snapshot ?? '{}',
      lastSaved: Date.now(),
    };
    await db.gameState.put(record);
  }

  async loadGameState(): Promise<GameStateRecord | undefined> {
    return db.gameState.get('main');
  }

  async clearGameState(): Promise<void> {
    await db.gameState.clear();
  }

  // Players
  async savePlayers(players: PlayerRecord[]): Promise<void> {
    await db.players.bulkPut(players);
  }

  async loadPlayersByTeam(teamId: string): Promise<PlayerRecord[]> {
    return db.players.where('teamId').equals(teamId).toArray();
  }

  async loadAllPlayers(): Promise<PlayerRecord[]> {
    return db.players.toArray();
  }

  async updatePlayer(playerId: string, updates: Partial<PlayerRecord>): Promise<void> {
    await db.players.update(playerId, updates);
  }

  async deletePlayer(playerId: string): Promise<void> {
    await db.players.delete(playerId);
  }

  async clearPlayers(): Promise<void> {
    await db.players.clear();
  }

  // Teams
  async saveTeams(teams: TeamRecord[]): Promise<void> {
    await db.teams.bulkPut(teams);
  }

  async loadTeams(): Promise<TeamRecord[]> {
    return db.teams.toArray();
  }

  async updateTeam(teamId: string, updates: Partial<TeamRecord>): Promise<void> {
    await db.teams.update(teamId, updates);
  }

  async clearTeams(): Promise<void> {
    await db.teams.clear();
  }

  // Draft Picks
  async saveDraftPicks(picks: DraftPickRecord[]): Promise<void> {
    await db.draftPicks.bulkPut(picks);
  }

  async loadDraftPicksByTeam(teamId: string): Promise<DraftPickRecord[]> {
    return db.draftPicks.where('currentTeamId').equals(teamId).toArray();
  }

  async loadAllDraftPicks(): Promise<DraftPickRecord[]> {
    return db.draftPicks.toArray();
  }

  async updateDraftPick(pickId: string, updates: Partial<DraftPickRecord>): Promise<void> {
    await db.draftPicks.update(pickId, updates);
  }

  async clearDraftPicks(): Promise<void> {
    await db.draftPicks.clear();
  }

  // Staff
  async saveStaff(staff: StaffRecord[]): Promise<void> {
    await db.staff.bulkPut(staff);
  }

  async loadStaffByTeam(teamId: string): Promise<StaffRecord[]> {
    return db.staff.where('teamId').equals(teamId).toArray();
  }

  async clearStaff(): Promise<void> {
    await db.staff.clear();
  }

  // Save Slots
  async saveSaveSlot(slotName: string, snapshot: string, schemaVersion: number = 1): Promise<void> {
    const record: SaveSlotRecord = {
      slotName,
      timestamp: Date.now(),
      schemaVersion,
      snapshot,
    };
    await db.saves.put(record);
  }

  async loadSaveSlot(slotName: string): Promise<SaveSlotRecord | undefined> {
    return db.saves.get(slotName);
  }

  async deleteSaveSlot(slotName: string): Promise<void> {
    await db.saves.delete(slotName);
  }

  async listSaveSlots(): Promise<SaveSlotRecord[]> {
    return db.saves.toArray();
  }

  // Bulk operations
  async clearAll(): Promise<void> {
    await db.delete();
    await db.open();
  }

  async isHydrated(): Promise<boolean> {
    const gameState = await this.loadGameState();
    return !!gameState;
  }
}

export const storage = StorageService.getInstance();
