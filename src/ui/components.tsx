/**
 * Shared UI primitives used across every screen.
 * Import these instead of building one-off elements in each screen.
 *
 * Design rules enforced here:
 *   - OVR / stat values are NEVER shown as numbers; only descriptors + color.
 *   - Exact numbers available on hover (tooltip) for power users.
 *   - All icons are lucide-react SVGs; zero emojis.
 */

import type { ReactNode, CSSProperties, ElementType } from "react";
import {
  Trophy, LayoutDashboard, Users, Briefcase, Mail, UserCog,
  ArrowLeftRight, ClipboardList, Target, DollarSign, Calendar, Award,
  Timer, Lock, Scissors, Dumbbell, FileEdit, Landmark, AlarmClock,
  Flag, Flame, Crown, Swords, Handshake, Megaphone, User,
  ClipboardCheck, Newspaper, HeartPulse, Search, Building2,
  TrendingUp, Minus, TrendingDown, AlertTriangle, ShieldAlert, Star,
  BarChart3, ArrowDownToLine, MessageCircle, CircleDollarSign,
  ChevronRight, Plus, Clock, type LucideIcon,
} from "lucide-react";
import {
  COLORS, FONT, POS_COLORS,
  ratingToDescriptor, ratingToColor, moraleColor, priorityColor,
} from "./theme";

// ═══════════════════════════════════════════════════════════════════
// RATING BADGE — The core "no numbers" component
// ═══════════════════════════════════════════════════════════════════
type BadgeSize = "sm" | "md" | "lg";

const BADGE_SIZES: Record<BadgeSize, { h: number; px: number; fs: number; r: number }> = {
  sm: { h: 22, px: 8,  fs: 9,  r: 4 },
  md: { h: 28, px: 10, fs: 10, r: 6 },
  lg: { h: 34, px: 14, fs: 12, r: 8 },
};

