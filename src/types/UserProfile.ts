/**
 * User Profile / Manager Persona
 * Represents the player's General Manager identity and career start
 * Converted from Swift UserProfile.swift
 */

/**
 * Manager Persona Information
 * Tracks the player's GM identity and career timeline
 */
export interface UserProfile {
  firstName: string;
  lastName: string;
  title: string; // Usually "General Manager"
  joinedDate: Date; // In-game date when GM career started
}

/**
 * Helper function to get the manager's full name
 */
export function getUserFullName(profile: UserProfile): string {
  return `${profile.firstName} ${profile.lastName}`;
}

/**
 * Helper function to get formatted display name
 */
export function getUserDisplayName(profile: UserProfile): string {
  return `${profile.firstName} ${profile.lastName}, ${profile.title}`;
}

/**
 * Helper function to get years in management
 */
export function getYearsInManagement(profile: UserProfile): number {
  const now = new Date();
  const startYear = profile.joinedDate.getFullYear();
  const currentYear = now.getFullYear();
  return Math.max(0, currentYear - startYear);
}

/**
 * Create a new user profile with defaults
 */
export function createUserProfile(
  firstName: string,
  lastName: string,
  joinedDate: Date = new Date(),
  title: string = 'General Manager'
): UserProfile {
  return {
    firstName,
    lastName,
    title,
    joinedDate
  };
}

/**
 * Validate user profile data
 * Returns true if profile is valid, false otherwise
 */
export function validateUserProfile(profile: Partial<UserProfile>): boolean {
  if (!profile.firstName || typeof profile.firstName !== 'string') return false;
  if (!profile.lastName || typeof profile.lastName !== 'string') return false;
  if (!profile.title || typeof profile.title !== 'string') return false;
  if (!profile.joinedDate || !(profile.joinedDate instanceof Date)) return false;
  return true;
}
