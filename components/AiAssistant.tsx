
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { db } from '../services/db';
import { sendAiMessage } from '../services/ai';

export default function AiAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
        { role: 'model', text: 'مرحباً! أنا المساعد الذكي لنظام ميزان. كيف يمكنني مساعدتك في تحليل بياناتك اليوم؟' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);

        try {
            // Prepare context from the database
            const snapshot = db.getSystemSnapshot();
            
            // Construct system instruction
            const systemInstruction = `
                You are Mizan AI, a specialized financial and inventory consultant for the "Mizan Online" ERP system.
                
                Current System Snapshot:
                ${snapshot}
                
                Your Guidelines:
                1. Role: Act as a senior accountant and business analyst.
                2. Language: Respond in the same language as the user (Arabic or English). Default to Arabic if unsure.
                3. Scope: Answer questions about sales performance, stock levels, debts, and financial health based ONLY on the provided snapshot.
                4. Tone: Professional, encouraging, and data-driven.
                5. Formatting: Use bullet points for lists and bold text for key figures.
            `;

            // Call the service (Handles Switch between Edge Function and Local Key)
            const reply = await sendAiMessage(userMsg, systemInstruction);
            
            setMessages(prev => [...prev, { role: 'model', text: reply }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 print:hidden">
            {/* Chat Window */}
            {isOpen && (
                <div className="w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 ring-1 ring-black/5">
                    <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-600 rounded-lg">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <span className="font-bold text-sm block">Mizan AI</span>
                                <span className="text-[10px] text-slate-400 block leading-none">Financial Assistant</span>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                                    msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                                }`}>
                                    <div className="flex items-center gap-1.5 mb-1.5 opacity-70 border-b border-white/10 pb-1">
                                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{msg.role === 'user' ? 'You' : 'Mizan AI'}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start animate-in fade-in">
                                <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm rounded-tl-none flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    <span className="text-xs text-slate-500">جاري التحليل...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t bg-white shrink-0">
                        <div className="flex gap-2 relative">
                            <input 
                                className="flex-1 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all"
                                placeholder="اسأل عن المبيعات، المخزون، أو العملاء..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                disabled={loading}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="absolute right-1.5 top-1.5 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                            >
                                <Send className="w-4 h-4 rtl:rotate-180" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white
                ${isOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-blue-600/30'}`}
                title="Mizan AI Assistant"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                    </span>
                )}
            </button>
        </div>
    );
}
