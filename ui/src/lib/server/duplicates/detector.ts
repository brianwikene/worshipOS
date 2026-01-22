// /ui/src/lib/server/duplicates/detector.ts
// Duplicate detection algorithm

import type { SupabaseClient } from '@supabase/supabase-js';
import { areNicknames, couldBeInitials } from './nicknames';
import { getEmailDomain, isCommonEmailDomain, jaroWinkler, normalizeEmail, normalizeName, phoneLast7, soundex } from './string-utils';

// ============================================================================
// Types
// ============================================================================

export interface PersonForMatching {
  id: string;
  church_id: string;
  first_name: string | null;
  last_name: string | null;
  goes_by: string | null;
  display_name: string;
  emails: string[];
  phones: string[];
  family_ids: string[];
}

export interface MatchReason {
  field: string;
  reason: string;
  weight: number;
  details?: string;
}

export interface MatchResult {
  person_a_id: string;
  person_b_id: string;
  score: number;
  reasons: MatchReason[];
}

export interface DuplicateCandidate {
  person_a_id: string;
  person_b_id: string;
  confidence_score: number;
  match_reasons: MatchReason[];
}

// ============================================================================
// Blocking Key Generation
// ============================================================================

/**
 * Generate blocking keys for a person
 * Only people who share at least one blocking key will be compared
 */
export function generateBlockingKeys(person: PersonForMatching): string[] {
  const keys: string[] = [];

  // 1. Soundex of last name (catches Wikene/Wilkene)
  if (person.last_name) {
    const sx = soundex(person.last_name);
    if (sx) keys.push(`soundex:${sx}`);
  }

  // 2. First 3 chars of last name + first char of first name
  if (person.last_name && person.first_name) {
    const prefix = person.last_name.slice(0, 3).toLowerCase() + person.first_name[0].toLowerCase();
    keys.push(`prefix:${prefix}`);
  }

  // 3. Email domain (non-common domains only)
  for (const email of person.emails) {
    if (!isCommonEmailDomain(email)) {
      const domain = getEmailDomain(email);
      if (domain) keys.push(`domain:${domain}`);
    }
  }

  // 4. Phone number (last 7 digits)
  for (const phone of person.phones) {
    const last7 = phoneLast7(phone);
    if (last7.length === 7) {
      keys.push(`phone7:${last7}`);
    }
  }

  // 5. Family membership
  for (const familyId of person.family_ids) {
    keys.push(`family:${familyId}`);
  }

  // 6. Goes-by soundex (catches nickname issues)
  if (person.goes_by) {
    const parts = person.goes_by.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3) {
        const sx = soundex(part);
        if (sx) keys.push(`goessoundex:${sx}`);
      }
    }
  }

  return [...new Set(keys)]; // dedupe
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Score a pair of people for duplicate likelihood
 */
export function scorePair(a: PersonForMatching, b: PersonForMatching): MatchResult {
  const reasons: MatchReason[] = [];

  // === EXACT MATCHES (high confidence) ===

  // Email exact match (strongest signal)
  const aEmails = a.emails.map(e => normalizeEmail(e));
  const bEmails = b.emails.map(e => normalizeEmail(e));
  const sharedEmails = aEmails.filter(e => bEmails.includes(e));
  if (sharedEmails.length > 0) {
    reasons.push({
      field: 'email',
      reason: 'Exact email match',
      weight: 45,
      details: sharedEmails[0]
    });
  }

  // Phone exact match (last 10 digits)
  const aPhones = a.phones.map(phoneLast7);
  const bPhones = b.phones.map(phoneLast7);
  const sharedPhones = aPhones.filter(p => p.length === 7 && bPhones.includes(p));
  if (sharedPhones.length > 0) {
    reasons.push({
      field: 'phone',
      reason: 'Exact phone match',
      weight: 40,
      details: `***-${sharedPhones[0].slice(-4)}`
    });
  }

  // === NAME MATCHING ===

  const aLast = normalizeName(a.last_name);
  const bLast = normalizeName(b.last_name);
  const aFirst = normalizeName(a.first_name);
  const bFirst = normalizeName(b.first_name);

  // Last name matching
  if (aLast && bLast) {
    if (aLast === bLast) {
      reasons.push({
        field: 'last_name',
        reason: 'Exact last name match',
        weight: 15
      });
    } else {
      const similarity = jaroWinkler(aLast, bLast);
      if (similarity > 0.9) {
        reasons.push({
          field: 'last_name',
          reason: 'Similar last name (possible typo)',
          weight: 10,
          details: `"${a.last_name}" ≈ "${b.last_name}" (${Math.round(similarity * 100)}%)`
        });
      }
    }
  }

  // First name matching
  if (aFirst && bFirst) {
    if (aFirst === bFirst) {
      reasons.push({
        field: 'first_name',
        reason: 'Exact first name match',
        weight: 10
      });
    } else if (areNicknames(aFirst, bFirst)) {
      reasons.push({
        field: 'first_name',
        reason: 'Known nickname pair',
        weight: 8,
        details: `"${a.first_name}" ↔ "${b.first_name}"`
      });
    } else {
      const similarity = jaroWinkler(aFirst, bFirst);
      if (similarity > 0.85) {
        reasons.push({
          field: 'first_name',
          reason: 'Similar first name',
          weight: 5,
          details: `"${a.first_name}" ≈ "${b.first_name}"`
        });
      }
    }
  }

  // === GOES-BY / LAST NAME DETECTION ===
  const goesByIssue = detectGoesByLastNameIssue(a, b);
  if (goesByIssue) {
    reasons.push(goesByIssue);
  }

  // === FAMILY MATCHING ===
  const sharedFamilies = a.family_ids.filter(f => b.family_ids.includes(f));
  if (sharedFamilies.length > 0) {
    reasons.push({
      field: 'family',
      reason: 'Same family membership',
      weight: 5,
      details: 'Both in same family group'
    });
  }

  // === CALCULATE FINAL SCORE ===
  const totalWeight = reasons.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.min(100, totalWeight);

  // Order person IDs consistently (a < b)
  const [orderedA, orderedB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];

  return {
    person_a_id: orderedA,
    person_b_id: orderedB,
    score,
    reasons
  };
}

