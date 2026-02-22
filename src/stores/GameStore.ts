/**
 * Game Store
 * Central state management hub for the NFL franchise management game
 * Handles game initialization, state persistence, and saves/loads
 * Replaces GameStateManager for state management, works alongside it
 */

import { Team } from '../types/team';
import { Player } from '../types/player';
import { UserProfile, createUserProfile, validateUserProfile } from '../types/UserProfile';
import { storage } from '../services/StorageService';
import {
  initializeDraftState,
  DraftState
} from '../types/DraftSystem';
import { CompPick, FreeAgencyTransaction } from '../types/CompensatoryPickSystem';
import type { GameDate as ManagerGameDate, ProcessingInterrupt, DraftProspect, TeamDraftPick } from '../types/GameStateManager';

/**
 * Game Date representation
 * Tracks the current in-game date
 */
export interface GameDate {
  year: number;
  week: number;
}

/**
 * Save game data structure
 * Mirrors the SaveGame struct from Swift implementation
 * Contains all persistent game state
 */
export interface SaveData {
  // Player profile
  userProfile: UserProfile;
  userTeamId: string;

  // Game state
  currentDate: GameDate;
  gameDifficulty: string;

  // League data
  teams: Team[];
  allPlayers: Player[];

  // Draft state
  draftState: DraftState;

  // Metadata
  saveTimestamp: Date;
  playtimeMins: number;

  // Simulation state (populated by GameStateManager.syncToStore before every save)
  offseasonTransactions?: FreeAgencyTransaction[];
  compPicks?: CompPick[];
  interruptQueue?: ProcessingInterrupt[];
  completedEvents?: string[];
  fullGameDate?: ManagerGameDate;
  freeAgents?: Player[];
  // Draft & staff ecosystem
  draftPicks?: TeamDraftPick[];
  draftProspects?: DraftProspect[];
  draftOrder?: string[];
  availableStaff?: unknown[];
  scoutingPointsAvailable?: number;
}

/**
 * Game Store - Central state management
 * Replaces GameStateManager for front-end state needs
 * Works alongside GameStateManager for simulation logic
 */
export class GameStore {
  // Player profile
  userProfile: UserProfile | null = null;
  userTeamId: string = '';

  // Game state
  currentDate: GameDate = { year: 1, week: 1 };
  gameDifficulty: string = 'Normal';

  // League data
  teams: Team[] = [];
  allPlayers: Player[] = [];

  // Draft state
  draftState: DraftState = initializeDraftState();

  // Metadata
  saveTimestamp: Date = new Date();
  playtimeMins: number = 0;

  /**
   * Initialize a new game
   * @param firstName - GM first name
   * @param lastName - GM last name
   * @param teamId - Selected team ID
   * @param difficulty - Game difficulty level
   * @returns true if initialization successful
   */
  initializeNewGame(
    firstName: string,
    lastName: string,
    teamId: string,
    difficulty: string = 'Normal'
  ): boolean {
    try {
      console.log(`\n🎮 [GameStore] Initializing new game for ${firstName} ${lastName}`);

      // Validate inputs
      if (!firstName || !lastName || !teamId) {
        console.error('❌ [GameStore] Invalid initialization parameters');
        return false;
      }

      // Create user profile
      this.userProfile = createUserProfile(firstName, lastName);
      this.userTeamId = teamId;
      this.gameDifficulty = difficulty;

      // Initialize game state
      this.currentDate = { year: 1, week: 1 };
      this.draftState = initializeDraftState();
      this.saveTimestamp = new Date();
      this.playtimeMins = 0;

      console.log(`✅ [GameStore] Game initialized for ${firstName} ${lastName} with ${this.teams.length} teams`);
      return true;
    } catch (error) {
      console.error('❌ [GameStore] Failed to initialize game:', error);
      return false;
    }
  }

  /**
   * Save the current game state to localStorage
   * @param slotName - The save slot name (e.g., "Season1" or "AutoSave")
   * @returns true if save was successful
   */
  saveGame(slotName: string): boolean {
    try {
      // Validate that we have a valid game state to save
      if (!this.userProfile) {
        console.error('❌ [GameStore] Cannot save: No user profile initialized');
        return false;
      }

      if (!validateUserProfile(this.userProfile)) {
        console.error('❌ [GameStore] Cannot save: Invalid user profile');
        return false;
      }

      // Construct save data
      const saveData: SaveData = {
        userProfile: this.userProfile,
        userTeamId: this.userTeamId,
        currentDate: this.currentDate,
        gameDifficulty: this.gameDifficulty,
        teams: this.teams,
        allPlayers: this.allPlayers,
        draftState: this.draftState,
        saveTimestamp: new Date(),
        playtimeMins: this.playtimeMins
      };

      // Persist to storage
      const snapshot = JSON.stringify(saveData);
      storage.saveSaveSlot(slotName, snapshot, 1).then(() => {
        console.log(`💾 [GameStore] Game saved to slot: ${slotName}`);
      }).catch((error: Error) => {
        console.error(`❌ [GameStore] Failed to save game to slot: ${slotName}`, error);
      });

      return true;
    } catch (error) {
      console.error('❌ [GameStore] Error during save:', error);
      return false;
    }
  }

