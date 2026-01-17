
export const SEARCH_CONFIG = {
  DEBOUNCE_TIME: 300,
  MIN_CHARS: 2,
  MAX_RESULTS: 500,
  WEIGHTS: {
    name: 10,
    code: 8,
    batchNumber: 5,
    category: 3,
    notes: 2
  }
};

export class ArabicSmartSearch {
  /**
   * Normalizes Arabic text for better search matching
   */
  static normalizeArabic(text: string): string {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')        // Unify Alifs
      .replace(/ة/g, 'ه')           // Ta Marbouta to Ha
      .replace(/ى/g, 'ي')           // Alef Maksura to Ya
      .replace(/ؤ/g, 'و')           // Hamza on Waw
      .replace(/ئ/g, 'ي')           // Hamza on Ya
      .replace(/[^\u0621-\u064A0-9\s]/g, '') // Remove non-Arabic/numbers except spaces
      .trim();
  }
  
  /**
   * Splits query into individual searchable tokens
   */
  static tokenizeQuery(query: string): string[] {
    const normalized = this.normalizeArabic(query);
    return normalized
      .split(/\s+/)
      .filter(word => word.length >= 1) 
      .map(word => word.trim());
  }
  
  /**
   * Calculates a match score for an object based on search tokens
   */
  static calculateMatchScore(item: any, searchTokens: string[]): number {
    let totalScore = 0;
    if (searchTokens.length === 0) return 0;

    const normalizedName = this.normalizeArabic(item.name || '');
    const normalizedCode = this.normalizeArabic(item.code || '');
    
    searchTokens.forEach(token => {
      // Name matches
      if (normalizedName.includes(token)) {
        totalScore += SEARCH_CONFIG.WEIGHTS.name;
        // Bonus for starting with token
        if (normalizedName.startsWith(token)) totalScore += 5;
      }
      
      // Code matches
      if (normalizedCode.includes(token)) {
        totalScore += SEARCH_CONFIG.WEIGHTS.code;
      }

      // Batch matches
      if (item.batches && Array.isArray(item.batches)) {
        item.batches.forEach((b: any) => {
          if (this.normalizeArabic(b.batch_number || '').includes(token)) {
            totalScore += SEARCH_CONFIG.WEIGHTS.batchNumber;
          }
        });
      }
    });
    
    return totalScore;
  }

  /**
   * Filters and ranks items based on smart search
   */
  static smartSearch<T>(items: T[], query: string): T[] {
    if (!query || query.trim().length < 1) {
      return items.slice(0, 100);
    }
    
    const tokens = this.tokenizeQuery(query);
    if (tokens.length === 0) return items.slice(0, 100);
    
    return items
      .map(item => ({
        item,
        score: this.calculateMatchScore(item, tokens)
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => ({
        ...entry.item,
        _searchScore: entry.score
      }))
      .slice(0, SEARCH_CONFIG.MAX_RESULTS);
  }
}
