/**
 * Contract negotiation system with agent personalities and financial warfare
 * Converted from Swift ContractNegotiationSystem.swift
 */

import {
  Position,
  PlayerContract,
  StaffMember,
  StaffRole,
} from "./nfl-types";
import { Player } from "./player";
import { Team, getTeamOverallRating } from "./team";

// ============================================================================
// COACHING SCHEMES
// ============================================================================

export enum OffensiveScheme {
  WEST_COAST = "West Coast",
  VERTICAL = "Vertical / Air Coryell",
  SPREAD = "Spread / RPO",
  WIDE_ZONE = "Wide Zone",
  POWER = "Power / Gap",
}

export function getOffensiveSchemeDescription(scheme: OffensiveScheme): string {
  const descriptions: Record<OffensiveScheme, string> = {
    [OffensiveScheme.WEST_COAST]: "Short, timing-based passing game",
    [OffensiveScheme.VERTICAL]: "Deep passing attack",
    [OffensiveScheme.SPREAD]: "Multiple formations, RPO concepts",
    [OffensiveScheme.WIDE_ZONE]: "Outside zone running scheme",
    [OffensiveScheme.POWER]: "Gap-scheme power running",
  };
  return descriptions[scheme];
}

export function getOffensiveSchemeIdealRosterTraits(
  scheme: OffensiveScheme
): string[] {
  const traits: Record<OffensiveScheme, string[]> = {
    [OffensiveScheme.WEST_COAST]: ["Accurate QB", "Route-running WRs", "Quick RBs"],
    [OffensiveScheme.VERTICAL]: ["Strong-armed QB", "Deep threat WRs", "Pass-blocking OL"],
    [OffensiveScheme.SPREAD]: ["Mobile QB", "Versatile WRs", "Athletic RBs"],
    [OffensiveScheme.WIDE_ZONE]: ["Zone-blocking OL", "Patient RBs", "Athletic TEs"],
    [OffensiveScheme.POWER]: ["Physical OL", "Power RBs", "Blocking TEs"],
  };
  return traits[scheme];
}

export enum DefensiveScheme {
  FOUR_THREE = "4-3 Base",
  THREE_FOUR = "3-4 Base",
  NICKEL = "Nickel / 4-2-5",
  MAN_BLITZ = "Man-Blitz",
  ZONE = "Zone / Match",
}

export function getDefensiveSchemeDescription(scheme: DefensiveScheme): string {
  const descriptions: Record<DefensiveScheme, string> = {
    [DefensiveScheme.FOUR_THREE]: "Traditional 4 down linemen, 3 linebackers",
    [DefensiveScheme.THREE_FOUR]: "3 down linemen, 4 linebackers",
    [DefensiveScheme.NICKEL]: "5 DBs, lighter front",
    [DefensiveScheme.MAN_BLITZ]: "Aggressive man coverage with blitzes",
    [DefensiveScheme.ZONE]: "Zone coverage principles",
  };
  return descriptions[scheme];
}

export function getDefensiveSchemeIdealRosterTraits(
  scheme: DefensiveScheme
): string[] {
  const traits: Record<DefensiveScheme, string[]> = {
    [DefensiveScheme.FOUR_THREE]: ["Penetrating DTs", "Athletic DEs", "Fast LBs"],
    [DefensiveScheme.THREE_FOUR]: ["2-gap DL", "Edge rushers", "Big LBs"],
    [DefensiveScheme.NICKEL]: ["Versatile DBs", "Quick LBs", "Pass rushers"],
    [DefensiveScheme.MAN_BLITZ]: ["Man coverage CBs", "Blitzing LBs", "Ball hawks"],
    [DefensiveScheme.ZONE]: ["Smart DBs", "Zone coverage", "Gap discipline"],
  };
  return traits[scheme];
}

export enum SpecialTeamsScheme {
  CONSERVATIVE = "Conservative",
  IDEAL = "Ideal",
  AGGRESSIVE = "Aggressive",
}

export function getSpecialTeamsSchemeDescription(
  scheme: SpecialTeamsScheme
): string {
  const descriptions: Record<SpecialTeamsScheme, string> = {
    [SpecialTeamsScheme.CONSERVATIVE]: "Safety-first approach, no risks",
    [SpecialTeamsScheme.IDEAL]: "Balanced special teams play",
    [SpecialTeamsScheme.AGGRESSIVE]: "High-risk, high-reward tactics",
  };
  return descriptions[scheme];
}

