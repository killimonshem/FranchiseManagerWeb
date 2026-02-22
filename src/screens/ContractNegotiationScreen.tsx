/**
 * ContractNegotiationScreen.tsx
 *
 * Full contract negotiation experience with agent personalities, leverage mechanics,
 * offer builders, response logs, and special events (holdouts, press leaks, shadow advisors).
 *
 * Data flow: All negotiation state lives in agentPersonalitySystem (engine).
 * UI state: only local offer draft sliders + response log display.
 */

import { useState, useEffect } from 'react';
import { COLORS, fmtCurrency } from '../ui/theme';
import {
  Section,
  RatingBadge,
  PosTag,
  StatusBadge,
  Pill,
  IconBtn,
  CapBar,
  StatBar,
  FinancialHealthBadge,
} from '../ui/components';
import { gameStateManager } from '../types/GameStateManager';
import { Player, PlayerStatus } from '../types/player';
import {
  AgentMood,
  ContractOffer,
  NegotiationResponse,
  getContractOfferAveragePerYear,
  getContractOfferGuaranteedPercentage,
  getContractOfferCapHitYear1,
  getAgentMoodColor,
  AgentArchetype,
  AGENT_ICONS,
} from '../types/ContractSystem';
import { PlayerNegotiationState } from '../systems/AgentPersonalitySystem';
import { CashReserveTier } from '../systems/FinanceSystem';

const AGENT_ICON_MAP: Record<string, string> = {
  'The Shark': 'SharkIcon',
  'Uncle/Family Friend': 'HeartIcon',
  'Brand Builder': 'TrendingUpIcon',
  'Self-Represented': 'UserIcon',
};

interface Props {
  playerId: string;
  onDone: () => void;
  negotiationContext?: 'freeAgency' | 'extension' | 'franchiseTag';
  onRosterChange?: () => void;
}

interface OfferDraft {
  years: number;
  apyMillions: number;
  guaranteedPct: number;
  signingBonusMillions: number;
  voidYears: number;
  offsetLanguage: boolean;
}

