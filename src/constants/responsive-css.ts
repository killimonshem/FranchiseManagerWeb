/**
 * Centralized responsive CSS for Draft overlays and board.
 * Injected once at root to avoid duplicate @keyframes stacking on re-renders.
 */

export const RESPONSIVE_CSS = `
  /* ─── Shared Animations (avoid duplication) ─────────────────────────────── */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @keyframes flashRed {
    0% { background: rgba(255,0,0,0.5); }
    100% { background: rgba(60,0,0,0.85); }
  }

  @keyframes ring {
    0% { box-shadow: 0 0 0 0 rgba(215, 241, 113, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(215, 241, 113, 0); }
    100% { box-shadow: 0 0 0 0 rgba(215, 241, 113, 0); }
  }

  /* ─── Draft Board Table: Responsive Column Hiding ─────────────────────────── */

  /* Tablet: Hide College column (screen <= 1024px) */
  @media (max-width: 1024px) {
    .draft-col-college {
      display: none !important;
    }
  }

  /* Mobile: Hide College and Proj columns (screen <= 640px) */
  @media (max-width: 640px) {
    .draft-col-college {
      display: none !important;
    }
    .draft-col-proj {
      display: none !important;
    }
  }

  /* ─── Advisor Debate Overlay: Mobile Layout Fix ────────────────────────────── */
  .advisor-overlay-wrapper {
    position: fixed;
    bottom: 20;
    left: 20;
    right: 20;
    height: 220;
    display: flex;
  }

  .advisor-left-panel {
    flex: 1;
    position: relative;
  }

  @media (max-width: 640px) {
    .advisor-overlay-wrapper {
      flex-direction: column !important;
      height: auto !important;
      max-height: calc(55vh - 65px - env(safe-area-inset-bottom)) !important;
      overflow-y: auto;
      bottom: calc(65px + env(safe-area-inset-bottom) + 12px) !important;
      left: 12px !important;
      right: 12px !important;
    }

    .advisor-left-panel {
      border-right: none !important;
      border-bottom: 1px solid rgba(116,0,86,0.4);
    }
  }

  /* ─── Phone Call Overlay: Mobile Nav Fix ────────────────────────────────── */
  .phone-call-overlay {
    position: fixed;
    bottom: 20;
    right: 20;
    width: 320;
    zindex: 150;
  }

  @media (max-width: 640px) {
    .phone-call-overlay {
      bottom: calc(65px + env(safe-area-inset-bottom) + 12px) !important;
      left: 12px !important;
      right: 12px !important;
      width: auto !important;
    }
  }

  /* ─── Trade Up Overlay: Mobile Responsive Width ────────────────────────────── */
  .trade-up-container {
    padding: 0 16px;
  }

  .trade-up-modal {
    width: 400;
    max-width: 400px;
  }

  @media (max-width: 640px) {
    .trade-up-modal {
      width: 90% !important;
      max-width: 90vw !important;
    }
  }

  /* ─── Scouting Report Modal: Grid Collapse ────────────────────────────────── */
  .scout-modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20;
  }

  @media (max-width: 640px) {
    .scout-modal-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
  }

  /* ─── Draft Header Row: Tabs & Buttons Wrapping ────────────────────────────── */
  .draft-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .draft-header-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .draft-header-actions {
    display: flex;
    gap: 8px;
  }

  @media (max-width: 640px) {
    .draft-header-row {
      flex-direction: column;
      align-items: stretch;
    }

    .draft-header-tabs {
      width: 100%;
    }

    .draft-header-actions {
      width: 100% !important;
    }

    .draft-header-actions button {
      flex: 1 !important;
      min-width: 0 !important;
    }
  }
`;
