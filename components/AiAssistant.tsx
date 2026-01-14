
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Send, X, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { db } from '../services/db';
import { t } from '../utils/t';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default function AiAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
        { role: 'model', text: 'Hello! I am Mizan AI. How can I help you analyze your business today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);

        try {
            const snapshot = db.getSystemSnapshot();
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: userMsg,
                config: {
                    systemInstruction: `
                        You are Mizan AI, a world-class financial consultant for a business management app called "Mizan Online".
                        Current Business State context:
                        ${snapshot}
                        
                        Instructions:
                        - Be precise, helpful, and professional.
                        - You can answer in Arabic or English based on user input.
                        - You have access to the business data above. Use it to answer specific queries about sales, stock, and debts.
                        - If asked for advice, suggest optimizing stock or collecting debts.
                    `,
                }
            });

            const reply = response.text || "I'm sorry, I couldn't process that request.";
            setMessages(prev => [...prev, { role: 'model', text: reply }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: "Error: Could not connect to AI services." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
            {/* Chat Window */}
            {isOpen && (
                <div className="w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 fill-white" />
                            <span className="font-bold">Mizan AI Assistant</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                                }`}>
                                    <div className="flex items-center gap-1.5 mb-1 opacity-60">
                                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                        <span className="text-[10px] font-bold uppercase">{msg.role}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm rounded-tl-none">
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t bg-white">
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ask about your business..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-[9px] text-center text-slate-400 mt-2 font-medium">Powered by Gemini 3 Flash</p>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-95
                ${isOpen ? 'bg-slate-800 text-white' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/40'}`}
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
