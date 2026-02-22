/**
 * Team Select Screen — new franchise setup
 * Step 1: GM Profile  →  Step 2: Load CSV  →  Step 3: Pick Team  →  Start
 *
 * Team colors + logos fetched from nflverse-data at runtime.
 */

import { useState, useRef, useEffect } from "react";
import { Upload, ChevronRight } from "lucide-react";
import { COLORS, FONT } from "../ui/theme";
import { parsePlayersFromCSV } from "../services/CSVPlayerImportService";
import { Player } from "../types/player";

// ─── NFL Team Metadata (static base) ─────────────────────────────────────────

export interface TeamMeta {
  abbr: string;
  city: string;
  name: string;
  conf: "AFC" | "NFC";
  div: string;
}

export const NFL_TEAMS: TeamMeta[] = [
  { abbr: "ARI", city: "Arizona",      name: "Cardinals",  conf: "NFC", div: "West"  },
  { abbr: "ATL", city: "Atlanta",       name: "Falcons",    conf: "NFC", div: "South" },
  { abbr: "BAL", city: "Baltimore",     name: "Ravens",     conf: "AFC", div: "North" },
  { abbr: "BUF", city: "Buffalo",       name: "Bills",      conf: "AFC", div: "East"  },
  { abbr: "CAR", city: "Carolina",      name: "Panthers",   conf: "NFC", div: "South" },
  { abbr: "CHI", city: "Chicago",       name: "Bears",      conf: "NFC", div: "North" },
  { abbr: "CIN", city: "Cincinnati",    name: "Bengals",    conf: "AFC", div: "North" },
  { abbr: "CLE", city: "Cleveland",     name: "Browns",     conf: "AFC", div: "North" },
  { abbr: "DAL", city: "Dallas",        name: "Cowboys",    conf: "NFC", div: "East"  },
  { abbr: "DEN", city: "Denver",        name: "Broncos",    conf: "AFC", div: "West"  },
  { abbr: "DET", city: "Detroit",       name: "Lions",      conf: "NFC", div: "North" },
  { abbr: "GB",  city: "Green Bay",     name: "Packers",    conf: "NFC", div: "North" },
  { abbr: "HOU", city: "Houston",       name: "Texans",     conf: "AFC", div: "South" },
  { abbr: "IND", city: "Indianapolis",  name: "Colts",      conf: "AFC", div: "South" },
  { abbr: "JAX", city: "Jacksonville",  name: "Jaguars",    conf: "AFC", div: "South" },
  { abbr: "KC",  city: "Kansas City",   name: "Chiefs",     conf: "AFC", div: "West"  },
  { abbr: "LAC", city: "Los Angeles",   name: "Chargers",   conf: "AFC", div: "West"  },
  { abbr: "LAR", city: "Los Angeles",   name: "Rams",       conf: "NFC", div: "West"  },
  { abbr: "LV",  city: "Las Vegas",     name: "Raiders",    conf: "AFC", div: "West"  },
  { abbr: "MIA", city: "Miami",         name: "Dolphins",   conf: "AFC", div: "East"  },
  { abbr: "MIN", city: "Minnesota",     name: "Vikings",    conf: "NFC", div: "North" },
  { abbr: "NE",  city: "New England",   name: "Patriots",   conf: "AFC", div: "East"  },
  { abbr: "NO",  city: "New Orleans",   name: "Saints",     conf: "NFC", div: "South" },
  { abbr: "NYG", city: "New York",      name: "Giants",     conf: "NFC", div: "East"  },
  { abbr: "NYJ", city: "New York",      name: "Jets",       conf: "AFC", div: "East"  },
  { abbr: "PHI", city: "Philadelphia",  name: "Eagles",     conf: "NFC", div: "East"  },
  { abbr: "PIT", city: "Pittsburgh",    name: "Steelers",   conf: "AFC", div: "North" },
  { abbr: "SEA", city: "Seattle",       name: "Seahawks",   conf: "NFC", div: "West"  },
  { abbr: "SF",  city: "San Francisco", name: "49ers",      conf: "NFC", div: "West"  },
  { abbr: "TB",  city: "Tampa Bay",     name: "Buccaneers", conf: "NFC", div: "South" },
  { abbr: "TEN", city: "Tennessee",     name: "Titans",     conf: "AFC", div: "South" },
  { abbr: "WAS", city: "Washington",    name: "Commanders", conf: "NFC", div: "East"  },
];

// ─── nflverse team enrichment ─────────────────────────────────────────────────

interface NflverseTeam {
  team_abbr: string;
  team_color: string;
  team_color2: string;
  team_logo_espn: string;
  team_wordmark: string;
}

// ─── GM Style Options ─────────────────────────────────────────────────────────

const GM_STYLES = [
  { id: "analytics",  label: "Analytics",   desc: "Data-driven, market inefficiencies"     },
  { id: "old-school", label: "Old School",  desc: "Gut feel, film study, proven veterans"  },
  { id: "player",     label: "Player's GM", desc: "Culture-first, morale matters"          },
  { id: "win-now",    label: "Win Now",     desc: "Go all-in, trade future picks for stars" },
] as const;

