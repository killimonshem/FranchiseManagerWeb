/**
 * Shared UI primitives used across every screen.
 * Import these instead of building one-off elements in each screen.
 *
 * Design rules enforced here:
 *   - OVR / stat values are NEVER shown as numbers; only descriptors + color.
 *   - Exact numbers available on hover (tooltip) for power users.
 *   - All icons are lucide-react SVGs; zero emojis.
 */

import { useEffect, type ReactNode, type CSSProperties, type ElementType } from "react";
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
// RATING TO GRADE CONVERTER
// ═══════════════════════════════════════════════════════════════════
const valueToGrade = (value: number): string => {
  if (value >= 97) return 'A+';
  if (value >= 93) return 'A';
  if (value >= 90) return 'A-';
  if (value >= 87) return 'B+';
  if (value >= 83) return 'B';
  if (value >= 80) return 'B-';
  if (value >= 77) return 'C+';
  if (value >= 73) return 'C';
  if (value >= 70) return 'C-';
  if (value >= 67) return 'D+';
  if (value >= 63) return 'D';
  if (value >= 60) return 'D-';
  return 'F';
};

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
  const label = valueToGrade(value);
  const color = ratingToColor(value);
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
export function StatBar({ label, value, max = 99, color }: { label: string; value: number; max?: number; color?: string }) {
  const pct = (value / max) * 100;
  const desc = valueToGrade(value);
  const finalColor = color || ratingToColor(value);
  return (
    <div title={`${label}: ${value}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span style={{ width: 100, color: COLORS.muted, fontWeight: 500, fontSize: 10 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: "rgba(141,36,110,0.2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: finalColor, borderRadius: 2, transition: "width .5s" }} />
      </div>
      <span style={{ width: 72, textAlign: "right", fontWeight: 600, color: finalColor, fontFamily: FONT.mono, fontSize: 9 }}>{desc}</span>
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
export function Section({ title, right, children, pad = true, style }: {
  title?: string; right?: ReactNode; children: ReactNode; pad?: boolean; style?: CSSProperties;
}) {
  return (
    <div style={{ background: "rgba(141,36,110,0.1)", borderRadius: 10, border: `1px solid ${COLORS.darkMagenta}`, overflow: "hidden", ...style }}>
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
// RADAR CHART — For attributes visualization
// ═══════════════════════════════════════════════════════════════════
export function RadarChart({ data, size = 200, color = COLORS.lime }: { data: { label: string; value: number }[]; size?: number; color?: string }) {
  const center = size / 2;
  const radius = (size / 2) - 30; // Padding for labels
  const angleSlice = (Math.PI * 2) / data.length;

  const points = data.map((d, i) => {
    const r = (d.value / 100) * radius;
    const angle = i * angleSlice - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      lx: center + (radius + 15) * Math.cos(angle), // Label X
      ly: center + (radius + 15) * Math.sin(angle), // Label Y
    };
  });

  const pathData = points.map((p, i) => (i === 0 ? "M" : "L") + `${p.x},${p.y}`).join(" ") + "Z";

  return (
    <div style={{ width: size, height: size, position: "relative", margin: "0 auto" }}>
      <svg width={size} height={size}>
        {/* Background Web */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((scale, j) => (
          <polygon
            key={j}
            points={data.map((_, i) => {
              const r = radius * scale;
              const angle = i * angleSlice - Math.PI / 2;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(" ")}
            fill="none"
            stroke={COLORS.darkMagenta}
            strokeWidth="1"
            opacity={0.5}
          />
        ))}
        
        {/* Axis Lines */}
        {points.map((p, i) => (
          <line key={i} x1={center} y1={center} x2={p.lx} y2={p.ly} stroke={COLORS.darkMagenta} strokeWidth="1" opacity={0.3} />
        ))}

        {/* Data Shape */}
        <path d={pathData} fill={`${color}33`} stroke={color} strokeWidth="2" />

        {/* Labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.lx}
            y={p.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={COLORS.muted}
            fontSize="9"
            fontWeight="600"
            style={{ textTransform: "uppercase" }}
          >
            {data[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FINANCIAL HEALTH BADGE
// ═══════════════════════════════════════════════════════════════════
export function FinancialHealthBadge({ capSpace }: { capSpace: number }) {
  let label = "Stable";
  if (capSpace > 40_000_000) { label = "Wealthy"; }
  else if (capSpace > 20_000_000) { label = "Healthy"; }
  else if (capSpace > 10_000_000) { label = "Stable"; }
  else if (capSpace > 0) { label = "Strained"; }
  else { label = "Crisis"; }

  return <StatusBadge label={label} variant={capSpace > 10_000_000 ? "positive" : capSpace > 0 ? "warning" : "negative"} />;
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

export function IconBtn({ icon: Icon, label, variant = "ghost", onClick, style, disabled }: {
  icon: LucideIcon; label: string; variant?: IconBtnVariant; onClick?: () => void; style?: CSSProperties; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "7px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", transition: "all .12s", opacity: disabled ? 0.5 : 1, ...VARIANT_STYLES[variant], ...style,
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
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════════
export function Toast({ data, onClose, onUndo }: { data: { title: string; message: string; type: 'info' | 'success' | 'error'; action?: string; timeoutMs?: number }; onClose: () => void; onUndo?: () => void }) {
  useEffect(() => {
    const timeout = data.timeoutMs ?? 4000;
    const timer = setTimeout(onClose, timeout);
    return () => clearTimeout(timer);
  }, [onClose, data.timeoutMs]);

  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 9999,
      background: "rgba(10, 5, 10, 0.95)", border: `1px solid ${COLORS.lime}`, borderLeft: `4px solid ${COLORS.lime}`,
      borderRadius: 6, padding: "12px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      animation: "slideIn 0.3s ease-out", maxWidth: 320, backdropFilter: "blur(10px)"
    }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.lime, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{data.title}</div>
      <div style={{ fontSize: 12, color: COLORS.light, lineHeight: 1.4, marginBottom: data.action ? 8 : 0 }}>{data.message}</div>
      {data.action && onUndo && (
        <button
          onClick={() => {
            onUndo();
            onClose();
          }}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 8px',
            background: COLORS.lime,
            color: COLORS.bg,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Undo
        </button>
      )}
    </div>
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

export function StatusBadge({ label, variant, style }: { label: string; variant: StatusVariant; style?: CSSProperties }) {
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
      ...style,
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
  injury:      HeartPulse,
  signing:     ClipboardList,
  performance: TrendingUp,
  rumors:      MessageCircle,
  standings:   BarChart3,
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
