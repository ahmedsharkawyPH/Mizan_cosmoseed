
import { GoogleGenAI } from "@google/genai";
import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * خدمة ميزان للذكاء الاصطناعي
 * تعالج طلبات المستخدم بناءً على لقطة حية من قاعدة البيانات
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  
  // 1. محاولة الاتصال عبر بروكيس آمن (Edge Function) في حال وجود إعدادات سحابية
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { message, context }
      });
      if (!error && data?.reply) return data.reply;
    } catch (e) {
      console.debug("Cloud Edge Function unavailable, using direct SDK client.");
    }
  }

  // 2. الاتصال المباشر الآمن باستخدام مفتاح البيئة
  try {
    const apiKey = process.env.API_KEY;

    if (!apiKey || apiKey === 'ضع_مفتاح_جوجل_هنا' || apiKey.length < 10) {
      throw new Error("API_KEY_INVALID");
    }

    // تهيئة العميل (يُفضل إنشاؤه عند الطلب لضمان قراءة أحدث مفتاح بيئة)
    const ai = new GoogleGenAI({ apiKey });
    
    // استخدام موديل gemini-3-pro-preview للمهام المحاسبية المعقدة
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: context,
        temperature: 0.3, // قيمة منخفضة لضمان الدقة في الحسابات وتقليل العشوائية
        topP: 0.8,
        topK: 40,
      },
    });

    // استخراج النص مباشرة من الخاصية .text (بدون استدعائها كدالة)
    const replyText = response.text;
    
    if (!replyText) {
      return "تمت معالجة الطلب ولكن الموديل لم يرسل رداً نصياً. يرجى المحاولة مرة أخرى.";
    }

    return replyText;

  } catch (error: any) {
    console.error("Mizan AI Engine Error:", error);
    
    if (error.message === "API_KEY_INVALID") {
      return "⚠️ مفتاح الـ API غير مضبوط أو غير صالح. يرجى التأكد من إضافة مفتاح Gemini الصحيح في ملف .env";
    }
    
    if (error.message?.includes("Requested entity was not found")) {
      return "عذراً، يبدو أن موديل Gemini 3 غير مفعل لهذا المفتاح. يرجى مراجعة صلاحيات المفتاح في Google AI Studio.";
    }

    return "نعتذر، واجه المساعد مشكلة في تحليل البيانات حالياً. يرجى التأكد من اتصال الإنترنت والمحاولة لاحقاً.";
  }
}
