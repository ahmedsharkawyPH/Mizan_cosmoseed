
/**
 * خدمة ميزان للذكاء الاصطناعي - معطلة بناءً على طلب المستخدم
 */
export const sendAiMessage = async (message: string, context: string): Promise<string> => {
  console.warn("AI Assistant service is disabled.");
  return "SERVICE_DISABLED";
}
