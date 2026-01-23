export const SEARCH_CONFIG = {
  DEBOUNCE_TIME: 200,
  MIN_CHARS: 1,
  MAX_RESULTS: 50000, // دعم حتى 50 ألف سجل في البحث اللحظي
  WEIGHTS: {
    name: 10,
    code: 50,
    batchNumber: 5,
    category: 3,
    notes: 2
  }
};

export class ArabicSmartSearch {
  static normalizeArabic(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/[^\u0621-\u064A0-9a-z\s\-\.\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  static tokenizeQuery(query: string): string[] {
    const normalized = this.normalizeArabic(query);
    return normalized.split(/\s+/).filter(word => word.length >= 1);
  }
  
  static calculateMatchScore(item: any, searchTokens: string[]): number {
    if (searchTokens.length === 0) return 0;
    const normalizedName = this.normalizeArabic(item.name || '');
    const normalizedCode = this.normalizeArabic(item.code || '');
    let totalScore = 0;
    let matchesAllTokens = true;

    for (const token of searchTokens) {
      let tokenMatched = false;
      if (normalizedName.includes(token)) {
        totalScore += SEARCH_CONFIG.WEIGHTS.name;
        if (normalizedName.startsWith(token)) totalScore += 20;
        tokenMatched = true;
      }
      if (normalizedCode.includes(token)) {
        totalScore += SEARCH_CONFIG.WEIGHTS.code;
        if (normalizedCode === token) totalScore += 100;
        tokenMatched = true;
      }
      if (item.batches && Array.isArray(item.batches)) {
        for (const b of item.batches) {
          if (this.normalizeArabic(b.batch_number || '').includes(token)) {
            totalScore += SEARCH_CONFIG.WEIGHTS.batchNumber;
            tokenMatched = true;
            break;
          }
        }
      }
      if (!tokenMatched) { matchesAllTokens = false; break; }
    }
    return matchesAllTokens ? totalScore : 0;
  }

  static smartSearch<T>(items: T[], query: string): T[] {
    if (!query || query.trim().length < 1) {
      return items; // إرجاع كافة العناصر عند عدم وجود استعلام
    }
    const tokens = this.tokenizeQuery(query);
    if (tokens.length === 0) return items;
    
    return items
      .map(item => ({ item, score: this.calculateMatchScore(item, tokens) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => ({ ...entry.item, _searchScore: entry.score }))
      .slice(0, SEARCH_CONFIG.MAX_RESULTS);
  }
}