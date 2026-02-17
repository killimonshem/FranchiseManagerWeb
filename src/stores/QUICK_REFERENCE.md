# GameStore & Persistence - Quick Reference

## Import

```typescript
import { gameStore, GameStore, SaveData } from '@/stores/GameStore';
import { StorageService } from '@/services/StorageService';
import { UserProfile, createUserProfile, getUserFullName } from '@/types/UserProfile';
```

## Quick Start

### Initialize New Game

```typescript
gameStore.initializeNewGame('John', 'Smith', 'KC', 'Normal');
gameStore.teams = teams;
gameStore.allPlayers = players;
```

### Save Game

```typescript
gameStore.saveGame('MyGame');        // Manual save
gameStore.autoSave();                // Quick save to 'AutoSave' slot
```

### Load Game

```typescript
if (gameStore.slotExists('MyGame')) {
  gameStore.loadGame('MyGame');
}
```

### List Saves

```typescript
const slots = gameStore.getAllSaveSlots();
// Returns: ['AutoSave', 'Season1', 'Season2']
```

### Delete Save

```typescript
gameStore.deleteSave('OldGame');
```

---

## GameStore API

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `userProfile` | `UserProfile \| null` | GM identity |
| `userTeamId` | `string` | Selected team ID |
| `currentDate` | `GameDate` | Week and year |
| `gameDifficulty` | `string` | Difficulty level |
| `teams` | `Team[]` | League teams |
| `allPlayers` | `Player[]` | All players |
| `draftState` | `DraftState` | Draft progress |
| `playtimeMins` | `number` | Total playtime minutes |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `initializeNewGame(first, last, teamId, difficulty)` | `boolean` | Start new game |
| `saveGame(slotName)` | `boolean` | Save to slot |
| `loadGame(slotName)` | `boolean` | Load from slot |
| `autoSave()` | `boolean` | Save to 'AutoSave' |
| `getAllSaveSlots()` | `string[]` | List all saves |
| `slotExists(slotName)` | `boolean` | Check if save exists |
| `deleteSave(slotName)` | `boolean` | Delete a save |
| `addPlaytime(minutes)` | `void` | Add playtime |
| `getCurrentGMInfo()` | `string \| null` | GM display name |
| `reset()` | `void` | Clear all state |
| `printDebugInfo()` | `void` | Log debug info |

---

## StorageService API

### Static Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `isAvailable()` | `boolean` | Check if storage works |
| `save<T>(key, data)` | `boolean` | Save data |
| `load<T>(key)` | `T \| null` | Load data |
| `exists(key)` | `boolean` | Check if key exists |
| `remove(key)` | `boolean` | Delete data |
| `getAllSlots()` | `string[]` | List all saves |
| `clearAllSaves()` | `boolean` | Delete all saves |
| `hydrateDate(data, fields)` | `any` | Convert Date strings to Date objects |

---

## UserProfile API

### Interface

```typescript
interface UserProfile {
  firstName: string;
  lastName: string;
  title: string;           // Default: "General Manager"
  joinedDate: Date;
}
```

### Helper Functions

```typescript
// Full name
getUserFullName(profile)               // "John Smith"

// Display name
getUserDisplayName(profile)            // "John Smith, General Manager"

// Years in management
getYearsInManagement(profile)          // 2 (for 2024-2022)

// Create with defaults
createUserProfile(first, last)         // All fields set

// Validate profile
validateUserProfile(profile)           // true/false
```

---

## Common Patterns

### Pattern: Load Previous Game on App Start

```typescript
useEffect(() => {
  const autoSave = gameStore.getAllSaveSlots().find(s => s === 'AutoSave');
  if (autoSave) {
    const loaded = gameStore.loadGame('AutoSave');
    if (loaded) {
      // Game restored, navigate to game screen
      navigate('/game');
    }
  }
}, []);
```

### Pattern: Save Before Major Actions

```typescript
async function processDraft() {
  gameStore.autoSave();         // Backup first
  gameState.processDraft();     // Make changes
  gameStore.draftState = gameState.draftState;
  gameStore.autoSave();         // Save changes
}
```

### Pattern: Handle Quota Exceeded

```typescript
function ensureStorageSpace() {
  if (!gameStore.saveGame('TestSave')) {
    // Out of space
    const oldest = gameStore.getAllSaveSlots()[0];
    gameStore.deleteSave(oldest);
    gameStore.saveGame('TestSave'); // Retry
  }
}
```

