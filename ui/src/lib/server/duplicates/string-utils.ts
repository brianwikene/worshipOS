// /ui/src/lib/server/duplicates/string-utils.ts
// String similarity utilities for duplicate detection

/**
 * Soundex algorithm - phonetic encoding for similar-sounding names
 * Wikene and Wilkene both become W425
 */
export function soundex(str: string): string {
  if (!str) return '';

  const s = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return '';

  const codes: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };

  let result = s[0];
  let prevCode = codes[s[0]] || '';

  for (let i = 1; i < s.length && result.length < 4; i++) {
    const code = codes[s[i]] || '';
    if (code && code !== prevCode) {
      result += code;
    }
    // Only update prevCode if it's not a vowel (H, W are ignored)
    if (!'HW'.includes(s[i])) {
      prevCode = code;
    }
  }

  return result.padEnd(4, '0');
}

/**
 * Jaro similarity - base algorithm for Jaro-Winkler
 */
function jaro(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Jaro-Winkler similarity - gives bonus for common prefix
 * Returns value between 0 and 1 (1 = identical)
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;

  const str1 = s1.toLowerCase();
  const str2 = s2.toLowerCase();

  if (str1 === str2) return 1;

  const jaroSim = jaro(str1, str2);

  // Find common prefix (up to 4 chars)
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }

  // Winkler modification: boost for common prefix
  const scalingFactor = 0.1;
  return jaroSim + prefixLen * scalingFactor * (1 - jaroSim);
}

/**
 * Normalize phone number to digits only
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Get last N digits of phone (for blocking)
 */
export function phoneLast7(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.slice(-7);
}

/**
 * Normalize email for comparison
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if email domain is common (not useful for blocking)
 */
const COMMON_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'msn.com', 'live.com', 'mail.com', 'protonmail.com'
]);

export function isCommonEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !domain || COMMON_DOMAINS.has(domain);
}

/**
 * Extract email domain
 */
export function getEmailDomain(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain || null;
}

/**
 * Normalize name for comparison (lowercase, trim, remove extra spaces)
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
}
