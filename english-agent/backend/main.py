from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import sqlite3
import json
from datetime import datetime, date

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
client = anthropic.Anthropic()

# ── System prompts ─────────────────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "conversation": """You are an engaging English conversation partner and teacher. Level: {level}
Respond naturally to what the user says.
At the END of your reply add a section "📝 Language Notes:" that contains ONLY grammar corrections:
- If the user made grammar mistakes, list each one: show the wrong version, then the correct version, and briefly explain the rule.
- If there are no grammar mistakes, write "No grammar issues this time!"
Do NOT include vocabulary tips, phrase highlights, or general advice in this section — grammar corrections only.""",

    "vocabulary": """You are a vocabulary coach. User level: {level}
For each word/topic:
1. Clear definition in simple English
2. 3 example sentences in varied contexts
3. Common collocations or phrases
4. Memory tip or etymology
5. Quick quiz question
When user answers quiz, evaluate and give feedback.""",

    "text_analysis": """You are an English text analysis tutor. User level: {level}
When user shares text:
1. Brief summary (2-3 sentences)
2. 5 most useful vocabulary words with definitions
3. Any idioms or expressions explained
4. One grammar pattern worth noting
5. A comprehension question and a discussion question"""
}

# ── Extract prompt — pulls grammar notes + words from conversation reply ───────

EXTRACT_PROMPT = """You are a language learning data extractor.
Given an assistant message from an English conversation tutor, extract:

1. GRAMMAR_NOTES: the grammar corrections from the "📝 Language Notes:" section.
   Each note must have:
   - "wrong": the user's original incorrect phrase (as quoted in the notes)
   - "correct": the corrected version
   - "rule": short explanation of the grammar rule (1 sentence)
   If there are no corrections, return an empty array.

2. NEW_WORDS: up to 5 interesting or advanced English words mentioned in the reply body (NOT from the Language Notes section).
   Each word: {"word": "...", "definition": "...", "example": "..."}

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "grammar_notes": [
    {"wrong": "I goed to shop", "correct": "I went to the shop", "rule": "Go is an irregular verb; past tense is went, not goed."}
  ],
  "new_words": [
    {"word": "serendipity", "definition": "finding good things by accident", "example": "It was serendipity that we met."}
  ]
}
If nothing to extract: {"grammar_notes": [], "new_words": []}"""

# ── Database ───────────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect("english_agent.db")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY, mode TEXT, level TEXT,
            history TEXT, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS vocabulary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT, word TEXT, definition TEXT, example TEXT,
            repeat_count INTEGER DEFAULT 0, created_at TEXT,
            UNIQUE(session_id, word)
        );
        CREATE TABLE IF NOT EXISTS grammar_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT, wrong TEXT, correct TEXT, rule TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT, day TEXT, message_count INTEGER DEFAULT 0,
            UNIQUE(session_id, day)
        );
    """)
    conn.commit()
    conn.close()

init_db()

def get_conn():
    return sqlite3.connect("english_agent.db")

def get_history(session_id):
    conn = get_conn()
    row = conn.execute("SELECT history FROM sessions WHERE id=?", (session_id,)).fetchone()
    conn.close()
    return json.loads(row[0]) if row else []

def save_history(session_id, mode, level, history):
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO sessions VALUES (?,?,?,?,?)",
        (session_id, mode, level, json.dumps(history), datetime.now().isoformat()))
    conn.commit()
    conn.close()

def record_activity(session_id):
    today = date.today().isoformat()
    conn = get_conn()
    conn.execute("""INSERT INTO activity (session_id, day, message_count) VALUES (?,?,1)
        ON CONFLICT(session_id, day) DO UPDATE SET message_count = message_count + 1""",
        (session_id, today))
    conn.commit()
    conn.close()

def save_words(session_id, words):
    if not words:
        return
    conn = get_conn()
    for w in words:
        conn.execute("""INSERT INTO vocabulary (session_id, word, definition, example, created_at)
            VALUES (?,?,?,?,?)
            ON CONFLICT(session_id, word) DO UPDATE SET repeat_count = repeat_count + 1""",
            (session_id, w.get("word",""), w.get("definition",""), w.get("example",""),
             datetime.now().isoformat()))
    conn.commit()
    conn.close()

