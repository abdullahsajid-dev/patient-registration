# 🏥 Voice AI Patient Registration System

A voice-based patient registration system powered by **Vapi.ai**, **OpenAI GPT-4o**, **Node.js + Express**, and **SQLite**. Patients call a phone number, speak to an AI assistant, and their information is saved to a database — all hands-free.

---

## Live Demo

| Resource | URL |
|----------|-----|
| 📞 Phone Number | *(Add your Vapi number here after setup)* |
| 🌐 API Base URL | *(Add your Railway URL here after deploy)* |
| 🖥️ Dashboard | `{API_URL}/` |
| ❤️ Health Check | `{API_URL}/health` |

---

## Architecture

```
Caller (Phone)
     │
     ▼
[Vapi.ai] ──── STT (Deepgram) + TTS (ElevenLabs) + GPT-4o ────
     │
     │ HTTP Tool Calls (webhook)
     ▼
[Express API — Railway]
     │
     ├── POST   /patients       → Create patient
     ├── GET    /patients       → List all patients
     ├── GET    /patients/:id   → Get one patient
     ├── PUT    /patients/:id   → Update patient
     └── DELETE /patients/:id   → Soft-delete patient
     │
     ▼
[SQLite Database — file: data/patients.db]
```

**Separation of concerns:**
- **Telephony layer**: Vapi.ai handles STT, TTS, call routing, and LLM orchestration
- **LLM layer**: GPT-4o drives the conversation via a system prompt + tool definitions
- **API layer**: Express handles REST CRUD and Vapi webhook tool calls
- **Data layer**: SQLite with better-sqlite3 (synchronous, zero-config, fast)

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Telephony + Voice | Vapi.ai | Abstracts STT/TTS/telephony; fastest path to working demo |
| LLM | OpenAI GPT-4o | Best conversational quality; great function-calling support |
| Backend | Node.js + Express | Fast to write, widely understood, great ecosystem |
| Database | SQLite (better-sqlite3) | Zero setup, file-based, synchronous API — perfect for this scope |
| Hosting | Railway | GitHub-connected, one-click deploy, free tier available |

---

## Setup Instructions

### Prerequisites

- [Node.js 18+](https://nodejs.org) — download and install
- A [Vapi.ai](https://vapi.ai) account (free)
- An [OpenAI](https://platform.openai.com) account with API key
- A [Railway](https://railway.app) account (free)
- A [GitHub](https://github.com) account

---

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd patient-registration-system
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
PORT=3000
VAPI_API_KEY=your_vapi_private_api_key
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id
OPENAI_API_KEY=your_openai_api_key
DB_PATH=./data/patients.db
VAPI_WEBHOOK_SECRET=any_random_secret_string
```

### 3. Run Locally

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 4. Expose Locally with ngrok (for Vapi webhook during testing)

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL — you'll need it for Vapi.

### 5. Create the Vapi Assistant

1. Log in to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Go to **Assistants** → **Create Assistant**
3. Copy the contents of `vapi/assistant-config.json`
4. Replace `YOUR_DEPLOYED_URL_HERE` with your ngrok/Railway URL
5. Set the **Server URL** to `https://your-url.com/vapi/webhook`
6. Save the assistant

### 6. Assign a Phone Number

1. In Vapi Dashboard → **Phone Numbers** → **Buy Number**
2. Assign it to your assistant
3. Call the number to test!

### 7. Deploy to Railway

```bash
# Push to GitHub first
git add .
git commit -m "Initial commit"
git push origin main
```

1. Go to [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select your repository
3. Add environment variables (same as `.env`)
4. Railway auto-deploys — copy the generated URL
5. Update your Vapi assistant's Server URL to the Railway URL

---

## API Reference

All responses use the envelope format:
```json
{ "data": {...}, "error": null }
```

### `POST /patients`
Create a new patient.

**Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "date_of_birth": "1990-05-20",
  "phone": "5551234567",
  "email": "jane@example.com",
  "address": "123 Main St",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "reason_for_visit": "New patient checkup"
}
```

**Responses:** `201 Created` | `409 Conflict (duplicate phone)` | `422 Validation Error`

---

### `GET /patients`
List all active patients.

**Query params:** `?limit=50&offset=0`

---

### `GET /patients/:id`
Get a single patient by UUID.

---

### `PUT /patients/:id`
Partial update — send only fields you want to change.

---

### `DELETE /patients/:id`
Soft-delete (sets `deleted_at`, preserves data).

---

## Vapi Webhook Tools

The voice agent can call three tools:

| Tool | Description |
|------|-------------|
| `check_existing_patient` | Looks up a patient by phone before registering |
| `register_patient` | Creates a new patient record |
| `update_patient` | Updates an existing patient record |

---

## Testing with curl

```bash
# Health check
curl http://localhost:3000/health

# Create a patient
curl -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" \
  -d '{"first_name":"John","last_name":"Doe","date_of_birth":"1985-06-15","phone":"5559876543","reason_for_visit":"Annual checkup"}'

# List patients
curl http://localhost:3000/patients

# Get one patient
curl http://localhost:3000/patients/<patient-id>
```

---

## Known Limitations & Trade-offs

1. **SQLite vs PostgreSQL**: SQLite is single-writer, which works fine for this scale but wouldn't suit high-concurrency production. PostgreSQL (e.g., via Supabase) would be the production choice.

2. **No HIPAA compliance**: This is a technical assessment. Do not store real patient data. A production system would require encryption at rest, audit logs, BAAs with vendors, etc.

3. **Phone normalization**: Strips to 10 digits (US). International numbers may need libphonenumber for proper parsing.

4. **Vapi webhook not authenticated**: The `VAPI_WEBHOOK_SECRET` env var is set up but signature verification is not implemented (time constraint). In production, always verify Vapi's webhook signature.

5. **No retry logic**: If the DB write fails during a call, the caller gets an error message but we don't retry. A queue (e.g., BullMQ) would make this robust.

6. **ElevenLabs voice**: Requires Vapi's ElevenLabs integration to be active on your account. If not available, switch to `provider: "openai"` in `assistant-config.json`.

---

## Next Steps (if more time)

- [ ] Webhook signature verification (Vapi HMAC)
- [ ] PostgreSQL migration for production
- [ ] Appointment scheduling after registration
- [ ] Multi-language support (Spanish detection)
- [ ] Call transcript storage linked to patient record
- [ ] Unit tests for API routes (Jest + supertest)
- [ ] Rate limiting on the API
- [ ] Phone number international support

---

## Prompt Engineering Notes

The system prompt in `vapi/assistant-config.json` is designed to:
- Guide the conversation in natural order but allow flexibility
- Always check for duplicates before registering (via `check_existing_patient`)
- Always summarize and confirm before writing to DB (critical for voice UX)
- Convert spoken date formats to ISO 8601 (e.g., "March 15th 1985" → "1985-03-15")
- Handle corrections, restarts, and connection drops gracefully
- Temperature set to 0.3 for consistent, professional tone

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `production` or `development` |
| `VAPI_API_KEY` | Yes | Vapi private API key |
| `VAPI_PHONE_NUMBER_ID` | Yes | Vapi phone number ID |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `DB_PATH` | No | SQLite file path (default: ./data/patients.db) |
| `VAPI_WEBHOOK_SECRET` | No | For webhook security (future) |
