/**
 * Modal overlays for player management actions
 */

import { useState } from "react";
import { COLORS, FONT, fmtCurrency } from "./theme";
import type { Player } from "../types/player";

/**
 * RestructureModal - Allows user to restructure a player's contract
 * by converting salary into a signing bonus to reduce cap hit
 */
export function RestructureModal({
  player,
  team,
  onConfirm,
  onCancel,
}: {
  player: Player;
  team: any;
  onConfirm: (percent: number) => void;
  onCancel: () => void;
}) {
  const [percent, setPercent] = useState(25);

  if (!player.contract) return null;

  const contract = player.contract;
  const projectedCapSavings = Math.round((contract.currentYearCap * percent) / 100);
  const newCapHit = contract.currentYearCap - projectedCapSavings;

  return (
    <div style={backdropStyle}>
      <div style={modalContainerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>Restructure Contract</h3>
          <p style={subtitleStyle}>
            Convert salary to signing bonus to reduce cap hit
          </p>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          <div style={playerInfoStyle}>
            <span style={playerNameStyle}>
              {player.firstName} {player.lastName}
            </span>
            <span style={playerTeamStyle}>{team?.name || "Unknown"}</span>
          </div>

          {/* Current Contract Info */}
          <div style={infoBoxStyle}>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Current Cap Hit</span>
              <span style={valueStyle}>{fmtCurrency(contract.currentYearCap)}</span>
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Guaranteed Money</span>
              <span style={valueStyle}>{fmtCurrency(contract.guaranteedMoney)}</span>
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Years Remaining</span>
              <span style={valueStyle}>{contract.yearsRemaining}</span>
            </div>
          </div>

          {/* Restructure Amount Slider */}
          <div style={sliderSectionStyle}>
            <div style={sliderLabelStyle}>
              <span style={labelStyle}>Restructure Amount</span>
              <span style={percentageTextStyle}>{percent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={percent}
              onChange={(e) => setPercent(parseInt(e.target.value, 10))}
              style={sliderStyle}
            />
            <div style={sliderValueStyle}>
              <span style={smallLabelStyle}>Savings: {fmtCurrency(projectedCapSavings)}</span>
              <span style={smallLabelStyle}>New Cap Hit: {fmtCurrency(newCapHit)}</span>
            </div>
          </div>

          {/* Warnings */}
          {percent >= 75 && (
            <div style={warningStyle}>
              <span style={warningTextStyle}>
                ⚠ High restructure amounts extend dead cap burden into future years
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={buttonsStyle}>
          <button
            onClick={onCancel}
            style={cancelButtonStyle}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(percent)}
            style={confirmButtonStyle}
          >
            Confirm Restructure
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * FranchiseTagModal - Confirms franchise tag application
 * Tags a player for one more year at average salary
 */
export function FranchiseTagModal({
  player,
  onConfirm,
  onCancel,
}: {
  player: Player;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!player.contract) return null;

  const contract = player.contract;
  // Franchise tag is typically ~120% of average salary (simplified for now)
  const tagSalary = Math.round(contract.totalValue / contract.yearsRemaining * 1.2);

  return (
    <div style={backdropStyle}>
      <div style={modalContainerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>Apply Franchise Tag</h3>
          <p style={subtitleStyle}>
            Retain player for one more season at franchise tag salary
          </p>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          <div style={playerInfoStyle}>
            <span style={playerNameStyle}>
              {player.firstName} {player.lastName}
            </span>
            <span style={playerTeamStyle}>Franchise Tagged for 1 Year</span>
          </div>

          {/* Tag Details */}
          <div style={infoBoxStyle}>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Tag Salary (1 Year)</span>
              <span style={valueStyle}>{fmtCurrency(tagSalary)}</span>
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Original Contract</span>
              <span style={valueStyle}>{fmtCurrency(contract.totalValue)}</span>
            </div>
            <div style={infoRowStyle}>
              <span style={labelStyle}>Status After Tag</span>
              <span style={valueStyle}>Free Agent (2026)</span>
            </div>
          </div>

          {/* Info Box */}
          <div style={infoBoxStyle}>
            <p style={infoTextStyle}>
              The franchise tag gives you one more year to negotiate a long-term extension
              or prepare to let the player go as a free agent. After the tagged season, the
              player enters unrestricted free agency.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={buttonsStyle}>
          <button
            onClick={onCancel}
            style={cancelButtonStyle}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={tagButtonStyle}
          >
            Apply Franchise Tag
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContainerStyle: React.CSSProperties = {
  background: COLORS.bg,
  border: `1px solid ${COLORS.darkMagenta}`,
  borderRadius: 12,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  width: "90%",
  maxWidth: 500,
  maxHeight: "80vh",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  padding: "20px 24px",
  borderBottom: `1px solid ${COLORS.darkMagenta}`,
  background: `linear-gradient(135deg, ${COLORS.darkMagenta}20, ${COLORS.magenta}10)`,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: COLORS.light,
  fontFamily: FONT.system,
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0 0",
  fontSize: 11,
  color: COLORS.muted,
  fontFamily: FONT.system,
};

const contentStyle: React.CSSProperties = {
  padding: "20px 24px",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const playerInfoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const playerNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: COLORS.lime,
  fontFamily: FONT.system,
};

const playerTeamStyle: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.muted,
  fontFamily: FONT.mono,
};

const infoBoxStyle: React.CSSProperties = {
  background: `${COLORS.magenta}08`,
  border: `1px solid ${COLORS.magenta}20`,
  borderRadius: 8,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.muted,
  fontWeight: 600,
  fontFamily: FONT.system,
};

const valueStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.light,
  fontWeight: 700,
  fontFamily: FONT.mono,
};

const sliderSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const sliderLabelStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const percentageTextStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: COLORS.lime,
  fontFamily: FONT.mono,
};

const sliderStyle: React.CSSProperties = {
  width: "100%",
  height: 6,
  borderRadius: 3,
  background: `${COLORS.magenta}30`,
  outline: "none",
  cursor: "pointer",
  accentColor: COLORS.lime,
};

const sliderValueStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 9,
  color: COLORS.muted,
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: COLORS.muted,
  fontFamily: FONT.mono,
};

const warningStyle: React.CSSProperties = {
  background: `${COLORS.warning}15`,
  border: `1px solid ${COLORS.warning}40`,
  borderRadius: 6,
  padding: 10,
};

const warningTextStyle: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.warning,
  fontFamily: FONT.system,
  fontWeight: 500,
};

const infoTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 10,
  color: COLORS.muted,
  fontFamily: FONT.system,
  lineHeight: 1.4,
};

const buttonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "16px 24px",
  borderTop: `1px solid ${COLORS.darkMagenta}`,
  background: `${COLORS.darkMagenta}10`,
};

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 16px",
  borderRadius: 6,
  border: `1px solid ${COLORS.muted}40`,
  background: "transparent",
  color: COLORS.muted,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: FONT.system,
  transition: "all 0.2s",
};

const confirmButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 16px",
  borderRadius: 6,
  border: "none",
  background: COLORS.lime,
  color: COLORS.bg,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FONT.system,
};

const tagButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 16px",
  borderRadius: 6,
  border: "none",
  background: COLORS.magenta,
  color: COLORS.light,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FONT.system,
};