### Pattern: GM Info Display

```typescript
<header>
  <span>{gameStore.getCurrentGMInfo()}</span>
  {gameStore.userProfile && (
    <span>{getYearsInManagement(gameStore.userProfile)} years managing</span>
  )}
</header>
```

---

## Data Types

### SaveData (What Gets Saved)

```typescript
interface SaveData {
  userProfile: UserProfile;      // GM info
  userTeamId: string;            // Team ID
  currentDate: GameDate;         // Week/year
  gameDifficulty: string;        // Difficulty
  teams: Team[];                 // 32 teams
  allPlayers: Player[];          // All players
  draftState: DraftState;        // Draft state
  saveTimestamp: Date;           // When saved
  playtimeMins: number;          // Playtime tracking
}
```

### GameDate

```typescript
interface GameDate {
  year: number;                  // 1-based season number
  week: number;                  // 1-52 (full year)
}
```

---

## Error Scenarios & Solutions

### Storage Not Available

```typescript
if (!StorageService.isAvailable()) {
  // In-memory only mode
  console.warn('Storage unavailable - saves will not persist');
}
```

### Corrupted Save File

```typescript
const loaded = gameStore.loadGame('BadSave');
if (!loaded) {
  // Save was corrupted
  gameStore.deleteSave('BadSave');
  gameStore.reset();
}
```

### Quota Exceeded

```typescript
const saved = gameStore.saveGame('Slot');
if (!saved) {
  // Out of space - delete old saves
  const slots = gameStore.getAllSaveSlots();
  gameStore.deleteSave(slots[0]);
  gameStore.saveGame('Slot'); // Retry
}
```

### Date Hydration Issue

```typescript
// After loading from storage
const data = gameStore.userProfile;
if (data && !(data.joinedDate instanceof Date)) {
  // Fix: Use StorageService.hydrateDate()
  data.joinedDate = new Date(data.joinedDate);
}
```

---

## Logging & Debugging

### Enable Logging

```typescript
// All operations log to console with emoji prefixes
gameStore.printDebugInfo();           // Print state
gameStore.saveGame('Test');           // Logs: 💾 [Storage] Saved...
gameStore.loadGame('Test');           // Logs: 📂 [Storage] Loaded...
```

### Check Available Saves

```typescript
console.log(gameStore.getAllSaveSlots());
// ['AutoSave', 'Season1', 'Season2-Week5', ...]
```

### Verify State

```typescript
if (gameStore.userProfile) {
  console.log(`${gameStore.userProfile.firstName}'s career`);
  console.log(`Teams: ${gameStore.teams.length}`);
  console.log(`Players: ${gameStore.allPlayers.length}`);
}
```

---

## Performance Notes

| Operation | Time |
|-----------|------|
| `initializeNewGame()` | <50ms |
| `saveGame()` (100KB) | 20-50ms |
| `loadGame()` (100KB) | 30-100ms |
| `getAllSaveSlots()` | <10ms |
| `deleteSave()` | <10ms |
| Auto-save thread | ~100ms every 10 min |

**Tip**: Large saves (2MB+) may take 200-500ms. Show loading indicator.

---

## Testing

### Unit Test Template

```typescript
describe('GameStore', () => {
  beforeEach(() => gameStore.reset());

  test('saves and loads game', () => {
    gameStore.initializeNewGame('John', 'Doe', 'KC');
    gameStore.currentDate = { year: 2, week: 5 };
    gameStore.saveGame('Test');

    gameStore.reset();
    gameStore.loadGame('Test');

    expect(gameStore.userProfile?.firstName).toBe('John');
    expect(gameStore.currentDate.year).toBe(2);
  });
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Saves not loading | Check Date hydration, use validateUserProfile() |
| Storage errors | Verify StorageService.isAvailable() |
| State out of sync | Call gameStore.reset() and reload |
| Quota exceeded | Delete old saves with getAllSaveSlots() |
| Lost saves | Check browser DevTools → Application → localStorage |

---

## See Also

- [`src/stores/README.md`](./README.md) - Full documentation
- [`INTEGRATION_GUIDE.md`](../INTEGRATION_GUIDE.md) - UI integration examples
- [`src/types/UserProfile.ts`](../types/UserProfile.ts) - Profile types
- [`src/services/StorageService.ts`](../services/StorageService.ts) - Storage implementation
