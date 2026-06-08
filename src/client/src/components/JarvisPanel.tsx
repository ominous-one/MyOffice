import { useEffect, useRef, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export function JarvisPanel() {
  const { socket, connected } = useSocket()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!socket) return
    const onToken = ({ id, delta }: { id: string; delta: string }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + delta } : m))
    }
    const onComplete = ({ message }: { message: { id: string; content: string } }) => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, content: message.content, streaming: false } : m))
      setStreaming(false)
    }
    socket.on('message.token', onToken)
    socket.on('message.complete', onComplete)
    return () => {
      socket.off('message.token', onToken)
      socket.off('message.complete', onComplete)
    }
  }, [socket])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!socket || !input.trim() || streaming) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim() }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setStreaming(true)
    socket.emit('chat.send', { projectId: null, content: input.trim(), messageId: assistantId })
    setInput('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/40 md:bottom-6 md:right-6"
        aria-label={open ? 'Close Jarvis' : 'Open Jarvis'}
      >
        {open ? <X size={16} /> : <Sparkles size={16} />}
        <span className="text-xs font-medium">Jarvis</span>
      </button>

      {open && (
        <aside
          className="fixed z-30 bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex flex-col
            inset-x-0 bottom-0 top-16 rounded-t-xl
            md:inset-auto md:right-4 md:bottom-20 md:top-auto md:w-96 md:h-[32rem] md:rounded-xl"
          aria-label="Jarvis chat"
        >
          <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-brand-400" />
              <span className="text-sm font-semibold">Jarvis</span>
              {connected ? (
                <span className="text-[10px] text-emerald-400">online</span>
              ) : (
                <span className="text-[10px] text-amber-400">connecting…</span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--text)]"
              aria-label="Close Jarvis"
            >
              <X size={14} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-xs text-[var(--muted)] leading-relaxed">
                <p className="font-medium text-[var(--text)] mb-1">Good {timeOfDay()}, Riley.</p>
                <p>Ask me what the team's working on, the latest commits, or a status check. I won't dispatch tasks without confirming the project first.</p>
              </div>
            )}
            {messages.map(m => (
              <div
                key={m.id}
                className={`text-xs leading-relaxed rounded-lg px-3 py-2 max-w-[90%] ${
                  m.role === 'user'
                    ? 'ml-auto bg-brand-700/40 text-[var(--text)]'
                    : 'mr-auto bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]'
                }`}
              >
                {m.content || (m.streaming ? <span className="text-[var(--muted)]">…</span> : null)}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask Jarvis…"
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-400"
              disabled={streaming}
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="p-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send to Jarvis"
            >
              <Send size={12} />
            </button>
          </div>
        </aside>
      )}
    </>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// MessageCircle re-export for any consumer that wants the icon.
export { MessageCircle }
