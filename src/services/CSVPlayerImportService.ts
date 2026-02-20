/**
 * CSVPlayerImportService
 *
 * Parses a CSV export of real-world NFL player data and converts each row into
 * a fully-populated Player object compatible with the game engine.
 *
 * Key rules:
 *  - Age is ALWAYS calculated from `birthdate`; the CSV `age` column is ignored.
 *  - Every `stats/<field>/value` column is mapped to the matching PlayerAttributes field.
 *  - `stats/<field>/diff` columns are informational only and are not stored.
 *  - Rows with an unrecognised position or missing first/last name are collected
 *    in the `errors` array and skipped rather than crashing.
 *  - Contract is only attached when yearsLeft > 0 AND contract_apy > 0.
 */

import { Position, PlayerAttributes, PlayerContract, InjuryStatus, createEmptyPlayerAttributes } from "../types/nfl-types";
import { Player, PlayerStatus, createPlayer, createEmptyPlayerStats } from "../types/player";

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface CSVRowError {
  /** 1-based row index (header = 0, first data row = 1) */
  row: number;
  /** Raw comma-joined cell values for debugging */
  rawData: string;
  /** Human-readable description of why the row was rejected */
  reason: string;
}

export interface CSVImportResult {
  players: Player[];
  errors: CSVRowError[];
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * RFC-4180-aware CSV row splitter.
 * Handles fields wrapped in double-quotes that may contain commas or quotes.
 */
function splitCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Build a Map<columnName, columnIndex> from the header row.
 * Column names are trimmed and compared case-insensitively.
 */
function parseHeaders(headerRow: string): Map<string, number> {
  const map = new Map<string, number>();
  const cells = splitCSVRow(headerRow);
  cells.forEach((header, index) => {
    map.set(header.trim(), index);
  });
  return map;
}

/**
 * Safely read a cell value by column name. Returns empty string if the column
 * does not exist or the row is too short.
 */
function cell(row: string[], headers: Map<string, number>, column: string): string {
  const idx = headers.get(column);
  if (idx === undefined || idx >= row.length) return "";
  return (row[idx] ?? "").trim();
}

/**
 * Parse a numeric cell; returns the fallback when the cell is empty or NaN.
 */
function numCell(
  row: string[],
  headers: Map<string, number>,
  column: string,
  fallback = 0
): number {
  const raw = cell(row, headers, column);
  if (raw === "" || raw === null) return fallback;
  const parsed = Number(raw);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Calculate age in whole years from a birthdate up to today.
 */
function calculateAgeFromBirthdate(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Parse a birthdate string in common formats:
 *   YYYY-MM-DD  (ISO)
 *   MM/DD/YYYY  (US)
 *   M/D/YYYY
 * Returns null when the string cannot be parsed.
 */
function parseBirthdate(raw: string): Date | null {
  if (!raw) return null;

  // ISO format: 1998-04-23
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  // US format: 4/23/1998 or 04/23/1998
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [m, d, y] = raw.split("/").map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback — let Date constructor try
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Map a raw position string to the Position enum.
 * Accepts the abbreviated form (QB, RB …) as well as common full names.
 * Returns null for unrecognised values.
 */
function parsePosition(raw: string): Position | null {
  const upper = raw.trim().toUpperCase();

  // Direct abbreviation match
  const direct: Record<string, Position> = {
    QB: Position.QB,
    RB: Position.RB,
    WR: Position.WR,
    TE: Position.TE,
    OL: Position.OL,
    DL: Position.DL,
    LB: Position.LB,
    CB: Position.CB,
    S:  Position.S,
    K:  Position.K,
    P:  Position.P,
  };
  if (direct[upper]) return direct[upper];

  // Full / alternate name match
  const aliases: Record<string, Position> = {
    QUARTERBACK:        Position.QB,
    "RUNNING BACK":     Position.RB,
    "HALF BACK":        Position.RB,
    HB:                 Position.RB,
    FB:                 Position.RB,
    "FULL BACK":        Position.RB,
    "WIDE RECEIVER":    Position.WR,
    "TIGHT END":        Position.TE,
    "OFFENSIVE LINE":   Position.OL,
    "OFFENSIVE LINEMAN":Position.OL,
    "OFFENSIVE TACKLE": Position.OL,
    OT:                 Position.OL,
    OG:                 Position.OL,
    "OFFENSIVE GUARD":  Position.OL,
    C:                  Position.OL,
    CENTER:             Position.OL,
    "DEFENSIVE LINE":   Position.DL,
    "DEFENSIVE LINEMAN":Position.DL,
    "DEFENSIVE TACKLE": Position.DL,
    DT:                 Position.DL,
    DE:                 Position.DL,
    "DEFENSIVE END":    Position.DL,
    NT:                 Position.DL,
    "NOSE TACKLE":      Position.DL,
    LINEBACKER:         Position.LB,
    MLB:                Position.LB,
    OLB:                Position.LB,
    ILB:                Position.LB,
    "MIDDLE LINEBACKER":Position.LB,
    CORNERBACK:         Position.CB,
    CORNER:             Position.CB,
    SAFETY:             Position.S,
    FS:                 Position.S,
    SS:                 Position.S,
    "FREE SAFETY":      Position.S,
    "STRONG SAFETY":    Position.S,
    KICKER:             Position.K,
    PK:                 Position.K,
    PUNTER:             Position.P,
  };
  return aliases[upper] ?? null;
}

/**
 * Map all `stats/<field>/value` CSV columns to a PlayerAttributes object.
 * Starts from createEmptyPlayerAttributes() (all 50s) so any unmapped
 * attribute retains a sensible default.
 */
function mapAttributesFromRow(
  row: string[],
  headers: Map<string, number>
): PlayerAttributes {
  const attrs = createEmptyPlayerAttributes();

  const n = (col: string) => numCell(row, headers, col, 50);

  // Physical
  attrs.acceleration       = n("stats/acceleration/value");
  attrs.agility            = n("stats/agility/value");
  attrs.jumping            = n("stats/jumping/value");
  attrs.stamina            = n("stats/stamina/value");
  attrs.strength           = n("stats/strength/value");
  attrs.speed              = n("stats/speed/value");
  attrs.changeOfDirection  = n("stats/changeOfDirection/value");

  // Mental
  attrs.awareness          = n("stats/awareness/value");
  attrs.playRecognition    = n("stats/playRecognition/value");
  // playRecognitionDef shares the same source column as playRecognition
  attrs.playRecognitionDef = n("stats/playRecognition/value");

  // Technical - Ball Carrier
  attrs.ballCarrierVision  = n("stats/bCVision/value");
  attrs.carrying           = n("stats/carrying/value");
  attrs.trucking           = n("stats/trucking/value");
  attrs.stiffArm           = n("stats/stiffArm/value");
  attrs.spinMove           = n("stats/spinMove/value");
  attrs.jukeMove           = n("stats/jukeMove/value");

  // Technical - Receiving
  attrs.catching           = n("stats/catching/value");
  attrs.catchInTraffic     = n("stats/catchInTraffic/value");
  attrs.spectacularCatch   = n("stats/spectacularCatch/value");
  attrs.shortRouteRunning  = n("stats/shortRouteRunning/value");
  attrs.mediumRouteRunning = n("stats/mediumRouteRunning/value");
  attrs.deepRouteRunning   = n("stats/deepRouteRunning/value");
  attrs.release            = n("stats/release/value");

  // Technical - Passing
  attrs.throwPower          = n("stats/throwPower/value");
  attrs.shortAccuracy       = n("stats/throwAccuracyShort/value");
  attrs.mediumAccuracy      = n("stats/throwAccuracyMid/value");
  attrs.deepAccuracy        = n("stats/throwAccuracyDeep/value");
  attrs.playAction          = n("stats/playAction/value");
  attrs.throwOnTheRun       = n("stats/throwOnTheRun/value");
  attrs.throwUnderPressure  = n("stats/throwUnderPressure/value");
  // Derived: aggregate throw accuracy = average of short/medium/deep
  attrs.throwAccuracy = Math.round(
    (attrs.shortAccuracy + attrs.mediumAccuracy + attrs.deepAccuracy) / 3
  );

  // Technical - Blocking
  attrs.runBlock        = n("stats/runBlock/value");
  attrs.runBlockPower   = n("stats/runBlockPower/value");
  attrs.runBlockFinesse = n("stats/runBlockFinesse/value");
  attrs.passBlock       = n("stats/passBlock/value");
  attrs.passBlockPower  = n("stats/passBlockPower/value");
  attrs.passBlockFinesse= n("stats/passBlockFinesse/value");
  attrs.impactBlocking  = n("stats/impactBlocking/value");
  attrs.leadBlock       = n("stats/leadBlock/value");

  // Technical - Defensive
  attrs.tackle          = n("stats/tackle/value");
  attrs.hitPower        = n("stats/hitPower/value");
  attrs.blockShedding   = n("stats/blockShedding/value");
  attrs.pursuit         = n("stats/pursuit/value");
  attrs.powerMoves      = n("stats/powerMoves/value");
  attrs.finesseMoves    = n("stats/finesseMoves/value");
  attrs.manCoverage     = n("stats/manCoverage/value");
  attrs.zoneCoverage    = n("stats/zoneCoverage/value");
  attrs.press           = n("stats/press/value");

  // Durability
  attrs.injury    = n("stats/injury/value");
  attrs.toughness = n("stats/toughness/value");

  // Special Teams
  attrs.kickPower    = n("stats/kickPower/value");
  attrs.kickAccuracy = n("stats/kickAccuracy/value");
  attrs.kickReturn   = n("stats/kickReturn/value");

  // NOTE: The following CSV columns have no matching PlayerAttributes field
  // and are intentionally skipped:
  //   stats/breakSack/value
  //   stats/breakTackle/value
  //   stats/runningStyle/value
  //   stats/overall/value   (redundant — stored on Player.overall instead)
  //   all stats/*/diff columns (informational only)

  return attrs;
}

/**
 * Build a PlayerContract from contract-related CSV columns.
 * Returns undefined when the player has no active contract (yearsLeft = 0
 * or contract_apy = 0).
 */
function buildContractFromRow(
  row: string[],
  headers: Map<string, number>
): PlayerContract | undefined {
  const yearsRemaining = numCell(row, headers, "yearsLeft", 0);
  const apy            = numCell(row, headers, "contract_apy", 0);

  if (yearsRemaining <= 0 || apy <= 0) return undefined;

  const guaranteedMoney = numCell(row, headers, "contract_guarantees", 0);

  const contract: PlayerContract = {
    totalValue:                yearsRemaining * apy,
    yearsRemaining,
    guaranteedMoney,
    currentYearCap:            apy,
    signingBonus:              0,
    incentives:                0,
    canRestructure:            true,
    canCut:                    true,
    deadCap:                   0,
    hasNoTradeClause:          false,
    approvedTradeDestinations: [],
  };

  return contract;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Parse a CSV string containing NFL player data and return an array of Player
 * objects ready to be loaded into the game engine.
 *
 * Usage:
 *   import { parsePlayersFromCSV } from "./services/CSVPlayerImportService";
 *   const { players, errors } = parsePlayersFromCSV(rawCSVText);
 */
export function parsePlayersFromCSV(csvText: string): CSVImportResult {
  const players: Player[]      = [];
  const errors:  CSVRowError[] = [];

  // Normalise line endings and split into non-empty lines
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    errors.push({ row: 0, rawData: "", reason: "CSV is empty" });
    return { players, errors };
  }

  // First line is the header row
  const headers = parseHeaders(lines[0]);

  // Validate required columns exist
  const requiredColumns = ["first_name", "last_name", "position"];
  for (const col of requiredColumns) {
    if (!headers.has(col)) {
      errors.push({
        row: 0,
        rawData: lines[0],
        reason: `Required header column "${col}" is missing`,
      });
      return { players, errors };
    }
  }

  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const row     = splitCSVRow(rawLine);

    // --- Required fields ---
    const firstName = cell(row, headers, "first_name");
    const lastName  = cell(row, headers, "last_name");
    const posRaw    = cell(row, headers, "position");

    if (!firstName || !lastName) {
      errors.push({ row: i, rawData: rawLine, reason: "Missing first_name or last_name" });
      continue;
    }

    const position = parsePosition(posRaw);
    if (!position) {
      errors.push({
        row: i,
        rawData: rawLine,
        reason: `Unrecognised position "${posRaw}"`,
      });
      continue;
    }

    // --- Birthdate → age (CSV `age` column is intentionally ignored) ---
    const birthdateRaw = cell(row, headers, "birthdate");
    const birthDate    = parseBirthdate(birthdateRaw) ?? new Date(2000, 0, 1);
    const age          = calculateAgeFromBirthdate(birthDate);

    // --- Attributes ---
    const attributes = mapAttributesFromRow(row, headers);

    // --- Contract ---
    const contract = buildContractFromRow(row, headers);

    // --- Bio ---
    const overall      = numCell(row, headers, "overall", 70);
    const weight       = numCell(row, headers, "weight", 200);
    const jerseyNumber = numCell(row, headers, "jerseyNum", 0);
    const accruedSeasons = numCell(row, headers, "yearsPro", 0);
    const college      = cell(row, headers, "college_name");
    const height       = cell(row, headers, "height") || "6'0\"";

    // Store the team abbreviation in teamId; the game engine maps it to a UUID
    // at load time via createNFLTeams() matching by abbreviation.
    const teamId = cell(row, headers, "latest_team") || undefined;

    // Snaps: no dedicated Player field — store in legacy seasonStats record
    const snaps      = numCell(row, headers, "Snaps", 0);
    const seasonStats: Record<string, number> = snaps > 0 ? { snaps } : {};

    // --- Potential: not in the CSV, derive a plausible value from overall ---
    // Young players get more headroom; veterans get less.
    const potentialHeadroom = Math.max(0, 10 - Math.max(0, age - 23));
    const potential = Math.min(99, overall + potentialHeadroom);

    // --- Assemble the Player via the canonical factory ---
    const player = createPlayer(firstName, lastName, position, {
      age,
      birthDate,
      height,
      weight,
      college,
      jerseyNumber,
      overall,
      potential,
      attributes,
      contract,
      accruedSeasons,
      teamId,
      seasonStats,
      status: teamId ? PlayerStatus.ACTIVE : PlayerStatus.FREE_AGENT,
      injuryStatus: InjuryStatus.HEALTHY,
      currentSeasonStats: createEmptyPlayerStats(),
      careerTotalStats:   createEmptyPlayerStats(),
    });

    players.push(player);
  }

  return { players, errors };
}
