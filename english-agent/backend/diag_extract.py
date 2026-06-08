# Запустите этот скрипт отдельно в папке backend:
# python diag_extract.py
#
# Он симулирует типичный ответ агента и показывает что извлекает модель

import anthropic
import json

client = anthropic.Anthropic()

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

# Типичный ответ агента с грамматическими исправлениями
test_reply = """That sounds like a wonderful trip! Italy is truly a magnificent country with so much to offer.

📝 Language Notes:
- "I have went" → "I have gone" — Use the past participle (gone) after have, not the simple past (went).
- "more better" → "better" — Better is already a comparative form; adding "more" is redundant.
- Tip: Try using "I've been to..." when talking about places you've visited."""

print("=== Test reply ===")
print(test_reply)
print("\n=== Sending to Claude for extraction... ===\n")

response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=600,
    system=EXTRACT_PROMPT,
    messages=[{"role": "user", "content": test_reply}]
)

raw = response.content[0].text.strip()
print(f"Raw response:\n{raw}\n")

try:
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    parsed = json.loads(raw.strip())
    print(f"Parsed OK:")
    print(json.dumps(parsed, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Parse ERROR: {e}")
