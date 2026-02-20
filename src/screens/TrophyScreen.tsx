import { COLORS } from "../ui/theme";
import { Trophy, Star, Medal } from "lucide-react";
import trophiesData from "../../trophies.json";

interface ChampRecord {
  season: number;
  numeral?: string;
  opponent_abbr: string;
  points_for: number;
  points_against: number;
  won: boolean;
}

interface ConferenceChampRecord {
  season: number;
  opponent_abbr: string;
  points_for: number;
  points_against: number;
  won: boolean;
}

interface TeamRecord {
  conference_championships: ConferenceChampRecord[];
  super_bowls: ChampRecord[];
}

const records = trophiesData.records as Record<string, TeamRecord>;

export function TrophyScreen({ teamAbbr }: { teamAbbr: string }) {
  const teamRecord: TeamRecord | undefined = records[teamAbbr];

  const superBowls         = teamRecord?.super_bowls ?? [];
  const confChamps         = teamRecord?.conference_championships ?? [];

  const sbWins             = superBowls.filter(g => g.won);
  const sbLosses           = superBowls.filter(g => !g.won);
  const confWins           = confChamps.filter(g => g.won);
  const confLosses         = confChamps.filter(g => !g.won);

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>Trophy Room</h2>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 16 }}>
        {teamAbbr ? `${teamAbbr} franchise history` : "Select a team to view trophies"}
      </div>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Super Bowl Wins",        value: sbWins.length,    color: COLORS.lime,       icon: Trophy },
          { label: "SB Appearances",         value: superBowls.length, color: COLORS.warmLime,  icon: Trophy },
          { label: "Conf. Championships",    value: confWins.length,   color: COLORS.light,     icon: Star },
          { label: "Conf. Appearances",      value: confChamps.length, color: COLORS.muted,     icon: Medal },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{
            background: "rgba(141,36,110,0.1)", borderRadius: 10, padding: "14px 10px",
            border: `1px solid ${COLORS.darkMagenta}`, textAlign: "center",
          }}>
            <Icon size={20} color={color} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Super Bowl wins */}
      {sbWins.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>Super Bowl Championships</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {sbWins.map(g => (
              <GameCard
                key={g.numeral}
                icon={<Trophy size={18} color={COLORS.lime} />}
                title={`Super Bowl ${g.numeral}`}
                subtitle={`${g.season} Season`}
                detail={`Def. ${g.opponent_abbr}  ${g.points_for}–${g.points_against}`}
                earned
                rarity="legendary"
              />
            ))}
          </div>
        </div>
      )}

      {/* Super Bowl losses */}
      {sbLosses.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>Super Bowl Appearances</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {sbLosses.map(g => (
              <GameCard
                key={g.numeral}
                icon={<Trophy size={18} color={COLORS.muted} />}
                title={`Super Bowl ${g.numeral}`}
                subtitle={`${g.season} Season`}
                detail={`Lost to ${g.opponent_abbr}  ${g.points_for}–${g.points_against}`}
                earned={false}
                rarity="epic"
              />
            ))}
          </div>
        </div>
      )}

      {/* Conference championship wins */}
      {confWins.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>Conference Championships</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {confWins.map((g, i) => (
              <GameCard
                key={i}
                icon={<Star size={18} color={COLORS.warmLime} />}
                title="Conference Champion"
                subtitle={`${g.season} Season`}
                detail={`Def. ${g.opponent_abbr}  ${g.points_for}–${g.points_against}`}
                earned
                rarity="rare"
              />
            ))}
          </div>
        </div>
      )}

      {/* Conference championship losses */}
      {confLosses.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>Conference Final Appearances</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {confLosses.map((g, i) => (
              <GameCard
                key={i}
                icon={<Star size={18} color={COLORS.muted} />}
                title="Conf. Final"
                subtitle={`${g.season} Season`}
                detail={`Lost to ${g.opponent_abbr}  ${g.points_for}–${g.points_against}`}
                earned={false}
                rarity="uncommon"
              />
            ))}
          </div>
        </div>
      )}

      {!teamRecord && (
        <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          No historical records found for this team.
        </div>
      )}

      {teamRecord && superBowls.length === 0 && confChamps.length === 0 && (
        <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          No championship appearances in franchise history yet.
        </div>
      )}
    </div>
  );
}

// ── Small helper card ─────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  legendary: "#D7F171",
  epic:      "#9990A0",
  rare:      "#B8D94A",
  uncommon:  "#F0EEF2",
};

function GameCard({ icon, title, subtitle, detail, earned, rarity }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  detail: string;
  earned: boolean;
  rarity: string;
}) {
  const rc = RARITY_COLOR[rarity] || COLORS.muted;
  return (
    <div style={{
      background: earned ? "rgba(141,36,110,0.12)" : "rgba(29,25,32,0.6)",
      borderRadius: 8, padding: "12px 14px",
      border: `1px solid ${earned ? rc + "30" : COLORS.darkMagenta}`,
      opacity: earned ? 1 : 0.65,
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, color: earned ? COLORS.light : COLORS.muted, flex: 1 }}>{title}</span>
      </div>
      <div style={{ fontSize: 9, color: rc, fontWeight: 600 }}>{subtitle}</div>
      <div style={{ fontSize: 9, color: COLORS.muted }}>{detail}</div>
    </div>
  );
}
