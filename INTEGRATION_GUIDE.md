# Integration Guide - Manager Persona & Save System

## Overview

This guide shows UI developers how to integrate the Manager Persona and Save System into the Franchise Manager Web MVP.

## Architecture Summary

```
┌─────────────────────────────────────────────────┐
│              Web UI (React/Vue/etc)              │
│  - Main Menu (New Game / Load Game)              │
│  - GM Creation Form                              │
│  - Game HUD (with Save/Load buttons)             │
│  - Pause Menu (Save Game dialog)                 │
└──────────────────┬──────────────────────────────┘
                   │
                   ├─→ GameStore (singleton)
                   │   - initializeNewGame()
                   │   - saveGame() / loadGame()
                   │   - state: userProfile, teams, allPlayers, etc.
                   │
                   └─→ GameStateManager (rules engine)
                       - initializeGM()
                       - selectUserTeam()
                       - simulation logic
                       - season progression

        ↓ (sync data)

┌─────────────────────────────────────────────────┐
│            StorageService (persistence)          │
│  - save<T>(key, data): boolean                   │
│  - load<T>(key): T | null                        │
│  - getAllSlots(): string[]                       │
│  - delete(key): boolean                          │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Browser localStorage │
        └─────────────────────┘
```

---

## 1. Main Menu Flow

### Screen: "New Game" or "Continue Game"

```typescript
// components/MainMenu.tsx (pseudocode)

function MainMenu() {
  const [hasSaves, setHasSaves] = useState(false);

  useEffect(() => {
    // Check if any saves exist
    const saves = gameStore.getAllSaveSlots();
    setHasSaves(saves.length > 0);
  }, []);

  return (
    <div className="main-menu">
      <button onClick={() => navigate('/new-game')}>
        New Career
      </button>

      {hasSaves && (
        <button onClick={() => navigate('/load-game')}>
          Continue Career
        </button>
      )}

      <button onClick={() => navigate('/settings')}>
        Settings
      </button>
    </div>
  );
}
```

---

## 2. New Game Flow

### Step 1: GM Creation Form

```typescript
// components/GMCreationForm.tsx

function GMCreationForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('KC');
  const [difficulty, setDifficulty] = useState('Normal');

  const handleCreateGM = async () => {
    // Initialize game store
    const success = gameStore.initializeNewGame(
      firstName,
      lastName,
      selectedTeamId,
      difficulty
    );

    if (!success) {
      showError('Failed to initialize game');
      return;
    }

    // Create league in GameStateManager
    const manager = new GameStateManager();
    manager.initializeGM(firstName, lastName);
    manager.selectUserTeam(selectedTeamId);

    // Generate league (teams and players)
    // This is where you'd create NFL teams and draft prospects
    const teams = createNFLTeams(); // Your function
    const players = generateProspects(); // Your function

    // Sync to GameStore
    gameStore.teams = teams;
    gameStore.allPlayers = players;
    manager.teams = teams;
    manager.allPlayers = players;

    // Auto-save before entering game
    gameStore.saveGame('AutoSave');

    // Navigate to game
    navigate('/game');
  };

  return (
    <form onSubmit={handleCreateGM}>
      <input
        type="text"
        placeholder="First Name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />

      <input
        type="text"
        placeholder="Last Name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
      />

      <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
        <option value="KC">Kansas City Chiefs</option>
        <option value="SF">San Francisco 49ers</option>
        {/* ...all 32 teams */}
      </select>

      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
        <option value="Easy">Easy</option>
        <option value="Normal">Normal</option>
        <option value="Hard">Hard</option>
        <option value="Legendary">Legendary</option>
      </select>

      <button type="submit">Start Career</button>
    </form>
  );
}
```

---

## 3. Load Game Flow

### Screen: Select Save Slot

```typescript
// components/LoadGameMenu.tsx

function LoadGameMenu() {
  const [saves, setSaves] = useState<string[]>([]);
  const [selectedSave, setSelectedSave] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // List all available saves
    const allSaves = gameStore.getAllSaveSlots();
    setSaves(allSaves);
  }, []);

  const handleLoadGame = async () => {
    if (!selectedSave) {
      showError('Please select a save');
      return;
    }

    setIsLoading(true);

    // Load from storage
    const success = gameStore.loadGame(selectedSave);

    if (!success) {
      setIsLoading(false);
      showError('Failed to load game - save may be corrupted');
      return;
    }

    // Show loading screen
    showLoadingScreen(
      `Welcome back, ${gameStore.userProfile?.firstName}!`,
      'Loading your career...'
    );

    // Small delay for visual effect
    await delay(1500);

    // Navigate to game (GameStore is now fully restored)
    navigate('/game');
  };

  const handleDeleteSave = (slotName: string) => {
    if (confirm(`Delete save "${slotName}"?`)) {
      gameStore.deleteSave(slotName);
      setSaves(saves.filter(s => s !== slotName));
    }
  };

  return (
    <div className="load-game-menu">
      <h1>Load Career</h1>

      {saves.length === 0 ? (
        <p>No saves found. Start a new career!</p>
      ) : (
        <>
          <ul className="save-list">
            {saves.map((slot) => (
              <li
                key={slot}
                className={selectedSave === slot ? 'selected' : ''}
                onClick={() => setSelectedSave(slot)}
              >
                <span className="slot-name">{slot}</span>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteSave(slot)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={handleLoadGame}
            disabled={!selectedSave || isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Career'}
          </button>
        </>
      )}

      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}
```

