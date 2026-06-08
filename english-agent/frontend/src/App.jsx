import { useState, useRef, useEffect } from "react"

const API = "https://english-agent-production.up.railway.app"
const SESSION = "user-1"

const LEVELS = ["A1","A2","B1","B2","C1","C2"]
const TAB_ICONS = { chat: "💬", grammar: "✏️", flashcards: "🃏", stats: "📊" }

const MODES = [
  { id: "conversation",  label: "Conversation", icon: "💬" },
  { id: "vocabulary",    label: "Vocabulary",    icon: "📚" },
  { id: "text_analysis", label: "Text analysis", icon: "📄" },
]

const S = {
  app: { maxWidth: 700, margin: "0 auto", padding: "1.25rem 1rem", fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 14 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 600, margin: 0 },
  select: { fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" },
  tabs: { display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #eee" },
  tab: (active) => ({
    padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none",
    borderBottom: active ? "2px solid #111" : "2px solid transparent",
    background: "none", cursor: "pointer", color: active ? "#111" : "#888", marginBottom: -1
  }),
  modes: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 14 },
  modeBtn: (active) => ({
    padding: "7px 4px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
    border: active ? "2px solid #111" : "1px solid #ddd",
    background: active ? "#f5f5f5" : "white", textAlign: "center"
  }),
  messages: {
    border: "1px solid #eee", borderRadius: 12, padding: 14, minHeight: 300,
    maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10
  },
  bubble: (role) => ({
    maxWidth: "80%", padding: "9px 13px", fontSize: 13.5, lineHeight: 1.6,
    whiteSpace: "pre-wrap", alignSelf: role === "user" ? "flex-end" : "flex-start",
    background: role === "user" ? "#111" : "#f7f7f7", color: role === "user" ? "white" : "#111",
    border: role === "user" ? "none" : "1px solid #eee",
    borderRadius: role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px"
  }),
  inputRow: { display: "flex", gap: 8 },
  textarea: { flex: 1, padding: "9px 13px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13.5, resize: "none", fontFamily: "inherit" },
  sendBtn: { padding: "9px 18px", borderRadius: 10, border: "none", background: "#111", color: "white", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  wordBadge: { display: "inline-block", background: "#EEF2FF", color: "#4338CA", borderRadius: 20, padding: "2px 10px", fontSize: 12, margin: "2px 3px", fontWeight: 500 },
  card: { border: "1px solid #eee", borderRadius: 16, padding: "2rem", textAlign: "center", minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, cursor: "pointer", background: "white", marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  btn: (variant) => ({
    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
    border: "1px solid " + (variant === "primary" ? "#111" : "#ddd"),
    background: variant === "primary" ? "#111" : "white",
    color: variant === "primary" ? "white" : "#555"
  }),
  statCard: { background: "#f9f9f9", borderRadius: 12, padding: "16px 20px", textAlign: "center" },
  statNum: { fontSize: 28, fontWeight: 700, margin: "4px 0" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#333" },
  wordRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0" },
  activityGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 },
  activityCell: (count) => ({ width: "100%", paddingTop: "100%", borderRadius: 4, background: count === 0 ? "#f0f0f0" : count < 5 ? "#c7d2fe" : count < 10 ? "#818cf8" : "#4338CA" }),
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block", marginRight: 6 }
}

// ── ChatTab ────────────────────────────────────────────────────────────────────
function ChatTab({ mode, setMode, history, input, setInput, loading, newWords, send, bottomRef }) {
  return (
    <>
      <div style={S.modes}>
        {MODES.map(m => (
          <button key={m.id} style={S.modeBtn(mode === m.id)} onClick={() => setMode(m.id)}>
            {m.icon}<br />{m.label}
          </button>
        ))}
      </div>
      <div style={S.messages}>
        {history.length === 0 && (
          <div style={{ textAlign: "center", color: "#aaa", margin: "auto", fontSize: 13 }}>
            Start practising — type something below
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} style={S.bubble(msg.role)}>{msg.content}</div>
        ))}
        {loading && (
          <div style={{ ...S.bubble("assistant"), padding: "10px 16px" }}>
            <span style={S.dot} />typing...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {newWords.length > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 12px", background: "#EEF2FF", borderRadius: 8, fontSize: 12 }}>
          📖 New words added to flashcards:&nbsp;
          {newWords.map(w => <span key={w.word} style={S.wordBadge}>{w.word}</span>)}
        </div>
      )}
      <div style={S.inputRow}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={mode === "text_analysis" ? "Paste any English text here..." : "Type in English..."}
          style={S.textarea}
        />
        <button onClick={send} disabled={loading} style={S.sendBtn}>Send</button>
      </div>
    </>
  )
}

// ── GrammarTab ─────────────────────────────────────────────────────────────────
function GrammarTab({ grammarNotes, loadGrammar }) {
  if (grammarNotes === null) return (
    <div style={{ textAlign: "center", color: "#aaa", padding: "3rem 0" }}>Loading...</div>
  )
  if (grammarNotes.length === 0) return (
    <div style={{ textAlign: "center", color: "#aaa", padding: "3rem 0" }}>
      <div style={{ fontSize: 36 }}>✏️</div>
      <div style={{ marginTop: 12 }}>No grammar corrections yet</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>
        Grammar mistakes from your conversations will appear here automatically
      </div>
    </div>
  )
  return (
    <>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16 }}>
        {grammarNotes.length} correction{grammarNotes.length !== 1 ? "s" : ""} collected from your conversations
      </div>
      {grammarNotes.map((note, i) => (
        <div key={i} style={{ border: "1px solid #eee", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap", alignItems: "baseline" }}>
            <span style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 6, padding: "2px 8px", fontSize: 13, textDecoration: "line-through", fontFamily: "monospace" }}>
              {note.wrong}
            </span>
            <span style={{ color: "#aaa", fontSize: 12 }}>→</span>
            <span style={{ background: "#DCFCE7", color: "#166534", borderRadius: 6, padding: "2px 8px", fontSize: 13, fontFamily: "monospace" }}>
              {note.correct}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "#555", lineHeight: 1.5 }}>
            📌 {note.rule}
          </div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>
            {new Date(note.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button style={{ ...S.btn("secondary"), fontSize: 12 }} onClick={loadGrammar}>🔄 Refresh</button>
      </div>
    </>
  )
}

// ── FlashcardsTab ──────────────────────────────────────────────────────────────
function FlashcardsTab({ cards, cardIdx, setCardIdx, flipped, setFlipped, markRepeated, pushToEnd, loadCards }) {
  if (cards.length === 0) return (
    <div style={{ textAlign: "center", color: "#aaa", padding: "3rem 0" }}>
      <div style={{ fontSize: 40 }}>🃏</div>
      <div style={{ marginTop: 12 }}>No words yet — start a conversation!</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>Agent will automatically add new words from your chats</div>
    </div>
  )
  const card = cards[cardIdx]
  return (
    <>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12, textAlign: "right" }}>
        {cardIdx + 1} / {cards.length} cards
      </div>
      <div style={S.card} onClick={() => setFlipped(!flipped)}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{card.word}</div>
        {flipped ? (
          <>
            <div style={{ fontSize: 15, color: "#555", lineHeight: 1.5 }}>{card.definition}</div>
            {card.example && <div style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>"{card.example}"</div>}
            <div style={{ fontSize: 11, color: "#bbb" }}>Repeated {card.repeat_count} times</div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "#aaa" }}>tap to reveal definition</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {flipped ? (
          <>
            <button style={S.btn("secondary")} onClick={pushToEnd}>🔄 Again</button>
            <button style={S.btn("primary")} onClick={() => markRepeated(card.word)}>✓ Got it</button>
          </>
        ) : (
          <button style={S.btn("primary")} onClick={() => setFlipped(true)}>Reveal →</button>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button style={{ ...S.btn("secondary"), fontSize: 12 }} onClick={loadCards}>🔀 Shuffle</button>
      </div>
    </>
  )
}

// ── StatsTab ───────────────────────────────────────────────────────────────────
function StatsTab({ stats, loadStats }) {
  if (!stats) return (
    <div style={{ textAlign: "center", color: "#aaa", padding: "3rem 0" }}>Loading stats...</div>
  )
  const { totals, vocabulary, activity } = stats
  const today = new Date()
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (13 - i))
    return d.toISOString().split("T")[0]
  })
  const actMap = Object.fromEntries(activity.map(a => [a.day, a.count]))
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { n: totals.words_learned,       label: "Words learned" },
          { n: totals.total_messages,      label: "Messages sent" },
          { n: totals.grammar_corrections, label: "Grammar corrections" },
        ].map(({ n, label }) => (
          <div key={label} style={S.statCard}>
            <div style={{ fontSize: 11, color: "#aaa" }}>{label}</div>
            <div style={S.statNum}>{n}</div>
          </div>
        ))}
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>📅 Activity — last 14 days</div>
        <div style={S.activityGrid}>
          {days.map(day => (
            <div key={day} title={`${day}: ${actMap[day] || 0} messages`}>
              <div style={S.activityCell(actMap[day] || 0)} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 11, color: "#aaa", alignItems: "center" }}>
          <span>Less</span>
          {[0,3,7,12].map(n => <div key={n} style={{ ...S.activityCell(n), width: 12, paddingTop: 12, borderRadius: 3 }} />)}
          <span>More</span>
        </div>
      </div>
      {vocabulary.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>📖 Vocabulary ({vocabulary.length} words)</div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {vocabulary.map(w => (
              <div key={w.word} style={S.wordRow}>
                <div>
                  <span style={{ fontWeight: 600 }}>{w.word}</span>
                  <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>{w.definition}</span>
                </div>
                <span style={{ ...S.wordBadge, background: w.repeat_count > 2 ? "#DCFCE7" : "#EEF2FF", color: w.repeat_count > 2 ? "#166534" : "#4338CA" }}>
                  {w.repeat_count}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ textAlign: "center" }}>
        <button style={{ ...S.btn("secondary"), fontSize: 12 }} onClick={loadStats}>🔄 Refresh</button>
      </div>
    </>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("chat")
  const [mode, setMode]             = useState("conversation")
  const [level, setLevel]           = useState("B1")
  const [history, setHistory]       = useState([])
  const [input, setInput]           = useState("")
  const [loading, setLoading]       = useState(false)
  const [stats, setStats]           = useState(null)
  const [cards, setCards]           = useState([])
  const [cardIdx, setCardIdx]       = useState(0)
  const [flipped, setFlipped]       = useState(false)
  const [newWords, setNewWords]     = useState([])
  const [grammarNotes, setGrammarNotes] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [history, loading])

  useEffect(() => {
    if (tab === "stats")      loadStats()
    if (tab === "flashcards") loadCards()
    if (tab === "grammar")    loadGrammar()
  }, [tab])

  async function loadStats() {
    try { const r = await fetch(`${API}/stats/${SESSION}`); setStats(await r.json()) }
    catch { setStats(null) }
  }

  async function loadGrammar() {
    try { const r = await fetch(`${API}/grammar/${SESSION}`); const d = await r.json(); setGrammarNotes(d.notes || []) }
    catch { setGrammarNotes([]) }
  }

  async function loadCards() {
    try {
      const r = await fetch(`${API}/flashcards/${SESSION}`)
      const d = await r.json()
      setCards(d.cards || []); setCardIdx(0); setFlipped(false)
    } catch { setCards([]) }
  }

  async function markRepeated(word) {
    await fetch(`${API}/flashcards/repeat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION, word })
    })
    if (cardIdx + 1 < cards.length) { setCardIdx(cardIdx + 1); setFlipped(false) }
    else await loadCards()
  }

  function pushToEnd() {
    setCards(prev => { const next = [...prev]; const [card] = next.splice(cardIdx, 1); next.push(card); return next })
    setCardIdx(prev => (prev < cards.length - 1 ? prev : 0))
    setFlipped(false)
  }

  async function send() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput(""); setLoading(true); setNewWords([])
    const newHistory = [...history, { role: "user", content: text }]
    setHistory(newHistory)
    try {
      const r = await fetch(`${API}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION, message: text, mode, level })
      })
      const d = await r.json()
      setHistory([...newHistory, { role: "assistant", content: d.response }])
      if (d.new_words?.length) setNewWords(d.new_words)
      // Refresh grammar tab badge if we got new corrections
      if (d.grammar_notes?.length && tab === "grammar") loadGrammar()
    } catch {
      setHistory([...newHistory, { role: "assistant", content: "⚠️ Backend not reachable. Start FastAPI server first." }])
    }
    setLoading(false)
  }

  return (
    <div style={S.app}>
      <div style={S.header}>
        <h1 style={S.title}>🌍 English Agent</h1>
        <select value={level} onChange={e => setLevel(e.target.value)} style={S.select}>
          {LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      <div style={S.tabs}>
        {Object.entries(TAB_ICONS).map(([id, icon]) => (
          <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>
            {icon} {id.charAt(0).toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <ChatTab mode={mode} setMode={setMode} history={history}
          input={input} setInput={setInput} loading={loading}
          newWords={newWords} send={send} bottomRef={bottomRef} />
      )}
      {tab === "grammar" && (
        <GrammarTab grammarNotes={grammarNotes} loadGrammar={loadGrammar} />
      )}
      {tab === "flashcards" && (
        <FlashcardsTab cards={cards} cardIdx={cardIdx} setCardIdx={setCardIdx}
          flipped={flipped} setFlipped={setFlipped}
          markRepeated={markRepeated} pushToEnd={pushToEnd} loadCards={loadCards} />
      )}
      {tab === "stats" && (
        <StatsTab stats={stats} loadStats={loadStats} />
      )}
    </div>
  )
}
