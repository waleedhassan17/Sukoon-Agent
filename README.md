# Sukoon AI Agent — Standalone Server

Production-ready Islamic AI companion backend. Deployable to Render, Railway, Cloud Run, Fly.io, or any Node.js host. **No Firebase Blaze plan required.**

This server is fully written and tested. If you're reading this as Claude Code or another AI assistant, your job is to help the user **deploy** this code and **integrate** it into their existing React Native app. The code itself is complete and type-checked.

---

## Project Overview

**Tech stack:**
- Node.js 20 + TypeScript + Express
- Google Gemini 1.5 Flash (free tier) with function calling
- Firebase Admin SDK for auth verification + Firestore access
- Anonymous Firebase Auth (per-user persistent UIDs)

**Architecture:**

```
React Native (Sukoon app)
    │
    │ POST /agent
    │ Authorization: Bearer <firebase-id-token>
    │ Body: { message, sessionId }
    ▼
Express server (this project)
    │
    ├── verifyFirebaseToken middleware
    │   → extracts userId from Firebase Auth token (cannot be spoofed)
    │
    ├── checkRateLimit(userId)
    │   → 50 messages/user/day, stored in Firestore
    │
    └── runAgent(userId, sessionId, message)
        │
        ├── loadHistory() from users/{uid}/agent_sessions/{sid}/turns
        ├── Gemini chat with function calling
        │   ├── log_salah → writes users/{uid}/salah_logs
        │   ├── get_salah_stats → reads last 7 days, computes streak
        │   └── navigate_quran → saves progress + returns nav command
        └── saveTurn() to memory
```

**Response shape:**
```json
{
  "reply": "MashaAllah, may Allah accept it from you.",
  "commands": [
    { "action": "navigate_quran", "surah": 18, "ayah": 10, "surah_name": "Al-Kahf" }
  ],
  "session_id": "sess_1234567890"
}
```

---

## File Structure

```
sukoon-agent-server/
├── package.json                # dependencies + scripts
├── tsconfig.json               # TypeScript config
├── render.yaml                 # Render.com blueprint (one-click deploy)
├── .env.example                # template for local dev secrets
├── .gitignore
└── src/
    ├── index.ts                # Express server, auth middleware, routes
    ├── agent.ts                # Gemini orchestration, tool-calling loop
    ├── memory.ts               # Conversation history in Firestore
    ├── rateLimit.ts            # 50 msg/user/day
    └── tools/
        ├── logSalah.ts         # Log a prayer, prevent duplicates
        ├── getSalahStats.ts    # 7-day stats + streak calculation
        └── navigateQuran.ts    # Parse surah names/numbers, save progress
```

**The code is complete. Do not rewrite it.** Help the user deploy and integrate.

---

## Required Secrets

Two environment variables must be set wherever this deploys:

1. **`GEMINI_API_KEY`** — from https://aistudio.google.com (free tier sufficient)
2. **`FIREBASE_SERVICE_ACCOUNT`** — single-line JSON string of the Firebase service account credentials

To get the service account:
- Firebase Console → Project Settings → Service Accounts → Generate new private key
- Downloads a JSON file
- The entire file contents go into the env var as one line (with `\n` characters escaped if needed — Render/Railway/etc. handle multi-line env vars fine)

---

## Deployment Path (Render.com — free, no credit card)

### Step 1 — Push the code to GitHub

The user needs a GitHub account.

```bash
cd sukoon-agent-server
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com first, then:
git remote add origin https://github.com/USERNAME/sukoon-agent-server.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy to Render

1. Go to https://render.com → sign up (free, no card)
2. Click **New +** → **Web Service**
3. Connect GitHub → authorize → select the `sukoon-agent-server` repo
4. Render detects `render.yaml` automatically. Keep all defaults.
5. Before clicking **Create**, scroll to **Environment Variables**:
   - Add `GEMINI_API_KEY` → paste the key
   - Add `FIREBASE_SERVICE_ACCOUNT` → paste the entire service account JSON (Render handles multi-line values; paste it as-is)
6. Click **Create Web Service**

Render builds and deploys in ~3-5 minutes. You get a URL like:
```
https://sukoon-agent.onrender.com
```

### Step 3 — Verify it works

```bash
# Health check
curl https://sukoon-agent.onrender.com/
# Expected: {"status":"ok","service":"sukoon-agent"}
```

The `/agent` endpoint requires a real Firebase ID token from a signed-in user, so we test it from the React Native app instead (see Integration section).

### Step 4 — Heads-up about free tier

Render free tier **sleeps after 15 minutes of inactivity**. The first request after sleep takes ~30 seconds to wake up. Subsequent requests are instant.

For Sukoon's production users, you'll either:
- Add a cron-job.org ping every 10 min to keep it warm (free workaround)
- Upgrade to Render's $7/month plan (always-on)

This is the only downside vs Firebase Functions.

---

## React Native Integration

This is what the user needs to add to their existing Sukoon RN app.

### Install dependency

If using React Native Firebase (most likely):
```bash
npm install @react-native-firebase/auth
cd ios && pod install && cd ..   # iOS only
```

### Create `src/services/sukoonAgent.js`

```javascript
import auth from '@react-native-firebase/auth';

const AGENT_URL = 'https://YOUR-RENDER-URL.onrender.com/agent';

