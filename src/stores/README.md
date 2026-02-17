# GameStore - State Management & Persistence

## Overview

The `GameStore` is the central state management hub for the Franchise Manager Web MVP. It handles:

- **Player Profile Management** - GM identity and career tracking
- **Game State** - Date, difficulty, current progress
- **League Data** - Teams, players, schedule
- **Persistence** - Save/load game state using browser localStorage

## Architecture

### Components

```
┌─────────────────────────────────────────┐
│         User Interface Layer             │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│        GameStore (State Management)      │
│  - save/load game                        │
│  - manage user profile                   │
│  - track playtime & milestones           │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│   StorageService (Persistence Layer)     │
│  - localStorage wrapper                  │
│  - error handling & validation           │
│  - save slot management                  │
└──────────────────┬──────────────────────┘
                   │
           ┌───────▼────────┐
           │  Browser       │
           │  localStorage  │
           └────────────────┘
```

### Related Systems

- **GameStateManager** (`src/types/GameStateManager.ts`) - Simulation engine & rules logic
- **UserProfile** (`src/types/UserProfile.ts`) - Manager persona data structure
- **StorageService** (`src/services/StorageService.ts`) - Low-level persistence

## Usage Examples

### Initialize a New Game

```typescript
import { gameStore } from '@/stores/GameStore';

// Start a new game
const success = gameStore.initializeNewGame(
  'John',           // firstName
  'Smith',          // lastName
  'KC',             // teamId (Kansas City Chiefs)
  'Normal'          // difficulty
);

if (success) {
  // Game initialized, ready to populate teams/players
  gameStore.teams = createdTeams;
  gameStore.allPlayers = createdPlayers;
}
```

### Save Game

```typescript
// Manual save to named slot
gameStore.saveGame('Season1-Week15');

// Auto-save (called periodically)
gameStore.autoSave();
```

### Load Game

```typescript
// Check if a save exists
if (gameStore.slotExists('Season1-Week15')) {
  // Load it
  const success = gameStore.loadGame('Season1-Week15');

  if (success) {
    console.log(`Welcome back, ${gameStore.userProfile?.firstName}!`);
    // Game state is now restored
  }
}
```

### List All Saves

```typescript
const allSaves = gameStore.getAllSaveSlots();
console.log('Available saves:', allSaves);
// Output: ['AutoSave', 'Season1-Week15', 'Season1-Playoffs']
```

### Delete a Save

```typescript
gameStore.deleteSave('OldSeason');
```

## Data Persistence

### What Gets Saved

The `SaveData` interface includes:

```typescript
interface SaveData {
  userProfile: UserProfile;        // GM identity
  userTeamId: string;              // Selected team
  currentDate: GameDate;           // Current week/year
  gameDifficulty: string;          // Difficulty level
  teams: Team[];                   // League teams
  allPlayers: Player[];            // All players
  draftState: DraftState;          // Draft progress
  saveTimestamp: Date;             // When saved
  playtimeMins: number;            // Total playtime
}
```

### Storage Locations

- **Browser localStorage** - Prefixed with `franchise_manager_`
- **Save slots** - Stored as JSON strings
- **Example key** - `franchise_manager_Season1` → SaveData JSON

### Quota Management

The browser typically allows **5-10 MB** of localStorage per domain:

| Data | Typical Size |
|------|--------------|
| Small save (early game) | ~100 KB |
| Mid-game save | ~500 KB |
| Late-game save | ~1-2 MB |
| Max league data | ~3 MB |

**Best Practice**: Implement save slot rotation (keep last 3 saves, delete oldest)

## Error Handling

### Storage Unavailable

```typescript
// Private browsing mode, or localStorage disabled
if (!StorageService.isAvailable()) {
  console.error('Storage not available - offer in-memory only mode');
}
```

### Quota Exceeded

```typescript
// localStorage is full
const saved = gameStore.saveGame('NewSave');
if (!saved) {
  // Delete old saves or warn user
  gameStore.deleteSave('OldSeason');
  gameStore.saveGame('NewSave'); // Retry
}
```

### Corrupted Save File

```typescript
const loaded = gameStore.loadGame('BadSave');
if (!loaded) {
  console.log('Save was corrupted - starting new game');
  gameStore.reset();
}
```

## Development & Debugging

### Check Store State

```typescript
gameStore.printDebugInfo();
// Outputs: GM info, teams, players, dates, etc.
```

### Get GM Info

```typescript
const gmName = gameStore.getCurrentGMInfo();
// Output: "John Smith - General Manager"
```

### Track Playtime

```typescript
// Add 30 minutes of playtime
gameStore.addPlaytime(30);
```

### Reset Everything

```typescript
// WARNING: Clears all state (for testing)
gameStore.reset();
```

## Integration Points

### With UI Components

**SaveGame Modal**:
```typescript
// Get list of saves for user to choose
const slots = gameStore.getAllSaveSlots();
slots.forEach(slot => {
  // Display slot as option to load
});
```

**Load Screen**:
```typescript
// Player selects a save to continue
gameStore.loadGame(selectedSlotName);
// UI now has access to: gameStore.userProfile, gameStore.teams, etc.
```

**Pause Menu**:
```typescript
// Player hits pause and wants to save
gameStore.saveGame(userEnteredName);
// Confirmation: "Game saved to ${userEnteredName}"
```

### With GameStateManager

Both systems work together:

```typescript
// Initialize in GameStateManager
const manager = new GameStateManager();
manager.initializeGM('John', 'Smith');
manager.selectUserTeam('KC');

// Sync to GameStore for persistence
gameStore.userProfile = manager.userProfile;
gameStore.userTeamId = manager.userTeamId;
gameStore.teams = manager.teams;
gameStore.allPlayers = manager.allPlayers;

// Later: save the full state
gameStore.saveGame('MyGame');
```

## Type Safety

All save/load operations maintain TypeScript type safety:

```typescript
// ✅ Type-safe: Returns SaveData or null
const data = StorageService.load<SaveData>('MyGame');

// ✅ Automatically converted: Date strings → Date objects
const hydratedData = StorageService.hydrateDate(data, ['joinedDate', 'saveTimestamp']);
```

## Performance Considerations

### Serialization

- JSON serialization happens in-memory (fast for typical save sizes)
- Large rosters (500+ players) may take 50-100ms to serialize

### Auto-Save Strategy

- Call `gameStore.autoSave()` every 5-10 minutes
- Or when key events occur (draft pick, trade, etc.)
- Keep backup of last auto-save before overwriting

### Cleanup

- Periodically delete old saves to preserve quota
- Consider implementing "cloud sync" for backup in future

## Future Enhancements

1. **Cloud Sync** - Save to server for backup/cross-device play
2. **Save Encryption** - Prevent cheating by obfuscating save data
3. **Save Integrity Checks** - Detect/prevent corrupted saves
4. **Autosave Management** - Automatic cleanup of old saves
5. **Replay System** - Load historic game states for comparison