/**
 * Detect "AJ Jordan" issue where goes_by contains last name
 */
function detectGoesByLastNameIssue(a: PersonForMatching, b: PersonForMatching): MatchReason | null {
  const checks = [
    { goesByPerson: a, fullPerson: b },
    { goesByPerson: b, fullPerson: a }
  ];

  for (const { goesByPerson, fullPerson } of checks) {
    const goesBy = goesByPerson.goes_by?.toLowerCase().trim() || '';
    const lastName = fullPerson.last_name?.toLowerCase().trim() || '';
    const firstName = fullPerson.first_name?.toLowerCase().trim() || '';

    if (!goesBy || !lastName || goesBy.length < 3) continue;

    // Split goes_by into parts
    const goesByParts = goesBy.split(/\s+/);
    if (goesByParts.length < 2) continue;

    // Check if last part matches last name (exact or fuzzy)
    const lastPart = goesByParts[goesByParts.length - 1];
    const firstPart = goesByParts[0];

    // Exact last name match
    if (lastPart === lastName) {
      // Check if first part could be first name or nickname
      if (firstName && (
        areNicknames(firstPart, firstName) ||
        couldBeInitials(firstPart, firstName) ||
        firstPart === firstName
      )) {
        return {
          field: 'goes_by',
          reason: 'Goes-by appears to include last name',
          weight: 25,
          details: `"${goesByPerson.goes_by}" matches "${fullPerson.first_name} ${fullPerson.last_name}"`
        };
      }
    }

    // Fuzzy last name match (typo detection)
    const lastNameSimilarity = jaroWinkler(lastPart, lastName);
    if (lastNameSimilarity > 0.85 && lastPart.length >= 3) {
      if (firstName && (
        areNicknames(firstPart, firstName) ||
        couldBeInitials(firstPart, firstName) ||
        firstPart[0] === firstName[0]
      )) {
        return {
          field: 'goes_by',
          reason: 'Goes-by may include misspelled last name',
          weight: 20,
          details: `"${lastPart}" ≈ "${lastName}"`
        };
      }
    }
  }

  return null;
}

// ============================================================================
// Main Detection Pipeline
// ============================================================================

/**
 * Load all active people for a church with contact info
 */
export async function loadPeopleForMatching(supabase: SupabaseClient, churchId: string): Promise<PersonForMatching[]> {
  // Use nested select to fetch contact methods and family memberships efficiently
  const { data: people, error } = await supabase
    .from('people')
    .select(`
        id,
        church_id,
        first_name,
        last_name,
        goes_by,
        display_name,
        contact_methods(type, value),
        family_members(family_id, is_active)
    `)
    .eq('church_id', churchId)
    .eq('is_active', true)
    .is('merged_at', null);

  if (error) {
      console.error('Error loading people for matching:', error);
      throw error;
  }

  // Transform to flat format
  return (people || []).map((p: any) => ({
      id: p.id,
      church_id: p.church_id,
      first_name: p.first_name,
      last_name: p.last_name,
      goes_by: p.goes_by,
      display_name: p.display_name,
      emails: (p.contact_methods || [])
        .filter((cm: any) => cm.type === 'email')
        .map((cm: any) => cm.value),
      phones: (p.contact_methods || [])
        .filter((cm: any) => cm.type === 'phone')
        .map((cm: any) => cm.value),
      family_ids: (p.family_members || [])
        .filter((fm: any) => fm.is_active)
        .map((fm: any) => fm.family_id)
  }));
}

/**
 * Load existing identity links for a church
 */
export async function loadExistingLinks(supabase: SupabaseClient, churchId: string): Promise<Array<{ person_a_id: string; person_b_id: string; status: string }>> {
  const { data, error } = await supabase
    .from('identity_links')
    .select('person_a_id, person_b_id, status')
    .eq('church_id', churchId);

  if (error) {
      console.error('Error loading existing links:', error);
      return [];
  }
  return data || [];
}