def save_grammar_notes(session_id, notes):
    if not notes:
        return
    conn = get_conn()
    for n in notes:
        conn.execute(
            "INSERT INTO grammar_notes (session_id, wrong, correct, rule, created_at) VALUES (?,?,?,?,?)",
            (session_id, n.get("wrong",""), n.get("correct",""), n.get("rule",""),
             datetime.now().isoformat())
        )
    conn.commit()
    conn.close()

def increment_word_repeat(session_id, word):
    conn = get_conn()
    conn.execute("UPDATE vocabulary SET repeat_count = repeat_count + 1 WHERE session_id=? AND word=?",
        (session_id, word))
    conn.commit()
    conn.close()

# ── Extract learning data from conversation reply ──────────────────────────────

def extract_learning_data(reply_text):
    try:
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=600,
            system=EXTRACT_PROMPT,
            messages=[{"role": "user", "content": reply_text}]
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        print(f"[extract] {raw[:200]}")
        return json.loads(raw.strip())
    except Exception as e:
        print(f"[extract] ERROR: {e}")
        return {"grammar_notes": [], "new_words": []}

# ── Models ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str
    mode: str = "conversation"
    level: str = "B1"

class WordRepeat(BaseModel):
    session_id: str
    word: str

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/chat")
async def chat(req: ChatRequest):
    history = get_history(req.session_id)
    history.append({"role": "user", "content": req.message})
    system = SYSTEM_PROMPTS.get(req.mode, SYSTEM_PROMPTS["conversation"]).format(level=req.level)

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=system,
        messages=history
    )
    reply = response.content[0].text
    history.append({"role": "assistant", "content": reply})
    save_history(req.session_id, req.mode, req.level, history)
    record_activity(req.session_id)

    new_words = []
    grammar_notes = []

    # Only extract from conversation mode
    if req.mode == "conversation":
        data = extract_learning_data(reply)
        new_words = data.get("new_words", [])
        grammar_notes = data.get("grammar_notes", [])
        save_words(req.session_id, new_words)
        save_grammar_notes(req.session_id, grammar_notes)

    return {
        "response": reply,
        "new_words": new_words,
        "grammar_notes": grammar_notes
    }

@app.get("/grammar/{session_id}")
async def get_grammar(session_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT wrong, correct, rule, created_at FROM grammar_notes WHERE session_id=? ORDER BY created_at DESC",
        (session_id,)
    ).fetchall()
    conn.close()
    return {"notes": [{"wrong": r[0], "correct": r[1], "rule": r[2], "created_at": r[3]} for r in rows]}

@app.get("/stats/{session_id}")
async def get_stats(session_id: str):
    conn = get_conn()
    words = conn.execute(
        "SELECT word, definition, example, repeat_count, created_at FROM vocabulary WHERE session_id=? ORDER BY repeat_count DESC",
        (session_id,)).fetchall()
    activity = conn.execute(
        "SELECT day, message_count FROM activity WHERE session_id=? ORDER BY day DESC LIMIT 14",
        (session_id,)).fetchall()
    grammar_count = conn.execute(
        "SELECT COUNT(*) FROM grammar_notes WHERE session_id=?", (session_id,)).fetchone()[0]
    conn.close()
    return {
        "vocabulary": [{"word": w[0], "definition": w[1], "example": w[2],
                        "repeat_count": w[3], "created_at": w[4]} for w in words],
        "activity": [{"day": a[0], "count": a[1]} for a in activity],
        "totals": {
            "words_learned": len(words),
            "total_messages": sum(a[1] for a in activity),
            "grammar_corrections": grammar_count
        }
    }

@app.get("/flashcards/{session_id}")
async def get_flashcards(session_id: str):
    conn = get_conn()
    words = conn.execute(
        "SELECT word, definition, example, repeat_count FROM vocabulary WHERE session_id=? ORDER BY repeat_count ASC, created_at ASC LIMIT 20",
        (session_id,)).fetchall()
    conn.close()
    return {"cards": [{"word": w[0], "definition": w[1], "example": w[2], "repeat_count": w[3]} for w in words]}

@app.post("/flashcards/repeat")
async def repeat_word(req: WordRepeat):
    increment_word_repeat(req.session_id, req.word)
    return {"status": "ok"}

@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    conn = get_conn()
    conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "cleared"}