// ============================================================================
// STAFF CONTRACT
// ============================================================================

export interface StaffContract {
  totalValue: number;
  yearsRemaining: number;
  annualSalary: number;
  signingBonus: number;
  guaranteedMoney: number;
}

export function isStaffContractExpiring(contract: StaffContract): boolean {
  return contract.yearsRemaining <= 1;
}

export function getStaffContractDisplayValue(contract: StaffContract): string {
  const totalMillions = contract.totalValue / 1_000_000;
  return `$${totalMillions.toFixed(1)}M over ${contract.yearsRemaining} years`;
}

export function getStaffContractAnnualDisplay(contract: StaffContract): string {
  const annualMillions = contract.annualSalary / 1_000_000;
  return `$${annualMillions.toFixed(2)}M/year`;
}

/**
 * Generate staff contract based on role, rating, and years
 */
export function generateStaffContract(
  role: StaffRole,
  rating: number,
  years: number
): StaffContract {
  const baseSalary = calculateStaffBaseSalary(role);
  const ratingMultiplier = rating / 75.0;
  const annualSalary = baseSalary * ratingMultiplier;
  const totalValue = annualSalary * years;
  const signingBonus = totalValue * 0.2;
  const guaranteedMoney = totalValue * 0.5;

  return {
    totalValue,
    yearsRemaining: years,
    annualSalary,
    signingBonus,
    guaranteedMoney,
  };
}

// ============================================================================
// COACHING SCHEMES INTERFACE
// ============================================================================

export interface CoachingSchemes {
  offensiveScheme?: OffensiveScheme;
  defensiveScheme?: DefensiveScheme;
  specialTeamsScheme?: SpecialTeamsScheme;
}

export function getCoachingSchemesPrimaryScheme(schemes: CoachingSchemes): string {
  if (schemes.offensiveScheme) return schemes.offensiveScheme;
  if (schemes.defensiveScheme) return schemes.defensiveScheme;
  if (schemes.specialTeamsScheme) return schemes.specialTeamsScheme;
  return "Multiple";
}

// ============================================================================
// STAFF EMPLOYMENT
// ============================================================================

export interface StaffEmployment {
  teamId?: string;
  teamAbbreviation?: string;
  hiredDate?: Date;
  canBePoached: boolean;
}

export function isStaffFreeAgent(employment: StaffEmployment): boolean {
  return (
    employment.teamAbbreviation === "FreeAgent" || !employment.teamAbbreviation
  );
}

// ============================================================================
// SALARY CALCULATOR
// ============================================================================

/**
 * Calculate base salary for staff role
 */
export function calculateStaffBaseSalary(role: StaffRole): number {
  const salaries: Record<StaffRole, number> = {
    [StaffRole.HEAD_COACH]: 6_000_000,
    [StaffRole.OFFENSIVE_COORDINATOR]: 2_500_000,
    [StaffRole.DEFENSIVE_COORDINATOR]: 2_500_000,
    [StaffRole.SPECIAL_TEAMS]: 1_000_000,
    [StaffRole.POSITION_COACH]: 750_000,
    [StaffRole.ASSISTANT_GM]: 1_500_000,
    [StaffRole.SCOUT]: 500_000,
    [StaffRole.TRAINER]: 400_000,
    [StaffRole.DOCTOR]: 600_000,
  };
  return salaries[role] || 500_000;
}

/**
 * Calculate contract offer score
 */
export function calculateContractOfferScore(
  staff: StaffMember,
  salary: number,
  years: number,
  bonus: number,
  teamPrestige: number
): number {
  const salaryWeight = salary * 0.6;
  const securityWeight = (years / 5.0) * (salary * 0.3);
  const prestigeWeight = (teamPrestige / 100.0) * (salary * 0.1);
  const bonusWeight = bonus * 0.1;

  return salaryWeight + securityWeight + prestigeWeight + bonusWeight;
}

/**
 * Calculate asking score for staff member
 */
export function calculateStaffAskingScore(staff: StaffMember): number {
  const baseSalary = calculateStaffBaseSalary(staff.role);
  const effectivenessMultiplier = staff.effectiveness / 75.0;
  const expectedSalary = baseSalary * effectivenessMultiplier;

  return calculateContractOfferScore(
    staff,
    expectedSalary,
    3,
    expectedSalary * 0.2,
    75
  );
}

