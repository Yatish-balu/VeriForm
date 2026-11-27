import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import { SparkleIcon } from './Icons';
import { askVeriFormAssistant } from '../api/client';

const QUICK_PROMPTS = [
  'Who was absent in Room CDS 105?',
  'Which entries need review?',
  'Show Cyber Security attendance summary',
];

export default function AskAIDrawer({
  open,
  onClose,
  currentSheet,
  openDoubtsCount,
  backendStatus,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask about room attendance, absentees, branch totals, or flagged doubts across your Form-B sheets.',
      isMock: !backendStatus?.connected,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askVeriFormAssistant({
        message: trimmed,
        currentSheet,
        openDoubtsCount,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.content,
          isMock: res.isMock,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: err?.message || 'Unable to reach VeriForm AI right now.',
          isMock: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#111827]/25"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative z-10 w-full max-w-[420px] h-full bg-white border-l border-[#E5E7EB] flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Ask VeriForm AI"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[8px] bg-[#293F2D] text-white flex items-center justify-center">
              <SparkleIcon className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-[#111827]">Ask VeriForm AI</h3>
              <p className="text-[11.5px] text-[#64748B]">
                {backendStatus?.connected
                  ? 'Grounded Gemini attendance assistant'
                  : 'Demo mode · local sheet context'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ask VeriForm AI"
            className="p-1.5 rounded-[8px] text-[#64748B] hover:bg-[#F7F7F5] hover:text-[#111827]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Suggested Queries */}
        <div className="px-5 py-3 bg-[#F7F7F5] border-b border-[#E5E7EB]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] mb-2">
            Quick questions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-[#111827] hover:border-[#293F2D] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#FAF9F6]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-[12.5px] leading-[1.5] whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-[#293F2D] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#111827]'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E5E7EB] rounded-[12px] px-3.5 py-2.5 text-[12px] text-[#64748B]">
                Checking Form-B records…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-[#E5E7EB] bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a USN, room, or branch…"
            className="flex-1 h-10 px-3.5 rounded-[10px] border border-[#E5E7EB] bg-[#FAF9F7] text-[13px] text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#293F2D]"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send query"
            className="h-10 px-3.5 rounded-[10px] bg-[#293F2D] text-white hover:bg-[#203324] disabled:opacity-40 flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </div>
  );
}
