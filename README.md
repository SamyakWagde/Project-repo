# 🧠 Mental Burnout Predictor

An AI-powered mental health monitoring app that uses physiological wearable data and cognitive journaling to predict burnout risk and provide personalized coping strategies.

🔗 **Live Demo:** [project-repo-bice.vercel.app](https://project-repo-bice.vercel.app)  
🤖 **AI Studio:** [View on Google AI Studio](https://ai.studio/apps/fbcfbfb3-805c-422a-b6d7-654bb59411a7)

---

## ✨ Features

- **📊 Daily Entry Log** — Track mood, energy, stress, and cognitive load daily
- **🔥 Burnout Dashboard** — Visual analytics of burnout risk over time using Recharts
- **🤖 AI Coping Companion** — 1-on-1 live session with a Gemini-powered empathetic assistant
- **📈 Auto-Generate Scenario** — AI-generated burnout scenarios based on your biometric data
- **❤️ Physiological Wearable Biometrics** — Sync HRV, resting heart rate, sleep data from Garmin / Oura / Fitbit / WatchOS
- **🔐 JWT Authentication** — Secure access and refresh token-based auth

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite |
| Backend | Express.js, TypeScript (tsx) |
| AI | Google Gemini (`@google/genai`) |
| Auth | JWT (`jsonwebtoken`) + refresh tokens |
| Charts | Recharts |
| Animation | Motion (Framer Motion) |
| Rate Limiting | `express-rate-limit` |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Installation

```bash
# Clone the repo
git clone https://github.com/SamyakWagde/Project-repo.git
cd Project-repo

# Install dependencies
npm install
```

### Environment Setup

```bash
# Copy the example env file
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
```

> Generate secure JWT secrets using PowerShell:
> ```powershell
> [System.Convert]::ToBase64String((1..64 | ForEach-Object { [byte](Get-Random -Max 256) }))
> ```

### Run Locally

```bash
npm run dev
```

App will be available at `http://localhost:3000`

---

## 📦 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | TypeScript type check |

---

## 🔐 Security

- JWT access tokens (short-lived) + refresh tokens (long-lived)
- Rate limiting on all API endpoints via `express-rate-limit`
- Environment variables never committed to repo (see `.gitignore`)
- `.env.example` provided for reference — never contains real secrets

---

## 📁 Project Structure

```
├── src/              # React frontend
├── server/           # Express backend routes
├── server.ts         # Express entry point
├── assets/           # Static assets + AI Studio config
├── .env.example      # Environment variable template
├── vite.config.ts    # Vite config
└── tsconfig.json     # TypeScript config
```

---

## 🌐 Deployment

Deployed on **Vercel**. Every push to `main` triggers an automatic redeploy.

To deploy manually:
```bash
vercel --prod
```

Set environment variables in Vercel dashboard:  

---

## 👤 Author

**Samyak Wagde**  
[GitHub](https://github.com/SamyakWagde)

---

## 📄 License

This project is private. All rights reserved.
