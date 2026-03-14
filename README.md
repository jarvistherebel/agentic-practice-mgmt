# Agentic Practice Management System

**Cliniko, but agentic.** An AI-native practice management platform where autonomous agents handle scheduling, documentation, patient communications, and billing.

![AI Agents Active](https://img.shields.io/badge/AI%20Agents-Online-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## 🎯 What Makes This Different?

| Traditional (Cliniko) | Agentic (This) |
|----------------------|----------------|
| Manual booking entry | Voice AI answers calls & books automatically |
| Type notes after session | AI generates SOAP notes from session audio |
| Send reminders manually | AI handles all patient comms 24/7 |
| Chase invoices yourself | AI follows up on payments |
| Check reports weekly | AI alerts you to issues in real-time |

## 🚀 Quick Start

### Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

Or manually:

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/agentic-practice-mgmt.git
cd agentic-practice-mgmt

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open http://localhost:3000
```

### Environment Variables

```env
PORT=3000
NODE_ENV=production
# Required for AI note generation
OPENAI_API_KEY=sk-your_openai_key_here
# Optional: For voice AI integration
VAPI_API_KEY=your_key_here
```

### 📝 AI Note Generation Setup

The system uses **OpenAI Whisper** for audio transcription and **GPT-4o** for SOAP note generation:

1. Get an OpenAI API key from https://platform.openai.com
2. Add it to your environment variables as `OPENAI_API_KEY`
3. Cost: ~$0.10-0.20 per 15-minute session

**How it works:**
1. Record session audio in the Notes tab
2. Audio is sent to Whisper API for transcription
3. Transcript is sent to GPT-4o to generate structured SOAP note
4. Review and edit the note before saving

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         PRACTICE ORCHESTRATOR           │
│    (Express.js + WebSocket Server)      │
└─────────────────────────────────────────┘
     │        │        │        │
     ▼        ▼        ▼        ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Schedule│ │Document│ │Patient │ │Billing │
│ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │
└────────┘ └────────┘ └────────┘ └────────┘
     │        │        │        │
     └────────┴────────┴────────┘
              │
              ▼
        ┌──────────┐
        │  React   │
        │ Dashboard│
        └──────────┘
```

## 🤖 The Agents

### 1. Scheduling Agent
- **Voice AI booking** — answers phone calls 24/7
- Smart calendar optimisation
- Automatic waitlist filling
- No-show prediction & overbooking

### 2. Documentation Agent
- Voice-to-text during sessions
- Auto-generates SOAP notes
- Creates referral letters
- Discharge summaries

### 3. Patient Communications Agent
- WhatsApp/SMS chatbot
- Appointment reminders
- Home exercise delivery
- Reactivation campaigns

### 4. Billing Agent
- Auto-invoice generation
- Payment processing
- Overdue invoice chasing
- Financial reporting

### 5. Practice Intelligence Agent
- Real-time KPI monitoring
- Revenue forecasting
- At-risk patient alerts
- Strategic recommendations

## 📁 Project Structure

```
agentic-practice-mgmt/
├── server.js           # Express API + agent orchestrator
├── package.json
├── README.md
└── public/
    ├── index.html      # Main HTML
    └── app.js          # Single-page app (vanilla JS)
```

## 🎨 Features

### Dashboard
- Live agent activity feed
- Today's appointments
- Pending notes (AI drafted)
- Overdue invoices (AI chasing)
- Practice KPIs

### Calendar
- Week/day views
- Practitioner colour coding
- Drag-and-drop booking
- Availability checker

### Patients
- Full patient profiles
- Treatment history
- Communication logs
- Document storage

### Voice AI
- Demo phone interface
- Live call simulation
- Transcript viewer
- Booking confirmation

### Agent Control Center
- Agent status monitoring
- Configuration panel
- Activity logs
- Human override controls

## 🔌 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | Dashboard stats & recent activity |
| `GET /api/practitioners` | List practitioners |
| `GET /api/patients` | List patients |
| `GET /api/appointments` | List/filter appointments |
| `POST /api/appointments` | Create appointment |
| `GET /api/availability` | Check available slots |
| `POST /api/voice-webhook` | Voice AI webhook |
| `POST /api/generate-note` | AI generate SOAP note |
| `GET /api/agent-activities` | Recent agent actions |

## 🛣️ Roadmap

- [ ] VAPI.ai integration for live voice AI
- [ ] WhatsApp Business API integration
- [ ] OpenAI Assistants API for agent memory
- [ ] Stripe integration for payments
- [ ] NHS e-Referral integration
- [ ] Mobile app (React Native)

## 📄 License

MIT License — free to use, modify, and deploy.

## 🤝 Contributing

This is a demo/proof-of-concept. For production use, add:
- Proper authentication (Auth0/Clerk)
- Database persistence (PostgreSQL)
- File storage (S3/R2)
- Testing suite
- HIPAA/GDPR compliance features

---

**Built with:** Node.js • Express • Tailwind CSS • Vanilla JS • ❤️