// ============================================================================
// CONTRACT NEGOTIATION
// ============================================================================

export interface NegotiationAttempt {
  id: string;
  salary: number;
  years: number;
  bonus: number;
  offerScore: number;
  askScore: number;
  success: boolean;
  feedback: string;
}

export interface NegotiationState {
  staff: StaffMember;
  offeredSalary: number;
  offeredYears: number;
  offeredBonus: number;
  attemptsRemaining: number;
  negotiationHistory: NegotiationAttempt[];
}

export interface NegotiationResult {
  success: boolean;
  message: string;
  contract: StaffContract | null;
  attemptsRemaining: number;
}

/**
 * Submit negotiation offer to coaching candidate
 * Compares offer score to asking score; provides feedback and records attempt
 */
export function submitNegotiationOffer(
  negotiation: NegotiationState,
  teamPrestige: number
): { result: NegotiationResult; updatedNegotiation: NegotiationState } {
  if (negotiation.attemptsRemaining <= 0) {
    return {
      result: {
        success: false,
        message: `${negotiation.staff.name} has walked away from negotiations.`,
        contract: null,
        attemptsRemaining: 0,
      },
      updatedNegotiation: negotiation,
    };
  }

  const offerScore = calculateContractOfferScore(
    negotiation.staff,
    negotiation.offeredSalary,
    negotiation.offeredYears,
    negotiation.offeredBonus,
    teamPrestige
  );

  const askScore = calculateStaffAskingScore(negotiation.staff);

  const updated = { ...negotiation };
  updated.attemptsRemaining -= 1;

  const success = offerScore >= askScore;

  let feedback: string;
  if (success) {
    feedback = `${negotiation.staff.name} accepts your offer!`;
  } else {
    const difference = ((askScore - offerScore) / askScore) * 100;
    if (difference > 20) {
      feedback = `Your offer is far too low. ${negotiation.staff.name} is insulted.`;
    } else if (difference > 10) {
      feedback =
        "Your offer is below market value. Consider increasing salary or years.";
    } else {
      feedback = "Close, but not quite. Try sweetening the deal.";
    }
  }

  const attempt: NegotiationAttempt = {
    id: Math.random().toString(36).substr(2, 9),
    salary: negotiation.offeredSalary,
    years: negotiation.offeredYears,
    bonus: negotiation.offeredBonus,
    offerScore,
    askScore,
    success,
    feedback,
  };

  updated.negotiationHistory = [...updated.negotiationHistory, attempt];

  let contract: StaffContract | null = null;
  if (success) {
    contract = {
      totalValue: negotiation.offeredSalary * negotiation.offeredYears,
      yearsRemaining: negotiation.offeredYears,
      annualSalary: negotiation.offeredSalary,
      signingBonus: negotiation.offeredBonus,
      guaranteedMoney:
        negotiation.offeredSalary *
        negotiation.offeredYears *
        0.5,
    };
  }

  return {
    result: {
      success,
      message: feedback,
      contract,
      attemptsRemaining: updated.attemptsRemaining,
    },
    updatedNegotiation: updated,
  };
}

// ============================================================================
// BLACK MONDAY SYSTEM
// ============================================================================

export interface StaffVacancy {
  id: string;
  teamId: string;
  role: StaffRole;
  priority: VacancyPriority;
}

export enum VacancyPriority {
  CRITICAL = "Critical",
  HIGH = "High",
  MEDIUM = "Medium",
}

export interface FiringDecision {
  shouldFire: boolean;
  reason: string;
}

export interface FiringResult {
  firedStaff: Array<{
    staff: StaffMember;
    team: Team;
    reason: string;
  }>;
  vacancies: StaffVacancy[];
  summary: string;
}

/**
 * Determine if a coach should be fired based on performance
 * Evaluates win percentage, elite roster underperformance, contract status, coordinator ratings
 *
 * Performance floors: <25% auto-fire; <40% with elite roster has 75% fire chance
 */