export function RatingBadge({ value, size = "md" }: { value: number; size?: BadgeSize }) {
  const { label, color } = ratingToDescriptor(value);
  const s = BADGE_SIZES[size];
  return (
    <span
      title={`Rating: ${value}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
        background: `${color}15`, border: `1.5px solid ${color}35`,
        color, fontWeight: 700, fontSize: s.fs, fontFamily: FONT.mono,
        letterSpacing: 0.3, flexShrink: 0, whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// POSITION TAG
// ═══════════════════════════════════════════════════════════════════
export function PosTag({ pos }: { pos: string }) {
  const c = POS_COLORS[pos] || COLORS.muted;
  return (
    <span style={{
      display: "inline-flex", padding: "2px 7px", borderRadius: 4,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      background: `${c}18`, color: c, border: `1px solid ${c}28`,
      fontFamily: FONT.mono,
    }}>
      {pos}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAT BAR — colored fill + descriptor at end, no number
// ═══════════════════════════════════════════════════════════════════
export function StatBar({ label, value, max = 99 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  const { label: desc, color } = ratingToDescriptor(value);
  return (
    <div title={`${label}: ${value}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span style={{ width: 100, color: COLORS.muted, fontWeight: 500, fontSize: 10 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: "rgba(141,36,110,0.2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width .5s" }} />
      </div>
      <span style={{ width: 72, textAlign: "right", fontWeight: 600, color, fontFamily: FONT.mono, fontSize: 9 }}>{desc}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MORALE METER — tiny bar, no number, no emoji
// ═══════════════════════════════════════════════════════════════════
export function MoraleMeter({ value }: { value: number }) {
  const c = moraleColor(value);
  const label = value > 80 ? "High" : value > 60 ? "Stable" : "Low";
  return (
    <div title={`Morale: ${value} (${label})`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 36, height: 4, background: "rgba(141,36,110,0.2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 8, color: c, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAP BAR — salary cap utilisation
// ═══════════════════════════════════════════════════════════════════
export function CapBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100);
  const c = pct > 95 ? COLORS.magenta : pct > 85 ? COLORS.muted : COLORS.lime;
  return (
    <div title={`${pct.toFixed(1)}% used`} style={{ width: "100%", height: 4, background: "rgba(141,36,110,0.2)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 2, transition: "width .4s" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION CARD — container with title bar
// ═══════════════════════════════════════════════════════════════════
export function Section({ title, right, children, pad = true }: {
  title?: string; right?: ReactNode; children: ReactNode; pad?: boolean;
}) {
  return (
    <div style={{ background: "rgba(141,36,110,0.1)", borderRadius: 10, border: `1px solid ${COLORS.darkMagenta}`, overflow: "hidden" }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${COLORS.darkMagenta}` }}>
          <span style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>{title}</span>
          {right}
        </div>
      )}
      <div style={pad ? { padding: 14 } : undefined}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DATA ROW — table row with hover & alternating bg
// ═══════════════════════════════════════════════════════════════════
export function DataRow({ children, header, hover, onClick, even }: {
  children: ReactNode; header?: boolean; hover?: boolean; onClick?: () => void; even?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center",
        padding: header ? "8px 14px" : "9px 14px", gap: 8,
        borderBottom: "1px solid rgba(116,0,86,0.4)",
        background: header ? "transparent" : even ? "transparent" : "rgba(141,36,110,0.05)",
        cursor: onClick ? "pointer" : "default", transition: "background .1s",
      }}
      onMouseEnter={e => { if (hover) (e.currentTarget as HTMLElement).style.background = "rgba(141,36,110,0.2)"; }}
      onMouseLeave={e => { if (hover) (e.currentTarget as HTMLElement).style.background = even ? "transparent" : "rgba(141,36,110,0.05)"; }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PILL — filter / tab toggle
// ═══════════════════════════════════════════════════════════════════
export function Pill({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: "pointer",
      background: active ? COLORS.magenta : "transparent",
      color: active ? COLORS.light : COLORS.muted,
      border: `1px solid ${active ? COLORS.midMagenta : "transparent"}`,
      letterSpacing: 0.4, transition: "all .15s",
    }}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB BUTTON — underlined tab
// ═══════════════════════════════════════════════════════════════════
export function TabBtn({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none",
      color: active ? COLORS.lime : COLORS.muted,
      fontSize: 11, fontWeight: 600, cursor: "pointer", paddingBottom: 4,
      borderBottom: active ? `2px solid ${COLORS.lime}` : "2px solid transparent",
      transition: "all .15s",
    }}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ICON BUTTON — icon + label, replaces all emoji-prefixed buttons
// ═══════════════════════════════════════════════════════════════════
type IconBtnVariant = "primary" | "ghost" | "danger" | "accent";

const VARIANT_STYLES: Record<IconBtnVariant, CSSProperties> = {
  primary: { background: "rgba(141,36,110,0.6)", color: COLORS.light, border: "none" },
  ghost:   { background: "rgba(141,36,110,0.2)", color: COLORS.muted, border: `1px solid ${COLORS.darkMagenta}` },
  danger:  { background: COLORS.darkMagenta, color: COLORS.light, border: "none" },
  accent:  { background: COLORS.lime, color: COLORS.bg, border: "none" },
};

export function IconBtn({ icon: Icon, label, variant = "ghost", onClick, style }: {
  icon: LucideIcon; label: string; variant?: IconBtnVariant; onClick?: () => void; style?: CSSProperties;
}) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "7px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600,
      cursor: "pointer", transition: "all .12s", ...VARIANT_STYLES[variant], ...style,
    }}>
      <Icon size={13} />
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ALERT DOT — priority indicator
// ═══════════════════════════════════════════════════════════════════
export function AlertDot({ priority }: { priority: string }) {
  const c = priorityColor(priority);
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE TAG — season phase indicator
// ═══════════════════════════════════════════════════════════════════
export function PhaseTag({ phase, color }: { phase: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, color, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700,
      padding: "3px 8px", background: `${color}15`, borderRadius: 4, border: `1px solid ${color}25`,
    }}>
      {phase}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STATUS BADGE — semantic status indicator (trade interest, injury, etc)
// ═══════════════════════════════════════════════════════════════════
type StatusVariant = "positive" | "negative" | "warning" | "neutral" | "info";

const STATUS_COLORS: Record<StatusVariant, string> = {
  positive: COLORS.lime,
  negative: COLORS.coral,
  warning:  COLORS.gold,
  neutral:  COLORS.lavender,
  info:     COLORS.sky,
};

export function StatusBadge({ label, variant }: { label: string; variant: StatusVariant }) {
  const color = STATUS_COLORS[variant] || COLORS.neutral;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 8px",
      borderRadius: 12,
      fontSize: 9,
      fontWeight: 700,
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY ICON — maps inbox/notification categories to lucide icons
// Single source of truth for category → icon mapping.
// ═══════════════════════════════════════════════════════════════════
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  owner:   Crown,
  agent:   Swords,
  trade:   ArrowLeftRight,
  staff:   ClipboardCheck,
  media:   Newspaper,
  medical: HeartPulse,
  scout:   Search,
  league:  Building2,
  fan:     Users,
};

export function CategoryIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICONS[category] || Mail;
  return <Icon size={size} />;
}

// ═══════════════════════════════════════════════════════════════════
// NAV ICON MAP — maps navigation IDs to lucide icons
// ═══════════════════════════════════════════════════════════════════
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard:  LayoutDashboard,
  inbox:      Mail,
  roster:     Users,
  staff:      UserCog,
  trade:      ArrowLeftRight,
  freeAgency: ClipboardList,
  draft:      Target,
  finances:   DollarSign,
  schedule:   Calendar,
  trophies:   Award,
};

// ═══════════════════════════════════════════════════════════════════
// SEASON EVENT ICON MAP
// ═══════════════════════════════════════════════════════════════════
export const EVENT_ICONS: Record<string, LucideIcon> = {
  "Scouting Combine":        Timer,
  "Free Agency Opens":       ClipboardList,
  "Free Agency Ends":        Lock,
  "NFL Draft":               Target,
  "Squad Cutdown (53-Man)":  Scissors,
  "Training Camp":           Dumbbell,
  "Final Roster Cuts":       FileEdit,
  "Regular Season":          Landmark,
  "Trade Deadline":          AlarmClock,
  "Regular Season Ends":     Flag,
  "Playoffs Begin":          Flame,
  "Super Bowl":              Crown,
};

// ═══════════════════════════════════════════════════════════════════
// AGENT ARCHETYPE ICON MAP
// ═══════════════════════════════════════════════════════════════════
export const AGENT_ICONS: Record<string, LucideIcon> = {
  "The Shark":         Swords,
  "Family Friend":     Handshake,
  "Brand Builder":     Megaphone,
  "Self-Represented":  User,
};

// ═══════════════════════════════════════════════════════════════════
// TROPHY ICON MAP
// ═══════════════════════════════════════════════════════════════════
export const TROPHY_ICONS: Record<string, LucideIcon> = {
  "Super Bowl LVII":    Trophy,
  "Super Bowl LVIII":   Trophy,
  "Perfect Season":     Star,
  "Cap Wizard":         CircleDollarSign,
  "Draft Genius":       Target,
  "Dynasty Builder":    Crown,
  "Trade Master":       ArrowLeftRight,
  "Rookie Whisperer":   TrendingUp,
};

// Re-export icons used directly in screens
export {
  Trophy, LayoutDashboard, Users, Briefcase, Mail, UserCog,
  ArrowLeftRight, ClipboardList, Target, DollarSign, Calendar, Award,
  Timer, Lock, Scissors, Dumbbell, FileEdit, Landmark, AlarmClock,
  Flag, Flame, Crown, Swords, Handshake, Megaphone, User as UserIcon,
  ClipboardCheck, Newspaper, HeartPulse, Search, Building2,
  TrendingUp, Minus, TrendingDown, AlertTriangle, ShieldAlert, Star,
  BarChart3, ArrowDownToLine, MessageCircle, CircleDollarSign,
  ChevronRight, Plus, Clock,
};
export type { LucideIcon };