---

## 4. During Gameplay: Pause Menu

### Screen: Pause Menu with Save Option

```typescript
// components/PauseMenu.tsx

function PauseMenu({ onResume }: { onResume: () => void }) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState(`Season${gameStore.currentDate?.year}`);

  const handleSaveGame = () => {
    // Trim and validate save name
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      showError('Please enter a save name');
      return;
    }

    // Save to storage
    const success = gameStore.saveGame(trimmedName);

    if (success) {
      showSuccess(`Game saved to "${trimmedName}"`);
      setShowSaveDialog(false);
      onResume();
    } else {
      showError('Failed to save game - storage may be full');
    }
  };

  return (
    <div className="pause-menu">
      <h1>Paused</h1>

      <div className="menu-buttons">
        <button onClick={onResume}>Resume Game</button>

        {showSaveDialog ? (
          <div className="save-dialog">
            <label>Save Name:</label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g., Season1-Week15"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSaveGame();
              }}
            />
            <button onClick={handleSaveGame}>Save</button>
            <button onClick={() => setShowSaveDialog(false)}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowSaveDialog(true)}>Save Game</button>
        )}

        <button onClick={() => navigate('/load-game')}>Load Game</button>

        <button onClick={() => navigate('/main-menu')}>Main Menu</button>
      </div>
    </div>
  );
}
```

---

## 5. Auto-Save During Gameplay

### Setup: Background Auto-Save Timer

```typescript
// hooks/useAutoSave.ts

export function useAutoSave(intervalMinutes: number = 10) {
  useEffect(() => {
    // Auto-save every N minutes
    const intervalMs = intervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      const success = gameStore.autoSave();
      if (success) {
        console.log(`✅ Auto-saved at ${new Date().toLocaleTimeString()}`);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMinutes]);
}

// Usage in main game component:
function GameScreen() {
  useAutoSave(10); // Auto-save every 10 minutes

  return (
    <div className="game">
      {/* Game UI */}
    </div>
  );
}
```

---

## 6. Game HUD Header with GM Info

```typescript
// components/GameHUD.tsx

function GameHUD() {
  const gmName = gameStore.getCurrentGMInfo();
  const currentTeam = gameStore.teams.find(t => t.id === gameStore.userTeamId);

  return (
    <header className="game-hud">
      <div className="gm-info">
        <span className="label">GM:</span>
        <span className="name">{gmName}</span>
      </div>

      <div className="team-info">
        <span className="label">Team:</span>
        <span className="name">{currentTeam?.fullName || 'Unknown'}</span>
      </div>

      <div className="date-info">
        <span className="label">Week:</span>
        <span className="value">{gameStore.currentDate.week}</span>
        <span className="label">Year:</span>
        <span className="value">{gameStore.currentDate.year}</span>
      </div>

      <button className="pause-btn" onClick={openPauseMenu}>
        ⏸ Pause
      </button>
    </header>
  );
}
```

---

## 7. Error Handling Examples

### Handle Missing Storage

```typescript
// pages/GamePage.tsx

function GamePage() {
  useEffect(() => {
    // Check if storage is available before loading
    if (!StorageService.isAvailable()) {
      showWarning(
        'Storage Unavailable',
        'Your browser is in private mode or has disabled storage. ' +
        'Games can only be saved in this session.'
      );
    }
  }, []);

  return <div>{/* Game content */}</div>;
}
```

### Handle Quota Exceeded

```typescript
function handleGameplayEvent() {
  // Attempt to auto-save
  const saved = gameStore.autoSave();

  if (!saved) {
    // Storage quota exceeded - offer to delete old saves
    const saves = gameStore.getAllSaveSlots();
    const oldestSave = saves[0]; // Simplified: just take first

    if (confirm(`Storage full. Delete old save "${oldestSave}"?`)) {
      gameStore.deleteSave(oldestSave);
      gameStore.autoSave(); // Retry
    }
  }
}
```

---

## 8. Data Sync Between Systems

### When to Sync GameStateManager → GameStore

```typescript
// During season progression:

// In GameStateManager (rules engine):
manager.advanceSeason();  // Updates internal state
manager.processDraft();   // Updates draftState

// Sync to GameStore (UI state):
gameStore.currentDate = manager.currentGameDate;
gameStore.draftState = manager.draftState;
gameStore.allPlayers = manager.allPlayers;
gameStore.teams = manager.teams;

// Auto-save after major events
gameStore.autoSave();
```

