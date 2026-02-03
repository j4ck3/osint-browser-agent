import type { Person, Address, SearchFilters } from '../types/person';
import { randomUUID } from 'crypto';

/**
 * Parse search results from hitta.se snapshot
 * Handles both:
 * 1. Search results list (multiple matches)
 * 2. Direct profile page (single/exact match redirect)
 */
export function parseSearchResults(snapshot: string, filters?: SearchFilters): Person | null {
  try {
    // Check if we have no results - be specific to avoid false positives
    // "0 personer" could appear in stats like "2850 personer" so check for exact "0 personer" as a count
    if (snapshot.includes('Inga träffar') || 
        /\b0 personer\b/.test(snapshot) ||
        snapshot.includes('Vi hittar det mesta, men inte just den här sidan')) {
      return null;
    }

    // First, check if we're on a direct profile page (single match redirect)
    // Profile pages have: heading [level=1] with name, paragraph with "X år City"
    const profilePageMatch = snapshot.match(/main:[\s\S]*?heading\s+"([^"]+)"\s*\[ref=\w+\]\s*\[level=1\][\s\S]*?paragraph:\s*(\d+)\s*år\s+([A-ZÅÄÖ][a-zåäö]+)/);
    
    if (profilePageMatch && profilePageMatch[1] && profilePageMatch[2] && profilePageMatch[3]) {
      return parseProfilePage(snapshot, profilePageMatch[1], profilePageMatch[2], profilePageMatch[3]);
    }

    // Otherwise, try to parse as search results list
    return parseSearchResultsList(snapshot);
  } catch {
    return null;
  }
}

/**
 * Parse a direct profile page (when hitta.se redirects to single match)
 */
function parseProfilePage(snapshot: string, name: string, ageStr: string, city: string): Person | null {
  const age = parseInt(ageStr, 10);

  // Extract profile URL from current page URL pattern in links
  // Look for the person ID in navigation links
  const profileIdMatch = snapshot.match(/\/person\/([a-zA-Z0-9_~-]+)/);
  const profileId = profileIdMatch ? profileIdMatch[1] : null;

  // Extract full name from the detailed heading (e.g., "Mats Wilhelm Hallgren bor i...")
  const fullNameMatch = snapshot.match(/heading\s+"([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)\s+bor\s+i/);
  const fullName = fullNameMatch && fullNameMatch[1] ? fullNameMatch[1] : name;

  // Extract address from link text (e.g., "Sturegatan 47 702 14 Örebro")
  const addressMatch = snapshot.match(/link\s+"([^"]+\d{3}\s*\d{2}\s+[A-ZÅÄÖ][a-zåäö]+)"\s*\[ref=\w+\]:\s*\n\s*-\s*\/url:\s*\/kartan/);
  const address = addressMatch && addressMatch[1] ? parseAddressString(addressMatch[1]) : { city };

  // Extract phone number from button
  // Pattern: button "Mobile Icon 070-926 44 XX Visa numret..."
  const phoneMatch = snapshot.match(/button\s+"[^"]*?(0\d[\d\s\-]+?)\s*(?:XX|Visa)/);
  const phoneNumbers: string[] = [];
  if (phoneMatch && phoneMatch[1]) {
    phoneNumbers.push(formatPhoneNumber(phoneMatch[1]));
  }

  // Extract relatives from "bor tillsammans med" pattern
  const relativesMatch = snapshot.match(/bor\s+tillsammans\s+med\s*[\s\S]*?link\s+"([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)+)"/);
  const relatives: string[] | undefined = relativesMatch && relativesMatch[1] ? [relativesMatch[1]] : undefined;

  // Build profile URL
  let profileUrl: string | undefined;
  if (profileId) {
    // Try to construct from name and city
    const nameSlug = name.toLowerCase().replace(/\s+/g, '+').replace(/[åä]/g, 'a').replace(/ö/g, 'o');
    const citySlug = city.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o');
    profileUrl = `https://www.hitta.se/${nameSlug}/${citySlug}/person/${profileId}`;
  }

  const person: Person = {
    id: randomUUID(),
    name: fullName,
    age: isNaN(age) ? undefined : age,
    address: address ?? undefined,
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    profileUrl,
    relatives,
    metadata: {
      scrapedAt: new Date().toISOString(),
      source: 'hitta.se'
    }
  };

  return person;
}