export function shouldFireCoach(
  coach: StaffMember,
  team: Team,
  winPercentage: number,
  isHeadCoach: boolean
): FiringDecision {
  // Performance Floor: < 25% win rate
  if (winPercentage < 0.25) {
    return {
      shouldFire: true,
      reason: `Catastrophic season (${team.wins}-${team.losses}) - Performance floor violation`,
    };
  }

  // Underperformance: < 40% with 85+ rated team
  if (winPercentage < 0.4 && getTeamOverallRating(team) >= 85) {
    if (Math.random() < 0.75) {
      return {
        shouldFire: true,
        reason: `Underachieving with elite roster (${team.wins}-${team.losses})`,
      };
    }
  }

  // Contract Expiry
  if (coach.yearsRemaining === 0) {
    if (Math.random() < 0.5) {
      return {
        shouldFire: true,
        reason: "Contract expired - Team moving in new direction",
      };
    }
  }

  // Coordinator-specific: Poor side-of-ball rating
  if (!isHeadCoach) {
    if (
      coach.role === StaffRole.OFFENSIVE_COORDINATOR &&
      team.offenseRating < 65
    ) {
      if (Math.random() < 0.4) {
        return {
          shouldFire: true,
          reason: "Offense ranked bottom-5 in league",
        };
      }
    } else if (
      coach.role === StaffRole.DEFENSIVE_COORDINATOR &&
      team.defenseRating < 65
    ) {
      if (Math.random() < 0.4) {
        return {
          shouldFire: true,
          reason: "Defense ranked bottom-5 in league",
        };
      }
    }
  }

  return {
    shouldFire: false,
    reason: "",
  };
}

/**
 * Generate Black Monday summary
 */
export function generateBlackMondaySummary(
  firedStaff: Array<{
    staff: StaffMember;
    team: Team;
    reason: string;
  }>,
  vacancies: StaffVacancy[]
): string {
  const headCoachFirings = firedStaff.filter(
    (f) => f.staff.role === StaffRole.HEAD_COACH
  ).length;
  const coordinatorFirings = firedStaff.length - headCoachFirings;

  let summary = `🏈 BLACK MONDAY RECAP 🏈\n\n`;
  summary += `Total Coaches Fired: ${firedStaff.length}\n`;
  summary += `Head Coaches: ${headCoachFirings}\n`;
  summary += `Coordinators: ${coordinatorFirings}\n\n`;
  summary += `Open Positions: ${vacancies.length}\n\n`;
  summary += `Notable Firings:\n`;

  for (const firing of firedStaff.slice(0, 5)) {
    summary += `• ${firing.team.abbreviation}: ${firing.staff.name} (${firing.staff.role})\n`;
    summary += `  Reason: ${firing.reason}\n`;
  }

  return summary;
}

// ============================================================================
// SCHEME MISMATCH ANALYZER
// ============================================================================

export enum MismatchSeverity {
  NONE = "none",
  MINOR = "minor",
  MODERATE = "moderate",
  SEVERE = "severe",
}

export function getMismatchSeverityPenalty(severity: MismatchSeverity): number {
  const penalties: Record<MismatchSeverity, number> = {
    [MismatchSeverity.NONE]: 0,
    [MismatchSeverity.MINOR]: -2,
    [MismatchSeverity.MODERATE]: -5,
    [MismatchSeverity.SEVERE]: -10,
  };
  return penalties[severity];
}

export interface MismatchResult {
  hasMismatch: boolean;
  severity: MismatchSeverity;
  details: string[];
  ratingPenalty: number;
}

/**
 * Analyze offensive scheme compatibility with roster
 */
export function analyzeOffensiveMismatch(
  scheme: OffensiveScheme,
  roster: Player[]
): MismatchResult {
  const mismatches: string[] = [];
  let severity = MismatchSeverity.NONE;

  // Simplified analysis - can be expanded
  if (scheme === OffensiveScheme.POWER) {
    const olPlayers = roster.filter((p) => p.position === Position.OL);
    const avgWeight = olPlayers.length > 0 ? 310 : 300;

    if (avgWeight < 310) {
      mismatches.push("Offensive line too light for Power scheme");
      severity = MismatchSeverity.MODERATE;
    }
  }

  if (scheme === OffensiveScheme.WEST_COAST) {
    const qbs = roster.filter((p) => p.position === Position.QB);
    if (qbs.length === 0) {
      mismatches.push("No QB suited for West Coast timing routes");
      severity = MismatchSeverity.SEVERE;
    }
  }

  return {
    hasMismatch: mismatches.length > 0,
    severity,
    details: mismatches,
    ratingPenalty: getMismatchSeverityPenalty(severity),
  };
}

