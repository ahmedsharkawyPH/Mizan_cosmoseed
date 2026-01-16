
import { supabase, isSupabaseConfigured } from './supabase';
import { GoogleGenAI } from "@google/genai";

/**
 * Sends a message to the AI, preferring a secure backend proxy (Edge Function).
 * Falls back to client-side execution for local development.
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  // 1. PATH A: Secure Edge Function (Production Best Practice)
  if (isSupabaseConfigured) {
      try {
          const { data, error } = await supabase.functions.invoke('gemini-chat', {
              body: { message, context }
          });
          
          if (!error && data?.reply) {
              return data.reply;
          }
          if (error) {
             console.debug("Edge Function skipped (Dev Mode):", error.message);
          }
      } catch (e) {
          console.debug("Edge Function connection failed, falling back to local client.");
      }
  }

  // 2. PATH B: Local Client-Side (Development / Demo)
  try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: message,
          config: {
              systemInstruction: context,
          }
      });
      
      // Directly access the .text property as per updated SDK guidelines
      return response.text || "I processed the data but couldn't generate a text response.";
  } catch (error: any) {
      console.error("AI Service Error:", error);
      return "I apologize, but I'm currently unable to connect to the AI service. Please check your internet connection or API key configuration.";
  }
}
