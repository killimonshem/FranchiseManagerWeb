import { COLORS } from "../ui/theme";
import { Trophy, Star, CircleDollarSign, Target, Crown, TrendingUp, Lock } from "lucide-react";

export function TrophyScreen() {
  const TROPHIES = [
    { name: "Super Bowl LVII", icon: Trophy, earned: true, rarity: "legendary" },
    { name: "Super Bowl LVIII", icon: Trophy, earned: true, rarity: "legendary" },
    { name: "Perfect Season", icon: Star, earned: false, rarity: "legendary" },
    { name: "Cap Wizard", icon: CircleDollarSign, earned: false, rarity: "epic" },
    { name: "Draft Genius", icon: Target, earned: false, rarity: "epic" },
    { name: "Dynasty Builder", icon: Crown, earned: false, rarity: "legendary" },
    { name: "Trade Master", icon: Star, earned: true, rarity: "rare" },
    { name: "Rookie Whisperer", icon: TrendingUp, earned: true, rarity: "uncommon" },
  ];

  const rarityColor: Record<string, string> = {
    legendary: COLORS.lime,
    epic: COLORS.magenta,
    rare: COLORS.midMagenta,
    uncommon: COLORS.light,
  };

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>Trophy Room</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {TROPHIES.map((t, i) => {
          const Icon = t.icon;
          const rc = rarityColor[t.rarity as keyof typeof rarityColor] || COLORS.muted;
          return (
            <div key={i} style={{
              background: t.earned ? "rgba(141,36,110,0.1)" : "#1D1920",
              borderRadius: 10, padding: 16, border: `1px solid ${t.earned ? rc + "30" : COLORS.darkMagenta}`,
              textAlign: "center", opacity: t.earned ? 1 : 0.4, position: "relative"
            }}>
              <div style={{ fontSize: 32, marginBottom: 6, display: "flex", justifyContent: "center", position: "relative" }}>
                <Icon size={32} color={rc} />
                {!t.earned && <Lock size={16} style={{ position: "absolute", top: 0, right: 0, color: COLORS.muted }} />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.earned ? COLORS.light : COLORS.muted }}>{t.name}</div>
              <div style={{ fontSize: 8, color: rc, textTransform: "uppercase", letterSpacing: 1, marginTop: 4, fontWeight: 600 }}>
                {t.rarity}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
