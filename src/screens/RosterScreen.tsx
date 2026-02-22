/**
 * Roster Screen — active roster & practice squad tables
 * Data comes from real CSV-parsed players — no mock data.
 * Progressive disclosure: click row → full profile
 *
 * Responsive: Pot and Morale columns hidden below 640 px.
 */

import { useState } from "react";
import { COLORS } from "../ui/theme";
import { gameStateManager } from "../types/GameStateManager";
import {
  RatingBadge, PosTag, Section, DataRow, Pill, MoraleMeter,
  ShieldAlert, Lock, AlertTriangle, Clock,
} from "../ui/components";
import { Player, PlayerStatus } from "../types/player";
import { InjuryStatus } from "../types/nfl-types";
import { ArrowUp, ArrowDown } from "lucide-react";
import { RestructureModal, FranchiseTagModal } from "../ui/Overlays";

const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

const RESPONSIVE_CSS = `
  @media (max-width: 640px) {
    .roster-pot   { display: none !important; }
    .roster-morale { display: none !important; }
  }
`;

export function RosterScreen({
  setScreen, setDetail, players,
}: {
  setScreen: (s: string) => void;
  setDetail: (d: any) => void;
  players: Player[];
}) {
  const [confirmRelease, setConfirmRelease] = useState<{ open: boolean; player?: Player }>({ open: false });
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab]       = useState("active");
  const [view, setView]     = useState<"overview" | "contract" | "status">("overview");
  const [columnSort, setColumnSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'rating', direction: 'desc' });
  const [showRestructure, setShowRestructure] = useState<Player | null>(null);
  const [showFranchiseTag, setShowFranchiseTag] = useState<Player | null>(null);

  const active   = players.filter(p => p.status !== PlayerStatus.PRACTICE_SQUAD);
  const practice = players.filter(p => p.status === PlayerStatus.PRACTICE_SQUAD);
  const tradeBlock = players.filter(p => p.shoppingStatus === "On The Block");
  const list     = tab === "practice" ? practice : tab === "tradeBlock" ? tradeBlock : active;

  const filtered = filter === "ALL" ? list : list.filter(p => p.position === filter);
  
  // Helper to sort by column
  const getSortedPlayers = (players: Player[]) => {
    return [...players].sort((a, b) => {
      if (columnSort) {
        const { key, direction } = columnSort;
        let aVal: any, bVal: any;
        
        switch (key) {
          case "age":
            aVal = a.age;
            bVal = b.age;
            break;
          case "rating":
            aVal = a.overall;
            bVal = b.overall;
            break;
          case "potential":
            aVal = a.potential;
            bVal = b.potential;
            break;
          case "salary":
          case "capHit":
            aVal = a.contract?.currentYearCap ?? 0;
            bVal = b.contract?.currentYearCap ?? 0;
            break;
          case "total":
            aVal = a.contract?.totalValue ?? 0;
            bVal = b.contract?.totalValue ?? 0;
            break;
          case "guaranteed":
            aVal = a.contract?.guaranteedMoney ?? 0;
            bVal = b.contract?.guaranteedMoney ?? 0;
            break;
          case "bonus":
            aVal = a.contract?.signingBonus ?? 0;
            bVal = b.contract?.signingBonus ?? 0;
            break;
          case "deadcap":
            aVal = a.contract?.deadCap ?? 0;
            bVal = b.contract?.deadCap ?? 0;
            break;
          case "years":
            aVal = a.contract?.yearsRemaining ?? 0;
            bVal = b.contract?.yearsRemaining ?? 0;
            break;
          case "morale":
            aVal = a.morale ?? 0;
            bVal = b.morale ?? 0;
            break;
          default:
            aVal = a.overall;
            bVal = b.overall;
        }
        
        if (typeof aVal === "number" && typeof bVal === "number") {
          return direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        return 0;
      }
      
      // Fallback default
      return b.overall - a.overall;
    });
  };

  const sorted = getSortedPlayers(filtered);
  
  const requestColumnSort = (key: string) => {
    if (columnSort?.key === key) {
      // Toggle direction
      setColumnSort({ key, direction: columnSort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      // New column - default to descending (highest to lowest)
      setColumnSort({ key, direction: 'desc' });
    }
  };

  // Helper to render sortable header
  const renderHeader = (label: string, key: string, flex = 1) => (
    <span
      onClick={() => requestColumnSort(key)}
      style={{
        flex,
        fontSize: 8,
        color: columnSort?.key === key ? COLORS.lime : COLORS.muted,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        fontWeight: columnSort?.key === key ? 800 : 700,
        cursor: "pointer",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "color 0.15s"
      }}
    >
      {label}
      {columnSort?.key === key && (
        columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
      )}
    </span>
  );

  return (
    <div style={{ animation: "fadeIn .4s" }}>
      <style>{RESPONSIVE_CSS}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light }}>Roster Management</h2>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
            {active.length}/53 Active · {practice.length}/16 Practice Squad · {tradeBlock.length} On Block
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill active={tab === "active"}   onClick={() => setTab("active")}>Active Roster</Pill>
          <Pill active={tab === "practice"} onClick={() => setTab("practice")}>Practice Squad</Pill>
          <Pill active={tab === "tradeBlock"} onClick={() => setTab("tradeBlock")}>Trade Block</Pill>
        </div>
      </div>

      {/* Filters & View Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
          {["ALL", ...POSITIONS].map(p => (
            <Pill key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Pill>
          ))}
        </div>
        
        <div style={{ display: "flex", background: "rgba(116,0,86,0.2)", borderRadius: 6, padding: 2 }}>
          {(["overview", "contract", "status"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "4px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer",
                background: view === v ? COLORS.magenta : "transparent",
                color: view === v ? COLORS.light : COLORS.muted,
                textTransform: "capitalize"
              }}
            >
              {v === "contract" ? "Contracts" : v}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: COLORS.muted, fontSize: 13, padding: "32px 0", textAlign: "center" }}>
          No players on this roster yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <Section pad={false}>
            {/* Header row */}
            <DataRow header>
              <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Player</span>
              <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Pos</span>
              {renderHeader("Age", "age", 1)}
              
              {view === "overview" && (
                <>
                  {renderHeader("Rating", "rating", 1)}
                  <span className="roster-pot" style={{ flex: 1, fontSize: 8, color: columnSort?.key === "potential" ? COLORS.lime : COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: columnSort?.key === "potential" ? 800 : 700, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }} onClick={() => requestColumnSort("potential")}>Pot {columnSort?.key === "potential" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}</span>
                  {renderHeader("Salary", "salary", 1)}
                  {renderHeader("Yrs", "years", 1)}
                  <span className="roster-morale" style={{ flex: 1, fontSize: 8, color: columnSort?.key === "morale" ? COLORS.lime : COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: columnSort?.key === "morale" ? 800 : 700, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }} onClick={() => requestColumnSort("morale")}>Morale {columnSort?.key === "morale" && (columnSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}</span>
                  <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Alerts</span>
                </>
              )}

              {view === "contract" && (
                <>
                  {renderHeader("Cap Hit", "capHit", 1)}
                  {renderHeader("Total", "total", 1)}
                  {renderHeader("Guaranteed", "guaranteed", 1)}
                  {renderHeader("Bonus", "bonus", 1)}
                  {renderHeader("Dead Cap", "deadcap", 1)}
                  <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Expires</span>
                  <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Actions</span>
                </>
              )}

              {view === "status" && (
                <>
                  {renderHeader("Rating", "rating", 1)}
                  {renderHeader("Morale", "morale", 1)}
                  <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Injury</span>
                  <span style={{ flex: 1, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Trade Status</span>
                  <span style={{ flex: 2, fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Notes</span>
                </>
              )}
            </DataRow>

            {sorted.map((p, i) => {
              const salary   = p.contract?.currentYearCap ?? 0;
              const years    = p.contract?.yearsRemaining ?? 0;
              const hasNTC   = p.contract?.hasNoTradeClause ?? false;
              const expiring = years === 1;
              const injured  = p.injuryStatus !== InjuryStatus.HEALTHY;
              const tradeReq = p.tradeRequestState === "Requested";

              return (
                <DataRow key={p.id} even={i % 2 === 0} hover onClick={() => { setDetail(p); setScreen("playerProfile"); }}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.light }}>
                      {p.firstName} {p.lastName}
                    </div>
                    <div style={{ fontSize: 9, color: COLORS.muted }}>#{p.jerseyNumber}</div>
                  </div>
                  <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                  <span style={{ flex: 1, fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>{p.age}</span>

                  {view === "overview" && (
                    <>
                      <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
                      <span className="roster-pot"    style={{ flex: 1 }}><RatingBadge value={p.potential} size="sm" /></span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.lime, fontFamily: "monospace", fontWeight: 600 }}>
                        {salary > 0 ? `${(salary / 1e6).toFixed(1)}M` : "—"}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>
                        {years > 0 ? `${years}yr` : "FA"}
                      </span>
                      <span className="roster-morale" style={{ flex: 1 }}><MoraleMeter value={p.morale} /></span>
                      <span style={{ flex: 1, display: "flex", gap: 4, alignItems: "center" }}>
                        {injured  && <span title={p.injuryStatus}><ShieldAlert   size={14} color={COLORS.magenta} /></span>}
                        {hasNTC   && <span title="NTC"><Lock          size={12} color={COLORS.midMagenta} /></span>}
                        {tradeReq && <span title="Trade Request"><AlertTriangle size={13} color={COLORS.magenta} /></span>}
                        {expiring && <span title="Expiring"><Clock         size={13} color={COLORS.muted} /></span>}
                      </span>
                    </>
                  )}

                  {view === "contract" && (
                    <>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.lime, fontFamily: "monospace", fontWeight: 600 }}>
                        {salary > 0 ? `${(salary / 1e6).toFixed(1)}M` : "—"}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
                        {p.contract?.totalValue ? `${(p.contract.totalValue / 1e6).toFixed(1)}M` : "—"}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
                        {p.contract?.guaranteedMoney ? `${(p.contract.guaranteedMoney / 1e6).toFixed(1)}M` : "—"}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>
                        {p.contract?.signingBonus ? `${(p.contract.signingBonus / 1e6).toFixed(1)}M` : "—"}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: COLORS.coral, fontFamily: "monospace" }}>
                        {p.contract?.deadCap ? `${(p.contract.deadCap / 1e6).toFixed(1)}M` : "0.0M"}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: expiring ? COLORS.gold : COLORS.muted }}>
                        {years > 0 ? `${new Date().getFullYear() + years}` : "—"}
                      </span>
                      <span style={{ flex: 2, display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRestructure(p);
                          }}
                          style={{
                            padding: "4px 8px", borderRadius: 4, border: "none",
                            background: COLORS.midMagenta, color: COLORS.light, fontSize: 9, fontWeight: 700, cursor: "pointer"
                          }}
                          title={p.contract?.canRestructure ? "Restructure this contract" : "Cannot restructure"}
                          disabled={!p.contract?.canRestructure}
                        >
                          Restructure
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFranchiseTag(p);
                          }}
                          style={{
                            padding: "4px 8px", borderRadius: 4, border: "none",
                            background: COLORS.warmLime, color: COLORS.bg, fontSize: 9, fontWeight: 700, cursor: "pointer"
                          }}
                          title="Apply franchise tag for 1 year"
                        >
                          Tag
                        </button>
                      </span>
                    </>
                  )}

                  {view === "status" && (
                    <>
                      <span style={{ flex: 1 }}><RatingBadge value={p.overall} size="sm" /></span>
                      <span style={{ flex: 1 }}><MoraleMeter value={p.morale} /></span>
                      <span style={{ flex: 1, fontSize: 10, color: injured ? COLORS.coral : COLORS.lime, fontWeight: 600 }}>
                        {p.injuryStatus === "Healthy" ? "Active" : p.injuryStatus}
                      </span>
                      <span style={{ flex: 1, fontSize: 10, color: p.shoppingStatus === "On The Block" ? COLORS.gold : COLORS.muted }}>
                        {p.shoppingStatus === "On The Block" ? "On Block" : "—"}
                      </span>
                      <span style={{ flex: 2, fontSize: 9, color: COLORS.muted, fontStyle: "italic" }}>
                        {tradeReq ? "Requested Trade" : hasNTC ? "No Trade Clause" : ""}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail({ playerId: p.id, context: 'extension' });
                          setScreen("contractNegotiation");
                        }}
                        style={{
                          marginLeft: 8, padding: "4px 8px", borderRadius: 4, border: "none",
                          background: COLORS.warmLime, color: COLORS.bg, fontSize: 9, fontWeight: 700, cursor: "pointer"
                        }}
                        title="Extend player contract"
                      >
                        Extend
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmRelease({ open: true, player: p });
                        }}
                        style={{
                          marginLeft: 8, padding: "4px 8px", borderRadius: 4, border: "1px solid transparent",
                          background: COLORS.coral, color: COLORS.bg, fontSize: 9, fontWeight: 700, cursor: "pointer"
                        }}
                      >
                        Release
                      </button>
                    </>
                  )}
                </DataRow>
              );
            })}
          </Section>
        </div>
      )}

      {confirmRelease.open && confirmRelease.player && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmRelease({ open: false })} />
          <div style={{ background: COLORS.bg, padding: 18, borderRadius: 8, width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', zIndex: 201 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Confirm Release</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>
              Are you sure you want to release {confirmRelease.player.firstName} {confirmRelease.player.lastName}? This action is immediate and cannot be undone.

              <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6, border: `1px solid ${COLORS.darkMagenta}` }}>
                <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Dead Cap Penalty</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: (confirmRelease.player.contract?.deadCap || 0) > 0 ? COLORS.coral : COLORS.lime }}>
                  ${((confirmRelease.player.contract?.deadCap || 0) / 1e6).toFixed(2)}M
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 1.3 }}>
                  {(confirmRelease.player.contract?.deadCap || 0) > 0
                    ? "This amount will accelerate onto your current year's salary cap."
                    : "No penalty. This release is free of dead money."}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRelease({ open: false })} style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: `1px solid ${COLORS.muted}`, color: COLORS.muted, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => {
                if (confirmRelease.player) gameStateManager.releasePlayer(confirmRelease.player.id);
                setConfirmRelease({ open: false });
              }} style={{ padding: '6px 12px', borderRadius: 6, background: COLORS.coral, border: 'none', color: COLORS.bg, cursor: 'pointer', fontWeight: 700 }}>Release</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showRestructure && (
        <RestructureModal
          player={showRestructure}
          team={gameStateManager.userTeam}
          onConfirm={(pct) => {
            const userTeam = gameStateManager.userTeam;
            if (userTeam) {
              const result = gameStateManager.financeSystem.executeRestructure(showRestructure, userTeam, pct);
              if (result.success) {
                setShowRestructure(null);
              }
            }
          }}
          onCancel={() => setShowRestructure(null)}
        />
      )}

      {showFranchiseTag && (
        <FranchiseTagModal
          player={showFranchiseTag}
          onConfirm={() => {
            gameStateManager.applyFranchiseTag(showFranchiseTag);
            setShowFranchiseTag(null);
          }}
          onCancel={() => setShowFranchiseTag(null)}
        />
      )}
    </div>
  );
}
