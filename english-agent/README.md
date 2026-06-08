# English Learning Agent

## Backend (FastAPI + Claude)
```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-...
uvicorn main:app --reload --port 8000
```

## Frontend
```bash
cd frontend
npm install
npm run dev
```

## Modes
| Mode | Description |
|------|-------------|
| conversation | Free dialogue with auto grammar corrections |
| vocabulary | Word study with examples and quizzes |
| grammar | Rules, exercises, feedback |
| text_analysis | Paste any English text for deep analysis |
