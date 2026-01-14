
import { supabase, isSupabaseConfigured } from './supabase';
import { GoogleGenAI } from "@google/genai";

/**
 * Sends a message to the AI, preferring a secure backend proxy (Edge Function).
 * Falls back to client-side execution for local development.
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  // 1. PATH A: Secure Edge Function (Production Best Practice)
  // This attempts to invoke a serverless function named 'gemini-chat' hosted on Supabase.
  // The API Key is stored safely in Supabase Secrets, not exposed to the client.
  if (isSupabaseConfigured) {
      try {
          const { data, error } = await supabase.functions.invoke('gemini-chat', {
              body: { message, context }
          });
          
          if (!error && data?.reply) {
              return data.reply;
          }
          // If the function doesn't exist or errors, we log a warning and proceed to fallback
          // This is expected behavior during local development before backend deployment
          if (error) {
             console.debug("Edge Function skipped (Dev Mode):", error.message);
          }
      } catch (e) {
          console.debug("Edge Function connection failed, falling back to local client.");
      }
  }

  // 2. PATH B: Local Client-Side (Development / Demo)
  // WARNING: This method exposes the API Key in the browser network tab.
  // Acceptable for localhost/demo, but strictly discouraged for production.
  try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
          return "Configuration Error: API_KEY is missing from environment variables. Please check your .env file.";
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: message,
          config: {
              systemInstruction: context,
          }
      });
      
      return response.text || "I processed the data but couldn't generate a text response.";
  } catch (error: any) {
      console.error("AI Service Error:", error);
      return "I apologize, but I'm currently unable to connect to the AI service. Please check your internet connection or API key configuration.";
  }
}