type GMStyleId = typeof GM_STYLES[number]["id"];

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GMProfile {
  firstName: string;
  lastName: string;
  age: number;
  style: GMStyleId;
}

export interface GameStartData {
  players: Player[];
  teamAbbr: string;
  teamMeta: TeamMeta;
  gm: GMProfile;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "profile", label: "GM Profile"  },
  { id: "csv",     label: "Load Roster" },
  { id: "team",    label: "Pick Team"   },
] as const;

type Step = typeof STEPS[number]["id"];

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
  background: "rgba(116,0,86,0.15)", border: `1px solid ${COLORS.darkMagenta}`,
  color: COLORS.light, outline: "none", fontFamily: FONT.system, boxSizing: "border-box",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, color: COLORS.muted, fontWeight: 700,
      letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamSelectScreen({ onStart }: { onStart: (data: GameStartData) => void }) {
  // GM profile
  const [gmFirst, setGmFirst] = useState("");
  const [gmLast,  setGmLast]  = useState("");
  const [gmAge,   setGmAge]   = useState("");
  const [gmStyle, setGmStyle] = useState<GMStyleId>("analytics");

  // Setup flow
  const [step, setStep]               = useState<Step>("profile");
  const [players, setPlayers]         = useState<Player[]>([]);
  const [parseErrors, setParseErrors] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<TeamMeta | null>(null);
  const [confFilter, setConfFilter]   = useState<"ALL" | "AFC" | "NFC">("ALL");
  const [loading, setLoading]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // nflverse enrichment
  const [nflData, setNflData] = useState<Map<string, NflverseTeam>>(new Map());

  useEffect(() => {
    // Asset Resilience (P0 0.2): Try local first, fallback to GitHub
    const fetchTeamsData = async () => {
      try {
        // Try local path first (relative to public root)
        const response = await fetch("/data/teams_colors_logos.json");
        if (!response.ok) throw new Error("Local not found");
        const data: NflverseTeam[] = await response.json();
        setNflData(new Map(data.map(t => [t.team_abbr, t])));
      } catch {
        try {
          // Fallback to GitHub if local fails
          const response = await fetch(
            "https://github.com/nflverse/nflverse-data/releases/download/manually_updated/teams_colors_logos.json"
          );
          const data: NflverseTeam[] = await response.json();
          setNflData(new Map(data.map(t => [t.team_abbr, t])));
        } catch {
          // Silent fail — cards render without enrichment
          console.warn("[Asset Resilience] Could not load teams_colors_logos.json from local or GitHub");
        }
      }
    };
    fetchTeamsData();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parsePlayersFromCSV(text);
      setPlayers(result.players);
      setParseErrors(result.errors.length);
      setLoading(false);
      setStep("team");
    };
    reader.readAsText(file);
  }

  const stepIndex   = STEPS.findIndex(s => s.id === step);
  const teamList    = confFilter === "ALL" ? NFL_TEAMS : NFL_TEAMS.filter(t => t.conf === confFilter);
  const rosterCount = (abbr: string) => players.filter(p => p.teamId === abbr).length;
  const canProfile  = gmFirst.trim() && gmLast.trim() && Number(gmAge) >= 18 && Number(gmAge) <= 80;

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT.system,
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>
          Franchise Manager
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, color: COLORS.light, margin: 0, letterSpacing: -1 }}>
          New Franchise
        </h1>
      </div>

      {/* Step Indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: 36, alignItems: "center" }}>
        {STEPS.map(({ id, label }, i) => {
          const past    = stepIndex > i;
          const current = stepIndex === i;
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800,
                background: current ? COLORS.magenta : past ? "rgba(215,241,113,0.15)" : "rgba(116,0,86,0.25)",
                color: current ? COLORS.light : past ? COLORS.lime : COLORS.muted,
                border: `1px solid ${current ? COLORS.magenta : past ? COLORS.lime : "transparent"}`,
              }}>
                {past ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, color: current ? COLORS.light : COLORS.muted, fontWeight: current ? 700 : 400 }}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div style={{ width: 20, height: 1, background: COLORS.darkMagenta, marginLeft: 2 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: GM Profile ── */}
      {step === "profile" && (
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>First Name</Label>
                <input
                  value={gmFirst} onChange={e => setGmFirst(e.target.value)}
                  placeholder="First" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = COLORS.magenta; }}
                  onBlur={e => { e.target.style.borderColor = COLORS.darkMagenta; }}
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <input
                  value={gmLast} onChange={e => setGmLast(e.target.value)}
                  placeholder="Last" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = COLORS.magenta; }}
                  onBlur={e => { e.target.style.borderColor = COLORS.darkMagenta; }}
                />
              </div>
            </div>

            <div style={{ maxWidth: 140 }}>
              <Label>Age</Label>
              <input
                type="number" min={18} max={80}
                value={gmAge} onChange={e => setGmAge(e.target.value)}
                placeholder="e.g. 38" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = COLORS.magenta; }}
                onBlur={e => { e.target.style.borderColor = COLORS.darkMagenta; }}
              />
            </div>

            <div>
              <Label>Management Style</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {GM_STYLES.map(s => {
                  const active = gmStyle === s.id;
                  return (
                    <button key={s.id} onClick={() => setGmStyle(s.id)} style={{
                      padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      border: `2px solid ${active ? COLORS.lime : "rgba(116,0,86,0.4)"}`,
                      background: active ? "rgba(215,241,113,0.07)" : "rgba(116,0,86,0.12)",
                      transition: "all 0.15s",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? COLORS.lime : COLORS.light, marginBottom: 3 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 9, color: COLORS.muted, lineHeight: 1.4 }}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            disabled={!canProfile}
            onClick={() => setStep("csv")}
            style={{
              width: "100%", marginTop: 26, padding: "12px", borderRadius: 10,
              fontSize: 13, fontWeight: 800, cursor: canProfile ? "pointer" : "not-allowed", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: canProfile ? COLORS.magenta : "rgba(116,0,86,0.3)",
              color: canProfile ? COLORS.light : COLORS.muted,
            }}
          >
            Next — Load Roster <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Step 2: Load CSV ── */}
      {step === "csv" && (
        <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
          <div
            onClick={() => !loading && fileRef.current?.click()}
            style={{
              border: `2px dashed ${COLORS.darkMagenta}`, borderRadius: 16, padding: "52px 32px",
              cursor: loading ? "default" : "pointer", background: "rgba(116,0,86,0.08)",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = COLORS.magenta; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.darkMagenta; }}
          >
            <Upload size={36} color={COLORS.muted} style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.light, marginBottom: 8 }}>
              {loading ? "Parsing roster…" : "Load NFL Roster CSV"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
              Click to browse for your{" "}
              <span style={{ color: COLORS.lime, fontWeight: 600 }}>nfl_players_merged.csv</span> file
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
          <button onClick={() => setStep("profile")} style={{
            marginTop: 16, padding: "8px 20px", borderRadius: 8, fontSize: 12,
            border: `1px solid ${COLORS.darkMagenta}`, background: "transparent",
            color: COLORS.muted, cursor: "pointer",
          }}>Back</button>
        </div>
      )}

      {/* ── Step 3: Pick Team ── */}
      {step === "team" && (
        <div style={{ width: "100%", maxWidth: 960 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              {players.length} players loaded
              {parseErrors > 0 && <span style={{ color: COLORS.magenta }}> · {parseErrors} skipped</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["ALL", "AFC", "NFC"] as const).map(c => (
                <button key={c} onClick={() => setConfFilter(c)} style={{
                  padding: "4px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                  background: confFilter === c ? COLORS.magenta : "rgba(116,0,86,0.3)",
                  color: confFilter === c ? COLORS.light : COLORS.muted,
                }}>{c}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {teamList.map(team => {
              const isSelected = selectedTeam?.abbr === team.abbr;
              const count      = rosterCount(team.abbr);
              const td         = nflData.get(team.abbr);
              const teamColor  = td?.team_color ?? COLORS.darkMagenta;
              const logoUrl    = td?.team_logo_espn;

              return (
                <button key={team.abbr} onClick={() => setSelectedTeam(team)} style={{
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${isSelected ? teamColor : "rgba(116,0,86,0.4)"}`,
                  background: isSelected ? `${teamColor}18` : "rgba(116,0,86,0.1)",
                  transition: "all 0.15s", position: "relative",
                  boxShadow: isSelected ? `0 0 0 1px ${teamColor}40` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {team.city}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? teamColor : COLORS.light }}>
                        {team.name}
                      </div>
                      <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 5 }}>
                        {team.conf} · {team.div} · {count} players
                      </div>
                    </div>
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={team.name}
                        style={{ width: 38, height: 38, objectFit: "contain", flexShrink: 0, opacity: isSelected ? 1 : 0.6 }}
                      />
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.15)" }}>
                        {team.abbr}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
            <button onClick={() => setStep("csv")} style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 12,
              border: `1px solid ${COLORS.darkMagenta}`, background: "transparent",
              color: COLORS.muted, cursor: "pointer",
            }}>Back</button>

            {selectedTeam && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {nflData.get(selectedTeam.abbr)?.team_logo_espn && (
                  <img
                    src={nflData.get(selectedTeam.abbr)!.team_logo_espn}
                    alt={selectedTeam.name}
                    style={{ width: 36, height: 36, objectFit: "contain" }}
                  />
                )}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: COLORS.muted }}>Selected</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: nflData.get(selectedTeam.abbr)?.team_color ?? COLORS.lime }}>
                    {selectedTeam.city} {selectedTeam.name}
                  </div>
                </div>
                <button onClick={() => onStart({
                  players,
                  teamAbbr: selectedTeam.abbr,
                  teamMeta: selectedTeam,
                  gm: { firstName: gmFirst.trim(), lastName: gmLast.trim(), age: Number(gmAge), style: gmStyle },
                })} style={{
                  padding: "11px 28px", borderRadius: 10, fontSize: 13, fontWeight: 800,
                  cursor: "pointer", border: "none",
                  background: nflData.get(selectedTeam.abbr)?.team_color ?? COLORS.magenta,
                  color: COLORS.light,
                }}>
                  Start Franchise
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