/**
 * Analyze defensive scheme compatibility with roster
 */
export function analyzeDefensiveMismatch(
  scheme: DefensiveScheme,
  roster: Player[]
): MismatchResult {
  const mismatches: string[] = [];
  let severity = MismatchSeverity.NONE;

  if (scheme === DefensiveScheme.THREE_FOUR) {
    const lbs = roster.filter((p) => p.position === Position.LB);
    if (lbs.length < 4) {
      mismatches.push("Insufficient linebackers for 3-4 scheme");
      severity = MismatchSeverity.MODERATE;
    }
  }

  return {
    hasMismatch: mismatches.length > 0,
    severity,
    details: mismatches,
    ratingPenalty: getMismatchSeverityPenalty(severity),
  };
}

// ============================================================================
// AGENT PERSONALITY SYSTEM
// ============================================================================

export enum AgentArchetype {
  SHARK = "The Shark",
  UNCLE = "Uncle/Family Friend",
  BRAND_BUILDER = "Brand Builder",
  SELF_REPRESENTED = "Self-Represented",
}

export function getAgentArchetypeDescription(archetype: AgentArchetype): string {
  const descriptions: Record<AgentArchetype, string> = {
    [AgentArchetype.SHARK]: "Maximum Guaranteed Money. No compromises.",
    [AgentArchetype.UNCLE]: "Prioritizes player happiness and location.",
    [AgentArchetype.BRAND_BUILDER]: "Short-term deals to maximize future earnings.",
    [AgentArchetype.SELF_REPRESENTED]: "Volatile. Takes everything personally.",
  };
  return descriptions[archetype];
}

export interface AgentPersonality {
  archetype: AgentArchetype;
  name: string;
  lowballTolerance: number;
  guaranteedMoneyWeight: number;
  termLengthPreference: number;
  hasReputation: boolean;
  willLeakToPress: boolean;
  pressureLevel: number;
  willingToDiscount: number;
  caresAboutStartingRole: boolean;
  maxContractLength: number;
  wantsQuickFreeAgency: boolean;
  volatility: number;
  hasShadowAdvisor: boolean;
  shadowAdvisorName?: string;
}

/**
 * Generate agent personality based on player personality
 */
export function generateAgentPersonality(
  player: Player,
  archetype?: AgentArchetype
): AgentPersonality {
  const selectedArchetype = archetype || deriveArchetypeFromPersonality(player);

  switch (selectedArchetype) {
    case AgentArchetype.SHARK:
      return {
        archetype: AgentArchetype.SHARK,
        name: ["Drew Rosenhaus", "Scott Boras", "Joel Segal"][
          Math.floor(Math.random() * 3)
        ],
        lowballTolerance: 2,
        guaranteedMoneyWeight: 1.5,
        termLengthPreference: 5,
        hasReputation: true,
        willLeakToPress: true,
        pressureLevel: 60 + Math.floor(Math.random() * 31),
        willingToDiscount: 0,
        caresAboutStartingRole: false,
        maxContractLength: 10,
        wantsQuickFreeAgency: false,
        volatility: 0,
        hasShadowAdvisor: false,
      };

    case AgentArchetype.UNCLE:
      return {
        archetype: AgentArchetype.UNCLE,
        name: [
          `${player.lastName}'s Uncle`,
          "Family Friend",
          "Local Attorney",
        ][Math.floor(Math.random() * 3)],
        lowballTolerance: 4,
        guaranteedMoneyWeight: 0.8,
        termLengthPreference: 4,
        hasReputation: false,
        willLeakToPress: false,
        pressureLevel: 0,
        willingToDiscount: 0.05 + Math.random() * 0.1,
        caresAboutStartingRole: true,
        maxContractLength: 10,
        wantsQuickFreeAgency: false,
        volatility: 0,
        hasShadowAdvisor: false,
      };

    case AgentArchetype.BRAND_BUILDER:
      return {
        archetype: AgentArchetype.BRAND_BUILDER,
        name: ["Tom Condon", "Jimmy Sexton", "David Mulugheta"][
          Math.floor(Math.random() * 3)
        ],
        lowballTolerance: 3,
        guaranteedMoneyWeight: 1.2,
        termLengthPreference: 2,
        hasReputation: true,
        willLeakToPress: false,
        pressureLevel: 0,
        willingToDiscount: 0,
        caresAboutStartingRole: false,
        maxContractLength: 2,
        wantsQuickFreeAgency: true,
        volatility: 0,
        hasShadowAdvisor: false,
      };

    case AgentArchetype.SELF_REPRESENTED:
      const hasShadow = Math.random() > 0.5;
      return {
        archetype: AgentArchetype.SELF_REPRESENTED,
        name: `${player.firstName} ${player.lastName} (Self-Rep)`,
        lowballTolerance: 1,
        guaranteedMoneyWeight: 1.3,
        termLengthPreference: 3,
        hasReputation: false,
        willLeakToPress: false,
        pressureLevel: 0,
        willingToDiscount: 0,
        caresAboutStartingRole: false,
        maxContractLength: 10,
        wantsQuickFreeAgency: false,
        volatility: 60 + Math.floor(Math.random() * 31),
        hasShadowAdvisor: hasShadow,
        shadowAdvisorName: hasShadow
          ? ["Saint Omni", "Business Partner", "Uncle"][
              Math.floor(Math.random() * 3)
            ]
          : undefined,
      };
  }
}

