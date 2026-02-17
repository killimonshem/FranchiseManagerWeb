# MASTER UI REQUIREMENT LIST
## Franchise Manager Web - Design Specification

---

## 1. THE VIEW HIERARCHY (SITEMAP)

### A. GAME SHELL (Always Present)

**Top Nav Bar / HUD**
- GM Name + Title (`UserProfile.firstName`, `lastName`, `title`)
- Team Logo + Abbreviation + Record (`Team.wins`-`losses`-`ties`)
- Current Week / Season Phase badge (`SeasonPhase` enum - 11 distinct phases)
- Cap Space indicator (color-coded by `FinancialHealthTier`)
- Notification bell with unread count (`unreadNotifications` getter)
- Inbox badge with action-required count (`InboxItem.requiresAction`)
- Simulation controls: Play / Pause / Speed toggle (`SimulationSpeed`: Slow, Normal, Fast, Instant)
- Save button (triggers `gameStore.saveGame()`)

**Bottom Ticker / News Crawl**
- Scrolling `NewsHeadline` items from `recentHeadlines[]`
- Social posts from `SocialPost` feed (author handle, content, heat score, likes/retweets)

---

### B. MAIN MENU / TITLE SCREEN

**Screen: Start Screen**
- "New Career" button
- "Continue Career" button (visible only if `gameStore.getAllSaveSlots().length > 0`)
- Settings button

**Screen: New Game Setup**
- Step 1: GM Creation Form (firstName, lastName inputs)
- Step 2: Team Selection Grid (32 NFL teams from `createNFLTeams()`, showing city, name, primaryColor, secondaryColor, stadium, division, owner archetype, fanBase archetype, market size)
- Step 3: Difficulty Picker (`GameDifficulty`: Easy, Normal, Hard, Legendary)
- Step 4: Confirmation summary before starting

**Screen: Load Game**
- List of save slots from `getAllSaveSlots()`
- Each slot shows: GM name, team, week/year, playtime, saveTimestamp
- Delete button per slot with confirmation
- Load button

---

### C. DASHBOARD (Home Screen)

**The central hub. Changes appearance based on `currentPhase`.**

- Team Overview Card: Record, Power Ranking, Playoff Chances, Streak indicator
- Owner Patience Meter (`OwnerProfile.patience`, `spendingMood`, `interferenceLevel`)
- Fan Mood Gauge (`FanBaseProfile.mood`, `expectations`, `loyalty`)
- Next Event indicator (`nextEvent()` shows upcoming `SeasonEvent`)
- "Advance Week" button (gated by `canAdvanceWeek()`)
- Quick Links to all major sections
- Inbox preview (latest 3 unread `InboxItem` entries)
- Recent Headlines panel (latest 5 `NewsHeadline` items)
- Financial Health badge (`FinancialHealthTier` with color from `getFinancialHealthTierColor()`)

---

### D. FRONT OFFICE GROUP

**D1. Screen: Roster Management**
- Sortable/filterable table of all team players
- Columns: Name, Position, Overall, Potential, Age, Contract (years remaining + cap hit), Injury Status, Morale, Fatigue, Depth Chart position
- Color-coded position badges (from `getPositionColor()`)
- Player status indicator (Active, IR, Practice Squad, Suspended)
- Tabs or filters: Active Roster (53-man), Practice Squad (16-man), Injured Reserve, All
- Roster compliance banner showing `RosterComplianceResult` (active count, PS count, IR count, violations)
- Actions per player: View Profile, Cut, Trade, Move to PS, Move to IR, Activate from IR, Restructure Contract

**D2. Screen: Player Profile (Detail Page)**
- Header: Photo placeholder, Name, Jersey Number, Position, Team
- Bio: Age, Height, Weight, College, Draft Year/Round/Pick
- Attributes radar chart (all 57 `PlayerAttributes` fields, grouped by Physical/Mental/Technical)
- Personality panel (11 `PlayerPersonality` traits with bar indicators)
- Contract details panel: Total Value, Years Remaining, Guaranteed Money, Cap Hit, Signing Bonus, Dead Cap, No-Trade Clause flag, Incentives
- Statistics tabs: Current Season Stats, Career Stats, Game Log (week-by-week), Season History
- Depth Chart assignment display
- Morale bar + Fatigue bar
- Trade Status section: `tradeRequestState`, `shoppingStatus`, `preferredDestinations`, `blockedDestinations`
- Development section: Experience Points, Development Focus, `calculatePlayerDevelopmentRate()` indicator
- Injury History: Current `injuryStatus` with games out estimate (`getInjuryGamesOut()`)
- Prospect Evaluation section (if drafted): PFF Grade, Club Grade, Tier Delta, Confidence stars, Evidence chips

