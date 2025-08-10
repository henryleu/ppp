/**
 * Search engine for PPP interactive UI
 * Provides fast searching and filtering capabilities
 */

import { SearchConfig, SearchableItem, SearchResult, FilterConfig } from '../../types/ui.js';

export class SearchEngine {
  private index: Map<string, SearchableItem[]> = new Map();
  private items: SearchableItem[] = [];
  private filters: FilterConfig[] = [];

  /**
   * Build search index from items
   */
  buildIndex(items: SearchableItem[]): void {
    this.items = items;
    this.index.clear();

    items.forEach(item => {
      // Index by type
      if (!this.index.has(item.type)) {
        this.index.set(item.type, []);
      }
      this.index.get(item.type)!.push(item);

      // Index by searchable words
      const words = item.searchText.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (!this.index.has(word)) {
          this.index.set(word, []);
        }
        this.index.get(word)!.push(item);
      });
    });
  }

  /**
   * Search items with optional fuzzy matching
   */
  search(query: string, config: Partial<SearchConfig> = {}): SearchResult {
    const startTime = Date.now();
    
    if (!query.trim()) {
      return {
        items: this.applyFilters(this.items.slice(0, config.maxResults || 50)),
        totalCount: this.items.length,
        query: '',
        executionTime: Date.now() - startTime
      };
    }

    const normalizedQuery = query.toLowerCase().trim();
    let results: SearchableItem[] = [];

    if (config.fuzzyMatch) {
      results = this.fuzzySearch(normalizedQuery, config);
    } else {
      results = this.exactSearch(normalizedQuery, config);
    }

    // Apply additional filters
    results = this.applyFilters(results);

    // Sort results
    if (config.sortBy) {
      results = this.sortResults(results, config.sortBy);
    } else {
      // Default scoring - prioritize exact matches in name and ID
      results = this.scoreResults(results, normalizedQuery);
    }

    // Limit results
    const maxResults = config.maxResults || 50;
    const paginatedResults = results.slice(0, maxResults);

    return {
      items: paginatedResults,
      totalCount: results.length,
      query: normalizedQuery,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get suggestions for autocompletion
   */
  suggest(partial: string, maxSuggestions: number = 10): string[] {
    const normalizedPartial = partial.toLowerCase();
    const suggestions = new Set<string>();

    // Find matching words in index
    for (const [word] of this.index) {
      if (word.startsWith(normalizedPartial) && word !== normalizedPartial) {
        suggestions.add(word);
        if (suggestions.size >= maxSuggestions) break;
      }
    }

    // Find matching item names and IDs
    this.items.forEach(item => {
      if (suggestions.size >= maxSuggestions) return;
      
      if (item.name.toLowerCase().includes(normalizedPartial)) {
        suggestions.add(item.name);
      }
      
      if (item.id.toLowerCase().includes(normalizedPartial)) {
        suggestions.add(item.id);
      }
    });

    return Array.from(suggestions).slice(0, maxSuggestions);
  }

  /**
   * Add filter to search
   */
  addFilter(filter: FilterConfig): void {
    // Remove existing filter for the same field
    this.filters = this.filters.filter(f => f.field !== filter.field);
    this.filters.push(filter);
  }

  /**
   * Remove filter
   */
  removeFilter(field: string): void {
    this.filters = this.filters.filter(f => f.field !== field);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * Get current filters
   */
  getFilters(): FilterConfig[] {
    return [...this.filters];
  }

  private exactSearch(query: string, config: Partial<SearchConfig>): SearchableItem[] {
    const results = new Set<SearchableItem>();
    const queryWords = query.split(/\s+/);

    queryWords.forEach(word => {
      // Direct index lookup
      const indexResults = this.index.get(word) || [];
      indexResults.forEach(item => results.add(item));

      // Search in searchable fields
      const searchFields = config.searchFields || ['id', 'name', 'searchText'];
      
      this.items.forEach(item => {
        searchFields.forEach(field => {
          const fieldValue = (item as any)[field] || item.metadata[field] || '';
          if (fieldValue.toLowerCase().includes(word)) {
            results.add(item);
          }
        });
      });
    });

    return Array.from(results);
  }

  private fuzzySearch(query: string, config: Partial<SearchConfig>): SearchableItem[] {
    const results: Array<{ item: SearchableItem; score: number }> = [];
    const searchFields = config.searchFields || ['id', 'name', 'searchText'];

    this.items.forEach(item => {
      let maxScore = 0;

      searchFields.forEach(field => {
        const fieldValue = (item as any)[field] || item.metadata[field] || '';
        const score = this.calculateFuzzyScore(query, fieldValue.toLowerCase());
        maxScore = Math.max(maxScore, score);
      });

      if (maxScore > 0.3) { // Minimum similarity threshold
        results.push({ item, score: maxScore });
      }
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results.map(r => r.item);
  }

  private calculateFuzzyScore(query: string, text: string): number {
    if (text.includes(query)) {
      return 1.0; // Exact substring match gets highest score
    }

    // Levenshtein distance based similarity
    const maxLen = Math.max(query.length, text.length);
    const distance = this.levenshteinDistance(query, text);
    return Math.max(0, 1 - (distance / maxLen));
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private applyFilters(items: SearchableItem[]): SearchableItem[] {
    if (this.filters.length === 0) return items;

    return items.filter(item => {
      return this.filters.every(filter => {
        const fieldValue = (item as any)[filter.field] || item.metadata[filter.field];
        
        switch (filter.operator || 'equals') {
          case 'equals':
            return fieldValue === filter.value;
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'startsWith':
            return String(fieldValue).toLowerCase().startsWith(String(filter.value).toLowerCase());
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(fieldValue);
          default:
            return fieldValue === filter.value;
        }
      });
    });
  }

  private sortResults(results: SearchableItem[], sortBy: string): SearchableItem[] {
    return results.sort((a, b) => {
      const aValue = (a as any)[sortBy] || a.metadata[sortBy] || '';
      const bValue = (b as any)[sortBy] || b.metadata[sortBy] || '';
      
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      return 0;
    });
  }

  private scoreResults(results: SearchableItem[], query: string): SearchableItem[] {
    const scored = results.map(item => {
      let score = 0;
      
      // Higher score for ID matches
      if (item.id.toLowerCase().includes(query)) {
        score += 10;
      }
      
      // Higher score for name matches
      if (item.name.toLowerCase().includes(query)) {
        score += 5;
      }
      
      // Lower score for other text matches
      if (item.searchText.toLowerCase().includes(query)) {
        score += 1;
      }
      
      return { item, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(s => s.item);
  }
}