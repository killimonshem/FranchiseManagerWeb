import { COLORS } from "../ui/theme";
import { Section, DataRow, RatingBadge } from "../ui/components";
import type { GameStateManager } from "../types/GameStateManager";

export function ScheduleScreen({ gsm }: { gsm?: GameStateManager }) {
  const season = gsm?.currentGameDate?.season ?? 2026;
  const currentWeek = gsm?.currentGameDate?.week ?? 0;
  const userTeamId = gsm?.userTeamId ?? "";

  // Get schedule for user's team and filter to regular season (weeks 29-49)
  const schedule = gsm?.schedule
    ?.filter(g => (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId) && g.week >= 29 && g.week <= 49)
    .sort((a, b) => a.week - b.week) ?? [];

  // Map schedule with opponent info
  const scheduleWithOpp = schedule.map(game => {
    const isHome = game.homeTeamId === userTeamId;
    const oppTeamId = isHome ? game.awayTeamId : game.homeTeamId;
    const oppTeam = gsm?.teams.find(t => t.id === oppTeamId);
    const oppRating = oppTeam ? Math.round((oppTeam.offenseRating + oppTeam.defenseRating + oppTeam.specialTeamsRating) / 3) : 75;

    return {
      wk: game.week,
      opp: oppTeam?.name ?? "Unknown",
      ovr: oppRating,
      home: isHome,
      isCurrentWeek: game.week === currentWeek,
    };
  });

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: COLORS.light }}>{season} Schedule</h2>

      {scheduleWithOpp.length === 0 ? (
        <div style={{ padding: 16, color: COLORS.muted, fontSize: 12 }}>
          No regular season schedule available yet.
        </div>
      ) : (
        <Section title="Regular Season" pad={false}>
          <DataRow header>
            {["Wk", "Location", "Opponent", "Rating"].map(h =>
              <span key={h} style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, flex: 1 }}>
                {h}
              </span>
            )}
          </DataRow>

          {scheduleWithOpp.map((g, i) => (
            <DataRow key={g.wk} even={i % 2 === 0} hover={g.isCurrentWeek}>
              <span style={{ flex: 1, fontSize: 10, color: g.isCurrentWeek ? COLORS.lime : COLORS.muted, fontFamily: "monospace", fontWeight: g.isCurrentWeek ? 700 : 400 }}>Wk {g.wk}</span>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: g.home ? COLORS.lime : COLORS.magenta }}>
                {g.home ? "HOME" : "AWAY"}
              </span>
              <span style={{ flex: 1, fontSize: 11, color: COLORS.light }}>{g.opp}</span>
              <span style={{ flex: 1 }}><RatingBadge value={g.ovr} size="sm" /></span>
            </DataRow>
          ))}
        </Section>
      )}
    </div>
  );
}
