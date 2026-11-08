# MyMusicISM — AI Music Studio

A web app that lets anyone generate original songs with AI, powered by [SunoAPI.org](https://docs.sunoapi.org).

- **Simple mode**: describe a song ("upbeat summer pop about road trips") and get two full tracks.
- **Custom mode**: set title, style, your own lyrics (or have AI write them), excluded styles, vocal gender, style adherence, weirdness, variety and target duration.
- Instrumental toggle, model picker (V6 / V6 Wild / V6 Mini), live progress, streaming preview, MP3 download, lyrics view, credit balance, and a history of your tracks saved in the browser.

## Tech stack

- `public/` — static frontend (plain HTML/CSS/JS, no build step)
- `netlify/functions/` — Netlify Functions that proxy SunoAPI so the **API key never reaches the browser**
- `netlify.toml` — publishes `public/`, maps `/api/*` → functions

| App route | SunoAPI endpoint |
|---|---|
| `POST /api/generate` | `POST /api/v1/generate` |
| `GET /api/status?taskId=` | `GET /api/v1/generate/record-info` |
| `POST /api/lyrics` | `POST /api/v1/lyrics` |
| `GET /api/lyrics-status?taskId=` | `GET /api/v1/lyrics/record-info` |
| `GET /api/credits` | `GET /api/v1/generate/credit` |
| `POST /.netlify/functions/callback` | receives SunoAPI's required callback (the app polls for results) |

## Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub** and pick this repo.
2. Build settings are read from `netlify.toml` (no build command; publish dir `public`).
3. **Site configuration → Environment variables** → add:
   - `SUNO_API_KEY` = your SunoAPI.org key (required)
   - `ACCESS_CODE` = any passphrase (optional — if set, visitors must enter it before they can generate, so strangers can't spend your credits)
4. Deploy (or **Trigger deploy → Clear cache and deploy** after adding variables).

> Never commit your API key. It is only read from the `SUNO_API_KEY` environment variable on the server.

## Local development

```bash
npm i -g netlify-cli
cp .env.example .env   # then put your key in .env
netlify dev
```

Generated audio is hosted by SunoAPI for roughly 14 days — download tracks you want to keep.