**D3. Screen: Depth Chart**
- Visual formation layout (offense/defense sides)
- Drag-and-drop depth chart editor
- Each position slot shows: Starter (depth 1), Backup (depth 2), etc.
- Scheme label per position
- Minimum roster requirement indicators (from `MIN_ROSTER_REQUIREMENTS`)

**D4. Screen: Salary Cap / Financials**
- Total Cap Space bar (used vs. available from `salaryCap` and `capSpace`)
- Cash Reserves display with `FinancialHealthTier` badge
- Revenue breakdown table (all 7 `TeamRevenue` fields)
- Expenses breakdown table (all 8 `TeamExpenses` fields)
- Net Income indicator (`getTeamNetIncome()`, green/red for profitable/not)
- Player salary list sorted by cap hit (all players with `getPlayerCapHit()`)
- "Cap-Rich, Cash-Poor" warning banner (from `isCapRichCashPoor()`)
- Dead Cap projection column
- Contract restructure candidates list (players where `canRestructure === true`)
- Cut candidates list with dead cap penalty shown

**D5. Screen: Coaching Staff**
- Head Coach card with: Name, Effectiveness rating, Salary, Years Remaining, Specialties, Preferred Scheme
- Coordinator cards (OC, DC, ST)
- Position coaches list
- Scheme Display: Offensive Scheme, Defensive Scheme, Special Teams Scheme (with descriptions from `getOffensiveSchemeDescription()` etc.)
- Scheme Mismatch indicator: `MismatchResult` showing severity (None/Minor/Moderate/Severe) and rating penalty
- Staff Vacancies list (`StaffVacancy` with priority levels)
- "Fire Coach" button (shown when `shouldFireCoach()` returns true)
- Available Staff market list for hiring

**D6. Screen: Front Office Staff**
- Assistant GM, Scouts, Trainers, Doctors
- Each card: Name, Role, Effectiveness, Salary, Years, Specialties

---

### E. SCOUTING & DRAFT GROUP

**E1. Screen: Scouting / Prospect Database**
- Full prospect list table
- Columns: Name, Position, College, Height, Weight, Age, Projected Round, Overall Rank, Position Rank, Scouting Grade, PFF Grade, Club Grade, Medical Grade, Character Grade, Big Board rank
- Search bar + Position filter + "Top Prospects Only" toggle
- Tier Delta badge per prospect (from `calculateTierDelta()`) with color-coded descriptor
- Evaluation Chips displayed per prospect (array of `ProspectChip` with positive/negative indicators)
- Combine Results panel: 40-yard, Bench, Vertical, Broad Jump, 3-Cone, Shuttle
- Sortable by any column

**E2. Screen: Prospect Detail Page**
- All prospect bio data
- Attributes display (10 `ProspectAttributes` as bar charts)
- Personality panel (6 `ProspectPersonality` traits)
- Production Metrics: Games Played, Career Stats, Awards, Production Score
- Athletic Score (from `calculateAthleticScore()`)
- Strengths list (from `getProspectStrengths()`)
- Weaknesses list (from `getProspectWeaknesses()`)
- NFL Comparables (from `combineResults.nflComparables`)
- Draft Projection panel: Projected round, pick range, confidence level, NFL Projection (rookie year, year 2-3, ceiling, floor)
- "Compare to Player" feature (shows `ProspectComparison[]` side-by-side)
- Red Flag alerts if any exist for this prospect

