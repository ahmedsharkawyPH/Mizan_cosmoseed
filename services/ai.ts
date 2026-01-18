
import { GoogleGenAI } from "@google/genai";

/**
 * خدمة ميزان للذكاء الاصطناعي - إصدار Gemini 3 Pro
 * تعتمد على مفتاح البيئة أو المفتاح المختار من قبل المستخدم
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  try {
    // 1. التحقق من وجود مفتاح API (سواء في البيئة أو عبر أداة الاختيار)
    const hasKey = await window.aistudio.hasSelectedApiKey();
    const envKey = process.env.API_KEY;

    if (!hasKey && (!envKey || envKey.length < 10)) {
      return "NEED_KEY_SELECTION";
    }

    // 2. إنشاء مثيل جديد من المحرك قبل كل طلب لضمان استخدام أحدث مفتاح
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 3. طلب توليد المحتوى باستخدام موديل gemini-3-pro-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: message,
      config: {
        systemInstruction: context,
        temperature: 0.3, // دقة عالية للحسابات المالية
      },
    });

    // 4. استخراج النص مباشرة
    const reply = response.text;
    
    if (!reply) {
      throw new Error("لم يتم استلام رد من المحرك.");
    }

    return reply;

  } catch (error: any) {
    console.error("Mizan AI Core Error:", error);
    
    if (error.message?.includes("Requested entity was not found")) {
      // إعادة ضبط حالة المفتاح إذا كان غير صالح للموديل المطلوب
      return "NEED_KEY_SELECTION";
    }

    throw error;
  }
}
