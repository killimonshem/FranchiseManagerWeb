/**
 * Design tokens, rating descriptor system, and formatters.
 * Every screen imports from here — single source of truth for visual language.
 */

// ─── Color Palette ────────────────────────────────────────────────
export const COLORS = {
  bg:          "#1D1920",
  darkMagenta: "#740056",
  midMagenta:  "#811765",
  magenta:     "#8D246E",
  muted:       "#9990A0",
  light:       "#F0EEF2",
  lime:        "#D7F171",
  warmLime:    "#B8D94A",
  // Semantic
  positive:    "#D7F171",
  negative:    "#740056",
  warning:     "#8D246E",
  neutral:     "#9990A0",
} as const;

export const FONT = {
  mono: "'JetBrains Mono', monospace",
  system: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ─── Rating Descriptor System ─────────────────────────────────────
// Replaces all numerical OVR / stat displays with human-readable tiers.
// Numbers are NEVER shown to the user; only descriptors + colors.
export interface RatingDescriptor {
  label: string;
  color: string;
}

const TIERS: { min: number; label: string; color: string }[] = [
  { min: 95, label: "Generational", color: COLORS.lime },
  { min: 90, label: "Elite",        color: COLORS.lime },
  { min: 85, label: "Exceptional",  color: COLORS.warmLime },
  { min: 80, label: "Star",         color: COLORS.light },
  { min: 75, label: "Solid",        color: COLORS.muted },
  { min: 70, label: "Average",      color: COLORS.muted },
  { min: 65, label: "Developing",   color: COLORS.magenta },
  { min: 60, label: "Below Avg",    color: COLORS.darkMagenta },
  { min: 0,  label: "Project",      color: COLORS.darkMagenta },
];

export function ratingToDescriptor(value: number): RatingDescriptor {
  for (const tier of TIERS) {
    if (value >= tier.min) return { label: tier.label, color: tier.color };
  }
  return { label: "Project", color: COLORS.darkMagenta };
}

export function ratingToColor(value: number): string {
  return ratingToDescriptor(value).color;
}

// ─── Grade Colors (A+, A, B+, etc. — these stay as letter grades) ──
export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return COLORS.lime;
  if (grade.startsWith("B")) return COLORS.light;
  if (grade.startsWith("C")) return COLORS.muted;
  return COLORS.darkMagenta;
}

// ─── Rarity Colors (Trophy system) ─────────────────────────────────
export function rarityColor(rarity: string): string {
  switch (rarity) {
    case "legendary": return COLORS.lime;
    case "epic":      return COLORS.magenta;
    case "rare":      return COLORS.midMagenta;
    case "uncommon":  return COLORS.light;
    default:          return COLORS.muted;
  }
}

// ─── Currency Formatter ────────────────────────────────────────────
export function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3)  return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Position Colors ───────────────────────────────────────────────
// Each position group gets a distinct, WCAG AA-accessible color
// (4.5:1+ contrast ratio against #1D1920 background).
export const POS_COLORS: Record<string, string> = {
  QB: "#D7F171",  // lime       — franchise centerpiece
  RB: "#F0EEF2",  // near-white — skill back
  WR: "#7EB8E8",  // sky blue   — speed/route
  TE: "#E8A046",  // amber      — hybrid blocker/receiver
  OL: "#C4A4E8",  // lavender   — trenches
  DL: "#E86060",  // coral red  — pass rush
  LB: "#E87DA0",  // rose       — linebacker corps
  CB: "#58C4B8",  // teal       — coverage
  S:  "#B8D94A",  // warm lime  — safety (distinct from QB lime)
  K:  "#F0EEF2",  // near-white — kicker
  P:  "#C0B0E8",  // light purple — punter
};

// ─── Priority Colors ──────────────────────────────────────────────
export function priorityColor(priority: string): string {
  switch (priority) {
    case "urgent": return COLORS.magenta;
    case "high":   return COLORS.midMagenta;
    case "medium": return COLORS.light;
    case "low":    return COLORS.muted;
    default:       return COLORS.muted;
  }
}

// ─── Morale Thresholds ────────────────────────────────────────────
export function moraleColor(value: number): string {
  if (value > 80) return COLORS.lime;
  if (value > 60) return COLORS.muted;
  return COLORS.magenta;
}

// ─── Franchise Tier Colors ────────────────────────────────────────
export function tierColor(tier: string): string {
  switch (tier) {
    case "Contender": return COLORS.lime;
    case "Rebuilder": return COLORS.light;
    case "Purgatory": return COLORS.muted;
    case "Hoarder":   return COLORS.midMagenta;
    case "Mediocre":  return COLORS.darkMagenta;
    default:          return COLORS.muted;
  }
}