  /**
   * Load a game state from localStorage
   * @param slotName - The save slot to load from
   * @returns true if load was successful
   */
  async loadGame(slotName: string): Promise<boolean> {
    try {
      console.log(`\n📂 [GameStore] Loading game from slot: ${slotName}`);

      // Retrieve data from storage
      const saveSlot = await storage.loadSaveSlot(slotName);

      if (!saveSlot) {
        console.error(`❌ [GameStore] No save data found for slot: ${slotName}`);
        return false;
      }

      const saveData = JSON.parse(saveSlot.snapshot) as SaveData;

      // Validate loaded data
      if (!validateUserProfile(saveData.userProfile)) {
        console.error('❌ [GameStore] Loaded profile is invalid');
        return false;
      }

      // Hydrate Date objects (IndexedDB serializes them as strings)
      const saveTimestamp = saveData.saveTimestamp ? new Date(saveData.saveTimestamp) : new Date();

      // Mass-assign loaded state to store
      this.userProfile = saveData.userProfile;
      this.userTeamId = saveData.userTeamId;
      this.currentDate = saveData.currentDate;
      this.gameDifficulty = saveData.gameDifficulty;
      this.teams = saveData.teams;
      this.allPlayers = saveData.allPlayers;
      this.draftState = saveData.draftState;
      this.saveTimestamp = saveTimestamp;
      this.playtimeMins = saveData.playtimeMins;

      console.log(`✅ [GameStore] Game loaded successfully from slot: ${slotName}`);
      console.log(`   GM: ${this.userProfile?.firstName} ${this.userProfile?.lastName}`);
      console.log(`   Week: ${this.currentDate.week}, Year: ${this.currentDate.year}`);
      console.log(`   Playtime: ${this.playtimeMins} minutes`);

      return true;
    } catch (error) {
      console.error(`❌ [GameStore] Failed to load game from slot '${slotName}':`, error);
      return false;
    }
  }

  /**
   * Get all available save slots
   * @returns Array of save slot names
   */
  async getAllSaveSlots(): Promise<string[]> {
    try {
      const slots = await storage.listSaveSlots();
      return slots.map(slot => slot.slotName);
    } catch (error) {
      console.error('❌ [GameStore] Failed to list save slots:', error);
      return [];
    }
  }

  /**
   * Delete a specific save slot
   * @param slotName - The save slot to delete
   * @returns true if deletion was successful
   */
  async deleteSave(slotName: string): Promise<boolean> {
    try {
      await storage.deleteSaveSlot(slotName);
      console.log(`🗑️ [GameStore] Save slot deleted: ${slotName}`);
      return true;
    } catch (error) {
      console.error(`❌ [GameStore] Failed to delete save slot '${slotName}':`, error);
      return false;
    }
  }

  /**
   * Auto-save the game (called periodically during gameplay)
   * @returns true if auto-save was successful
   */
  autoSave(): boolean {
    return this.saveGame('AutoSave');
  }

  /**
   * Check if a save slot exists
   * @param slotName - The save slot to check
   */
  async slotExists(slotName: string): Promise<boolean> {
    try {
      const slot = await storage.loadSaveSlot(slotName);
      return !!slot;
    } catch (error) {
      console.error(`❌ [GameStore] Failed to check save slot '${slotName}':`, error);
      return false;
    }
  }

  /**
   * Update playtime tracker
   * @param minutes - Minutes to add to playtime
   */
  addPlaytime(minutes: number): void {
    this.playtimeMins += minutes;
    console.log(`⏱️ [GameStore] Total playtime: ${this.playtimeMins} minutes`);
  }

  /**
   * Reset the store to initial state
   */
  reset(): void {
    this.userProfile = null;
    this.userTeamId = '';
    this.currentDate = { year: 1, week: 1 };
    this.gameDifficulty = 'Normal';
    this.teams = [];
    this.allPlayers = [];
    this.draftState = initializeDraftState();
    this.saveTimestamp = new Date();
    this.playtimeMins = 0;
    console.log('🔄 [GameStore] Store reset to initial state');
  }

  /**
   * Get current GM display info
   */
  getCurrentGMInfo(): string | null {
    if (!this.userProfile) return null;
    return `${this.userProfile.firstName} ${this.userProfile.lastName} - ${this.userProfile.title}`;
  }

  /**
   * Debug: Print store state
   */
  printDebugInfo(): void {
    console.log('\n' + '='.repeat(70));
    console.log('🎮 GAME STORE DEBUG INFO');
    console.log('='.repeat(70));
    console.log(`GM: ${this.getCurrentGMInfo() || 'Not initialized'}`);
    console.log(`Team: ${this.userTeamId}`);
    console.log(`Date: Week ${this.currentDate.week}, Year ${this.currentDate.year}`);
    console.log(`Difficulty: ${this.gameDifficulty}`);
    console.log(`Teams: ${this.teams.length}`);
    console.log(`Players: ${this.allPlayers.length}`);
    console.log(`Playtime: ${this.playtimeMins} mins`);
    console.log(`Last Save: ${this.saveTimestamp.toLocaleString()}`);
    console.log('='.repeat(70) + '\n');
  }
}

/**
 * Singleton instance of GameStore
 * Use this as the main state management point
 */
export const gameStore = new GameStore();
