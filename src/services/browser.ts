import { $ } from 'bun';
import { BrowserError } from '../utils/errors';
import type { Person, SearchFilters, Address } from '../types/person';
import { parseSearchResults } from './scraper';
import { enrichFromProfile } from './enrichment';

const HITTA_BASE_URL = 'https://www.hitta.se';

export class BrowserService {
  private initialized = false;
  private session = 'osint-agent';

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Install browser if needed (first run)
      await $`agent-browser install 2>/dev/null || true`.quiet();
      
      // Open hitta.se to initialize the browser session
      const headless = process.env.BROWSER_HEADLESS !== 'false';
      const headedFlag = headless ? '' : '--headed';
      
      await $`agent-browser --session ${this.session} ${headedFlag} open ${HITTA_BASE_URL}`.quiet();
      this.initialized = true;
    } catch (error) {
      throw new BrowserError('Failed to initialize browser', error);
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const result = await $`agent-browser --session ${this.session} get url --json`.quiet();
      const data = JSON.parse(result.stdout.toString());
      return data.success === true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await $`agent-browser --session ${this.session} close`.quiet();
      this.initialized = false;
    } catch {
      // Ignore close errors
    }
  }

  async searchByName(name: string, filters?: SearchFilters): Promise<Person | null> {
    await this.ensureInitialized();

    try {
      // Build search URL - use /sök?vad=... format with typ=prv for persons
      const searchQuery = filters?.city ? `${name} ${filters.city}` : name;
      const encodedQuery = encodeURIComponent(searchQuery);
      // Use sök endpoint with typ=prv for person search
      const searchUrl = `${HITTA_BASE_URL}/sök?vad=${encodedQuery}&typ=prv`;

      // Navigate to search results
      await $`agent-browser --session ${this.session} open ${searchUrl}`.quiet();
      
      // Wait for results to load
      await $`agent-browser --session ${this.session} wait 2500`.quiet();

      // Get snapshot of the page (more reliable for parsing)
      const snapshotResult = await $`agent-browser --session ${this.session} snapshot --json`.quiet();
      const snapshotData = JSON.parse(snapshotResult.stdout.toString());

      if (!snapshotData.success) {
        throw new BrowserError('Failed to get page snapshot');
      }

      const snapshot = snapshotData.data?.snapshot || '';

      // Parse results from snapshot (more reliable than HTML)
      const person = parseSearchResults(snapshot, filters);

      if (!person) {
        return null;
      }

      // Enrich with profile data if we have a profile URL
      if (person.profileUrl) {
        const enrichedData = await this.fetchProfileData(person.profileUrl);
        if (enrichedData) {
          person.relatives = enrichedData.relatives;
          person.previousAddresses = enrichedData.previousAddresses;
          person.email = enrichedData.email;
        }
      }

      return person;
    } catch (error) {
      if (error instanceof BrowserError) throw error;
      throw new BrowserError('Search by name failed', error);
    }
  }

  async searchByPhone(phone: string): Promise<Person | null> {
    await this.ensureInitialized();

    try {
      // Clean phone number
      const cleanPhone = phone.replace(/[\s\-()]/g, '');
      const encodedPhone = encodeURIComponent(cleanPhone);
      // Use sök endpoint for phone search
      const searchUrl = `${HITTA_BASE_URL}/sök?vad=${encodedPhone}&typ=prv`;

      // Navigate to search results
      await $`agent-browser --session ${this.session} open ${searchUrl}`.quiet();
      
      // Wait for results to load
      await $`agent-browser --session ${this.session} wait 2500`.quiet();

      // Get snapshot
      const snapshotResult = await $`agent-browser --session ${this.session} snapshot --json`.quiet();
      const snapshotData = JSON.parse(snapshotResult.stdout.toString());

      if (!snapshotData.success) {
        throw new BrowserError('Failed to get page snapshot');
      }

      const snapshot = snapshotData.data?.snapshot || '';

      // Parse results from snapshot
      const person = parseSearchResults(snapshot);

      if (!person) {
        return null;
      }

      // Enrich with profile data
      if (person.profileUrl) {
        const enrichedData = await this.fetchProfileData(person.profileUrl);
        if (enrichedData) {
          person.relatives = enrichedData.relatives;
          person.previousAddresses = enrichedData.previousAddresses;
          person.email = enrichedData.email;
        }
      }

      return person;
    } catch (error) {
      if (error instanceof BrowserError) throw error;
      throw new BrowserError('Search by phone failed', error);
    }
  }

  private async fetchProfileData(profileUrl: string): Promise<{
    relatives?: string[];
    previousAddresses?: Address[];
    email?: string;
  } | null> {
    try {
      // Navigate to profile page
      await $`agent-browser --session ${this.session} open ${profileUrl}`.quiet();
      
      // Wait for page to load
      await $`agent-browser --session ${this.session} wait 2500`.quiet();

      // Get snapshot
      const snapshotResult = await $`agent-browser --session ${this.session} snapshot --json`.quiet();
      const snapshotData = JSON.parse(snapshotResult.stdout.toString());

      if (!snapshotData.success) {
        return null;
      }

      const snapshot = snapshotData.data?.snapshot || '';

      return enrichFromProfile(snapshot);
    } catch {
      // Return null if enrichment fails - don't fail the whole search
      return null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Singleton instance
export const browserService = new BrowserService();