export async function sendToAgent(message, sessionId) {
  // Ensure user is signed in (anonymous is fine)
  let user = auth().currentUser;
  if (!user) {
    const credential = await auth().signInAnonymously();
    user = credential.user;
  }

  // Get the Firebase ID token - this is how the server verifies the user
  const idToken = await user.getIdToken();

  const response = await fetch(AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Agent request failed');
  }

  return await response.json();
  // Returns: { reply, commands: [...], session_id }
}

export function newSessionId() {
  return `sess_${Date.now()}`;
}
```

### Chat screen example

```javascript
import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { sendToAgent, newSessionId } from '../services/sukoonAgent';

export default function SukoonChatScreen({ navigation }) {
  const [sessionId] = useState(newSessionId());
  const [messages, setMessages] = useState([
    { text: 'Assalamu alaikum 🌙 Tell me about your day.', isUser: false }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setMessages(prev => [...prev, { text, isUser: true }]);
    setInput('');
    setSending(true);

    try {
      const response = await sendToAgent(text, sessionId);
      setMessages(prev => [...prev, { text: response.reply, isUser: false }]);

      for (const cmd of response.commands || []) {
        if (cmd.action === 'navigate_quran') {
          navigation.navigate('QuranReader', { surah: cmd.surah, ayah: cmd.ayah });
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        text: 'Sorry, something went wrong.',
        isUser: false,
        isError: true,
      }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={{
            alignSelf: item.isUser ? 'flex-end' : 'flex-start',
            backgroundColor: item.isError ? '#FEE' : (item.isUser ? '#1E5C4F' : '#EEE'),
            padding: 10,
            borderRadius: 16,
            marginVertical: 4,
            maxWidth: '75%',
          }}>
            <Text style={{ color: item.isUser ? '#FFF' : '#000' }}>{item.text}</Text>
          </View>
        )}
        ListFooterComponent={sending ? <ActivityIndicator style={{ margin: 12 }} /> : null}
      />
      <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#EEE' }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message Sukoon..."
          style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14 }}
          editable={!sending}
        />
        <TouchableOpacity onPress={handleSend} disabled={sending} style={{ padding: 10 }}>
          <Text style={{ color: '#1E5C4F', fontWeight: 'bold' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

## Local Development

```bash
cd sukoon-agent-server
npm install
cp .env.example .env
# Edit .env: paste your Gemini key and service account JSON
npm run dev   # auto-rebuilds on save
```

Server runs at http://localhost:3000

To test locally, you can't use curl directly (you need a valid Firebase ID token). Either:
- Use your RN app pointed at `http://localhost:3000/agent` (use your machine's LAN IP from the device, like `http://192.168.1.5:3000`)
- Or temporarily comment out the `verifyFirebaseToken` middleware for testing (NEVER deploy without it)

---

## Troubleshooting Guide for Claude Code

If the user reports:

**"npm install fails"**
- Check Node version: `node -v` must be 20.x. If not, install Node 20 from nodejs.org or via nvm.

**"Build fails with TypeScript errors"**
- The code passes `npx tsc --noEmit` cleanly when last tested. If errors appear, run that command first to see the actual problem. Don't rewrite code — fix the specific error.

**"Render build succeeds but app crashes"**
- Check Render logs: dashboard → service → Logs tab
- 99% of crashes are missing env vars. Verify both `GEMINI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` are set
- `FIREBASE_SERVICE_ACCOUNT` parsing fails if the JSON is malformed. Tell user to paste the entire file contents including the outer `{` and `}`.

**"401 unauthenticated from RN app"**
- User isn't signed in. Make sure `auth().signInAnonymously()` is called before the first request
- Token expired (rare — Firebase auto-refreshes). Try forcing refresh: `user.getIdToken(true)`

**"Render service sleeping / first request slow"**
- Expected on free tier. Suggest adding cron-job.org ping or upgrading.

**"How do I see what the agent is doing?"**
- Render dashboard → service → Logs (real-time)
- Each tool call is logged with `[Tool] tool_name { args }`

**"User wants to add a new tool"**
- Create `src/tools/newTool.ts` with an exported async function
- In `src/agent.ts`:
  1. Add a `FunctionDeclaration` to `TOOL_DECLARATIONS`
  2. Add a case in the tool-call loop inside `runAgent`
- Push to GitHub; Render auto-deploys

---

## What NOT to do

- Do NOT add Firebase Functions back. The whole point is to avoid Blaze plan.
- Do NOT hardcode the Gemini key or service account in the code. Always use env vars.
- Do NOT remove the `verifyFirebaseToken` middleware in production. Without it, any random caller can hit the endpoint.
- Do NOT bypass rate limiting. The 50 msg/user/day limit prevents quota abuse.
- Do NOT rewrite the agent logic. It's complete, type-safe, and tested.

---

## Cost Estimate

For 500-2000 active users:
- **Render free tier**: $0/month (with 15-min sleep) or $7/month (always-on)
- **Gemini Flash free tier**: 1500 requests/day free, then $0.075 per 1M tokens (~$2-5/month at this scale)
- **Firestore reads/writes** on Spark (free) plan: well within limits (50K reads/day, 20K writes/day free)

Total: **$0-12/month** depending on tier choice.

---

## Summary for the User

You have a complete, production-ready AI agent backend. To get it live:

1. **Push to GitHub** (5 min)
2. **Deploy to Render** with env vars set (5 min)
3. **Test with curl /health endpoint** (1 min)
4. **Integrate into RN app** using the snippet above (15 min)
5. **Beta test** with a few real users
6. **Monitor logs**, iterate

Total time: ~30 minutes to deploy + however long you spend integrating.
# Sukoon-Agent