/**
 * Derive agent archetype from player personality
 */
function deriveArchetypeFromPersonality(player: Player): AgentArchetype {
  const p = player.personality;

  // Self-Represented: high leadership + low loyalty + high motivation
  if (p.leadership >= 75 && p.motivation >= 75 && p.loyalty < 50) {
    return AgentArchetype.SELF_REPRESENTED;
  }

  // Shark: high marketability + low teamPlayer (wants maximum money)
  if (p.marketability >= 70 && (p.teamPlayer < 50 || p.loyalty < 40)) {
    return AgentArchetype.SHARK;
  }

  // Brand Builder: high marketability + young + high workEthic
  if (p.marketability >= 65 && player.age < 27 && p.workEthic >= 70) {
    return AgentArchetype.BRAND_BUILDER;
  }

  // Uncle: high loyalty + high teamPlayer
  if (p.loyalty >= 70 && p.teamPlayer >= 70) {
    return AgentArchetype.UNCLE;
  }

  // Default to Uncle
  return AgentArchetype.UNCLE;
}

// ============================================================================
// CONTRACT OFFER TYPES
// ============================================================================

export interface ContractIncentive {
  id: string;
  description: string;
  value: number;
  likelihood: "LTBE" | "NLTBE";
}

export interface BonusDeferral {
  immediatePercent: number;
  deferredPercent: number;
  deferredDate: Date;
}

export interface ContractOffer {
  id: string;
  years: number;
  baseSalaryPerYear: number[];
  signingBonus: number;
  guaranteedMoney: number;
  ltbeIncentives: ContractIncentive[];
  nltbeIncentives: ContractIncentive[];
  voidYears: number;
  offsetLanguage: boolean;
  bonusDeferral?: BonusDeferral;
}

/**
 * Calculate total contract value
 */
export function getContractOfferTotalValue(offer: ContractOffer): number {
  const baseSalaryTotal = offer.baseSalaryPerYear.reduce((a, b) => a + b, 0);
  const ltbeTotal = offer.ltbeIncentives.reduce((sum, i) => sum + i.value, 0);
  const nltbeTotal = offer.nltbeIncentives.reduce((sum, i) => sum + i.value, 0);

  return baseSalaryTotal + offer.signingBonus + ltbeTotal + nltbeTotal;
}

/**
 * Calculate average per year
 */
export function getContractOfferAveragePerYear(offer: ContractOffer): number {
  if (offer.years <= 0) return 0;
  return getContractOfferTotalValue(offer) / offer.years;
}

/**
 * Calculate guaranteed percentage
 */
export function getContractOfferGuaranteedPercentage(offer: ContractOffer): number {
  const total = getContractOfferTotalValue(offer);
  if (total <= 0) return 0;
  return offer.guaranteedMoney / total;
}

/**
 * Calculate year 1 cap hit
 */