### When to Sync GameStore → GameStateManager

```typescript
// When loading a game:

gameStore.loadGame('Season1');

// Recreate GameStateManager with loaded state
const manager = new GameStateManager();
manager.userProfile = gameStore.userProfile;
manager.userTeamId = gameStore.userTeamId;
manager.teams = gameStore.teams;
manager.allPlayers = gameStore.allPlayers;
// ... etc

// Now both systems are in sync
```

---

## 9. Type-Safe State Access

```typescript
// components/GameInfo.tsx

function GameInfo() {
  // Type-safe access to game state
  const gmProfile = gameStore.userProfile; // UserProfile | null

  // Safely check before accessing
  if (!gmProfile) {
    return <div>No game in progress</div>;
  }

  // Now gmProfile is definitely UserProfile
  return (
    <div>
      <h1>{gmProfile.firstName} {gmProfile.lastName}</h1>
      <p>Title: {gmProfile.title}</p>
      <p>Started: {gmProfile.joinedDate.toLocaleDateString()}</p>
    </div>
  );
}
```

---

## 10. Testing Save/Load

```typescript
// __tests__/saves.test.ts

describe('Save/Load System', () => {
  beforeEach(() => {
    gameStore.reset();
  });

  test('should save and load game state', () => {
    // Initialize
    gameStore.initializeNewGame('John', 'Smith', 'KC', 'Normal');
    gameStore.currentDate = { year: 2, week: 15 };

    // Save
    const saved = gameStore.saveGame('TestSave');
    expect(saved).toBe(true);

    // Reset
    gameStore.reset();
    expect(gameStore.userProfile).toBeNull();

    // Load
    const loaded = gameStore.loadGame('TestSave');
    expect(loaded).toBe(true);

    // Verify
    expect(gameStore.userProfile?.firstName).toBe('John');
    expect(gameStore.currentDate.year).toBe(2);
    expect(gameStore.currentDate.week).toBe(15);
  });

  test('should list all save slots', () => {
    gameStore.initializeNewGame('John', 'Smith', 'KC');
    gameStore.saveGame('Save1');
    gameStore.saveGame('Save2');

    const slots = gameStore.getAllSaveSlots();
    expect(slots).toContain('Save1');
    expect(slots).toContain('Save2');
  });
});
```

---

## Implementation Checklist

- [ ] Create MainMenu component (New Game / Load Game)
- [ ] Create GMCreationForm component
- [ ] Create LoadGameMenu component
- [ ] Create PauseMenu with save functionality
- [ ] Create GameHUD with GM info display
- [ ] Wire up auto-save timer
- [ ] Implement error handling for storage issues
- [ ] Add loading/saving screens with visual feedback
- [ ] Sync data between GameStateManager and GameStore
- [ ] Test save/load with various game states
- [ ] Handle edge cases (corrupted saves, quota exceeded)
- [ ] Add analytics/telemetry for save slots
- [ ] Create save management UI (backup, cloud sync planning)

---

## Common Pitfalls

### ❌ Not Checking if Storage is Available

```typescript
// DON'T: Assume localStorage works
const data = localStorage.getItem('key');

// DO: Use StorageService which handles errors
const data = StorageService.load('key');
```

### ❌ Forgetting to Hydrate Dates

```typescript
// DON'T: Dates become strings after JSON parse
const data = JSON.parse(json);
console.log(data.userProfile.joinedDate instanceof Date); // false!

// DO: Use StorageService.hydrateDate()
const data = StorageService.load<SaveData>('slot');
const hydrated = StorageService.hydrateDate(data, ['joinedDate', 'saveTimestamp']);
console.log(hydrated.userProfile.joinedDate instanceof Date); // true
```

### ❌ Not Validating Loaded Data

```typescript
// DON'T: Assume loaded data is valid
const loaded = gameStore.loadGame('slot');
// What if it's corrupted or partial?

// DO: Check return value and validate
if (!loaded) {
  console.error('Failed to load - starting fresh');
  gameStore.reset();
}
```

### ❌ Syncing in Wrong Direction

```typescript
// DON'T: Always overwrite GameStore from GameStateManager
gameStore.teams = manager.teams;

// DO: Sync bidirectionally as needed
// Load: GameStore → GameStateManager
// Save: GameStateManager → GameStore
```

---

## Performance Tips

1. **Don't save every frame** - Use 10-minute intervals for auto-save
2. **Show loading indicator** - Save/load can take 100-500ms
3. **Compress if needed** - For very large rosters, consider gzip
4. **Validate early** - Check localStorage availability on app start
5. **Batch saves** - Save once after multiple state changes, not per change

---

## Next Steps

1. **UI Implementation** - Build out the components above
2. **Visual Polish** - Add loading screens, animations
3. **Cloud Sync** - Plan for multi-device save sync
4. **Save Encryption** - Prevent cheating
5. **Analytics** - Track save/load patterns
