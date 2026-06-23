# مركز الرصد — Backend (FastAPI)

Monitoring API: news / X / replies / summary. Async, CORS-enabled.

## Run locally
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env   # fill keys
    uvicorn app.main:app --reload

## Endpoints
- `GET  /health`
- `POST /monitor/news`        {keywords:[...]}
- `POST /monitor/x`           {keywords:[...], limit}
- `POST /monitor/x-replies`   {tweetId}
- `POST /monitor/summarize`   {name, stats, samples}

## Deploy
Docker-ready (`Dockerfile`). Works on Railway/Render: set env vars, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
