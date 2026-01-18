
import { GoogleGenAI } from "@google/genai";
import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * خدمة ميزان للذكاء الاصطناعي
 * تعالج طلبات المستخدم بناءً على لقطة حية من قاعدة البيانات
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  
  // 1. محاولة الاتصال عبر بروكسي آمن (Edge Function) إذا كان متاحاً
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { message, context }
      });
      if (!error && data?.reply) return data.reply;
    } catch (e) {
      console.debug("Edge Function unavailable, falling back to local client.");
    }
  }

  // 2. الاتصال المباشر باستخدام SDK
  try {
    // محاولة جلب المفتاح من عدة مصادر محتملة (process.env أو الذاكرة المحلية لـ AI Studio)
    const apiKey = process.env.API_KEY;

    if (!apiKey || apiKey === 'ضع_مفتاح_جوجل_هنا') {
      // إذا لم يوجد مفتاح، نتحقق مما إذا كان المستخدم قد اختار مفتاحاً عبر النافذة المنبثقة
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        throw new Error("API_KEY_MISSING");
      }
    }

    // إنشاء عميل جديد لكل طلب لضمان استخدام المفتاح الحالي
    const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY || '' });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: context,
        temperature: 0.4,
        topP: 0.9,
      },
    });

    const replyText = response.text;
    if (!replyText) throw new Error("EMPTY_RESPONSE");

    return replyText;

  } catch (error: any) {
    console.error("Mizan AI Error:", error);
    
    if (error.message === "API_KEY_MISSING") {
      return "NEED_KEY_SELECTION"; // إشارة للواجهة لإظهار زر الاختيار
    }
    
    if (error.message?.includes("Requested entity was not found")) {
      return "عذراً، الموديل المطلوب غير متاح لهذا المفتاح. يرجى اختيار مفتاح صالح من مشروع مفعل.";
    }

    return "نعتذر، واجه المساعد مشكلة في الاتصال. يرجى التأكد من إعدادات المفتاح والإنترنت.";
  }
}
