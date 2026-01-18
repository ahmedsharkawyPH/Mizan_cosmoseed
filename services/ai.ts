
import { GoogleGenAI } from "@google/genai";
import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * خدمة ميزان للذكاء الاصطناعي
 * تقوم بمعالجة طلبات المستخدم بناءً على بيانات النظام الحالية
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  
  // 1. محاولة الاتصال عبر بروكسي آمن (Edge Function) إذا كان متاحاً في الإنتاج
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

  // 2. الاتصال المباشر الآمن باستخدام SDK (يستخدم process.env.API_KEY)
  try {
    // التحقق من وجود المفتاح قبل المحاولة
    if (!process.env.API_KEY || process.env.API_KEY === 'ضع_مفتاح_جوجل_هنا') {
      throw new Error("API_KEY_MISSING");
    }

    // إنشاء مثيل جديد لكل طلب لضمان تحديث المفتاح
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: context,
        temperature: 0.5, // تقليل العشوائية لضمان دقة الأرقام المحاسبية
        topP: 0.95,
      },
    });

    return response.text || "تمت معالجة البيانات ولكن لم يتم إنشاء رد نصي.";
  } catch (error: any) {
    console.error("AI Service Error:", error);
    
    if (error.message === "API_KEY_MISSING") {
      return "⚠️ مفتاح الـ API غير مضبوط. يرجى إضافة مفتاح Gemini في ملف .env لتفعيل المساعد الذكي.";
    }
    
    if (error.message?.includes("Requested entity was not found")) {
      return "عذراً، موديل Gemini 3 غير متاح حالياً لهذا المفتاح أو يرجى التأكد من صلاحيته.";
    }

    return "نعتذر، واجه المساعد الذكي مشكلة في الاتصال. تأكد من جودة الإنترنت وحاول مرة أخرى.";
  }
}
