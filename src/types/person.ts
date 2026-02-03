// Person data types with enriched fields

export interface Person {
  id: string;
  name: string;
  age?: number;
  address?: Address;
  phoneNumbers?: string[];
  profileUrl?: string;
  // Enriched data from profile page
  relatives?: string[];
  previousAddresses?: Address[];
  email?: string;
  metadata: Metadata;
}

export interface Address {
  street?: string;
  postalCode?: string;
  city?: string;
  municipality?: string;
}

export interface Metadata {
  scrapedAt: string;
  source: 'hitta.se';
}

// Search request types
export interface SearchFilters {
  city?: string;
  ageMin?: number;
  ageMax?: number;
}

export interface SearchByNameRequest {
  name: string;
  city?: string;
  ageMin?: number;
  ageMax?: number;
}

export interface SearchByPhoneRequest {
  phone: string;
}

// API response types
export interface SearchResponse {
  success: boolean;
  query?: Record<string, unknown>;
  result?: Person;
  error?: string;
  code?: string;
  details?: string;
}
