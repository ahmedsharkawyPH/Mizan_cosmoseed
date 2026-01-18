
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { db } from '../services/db';
import { sendAiMessage } from '../services/ai';

export default function AiAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
        { role: 'model', text: 'مرحباً بك في ميزان AI! أنا مساعدك المالي. يمكنني تحليل مبيعاتك، تنبيهك للنواقص، أو مراجعة مديونيات العملاء. كيف أساعدك الآن؟' }
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
            // جلب لقطة حية من بيانات النظام (مبيعات، مخزون، ديون)
            const snapshot = db.getSystemSnapshot();
            
            const systemInstruction = `
                أنت "ميزان AI"، خبير مالي ومحاسبي متخصص لنظام "Mizan Online".
                بيانات النظام الحالية هي:
                ${snapshot}
                
                تعليمات الرد:
                1. اللغة: العربية هي اللغة الأساسية للرد.
                2. الدقة: اعتمد فقط على الأرقام الموجودة في البيانات المقدمة (Snapshot).
                3. الأسلوب: مهني، مباشر، وداعم لاتخاذ القرار.
                4. التنسيق: استخدم النقاط (Bullet points) للقوائم والنص العريض (Bold) للأرقام الهامة.
                5. الخصوصية: لا تطلب معلومات خارج نطاق العمليات المحاسبية.
            `;

            const reply = await sendAiMessage(userMsg, systemInstruction);
            setMessages(prev => [...prev, { role: 'model', text: reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "عذراً، حدث خطأ أثناء تحليل البيانات. حاول مرة أخرى." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 print:hidden font-sans">
            {isOpen && (
                <div className="w-80 md:w-96 h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 ring-1 ring-black/5">
                    <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <span className="font-bold text-sm block">مساعد ميزان الذكي</span>
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                    متصل بالبيانات الحية
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                                    msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                                }`}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm rounded-bl-none flex items-center gap-3">
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    <span className="text-xs text-slate-500 font-bold">جاري تحليل الأرقام...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-white">
                        <div className="flex gap-2 relative">
                            <input 
                                className="flex-1 border border-slate-200 rounded-2xl pr-4 pl-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 transition-all font-medium"
                                placeholder="اسأل عن مبيعات اليوم، النواقص..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                disabled={loading}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="absolute left-1.5 top-1.5 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-white
                ${isOpen ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white shadow-blue-600/40'}`}
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white"></span>
                    </span>
                )}
            </button>
        </div>
    );
}