/**
 * Parse search results list page (multiple matches)
 */
function parseSearchResultsList(snapshot: string): Person | null {
  // Pattern: listitem with link to /person/ and heading with name
  const personPattern = /listitem:.*?link.*?\/url:\s*(\/[^/]+\/[^/]+\/person\/[^\s\n]+).*?heading\s+"([^"]+)"/gs;
  const matches = [...snapshot.matchAll(personPattern)];
  
  if (matches.length === 0) {
    return null;
  }

  // Extract data from the first match
  const firstMatch = matches[0];
  if (!firstMatch) {
    return null;
  }

  const profilePath = firstMatch[1];
  const nameWithAge = firstMatch[2];

  if (!profilePath || !nameWithAge) {
    return null;
  }

  // Parse name and age from heading (e.g., "Anders Andersson 62")
  const nameAgeMatch = nameWithAge.match(/^(.+?)\s+(\d{1,3})$/);
  let name: string;
  let age: number | undefined;

  if (nameAgeMatch && nameAgeMatch[1] && nameAgeMatch[2]) {
    name = nameAgeMatch[1].trim();
    age = parseInt(nameAgeMatch[2], 10);
  } else {
    name = nameWithAge.trim();
  }

  // Build profile URL
  const profileUrl = `https://www.hitta.se${profilePath}`;

  // Extract address from paragraph after heading
  const matchIndex = firstMatch.index ?? 0;
  const addressSection = snapshot.substring(matchIndex, matchIndex + 500);
  const address = extractAddressFromSection(addressSection);

  // Extract phone from button text
  const phoneMatch = addressSection.match(/button\s+"(0\d[\d\s\-]+)\s*Visa"/);
  const phoneNumbers: string[] = [];
  if (phoneMatch && phoneMatch[1]) {
    phoneNumbers.push(formatPhoneNumber(phoneMatch[1]));
  }

  const person: Person = {
    id: randomUUID(),
    name,
    age,
    address: address ?? undefined,
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    profileUrl,
    metadata: {
      scrapedAt: new Date().toISOString(),
      source: 'hitta.se'
    }
  };

  return person;
}

/**
 * Parse address from a full address string like "Sturegatan 47 702 14 Örebro"
 */
function parseAddressString(addressStr: string): Address | null {
  const address: Address = {};

  // Extract postal code (Swedish format: XXX XX)
  const postalMatch = addressStr.match(/(\d{3})\s*(\d{2})/);
  if (postalMatch && postalMatch[1] && postalMatch[2]) {
    address.postalCode = `${postalMatch[1]} ${postalMatch[2]}`;
    
    // City is after postal code
    const afterPostal = addressStr.substring(addressStr.indexOf(postalMatch[0]) + postalMatch[0].length).trim();
    const cityMatch = afterPostal.match(/^([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ]?[a-zåäö]+)*)/);
    if (cityMatch && cityMatch[1]) {
      address.city = cityMatch[1];
    }

    // Street is before postal code
    const beforePostal = addressStr.substring(0, addressStr.indexOf(postalMatch[0])).trim();
    if (beforePostal) {
      address.street = beforePostal;
    }
  }

  return Object.keys(address).length > 0 ? address : null;
}

/**
 * Extract address from a section of snapshot text (for list results)
 */
function extractAddressFromSection(section: string): Address | null {
  // Look for paragraph with address pattern: Man/Kvinna StreetName PostalCode City
  const paragraphMatch = section.match(/paragraph:\s*(?:Man|Kvinna)?\s*([^\n]+)/);
  
  if (!paragraphMatch || !paragraphMatch[1]) {
    return null;
  }

  const addressText = paragraphMatch[1].trim();
  return parseAddressString(addressText);
}

/**
 * Format phone number to consistent format
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Convert to international format if Swedish number
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    cleaned = '+46' + cleaned.substring(1);
  }

  return cleaned;
}