export function ContractNegotiationScreen({ playerId, onDone, negotiationContext = 'freeAgency', onRosterChange }: Props) {
  const [offerDraft, setOfferDraft] = useState<OfferDraft>({
    years: 2,
    apyMillions: 5,
    guaranteedPct: 60,
    signingBonusMillions: 0.5,
    voidYears: 0,
    offsetLanguage: false,
  });

  const [lastResponse, setLastResponse] = useState<NegotiationResponse | null>(null);
  const [responseHistory, setResponseHistory] = useState<NegotiationResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get fresh negotiation state
  const negotiationState = gameStateManager.agentPersonalitySystem.getPlayerNegotiationState(
    playerId
  );
  const player = gameStateManager.allPlayers.find(p => p.id === playerId);

  // Initialize negotiation if not already started
  useEffect(() => {
    if (!negotiationState && player) {
      const capSpace = gameStateManager.userTeamId
        ? gameStateManager.getCapSpace(gameStateManager.userTeamId)
        : 0;
      const positionDepth = gameStateManager.allPlayers.filter(
        p => p.position === player.position && p.teamId === gameStateManager.userTeamId
      ).length;
      const userTeam = gameStateManager.userTeam;
      const isContender = userTeam
        ? (userTeam.wins + userTeam.losses > 8 && userTeam.wins > userTeam.losses) ||
          userTeam.playoffChances > 50
        : false;

      gameStateManager.agentPersonalitySystem.beginPlayerNegotiation(
        player,
        capSpace,
        positionDepth,
        isContender
      );
    }
  }, [playerId, player, negotiationState]);

  if (!player || !negotiationState) {
    return (
      <div style={{ animation: 'fadeIn .4s' }}>
        <h2>Contract Negotiation</h2>
        <p>Loading...</p>
      </div>
    );
  }

  const userTeamId = gameStateManager.userTeamId ?? '';
  const capSpace = gameStateManager.getCapSpace(userTeamId);
  const apy = offerDraft.apyMillions * 1_000_000;
  const signingBonus = offerDraft.signingBonusMillions * 1_000_000;
  const totalValue = apy * offerDraft.years + signingBonus;
  const guaranteedMoney = totalValue * (offerDraft.guaranteedPct / 100);
  const userTeam = gameStateManager.userTeam;
  const cashReserves = userTeam?.cashReserves ?? 0;
  const cashTier = userTeam ? gameStateManager.financeSystem.getCashReserveTier(userTeam) : CashReserveTier.COMFORTABLE;

  // Build contract offer from draft
  const buildOffer = (): ContractOffer => ({
    id: `offer_${playerId}_${Date.now()}`,
    years: offerDraft.years,
    baseSalaryPerYear: Array(offerDraft.years).fill(apy),
    signingBonus,
    guaranteedMoney,
    ltbeIncentives: [],
    nltbeIncentives: [],
    voidYears: offerDraft.voidYears,
    offsetLanguage: offerDraft.offsetLanguage,
  });

  // Calculate projected Year 1 cap hit
  const offer = buildOffer();
  const projectedCapHit = getContractOfferCapHitYear1(offer);
  const canAfford = capSpace >= projectedCapHit;
  const canAffordCash = userTeam ? gameStateManager.financeSystem.canAffordSigningBonus(userTeam, signingBonus) : true;

  // Handle offer submission
  const handleMakeOffer = async () => {
    setSubmitting(true);
    const offer = buildOffer();
    const response = gameStateManager.agentPersonalitySystem.submitOffer(playerId, offer);

    setLastResponse(response);
    setResponseHistory([...responseHistory, response]);

    if (response.accepted) {
      // Sign the player
      gameStateManager.commitPlayerSigning(playerId, offer, userTeamId);
      onRosterChange?.();
      setTimeout(() => {
        onDone();
      }, 500);
    }

    setSubmitting(false);
  };

  // Clamp years to agent max length
  const maxYears = negotiationState.agent.maxContractLength || 10;

  // Market Context Calculation
  const marketContext = (() => {
    const allPlayers = gameStateManager.allPlayers;
    const posPlayers = allPlayers.filter(p => p.position === player.position && p.contract);
    
    // Top 5 at position
    const top5 = [...posPlayers].sort((a, b) => (b.contract!.currentYearCap) - (a.contract!.currentYearCap)).slice(0, 5);
    const top5Avg = top5.length ? top5.reduce((sum, p) => sum + p.contract!.currentYearCap, 0) / top5.length : 0;

    // Comparables (OVR +/- 3)
    const comparables = posPlayers.filter(p => Math.abs(p.overall - player.overall) <= 3);
    const compAvg = comparables.length ? comparables.reduce((sum, p) => sum + p.contract!.currentYearCap, 0) / comparables.length : 0;
    
    return { top5Avg, compAvg };
  })();

  return (
    <div style={{ animation: 'fadeIn .4s', paddingBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h2>{player.firstName} {player.lastName}</h2>
          <div style={{ fontSize: 12, color: COLORS.neutral }}>
            {player.position} | Age {player.age} | {negotiationContext === 'extension' ? 'Extension' : 'Free Agent'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <RatingBadge overall={player.overall} />
        </div>
      </div>

      {/* ── SECTION A: Agent Header ──────────────────────────────────────────────── */}

      <Section
        title={`${negotiationState.agent.name}`}
        pad
        style={{
          borderLeft: `4px solid ${getAgentMoodColor(negotiationState.agentMood) || COLORS.muted}`,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
              ARCHETYPE
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {negotiationState.agent.archetype}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
              MOOD
            </div>
            <StatusBadge
              variant={
                negotiationState.agentMood === AgentMood.EXCITED
                  ? 'positive'
                  : negotiationState.agentMood === AgentMood.ANGRY
                    ? 'negative'
                    : negotiationState.agentMood === AgentMood.INTERESTED
                      ? 'info'
                      : 'neutral'
              }
            >
              {negotiationState.agentMood}
            </StatusBadge>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>Market Value</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {fmtCurrency(negotiationState.marketValue)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>Your Cap Space</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: capSpace < projectedCapHit ? COLORS.coral : COLORS.lime,
              }}
            >
              {fmtCurrency(capSpace)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>Round</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {negotiationState.negotiationRound}
            </div>
          </div>
        </div>

        {/* Leverage Bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
            LEVERAGE: {
              negotiationState.leverage.userLeverage > negotiationState.leverage.agentLeverage + 0.2
                ? 'You Dominate'
                : negotiationState.leverage.agentLeverage > negotiationState.leverage.userLeverage + 0.2
                  ? 'Agent Holds Leverage'
                  : 'Balanced'
            }
          </div>
          <StatBar
            label=""
            value={negotiationState.leverage.userLeverage * 100}
            max={100}
            color={COLORS.lime}
          />
          <div style={{ fontSize: 9, textAlign: 'center', color: COLORS.muted, marginTop: 4 }}>
            You {Math.round(negotiationState.leverage.userLeverage * 100)}% | Agent{' '}
            {Math.round(negotiationState.leverage.agentLeverage * 100)}%
          </div>
        </div>
      </Section>

      {/* ── LOCKOUT STATE ────────────────────────────────────────────────────────── */}

      {negotiationState.isLockedOut ? (
        <>
          <Section
            pad
            style={{
              backgroundColor: COLORS.coral + '20',
              borderLeft: `4px solid ${COLORS.coral}`,
              marginBottom: 20,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <StatusBadge variant="negative">
                LOCKOUT: {negotiationState.lockoutReason || 'Negotiations terminated'}
              </StatusBadge>
            </div>

            {negotiationState.pressLeaks.length > 0 && (
              <div
                style={{
                  backgroundColor: COLORS.gold + '10',
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 12,
                }}
              >
                {negotiationState.pressLeaks.map((leak, i) => (
                  <div key={i} style={{ fontSize: 11, marginBottom: i < negotiationState.pressLeaks.length - 1 ? 8 : 0 }}>
                    <strong style={{ color: COLORS.gold }}>Press Leak:</strong> {leak.headline}
                  </div>
                ))}
              </div>
            )}

            <IconBtn
              variant="ghost"
              onClick={onDone}
              style={{ width: '100%' }}
            >
              Return to Free Agency
            </IconBtn>
          </Section>
        </>
      ) : (
        <>
          {/* ── PHONE DEAD BANNER ─────────────────────────────────────────────── */}

          {negotiationState.phoneDeadUntilRound !== undefined &&
            negotiationState.phoneDeadUntilRound > negotiationState.negotiationRound && (
              <StatusBadge
                variant="warning"
                style={{ marginBottom: 20, display: 'block', textAlign: 'center' }}
              >
                Phone Dead — Agent not taking calls for{' '}
                {(negotiationState.phoneDeadUntilRound - negotiationState.negotiationRound) * 7} days
              </StatusBadge>
            )}

          {/* ── SHADOW ADVISOR OVERLAY ───────────────────────────────────────── */}

          {negotiationState.pendingShadowEvent && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                marginLeft: -24,
                marginRight: -24,
              }}
            >
              <Section
                pad
                style={{
                  maxWidth: 320,
                  backgroundColor: COLORS.bg,
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    marginBottom: 8,
                    fontWeight: 600,
                    color: COLORS.gold,
                  }}
                >
                  Blocked Number
                </div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>
                  <strong>{negotiationState.pendingShadowEvent.advisorName}</strong> is advising{' '}
                  {negotiationState.pendingShadowEvent.playerName} off-book.
                </div>
                <div style={{ fontSize: 12, marginBottom: 16 }}>
                  <strong>Demand:</strong> {fmtCurrency(negotiationState.pendingShadowEvent.demand)}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <IconBtn
                    variant="accent"
                    onClick={() =>
                      gameStateManager.agentPersonalitySystem.respondToShadowAdvisor(
                        playerId,
                        'ENGAGE'
                      )
                    }
                    style={{ flex: 1 }}
                  >
                    Engage
                  </IconBtn>
                  <IconBtn
                    variant="danger"
                    onClick={() =>
                      gameStateManager.agentPersonalitySystem.respondToShadowAdvisor(
                        playerId,
                        'REPORT'
                      )
                    }
                    style={{ flex: 1 }}
                  >
                    Report
                  </IconBtn>
                </div>
              </Section>
            </div>
          )}

          {/* ── SECTION B: Offer Builder ──────────────────────────────────────── */}

          <Section title="Build Your Offer" pad style={{ marginBottom: 20 }}>
            {/* Market Context Banner */}
            <div style={{ 
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, 
              marginBottom: 16, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6 
            }}>
              <div>
                <div style={{ fontSize: 9, color: COLORS.muted, textTransform: 'uppercase' }}>Top 5 {player.position} Avg</div>
                <div style={{ fontSize: 11, color: COLORS.light, fontFamily: 'monospace' }}>{fmtCurrency(marketContext.top5Avg)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: COLORS.muted, textTransform: 'uppercase' }}>Comparable Avg</div>
                <div style={{ fontSize: 11, color: COLORS.lime, fontFamily: 'monospace' }}>{fmtCurrency(marketContext.compAvg)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                Years: {offerDraft.years}
              </label>
              <input
                type="range"
                min="1"
                max={Math.min(10, maxYears)}
                value={offerDraft.years}
                onChange={(e) =>
                  setOfferDraft({ ...offerDraft, years: parseInt(e.target.value) })
                }
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                APY: {fmtCurrency(apy)}
              </label>
              <input
                type="range"
                min="0.795"
                max={negotiationState.marketValue * 1.5 / 1_000_000}
                step="0.1"
                value={offerDraft.apyMillions}
                onChange={(e) =>
                  setOfferDraft({ ...offerDraft, apyMillions: parseFloat(e.target.value) })
                }
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                Guaranteed: {Math.round(offerDraft.guaranteedPct)}% ({fmtCurrency(guaranteedMoney)})
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={offerDraft.guaranteedPct}
                onChange={(e) =>
                  setOfferDraft({ ...offerDraft, guaranteedPct: parseInt(e.target.value) })
                }
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                Signing Bonus: {fmtCurrency(signingBonus)}
              </label>
              <input
                type="range"
                min="0"
                max={apy * 0.3 / 1_000_000}
                step="0.1"
                value={offerDraft.signingBonusMillions}
                onChange={(e) =>
                  setOfferDraft({ ...offerDraft, signingBonusMillions: parseFloat(e.target.value) })
                }
                style={{ width: '100%' }}
              />
            </div>

            {/* Advanced Structure */}
            <div style={{ marginBottom: 16 }}>
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ 
                  background: 'transparent', border: 'none', color: COLORS.lime, 
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 
                }}
              >
                {showAdvanced ? 'Hide Structure Options' : 'Show Contract Structure'}
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                      Void Years: {offerDraft.voidYears}
                    </label>
                    <input
                      type="range" min="0" max="3" step="1"
                      value={offerDraft.voidYears}
                      onChange={(e) => setOfferDraft({ ...offerDraft, voidYears: parseInt(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: 9, color: COLORS.muted }}>Spreads signing bonus cap hit over extra years.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input 
                      type="checkbox" 
                      checked={offerDraft.offsetLanguage}
                      onChange={(e) => setOfferDraft({ ...offerDraft, offsetLanguage: e.target.checked })}
                    />
                    <span style={{ fontSize: 11, color: COLORS.light }}>Offset Language (Reduces dead cap if cut & signed elsewhere)</span>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                backgroundColor: COLORS.muted + '10',
                padding: 12,
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                Total Value
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                {fmtCurrency(totalValue)}
              </div>

              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                Year 1 Cap Hit (Projected)
              </div>
              <CapBar value={projectedCapHit} max={capSpace * 1.2} label="" />
              <div
                style={{
                  fontSize: 9,
                  textAlign: 'right',
                  color:
                    projectedCapHit > capSpace
                      ? COLORS.coral
                      : COLORS.lime,
                  marginTop: 4,
                }}
              >
                {fmtCurrency(projectedCapHit)} vs {fmtCurrency(capSpace)} available
              </div>
            </div>

            <IconBtn
              variant={canAfford && !submitting ? 'primary' : 'ghost'}
              onClick={handleMakeOffer}
              disabled={!canAfford || !canAffordCash || submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Submitting...' : 'Make Offer'}
            </IconBtn>
            {!canAfford && (
              <div style={{ fontSize: 10, color: COLORS.coral, marginTop: 8, textAlign: 'center' }}>
                Insufficient cap space (need {fmtCurrency(projectedCapHit - capSpace)} more)
              </div>
            )}
            {!canAffordCash && (
              <div style={{ fontSize: 10, color: COLORS.coral, marginTop: 8, textAlign: 'center' }}>
                Owner blocked: Insufficient cash reserves for this signing bonus.
              </div>
            )}
          </Section>

          {/* ── SECTION C: Response Log ───────────────────────────────────────── */}

          <Section
            title="Negotiation Log"
            pad
            style={{
              maxHeight: 300,
              overflowY: 'auto',
              marginBottom: 20,
            }}
          >
            {responseHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Submit your first offer to begin negotiations.
              </div>
            ) : (
              responseHistory.map((response, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    marginBottom: idx < responseHistory.length - 1 ? 12 : 0,
                    backgroundColor: COLORS.muted + '10',
                    borderRadius: 4,
                    borderLeft: `3px solid ${getAgentMoodColor(response.newMood) || COLORS.muted}`,
                  }}
                >
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                    Round {idx + 1} — {response.newMood}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 8 }}>
                    {response.message}
                  </div>
                  {response.counterOffer && (
                    <StatusBadge variant="info" style={{ fontSize: 10 }}>
                      Counter: {fmtCurrency(getContractOfferAveragePerYear(response.counterOffer))}/year
                    </StatusBadge>
                  )}
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </div>
  );
}