/**
 * Find all duplicate candidates for a church
 */
export async function findDuplicates(
  supabase: SupabaseClient,
  churchId: string,
  options: {
    minScore?: number;
    limit?: number;
    includeExisting?: boolean;
  } = {}
): Promise<DuplicateCandidate[]> {
  const { minScore = 50, limit = 100, includeExisting = false } = options;

  // 1. Load all active people
  const people = await loadPeopleForMatching(supabase, churchId);
  if (people.length < 2) return [];

  // 2. Build blocking index
  const blockingIndex = new Map<string, PersonForMatching[]>();
  for (const person of people) {
    const keys = generateBlockingKeys(person);
    for (const key of keys) {
      if (!blockingIndex.has(key)) {
        blockingIndex.set(key, []);
      }
      blockingIndex.get(key)!.push(person);
    }
  }

  // 3. Generate candidate pairs from blocking
  const candidatePairs = new Set<string>();
  for (const [, blocked] of blockingIndex) {
    // Skip blocks that are too large (probably noise) or too small
    if (blocked.length < 2 || blocked.length > 100) continue;

    for (let i = 0; i < blocked.length; i++) {
      for (let j = i + 1; j < blocked.length; j++) {
        const [idA, idB] = [blocked[i].id, blocked[j].id].sort();
        candidatePairs.add(`${idA}:${idB}`);
      }
    }
  }

  // 4. Load existing links (to exclude unless includeExisting)
  const existingLinks = await loadExistingLinks(supabase, churchId);
  const existingPairs = new Set(
    existingLinks.map(l => `${l.person_a_id}:${l.person_b_id}`)
  );

  // 5. Score each candidate pair
  const personMap = new Map(people.map(p => [p.id, p]));
  const results: DuplicateCandidate[] = [];

  for (const pairKey of candidatePairs) {
    // Skip if already has identity link (unless includeExisting)
    if (!includeExisting && existingPairs.has(pairKey)) continue;

    const [idA, idB] = pairKey.split(':');
    const personA = personMap.get(idA);
    const personB = personMap.get(idB);

    if (!personA || !personB) continue;

    const match = scorePair(personA, personB);

    if (match.score >= minScore) {
      results.push({
        person_a_id: match.person_a_id,
        person_b_id: match.person_b_id,
        confidence_score: match.score,
        match_reasons: match.reasons
      });
    }
  }

  // 6. Sort by score descending, limit results
  results.sort((a, b) => b.confidence_score - a.confidence_score);
  return results.slice(0, limit);
}

/**
 * Find duplicates for a specific person
 */
export async function findDuplicatesForPerson(
  supabase: SupabaseClient,
  churchId: string,
  personId: string,
  options: { minScore?: number; limit?: number } = {}
): Promise<DuplicateCandidate[]> {
  const { minScore = 40, limit = 20 } = options;

  // Load all people
  const people = await loadPeopleForMatching(supabase, churchId);
  const targetPerson = people.find(p => p.id === personId);

  if (!targetPerson) return [];

  // Generate blocking keys for target
  const targetKeys = new Set(generateBlockingKeys(targetPerson));

  // Find candidates that share blocking keys
  const candidates: PersonForMatching[] = [];
  for (const person of people) {
    if (person.id === personId) continue;

    const personKeys = generateBlockingKeys(person);
    const hasOverlap = personKeys.some(k => targetKeys.has(k));

    if (hasOverlap) {
      candidates.push(person);
    }
  }

  // Score each candidate
  const results: DuplicateCandidate[] = [];
  for (const candidate of candidates) {
    const match = scorePair(targetPerson, candidate);

    if (match.score >= minScore) {
      results.push({
        person_a_id: match.person_a_id,
        person_b_id: match.person_b_id,
        confidence_score: match.score,
        match_reasons: match.reasons
      });
    }
  }

  results.sort((a, b) => b.confidence_score - a.confidence_score);
  return results.slice(0, limit);
}

/**
 * Save detected duplicates to identity_links table
 */
export async function saveDetectedDuplicates(
  supabase: SupabaseClient,
  churchId: string,
  candidates: DuplicateCandidate[],
  detectedBy: string = 'system'
): Promise<number> {
  if (candidates.length === 0) return 0;

  let inserted = 0;

  for (const candidate of candidates) {
      const { error } = await supabase
        .from('identity_links')
        .upsert({
            church_id: churchId,
            person_a_id: candidate.person_a_id,
            person_b_id: candidate.person_b_id,
            confidence_score: candidate.confidence_score,
            match_reasons: candidate.match_reasons,
            detected_by: detectedBy,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'church_id,person_a_id,person_b_id',
            // Upsert will update if conflict
            ignoreDuplicates: false
        });

      if (error) {
           console.error('Failed to save duplicate candidate:', error);
      } else {
           inserted++;
      }
  }

  return inserted;
}
