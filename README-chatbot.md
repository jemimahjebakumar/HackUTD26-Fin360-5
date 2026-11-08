# Fin360 Chatbot: Local Setup

The chatbot runs a small language model **on your own machine** through Ollama. No API keys or accounts needed. Use fake financial data only while testing.

## How it fits together

```
Browser (fin-360-5-web, port 5173)
   │  /api/chat  (Vite proxy)
   ▼
AI server (fin-360-5-ai, port 8787)  ──►  Ollama (port 11434, runs the model)
```

- `fin-360-5-web/` is the React app. The chat UI is `src/Chat.tsx`, with helpers in `src/lib/`.
- `fin-360-5-ai/` is a small Node server that talks to Ollama and does the projection math.
- The chatbot does **not** need SpacetimeDB. If the app shows a SpacetimeDB "disconnected" banner, that is unrelated to the chat.

## 1. Install the prerequisites (one time)

**Node.js** (current LTS): https://nodejs.org (Mac with Homebrew: `brew install node`)

**Ollama**: https://ollama.com/download (Linux: `curl -fsSL https://ollama.com/install.sh | sh`)

Check both installed:

```bash
node -v
ollama --version
```

On Mac and Windows, Ollama runs in the background after install (look for the icon in the menu bar or tray). On Linux, or if it isn't running, start it in a spare terminal with `ollama serve`.

## 2. Download the model (one time, ~3 GB)

```bash
ollama pull qwen3:4b-instruct
```

If that tag isn't found, open https://ollama.com/library/qwen3, find the instruct variant of the 4B model, and use its exact name everywhere below. Confirm what you have with `ollama list`.

Quick test that the model works:

```bash
ollama run qwen3:4b-instruct "Say hello in five words"
```

Type `/bye` to exit.

## 3. Install project dependencies (one time)

From the repo root:

```bash
cd fin-360-5-ai
npm install
cd ../fin-360-5-web
npm install
```

## 4. Run it (every time)

Open **two terminals**.

**Terminal 1: AI server**

```bash
cd fin-360-5-ai
OLLAMA_MODEL=qwen3:4b-instruct npm run dev
```

(Windows PowerShell: `$env:OLLAMA_MODEL="qwen3:4b-instruct"; npm run dev`)

You should see: `AI server on http://localhost:8787`

**Terminal 2: web app**

```bash
cd fin-360-5-web
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

## 5. Try it

1. Fill in the profile form with fake numbers (for example income 6000, expenses 4000, savings 10000, debt 0) and click **Save profile**.
2. Ask: *"Can I afford a $30,000 car with $5,000 down and $450/month payments?"*
3. Reply *"Okay, I'm going with it."* and the decision should appear under **Saved decisions**.

The first reply is slow because the model has to load into memory. Later ones are faster.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `http proxy error: /api/chat ... ECONNREFUSED` in the web terminal | The AI server (terminal 1) isn't running. Start it. |
| Chat says it couldn't reach the model | Ollama isn't running (`ollama ps` errors) or the model name doesn't match `ollama list`. |
| Replies are very slow or show `<think>` text | Make sure you're using the `-instruct` model and the latest Ollama version. Run `ollama ps` and check the PROCESSOR column says GPU, not CPU. |
| Model name errors | Use the exact name from `ollama list` in the `OLLAMA_MODEL` variable. |
| Changed `OLLAMA_MODEL` or `vite.config.ts` and nothing happened | Stop the process with Ctrl+C and start it again. Both are read only at startup. |
| `npm install` fails on Windows | Install "Desktop development with C++" from Visual Studio Build Tools, then retry. |

## Notes

- Hardware: the 4B model needs roughly 3 to 4 GB of free memory and runs best on a GPU or Apple Silicon.
- Saved profile and decisions currently live in your browser's `localStorage` (a mock store), so they are per browser and per device.
- This is not financial advice. Projections use simple assumptions (flat income, 4% savings return, debt not modeled).