export function getContractOfferCapHitYear1(offer: ContractOffer): number {
  if (offer.years + offer.voidYears <= 0) {
    return offer.baseSalaryPerYear[0] ?? 0;
  }

  const bonusProration =
    offer.signingBonus / (offer.years + offer.voidYears);
  const ltbeTotal = offer.ltbeIncentives.reduce((sum, i) => sum + i.value, 0);

  return (offer.baseSalaryPerYear[0] ?? 0) + bonusProration + ltbeTotal;
}

/**
 * Calculate dead cap risk
 */
export function getContractOfferDeadCapRisk(offer: ContractOffer): number {
  if (offer.voidYears > 0) {
    return offer.signingBonus; // All unprorated bonus accelerates
  }
  return offer.guaranteedMoney;
}

// ============================================================================
// NEGOTIATION RESPONSE & LEVERAGE
// ============================================================================

export enum AgentMood {
  ANGRY = "Angry",
  DISAPPOINTED = "Disappointed",
  NEUTRAL = "Neutral",
  INTERESTED = "Interested",
  EXCITED = "Excited",
}

export function getAgentMoodColor(mood: AgentMood): string {
  const colors: Record<AgentMood, string> = {
    [AgentMood.ANGRY]: "#FF0000",
    [AgentMood.DISAPPOINTED]: "#FF6B00",
    [AgentMood.NEUTRAL]: "#808080",
    [AgentMood.INTERESTED]: "#4CAF50",
    [AgentMood.EXCITED]: "#00FF00",
  };
  return colors[mood];
}

export interface NegotiationState {
  id: string;
  player: Player;
  agent: AgentPersonality;
  currentOffer?: ContractOffer;
  counterOffer?: ContractOffer;
  leverage: NegotiationLeverage;
  lowballCount: number;
  isLockedOut: boolean;
  lockoutReason?: string;
  negotiationRound: number;
  agentMood: AgentMood;
  marketValue: number;
  teamFriendlyTarget: number;
}

export interface NegotiationLeverage {
  userLeverage: number; // 0.0 to 1.0
  agentLeverage: number;
}

export function getDominantParty(leverage: NegotiationLeverage): string {
  if (leverage.userLeverage > leverage.agentLeverage + 0.2) {
    return "User";
  } else if (leverage.agentLeverage > leverage.userLeverage + 0.2) {
    return "Agent";
  }
  return "Balanced";
}

export function getLeverageGap(leverage: NegotiationLeverage): number {
  return Math.abs(leverage.userLeverage - leverage.agentLeverage);
}

export interface NegotiationResponse {
  accepted: boolean;
  message: string;
  newMood: AgentMood;
  isLockout: boolean;
  phoneDeadDays: number;
  counterOffer?: ContractOffer;
}

export enum HoldoutResolution {
  CAVE_IN = "caveIn",
  FINE = "fine",
  PROVE_IT = "proveIt",
}

export interface PressLeak {
  id: string;
  playerName: string;
  teamName: string;
  offerAmount: number;
  marketValue: number;
  headline: string;
  timestamp: Date;
}

export interface ShadowAdvisorEvent {
  id: string;
  playerId: string;
  playerName: string;
  advisorName: string;
  demand: number;
  deadline: number; // hours
  phoneNumber: string;
}

export enum ShadowAdvisorAction {
  ENGAGE = "engage",
  REPORT = "report",
}

// ============================================================================
// MARKET VALUE CALCULATION
// ============================================================================

/**
 * Calculate market value for a player
 * Uses overall rating, position multipliers, and age adjustments
 */
export function calculateMarketValueForContract(player: Player): number {
  let baseValue = player.overall * 500_000.0; // $500k per OVR point

  // Position multipliers
  const positionMultipliers: Record<Position, number> = {
    [Position.QB]: 2.5,
    [Position.DL]: 2.0,
    [Position.CB]: 2.0,
    [Position.OL]: 2.0,
    [Position.WR]: 1.5,
    [Position.RB]: 1.5,
    [Position.TE]: 1.2,
    [Position.LB]: 1.0,
    [Position.S]: 1.0,
    [Position.K]: 0.5,
    [Position.P]: 0.5,
  };

  baseValue *= positionMultipliers[player.position] ?? 1.0;

  // Age factor
  if (player.age < 25) {
    baseValue *= 1.3; // Young players get premium
  } else if (player.age > 30) {
    baseValue *= 0.6; // Old players discount
  }

  return baseValue;
}
