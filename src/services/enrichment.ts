import type { Address } from '../types/person';

export interface EnrichedData {
  relatives?: string[];
  previousAddresses?: Address[];
  email?: string;
}

/**
 * Extract enriched data from a person's profile page snapshot
 */
export function enrichFromProfile(snapshot: string): EnrichedData | null {
  try {
    const enriched: EnrichedData = {};

    // Extract relatives from profile page
    const relatives = extractRelatives(snapshot);
    if (relatives.length > 0) {
      enriched.relatives = relatives;
    }

    // Extract previous addresses
    const previousAddresses = extractPreviousAddresses(snapshot);
    if (previousAddresses.length > 0) {
      enriched.previousAddresses = previousAddresses;
    }

    // Extract email if publicly available
    const email = extractEmail(snapshot);
    if (email) {
      enriched.email = email;
    }

    return Object.keys(enriched).length > 0 ? enriched : null;
  } catch {
    return null;
  }
}

/**
 * Extract relatives/family members from profile snapshot
 */
function extractRelatives(snapshot: string): string[] {
  const relatives: Set<string> = new Set();

  // Look for sections about relatives/family in snapshot
  // Common patterns: links to other person profiles, "Familj", "Anhöriga"
  
  // Find links to person profiles with names
  const personLinks = snapshot.matchAll(/link\s+"([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)"[^:]*:\s*\n\s*-\s*\/url:\s*\/[^/]+\/[^/]+\/person\//gi);
  
  for (const match of personLinks) {
    if (match[1]) {
      const name = match[1].trim();
      if (isSwedishName(name)) {
        relatives.add(name);
      }
    }
  }

  // Also look for heading patterns with family member names
  const familySection = snapshot.match(/(?:familj|anhöriga|bor\s+tillsammans)[^-]*-[^"]*heading\s+"([^"]+)"/gi);
  if (familySection) {
    for (const match of familySection) {
      const nameMatch = match.match(/heading\s+"([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)"/i);
      if (nameMatch && nameMatch[1]) {
        relatives.add(nameMatch[1].trim());
      }
    }
  }

  return Array.from(relatives).slice(0, 10); // Limit to 10 relatives
}

/**
 * Extract previous addresses from profile snapshot
 */
function extractPreviousAddresses(snapshot: string): Address[] {
  const addresses: Address[] = [];
  const seen = new Set<string>();

  // Look for address patterns in snapshot text
  // Pattern: paragraph with postal code and city
  const addressPattern = /paragraph:\s*[^"]*(\d{3})\s*(\d{2})\s*([A-ZÅÄÖ][a-zåäö]+)/g;
  const matches = snapshot.matchAll(addressPattern);

  let isFirst = true;
  for (const match of matches) {
    if (match[1] && match[2] && match[3]) {
      const key = `${match[1]}${match[2]}-${match[3]}`;
      
      // Skip the first address (current address) and duplicates
      if (isFirst) {
        isFirst = false;
        continue;
      }

      if (!seen.has(key)) {
        seen.add(key);
        addresses.push({
          postalCode: `${match[1]} ${match[2]}`,
          city: match[3]
        });
      }
    }
  }

  return addresses.slice(0, 5); // Limit to 5 previous addresses
}

/**
 * Extract email from profile snapshot if publicly listed
 */
function extractEmail(snapshot: string): string | null {
  // Look for email patterns in snapshot text
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = snapshot.match(emailPattern);
  
  if (matches && matches.length > 0) {
    // Filter out common non-personal emails
    const personal = matches.find(email => 
      !email.includes('hitta.se') && 
      !email.includes('support') && 
      !email.includes('info@') &&
      !email.includes('noreply')
    );
    return personal?.toLowerCase() ?? null;
  }

  return null;
}

/**
 * Check if a string looks like a Swedish name
 */
function isSwedishName(text: string): boolean {
  // Must have at least 2 parts (first and last name)
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return false;

  // Each part should start with uppercase
  for (const part of parts) {
    if (!/^[A-ZÅÄÖ]/.test(part)) return false;
    if (part.length < 2) return false;
  }

  // Filter out common non-name words
  const nonNames = ['Till', 'Från', 'Och', 'Med', 'För', 'Som', 'Har', 'Kan', 'Ska', 'Skicka', 'Visa', 'Värdera'];
  const firstPart = parts[0];
  if (firstPart && nonNames.includes(firstPart)) return false;

  return true;
}