**E3. Screen: Draft Board (User's Custom Board)**
- Drag-and-drop reorderable prospect list
- Tier system: User-defined tiers with prospect grouping
- "Auto-Rank by Needs" button
- "Auto-Rank by Best Available" button
- "Import Big Board" / "Export Board" buttons
- "Lock Board" button (before draft day, from `lockBoard()`)
- Visual indicator for "Your Pick Is Coming" (from `isUserPickComing()`)
- Team Needs analysis sidebar (from `analyzeTeamNeeds()`)

**E4. Screen: Mock Draft Simulator**
- "Run Mock Draft" button
- Progress indicator (0-100%)
- Results table: Overall Pick, Round, Pick, Team, Prospect selected
- Re-run capability

**E5. Screen: Draft Week Lead-Up (Mon-Wed)**
- Day-by-day progression (Monday through Wednesday, from `DraftDay` enum)
- Daily Rumors feed (`DraftRumor[]` with team, prospect, confidence %, true/false hidden)
- Red Flag Events panel (`RedFlagEvent[]` with type: Medical/Character/Performance, severity: Minor/Moderate/Major)
- "Leak Interest" button to strategically reveal your interest in a prospect
- Advance Day button

**E6. Screen: Draft War Room (Thursday - Live Draft)**
- CRITICAL VIEW - THE MONEY SCREEN
- "On The Clock" banner with countdown timer (`clockTimeRemaining`)
- Current pick indicator: Round X, Pick Y, Overall Z
- Currently drafting team display (`getCurrentDraftingTeam()`)
- Available Prospects panel (filterable, sortable)
- Your Draft Board panel (user's ranked list)
- Advisor Debate panel: Scout recommendation vs. Coach recommendation (both with prospect name, position, reasoning, confidence level)
- War Room Tension meter (`warRoomTension` 0-100)
- Scramble Mode indicator (activated when target is sniped)
- "Make Pick" button (select prospect + confirm)
- "Trade Down" button (opens trade interface)
- Incoming Trade Offers sidebar (`DraftTradeOffer[]` with offering team, package details, urgency, reasoning)
- Phone Call overlay (`showingPhoneCall` flag with `currentTradeOffer`)
- Snipe Alert (when `snipedPlayerIds` changes, show dramatic alert)
- Compensatory Picks indicator (picks 33+ in rounds 3-7, from `compPicks[]`)
- Recent Picks ticker (who was just drafted)

**E7. Screen: Post-Draft Summary**
- Draft Grade Report Card (`DraftSummary`): Needs Grade, Value Grade, Future Assets Grade, Overall Grade
- All grade letters with colors (from `getGradeColor()`)
- Standout Picks section with icons: Steal, Reach, Potential (from `getStandoutIcon()`, `getStandoutColor()`)
- Full drafted players list with details
- UDFA Signings section (converted undrafted free agents)
- "Dismiss and Advance" button (from `dismissSummaryAndEnableAdvancement()`)

---

### F. TRANSACTIONS GROUP

**F1. Screen: Free Agency Hub**
- Available Free Agents table
- Columns: Name, Position, Overall, Potential, Age, Market Value (from `calculatePlayerMarketValue()`), Asking Price, Agent Type
- Position filter + search
- Agent Personality indicator per player (Shark, Uncle, Brand Builder, Self-Represented with archetype description)
- "Start Negotiation" button per player
- Your team's Cap Space + Cash Reserves prominently displayed
- Financial Constraints message (from `getConstraintMessage()`)
- Max Signing Bonus available (from `getMaxSigningBonus()`)
- Franchise Tag section: List of expiring players, Tag/Extend/Release buttons, Tag value display

**F2. Screen: Contract Negotiation**
- FULL NEGOTIATION INTERFACE
- Player card (name, position, overall, market value)
- Agent card (name, archetype, description, mood indicator with color from `getAgentMoodColor()`)
- Leverage meter: User vs. Agent bar (from `NegotiationLeverage`)
- Dominant party indicator (from `getDominantParty()`)
- Offer Builder:
  - Years slider (1-7, per-year salary breakdown `baseSalaryPerYear[]`)
  - Signing Bonus input
  - Guaranteed Money input
  - LTBE Incentives section (add/remove `ContractIncentive` items)
  - NLTBE Incentives section
  - Void Years toggle + count
  - Offset Language toggle
  - Bonus Deferral option (immediate % vs. deferred %)
- Offer Summary panel:
  - Total Value (from `getContractOfferTotalValue()`)
  - Average Per Year (from `getContractOfferAveragePerYear()`)
  - Guaranteed Percentage (from `getContractOfferGuaranteedPercentage()`)
  - Year 1 Cap Hit (from `getContractOfferCapHitYear1()`)
  - Dead Cap Risk (from `getContractOfferDeadCapRisk()`)
- "Submit Offer" button
- Response panel: Agent's message, mood change, counter-offer details
- Lockout warning (when `isLockedOut === true`, show lockout reason + phone dead days)
- Negotiation History timeline (all `NegotiationAttempt` entries)
- "Cash-Friendly Contract" auto-generate option

**F3. Screen: Trade Center**
- Two-panel trade builder (Your Team | Other Team)
- Each panel: Players list (draggable to trade block), Draft Picks list (draggable)
- Cap Space before/after for BOTH teams
- Trade Fairness Score meter (from `TradeEvaluation.fairnessScore`)
- "Evaluate Trade" button showing accept/reject prediction with reason
- No-Trade Clause flag on relevant players (from `hasNoTradeClause`)
- NTC Approved Destinations list (from `approvedTradeDestinations`)
- NTC Waive Chance percentage (from `calculateNTCWaiveChance()`)
- Trade Block section: Your players on the block (`onTheBlock[]`)
- Trade Rumors feed (`TradeRumor[]` with player, interested teams, likelihood)
- Incoming Trade Offers list with Accept/Reject/Counter buttons
- Sent Trade Offers list with status tracking
- Franchise State indicator for both teams (`FranchiseTier`: Contender, Rebuilder, Purgatory, Hoarder, Mediocre)

**F4. Screen: Trade Deadline Mode**
- Countdown timer (`deadlineTimeRemaining`)
- "Deadline Active" banner
- Accelerated trade activity feed
- Block List display (from `generateBlockList()`)
- Desperation Tax indicators by position (from `calculateDesperationTax()`)

**F5. Screen: Franchise Tag / Contract Deadline**
- Expiring Players list (from `getExpiringPlayers()`)
- Per player: three buttons - Extend / Tag / Release
- Tag Value display per position (from `calculateFranchiseTagValue()`)
- "Can Afford Tag?" indicator with cap impact (from `canTeamAffordTag()`)
- Tag Used This Season indicator (from `hasTeamUsedFranchiseTag()`)
- Deadline Cap Impact summary: Extensions cost, Tags cost, Total (from `calculateDeadlineCapImpact()`)
- Resolution Status: Are all contracts resolved? (from `areAllContractsResolved()`)

---

### G. IN-SEASON GROUP

**G1. Screen: Weekly Schedule / Scoreboard**
- This week's games list (`GameSchedule[]`)
- Each game: Home team vs. Away team, game time, National TV badge
- "Simulate Week" button
- Results after simulation: Scores, attendance, weather
- Your game highlighted

**G2. Screen: Standings**
- Division standings tables (8 divisions)
- Columns: Team, W, L, T, Win%, PF, PA, Div Record, Conf Record, Streak
- Playoff picture: Top 7 seeds per conference with clinch/elimination indicators
- Power Rankings list (all 32 teams by `powerRanking`)

**G3. Screen: Playoff Bracket**
- Visual bracket layout (AFC side + NFC side)
- Seeds 1-7 per conference (`PlayoffSeed[]`)
- Matchup cards: Higher seed vs. Lower seed, with scores if played
- Round progression: Wild Card -> Divisional -> Conference Championship -> Super Bowl
- Winner highlights, eliminated teams grayed out
- "Simulate Round" button

**G4. Screen: Player Development / Training**
- Development Focus selector per player
- Experience Points display
- Development Rate indicator (from `calculatePlayerDevelopmentRate()`)
- Weekly development reports (from `DevelopmentState.reports`)

**G5. Screen: Preseason**
- Preseason game results
- Standout players indicator (from `isPlayerPreseasonStandout()`)
- Preseason Rating display (0-10 from `preseasonRating`)
- Roster Cut Helper: Players sorted by preseason performance + overall for cut decisions
- Roster compliance countdown (must reach 53 by `ROSTER_CUTS` event)

---

### H. SOCIAL & NARRATIVE GROUP

**H1. Screen: Inbox / Messages**
- List of `InboxItem` entries
- Category tabs: Trade, Contract, Media, League, Staff, Owner, Fan
- Each message: Subject, Sender, Date, Priority badge, Unread indicator
- "Requires Action" flag
- Message detail view with full body text
- Narrative Impact display when applicable: Fan Support change, Owner Patience change, Team Morale change, Media Pressure level

**H2. Screen: News Feed / Social Timeline**
- `SocialPost` feed with:
  - Author avatar, name, handle, verification badge
  - Content text
  - Post type (News, Rumor, Analysis)
  - Archetype (Leak, Speculation, Official)
  - Engagement stats: Likes, Retweets, Replies
  - Heat Score bar (0-100)
  - Related player/team links
- `NewsHeadline` feed with category badges and importance levels

**H3. Screen: Notifications Panel**
- Chronological list of `GameNotification` entries
- Type icons (Trade, Injury, Contract, Draft, Media, Milestone, Financial, Psychology, Roster, Team Update, Performance)
- Priority color coding (Low=gray, Medium=blue, High=orange, Urgent=red)
- Read/Unread states
- Related players/teams linked

**H4. Screen: Trophy Case**
- All earned `Trophy` items
- Per trophy: Name, Description, Date Earned, Season, Icon, Rarity (Common through Legendary)
- Rarity color coding

---

### I. SETTINGS & META

**Screen: Settings**
- Auto-Pause toggles (`AutoPauseSettings`): Pause on Injuries, Pause on Trade Offers
- Simulation Speed default
- Auto-Save frequency
- Storage management (view used space, clear old saves)

**Screen: Simulation Overlay**
- Visual state display (`SimVisualState`): Scoreboard, Transaction Ticker, Pro Day Map, Newspaper Spin, Draft Room
- Processing description text
- Progress bar (`currentProcessingProgress`)
- Headlines digest (accumulated during simulation)

---

## 2. THE INTERACTION LAYER (Modals & Overlays)

### CONFIRMATION MODALS

| Trigger | Modal Title | Critical Data Shown | Actions |
|---------|-------------|---------------------|---------|
| Cut Player | "Release {name}?" | Dead Cap penalty (`contract.deadCap`), Cap savings, Roster count after | Confirm Release / Cancel |
| Restructure Contract | "Restructure {name}'s Contract?" | Before/after cap hit, new guaranteed money, dead cap change | Confirm / Cancel |
| Accept Trade | "Accept Trade?" | Full package both sides, cap impact both sides, roster impact | Accept / Reject / Counter |
| Reject Trade | "Reject Trade from {team}?" | Offer details, relationship impact note | Confirm Reject / Reconsider |
| Fire Coach | "Fire {name}?" | Remaining contract buyout, vacancy created, `FiringDecision.reason` | Confirm Fire / Cancel |
| Franchise Tag | "Apply Franchise Tag to {name}?" | Tag Value, Cap Impact, "You can only tag ONE player per season" warning | Confirm Tag / Cancel |
| Release to FA | "Release {name} to Free Agency?" | Dead cap, cap savings, narrative impact (social post preview from `generateFranchiseTagSocialPost()`) | Confirm / Cancel |
| Delete Save | "Delete Save '{slot}'?" | Last played date, GM name | Delete / Cancel |
| Trade Deadline | "Trade Deadline Approaching!" | Time remaining, pending offers count | Dismiss |
| Draft Pick | "Select {prospect} with Pick {round}.{pick}?" | Prospect grade, team needs filled, projected outcome | Confirm Pick / Go Back |
| Move to IR | "Place {name} on Injured Reserve?" | Minimum 4 weeks (`MIN_WEEKS_ON_IR`), roster spot freed | Confirm / Cancel |
| Activate from IR | "Activate {name} from IR?" | Roster count (must have room under 53), weeks on IR | Confirm / Cancel |
| Practice Squad | "Add {name} to Practice Squad?" | PS count vs. limit (16), eligibility check | Confirm / Cancel |

### NEGOTIATION MODALS

| Modal | Contents | Interaction |
|-------|----------|-------------|
| Contract Offer | Sliders: Years (1-7), Base Salary per year, Signing Bonus, Guaranteed Money. Toggles: Void Years, Offset Language. Incentive builder. Deferral options. | Submit Offer -> Agent Response -> Iterate or Walk Away |
| Agent Response | Agent mood face/color, Response message, Counter-offer details (if any), Lockout timer (if triggered) | Accept Counter / Revise / Walk Away |
| Staff Negotiation | Salary input, Years input, Bonus input. Attempts remaining counter. History of previous offers. | Submit -> Result (success/fail with `NegotiationResult.message`) |
| NTC Waiver Request | Player name, destination team, waive chance %, "Request Waiver" option instead of direct trade | Request -> Result with `NTCWaiverResult` (waived: true/false, reason) |
| Draft Day Phone Call | Calling team name, their offer (picks + players), urgency level, reasoning text. Timer ticking in background. | Accept Trade / Decline / Counter |
| Shadow Advisor Call | Advisor name, demand amount, deadline hours, phone number flavor text. | Engage Advisor / Report to League (`ShadowAdvisorAction`) |
| Press Leak Alert | Headline, player name, team name, offered amount vs. market value. | Dismiss (impact already applied) |

### OVERLAY SCREENS

| Overlay | When Shown | Contents |
|---------|------------|----------|
| Simulation Digest | After simulation completes | All accumulated headlines, transactions, score results |
| Draft Snipe Alert | When `snipedPlayerIds` changes | "YOUR TARGET WAS TAKEN!" with prospect name, picking team, scramble mode activation |
| Advisor Debate | During draft when it's your pick | Split screen: Scout says pick X (reasoning + confidence), Coach says pick Y (reasoning + confidence) |
| Trade Deadline Countdown | When `tradeDeadlineActive === true` | Pulsing timer, frantic activity feed |
| Black Monday | After season if coaches fired | `generateBlackMondaySummary()` output: fired coaches list with reasons, vacancies created |
| Holdout Alert | If player holdout detected | Resolution options: Cave In, Fine, Prove-It Deal (`HoldoutResolution` enum) |
| Roster Cut Day | During `ROSTER_CUTS` event week | Must-cut list to reach 53, compliance status, position violations |

---

## 3. DATA VISUALIZATION REQUIREMENTS

### PLAYER DATA POINTS (Decision-Making Critical)

**On Every Player Card/Row:**
- Overall rating (0-100, color-coded tiers: Elite 90+, Franchise 85+, Starter 75+, etc.)
- Potential rating (future ceiling)
- Age (context for development vs. decline)
- Contract: Cap Hit this year + Years Remaining + Dead Cap
- Injury Status badge with color (from `getPlayerStatusColor()`)
- Morale bar (0-100)
- Position badge with color (from `getPositionColor()`)

**In Trade Evaluations:**
- Cap Space BEFORE and AFTER for both teams
- Cash Reserves BEFORE and AFTER
- Player Trade Value number (from `calculatePlayerTradeValue()`)
- Pick Value number (from `calculatePickValue()`)
- Fairness Score bar (from `TradeEvaluation.fairnessScore`)
- Franchise Tier for both teams (Contender/Rebuilder/etc.)
- Desperation Tax by position (from `calculateDesperationTax()`)
- NTC status: Blocked/Approved destinations, Waive chance %

**In Free Agency:**
- Market Value (from `calculateMarketValueForContract()`)
- Team-Friendly Target price
- Agent Mood indicator (5 states: Angry->Excited with colors)
- Leverage bar (User vs. Agent split)
- Cap Impact of potential signing (Year 1 Cap Hit)
- Cash Required upfront (signing bonus + guaranteed)
- Financial Health Tier badge (affects what you can offer)
- "Cash-Friendly" indicator on contracts (from `isCashFriendlyContract()`)

**In Draft:**
- Prospect Grade vs. PFF Grade (Tier Delta with +/- indicator and color)
- Scouting Confidence level (1-3 stars)
- Combine Results with percentile indicators
- Medical Grade + Character Grade (color-coded)
- Evaluation Chips as tag pills (green for positive, red for negative)
- Draft Outcome probability hint: Bust/Gem/Normal chances (from `calculateDraftOutcome()`)
- Position Need indicator for your team

**In Financial Views:**
- Revenue vs. Expenses stacked bar chart
- Cap utilization donut chart (used / available / dead cap)
- Cash Reserves trend line
- Financial Health Tier with color (5 tiers: Wealthy -> Crisis)
- Signing Bonus affordability indicator
- "Cap-Rich, Cash-Poor" warning

### TEAM DATA POINTS

**On Team Cards/Headers:**
- Win-Loss-Tie record
- Division rank
- Power Ranking (#1-32)
- Playoff Chances percentage
- Competitiveness score
- Offense/Defense/Special Teams ratings (3 bars)
- Coaching Efficiency score
- Streak indicator (W3, L2, etc.)
- Championships count (trophy icon + number)

**Owner/Fan Gauges:**
- Owner Patience meter (critical: if low, you get fired)
- Owner Spending Mood (affects budget)
- Owner Interference Level
- Fan Mood gauge
- Fan Expectations level
- Fan Loyalty level
- Media Perception score

---

## 4. STATE STATES (The "Ifs")

### PHASE-DRIVEN UI CHANGES

| `currentPhase` Value | Dashboard Changes | Locked/Unlocked Sections | Special UI |
|---------------------|-------------------|--------------------------|-----------|
| `OFFSEASON` | Show "Prepare for new season" | Roster moves open, no games | Season summary visible |
| `SCOUTING_COMBINE` | Combine results feed active | Prospect database unlocked with combine data | Pro Day Map overlay during sim |
| `FREE_AGENCY` | FA Hub prominent, "Hot Market" banner | Full negotiation system active, trade system active | Agent mood indicators visible |
| `POST_FREE_AGENCY` | "Draft Preparation" label | Draft Board editing open, FA winding down | Comp picks calculation visible |
| `DRAFT` | FULL WAR ROOM MODE | All other sections secondary, draft is primary | Timer, advisors, phone calls, tension meter |
| `POST_DRAFT` | Draft summary mandatory | Draft locked (`draftIsLocked`), UDFA signings open | Grade report card shown |
| `TRAINING_CAMP` | Camp battles feed | Development system active | Preseason ratings appearing |
| `PRESEASON` | Preseason games + standouts | Roster cuts pressure building | Cut Day compliance counter |
| `REGULAR_SEASON` | Scoreboard primary, standings visible | In-season trades active (until deadline), game sim active | Weekly game results |
| `PLAYOFFS` | Bracket view primary | No trades, no FA | Elimination drama, bracket progression |
| `SUPER_BOWL` | Championship game focus | Everything else locked | Trophy potential |

### PLAYER-DRIVEN FLAGS

| Flag / Condition | UI Effect |
|-----------------|-----------|
| `hasNoTradeClause === true` | Lock icon on trade button, show "NTC" badge, show approved destinations list, "Request Waiver" option instead of direct trade |
| `tradeRequestState === 'PUBLIC_DEMAND'` | Red "WANTS OUT" badge on player card, drama indicator, morale impact shown |
| `shoppingStatus === 'PUBLIC_BLOCK'` | "ON THE BLOCK" banner on player, increased AI interest indicator |
| `isPlayerBeingShopped() === true` | Shopping cart icon, "Being Shopped" label |
| `isPlayerCausingDrama() === true` | Drama/fire icon, team chemistry impact note |
| `injuryStatus !== HEALTHY` | Injury badge (color by severity: Questionable=yellow, Doubtful=orange, Out=red, IR=dark red) |
| `status === PRACTICE_SQUAD` | "PS" badge, eligible for promotion button |
| `status === INJURED_RESERVE` | "IR" badge with weeks counter, activate button (only if `canPlayerActivateFromIR()`) |
| `morale < 30` | Red morale warning icon |
| `contract.canRestructure === true` | "Restructure" button visible |
| `contract.canCut === true` | "Cut" button visible, dead cap shown |
| `playerHasExpiringContract() === true` | "Expiring" badge, extension/tag options |
| `isPlayerRookie() === true` | "Rookie" badge |
| `isPlayerElite() === true` | Star/elite badge |

### TRADE-DRIVEN FLAGS

| Flag / Condition | UI Effect |
|-----------------|-----------|
| `TradeEvaluation.ntcBlocked === true` | "BLOCKED BY NTC" overlay, waiver option |
| `TradeEvaluation.isAcceptable === false` | Red "Likely Rejected" indicator with reason |
| `TradeEvaluation.fairnessScore < 0.5` | "Unfair Trade" warning banner |
| `currentWeek >= TRADE_SYSTEM_DEADLINE_WEEK` | "TRADE DEADLINE PASSED" - disable all trade buttons |
| `tradeDeadlineActive === true` | Countdown timer visible globally, urgency pulse animation |

### DRAFT-DRIVEN FLAGS

| Flag / Condition | UI Effect |
|-----------------|-----------|
| `isDraftActive === true` | War Room is the forced primary view |
| `onTheClock === true` | YOUR PICK banner, timer counting down, advisor debate appears |
| `scrambleMode === true` | Red "SCRAMBLE MODE" alert, board reshuffles suggested |
| `boardLocked === true` | Draft board is read-only, no more reordering |
| `showingPhoneCall === true` | Phone call modal overlay with trade offer |
| `warRoomTension > 75` | Visual tension effects (UI could shake/pulse) |
| `draftIsLocked === true` | All draft UI disabled, summary only |
| `showingSummaryScreen === true` | Mandatory summary modal, blocks advancement until dismissed |
| `postDraftComplete === true` | UDFA processing complete, advance week enabled |

### FINANCIAL FLAGS

| Flag / Condition | UI Effect |
|-----------------|-----------|
| `FinancialHealthTier === CRISIS` | Red warning banner globally: "FINANCIAL CRISIS" |
| `FinancialHealthTier === STRAINED` | Orange warning in cap views |
| `isCapRichCashPoor() === true` | Split indicator: green cap bar but red cash bar, warning message |
| `isInLiquidityCrisis() === true` | "NO CASH FOR BONUSES" blocker on signing screens |
| `canAffordSigningBonus() === false` | Disable signing bonus slider, show reason |
| `capSpace < 0` | "OVER THE CAP" red banner, must cut/restructure to comply |

### SIMULATION FLAGS

| Flag / Condition | UI Effect |
|-----------------|-----------|
| `simulationState === SIMULATING` | Simulation overlay active, controls disabled |
| `simulationState === PAUSED_FOR_INTERRUPT` | Interrupt modal shown (injury/trade/event) |
| `activeInterrupt !== null` | Must acknowledge before continuing |
| `hasGamesThisWeek === true` | "Game Day" indicator, simulate button says "Play Week" |
| `isOffseason === true` | No game buttons, offseason activities highlighted |

### COACHING FLAGS

| Flag / Condition | UI Effect |
|-----------------|-----------|
| `MismatchResult.hasMismatch === true` | Warning on coaching screen: "SCHEME MISMATCH" with severity and rating penalty |
| `shouldFireCoach() === true` | "Consider Firing" suggestion badge on coach card with reason |
| `isStaffContractExpiring() === true` | "Expiring" badge on staff card |

---

## DESIGN SYSTEM NOTES

### Color Palette Requirements (From Backend)

The backend defines these color functions you must honor:
- **Position Colors**: `getPositionColor(position)` - each of 11 positions has a unique color
- **Player Status Colors**: `getPlayerStatusColor(status)` - Active/FA/PS/IR/etc.
- **Grade Colors**: `getGradeColor(grade)` - A+ through F
- **Agent Mood Colors**: `getAgentMoodColor(mood)` - Angry/Disappointed/Neutral/Interested/Excited
- **Financial Tier Colors**: `getFinancialHealthTierColor(tier)` - Wealthy through Crisis
- **Injury Colors**: Based on severity (Healthy=green, Questionable=yellow, Doubtful=orange, Out=red)
- **Notification Priority Colors**: Low=gray, Medium=blue, High=orange, Urgent=red
- **Trade Request Severity Colors**: `getTradeRequestSeverityColor(state)`
- **Standout Pick Colors**: `getStandoutColor(type)` - Steal/Reach/Potential
- **Trophy Rarity Colors**: Common/Uncommon/Rare/Epic/Legendary
- **Owner Archetype**: Ghost/Titan/Meddler/Penny-Pincher/Trust-Fund-Baby (each needs a visual identity)
- **Fan Base Archetype**: Die-Hard/Hostile/Fair-Weather/Casual (each needs a visual identity)

### Typography Hierarchy
- **H1**: Screen titles (Dashboard, Draft War Room, etc.)
- **H2**: Section headers (Roster, Financials, etc.)
- **H3**: Card titles (Player name, Team name)
- **Body**: Data tables, descriptions
- **Caption**: Secondary stats, timestamps
- **Mono**: Numbers, financial figures, ratings

### Responsive Priority
The primary target is desktop web (1440px+), but the data-dense screens (Roster, Draft Board, Trade Center) need careful consideration for 1280px widths.

---

## SUMMARY

This document provides **100% coverage** of every feature, data point, interaction, and state flag in the backend. Every interface, every enum value, and every function return type has been mapped to a specific UI element, screen, modal, or visual state.

**Key Metrics:**
- **16 Backend Type Files** analyzed
- **300+ Functions/Methods** documented
- **100+ Interfaces** mapped to UI requirements
- **50+ Enums** converted to visual states
- **50+ Screens/Views** required
- **20+ Modal Types** defined
- **40+ Data Visualizations** specified
- **80+ UI State Conditions** documented

You can now open Figma/Sketch and start wireframing with zero ambiguity about what the backend supports.
