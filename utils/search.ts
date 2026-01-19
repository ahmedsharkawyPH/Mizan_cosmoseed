
export const SEARCH_CONFIG = {
  DEBOUNCE_TIME: 300,
  MIN_CHARS: 1, // تم تقليل الحد الأدنى للبحث لزيادة الاستجابة
  MAX_RESULTS: 1000, // زيادة عدد النتائج المسموح بها في البحث
  WEIGHTS: {
    name: 10,
    code: 15, // رفع وزن الكود ليكون البحث به أدق
    batchNumber: 5,
    category: 3,
    notes: 2
  }
};

export class ArabicSmartSearch {
  /**
   * يقوم بتطبيع النصوص مع الحفاظ على الحروف الإنجليزية والأرقام
   */
  static normalizeArabic(text: string): string {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')        // توحيد الألف
      .replace(/ة/g, 'ه')           // التاء المربوطة
      .replace(/ى/g, 'ي')           // الألف المقصورة
      .replace(/ؤ/g, 'و')           
      .replace(/ئ/g, 'ي')
      // تم تعديل الريجكس للسماح بالحروف الإنجليزية (a-z) والأرقام والمسافات والرموز الأساسية
      .replace(/[^\u0621-\u064A0-9a-zA-Z\s\-\.\/]/g, '') 
      .trim();
  }
  
  /**
   * تقسيم استعلام البحث إلى كلمات (Tokens)
   */
  static tokenizeQuery(query: string): string[] {
    const normalized = this.normalizeArabic(query);
    return normalized
      .split(/\s+/)
      .filter(word => word.length >= 1) 
      .map(word => word.trim());
  }
  
  /**
   * حساب درجة المطابقة
   */
  static calculateMatchScore(item: any, searchTokens: string[]): number {
    let totalScore = 0;
    if (searchTokens.length === 0) return 0;

    const normalizedName = this.normalizeArabic(item.name || '');
    const normalizedCode = this.normalizeArabic(item.code || '');
    
    searchTokens.forEach(token => {
      // مطابقة الاسم
      if (normalizedName.includes(token)) {
        totalScore += SEARCH_CONFIG.WEIGHTS.name;
        if (normalizedName.startsWith(token)) totalScore += 10;
      }
      
      // مطابقة الكود (دقة عالية)
      if (normalizedCode.includes(token)) {
        totalScore += SEARCH_CONFIG.WEIGHTS.code;
        if (normalizedCode === token) totalScore += 20; // مطابقة كاملة للكود
      }

      // مطابقة التشغيلات
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
   * الفلترة والترتيب الذكي
   */
  static smartSearch<T>(items: T[], query: string): T[] {
    if (!query || query.trim().length < 1) {
      // إرجاع أول 200 صنف بدلاً من 100 في حال عدم وجود بحث لضمان رؤية أكبر
      return items.slice(0, 200);
    }
    
    const tokens = this.tokenizeQuery(query);
    if (tokens.length === 0) return items.slice(0, 200);
    
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
