import { COLORS, fmtCurrency } from "../ui/theme";
import { Section, DataRow, PosTag } from "../ui/components";
import { useState } from "react";
import type { GameStateManager } from "../types/GameStateManager";
import { HardStopReason } from "../types/engine-types";

export function ReviewTradeOfferScreen({ gsm, onNavigate, refresh }: { gsm: GameStateManager; onNavigate: (s: string, d?: any) => void; refresh: () => void; }) {
  const offer = gsm.pendingAITradeOffer;

  if (!offer) {
    return (
      <div style={{ animation: 'fadeIn .3s' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>No Active Trade Offer</h2>
        <div style={{ color: COLORS.muted, fontSize: 12 }}>There are no AI trade proposals waiting for your review.</div>
      </div>
    );
  }

  const offeringTeam = gsm.teams.find(t => t.id === offer.offeringTeamId);

  function handleAccept() {
    gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: true });
    refresh();
    onNavigate('inbox');
  }

  function handleDecline() {
    gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: false });
    refresh();
    onNavigate('inbox');
  }

  function handleNegotiate() {
    gsm.resolveEngineInterrupt({ reason: HardStopReason.TRADE_OFFER_RECEIVED, accepted: false, navigate: true });
    // Navigate into the Trade Center where TradeScreen will pre-populate the offer
    onNavigate('trade');
    refresh();
  }

  return (
    <div style={{ animation: 'fadeIn .3s' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: COLORS.light, marginBottom: 12 }}>Review Trade Offer</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Section title={offeringTeam ? `${offeringTeam.abbreviation} Offer` : 'Offer'}>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>They are offering:</div>
          <div style={{ borderTop: '1px solid rgba(116,0,86,0.3)', paddingTop: 8 }}>
            {offer.offeringPlayerIds.length === 0 && offer.offeringPickIds.length === 0 && (
              <div style={{ color: COLORS.muted }}>No assets offered.</div>
            )}
            {offer.offeringPlayerIds.map(pid => {
              const p = gsm.allPlayers.find(x => x.id === pid);
              if (!p) return null;
              return (
                <DataRow key={pid} hover even={false}>
                  <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                  <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.firstName} {p.lastName}</span>
                  <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{p.overall}</span>
                </DataRow>
              );
            })}
            {offer.offeringPickIds.map(pid => (
              <div key={pid} style={{ fontSize: 11, color: COLORS.muted, padding: '8px 0' }}>{pid}</div>
            ))}
          </div>
        </Section>

        <Section title="They want:">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>They are asking for:</div>
          <div style={{ borderTop: '1px solid rgba(116,0,86,0.3)', paddingTop: 8 }}>
            {offer.receivingPlayerIds.length === 0 && offer.receivingPickIds.length === 0 && (
              <div style={{ color: COLORS.muted }}>No assets requested.</div>
            )}
            {offer.receivingPlayerIds.map(pid => {
              const p = gsm.allPlayers.find(x => x.id === pid);
              if (!p) return null;
              return (
                <DataRow key={pid} hover even={false}>
                  <span style={{ flex: 1 }}><PosTag pos={p.position} /></span>
                  <span style={{ flex: 3, fontSize: 11, fontWeight: 600, color: COLORS.light }}>{p.firstName} {p.lastName}</span>
                  <span style={{ flex: 1, fontSize: 10, color: COLORS.muted }}>{p.overall}</span>
                </DataRow>
              );
            })}
            {offer.receivingPickIds.map(pid => (
              <div key={pid} style={{ fontSize: 11, color: COLORS.muted, padding: '8px 0' }}>{pid}</div>
            ))}
          </div>
        </Section>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
        <button onClick={handleDecline} style={{ padding: '8px 14px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: COLORS.muted }}>Decline</button>
        <button onClick={handleNegotiate} style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623' }}>Negotiate</button>
        <button onClick={handleAccept} style={{ padding: '8px 14px', borderRadius: 6, background: 'linear-gradient(135deg,#b0007a,#6a004f)', border: 'none', color: COLORS.light }}>Accept Offer</button>
      </div>
    </div>
  );
}
