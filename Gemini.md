# Feynman Club — Project Brief

## How To Begin — IMPORTANT, Follow This Exactly

Before writing a single line of code, you must follow these steps in order:

**Step 1 — Create an implementation plan**
Write a detailed implementation plan covering:
- The full tech stack with reasoning for each choice
- A breakdown of every screen and component you will build
- The order you will build things in, and why
- How the real-time canvas sync will work technically
- How the server-side timer will be implemented
- Any technical risks or tradeoffs you foresee
- Estimated phases (e.g. Phase 1: Rooms + Lobby, Phase 2: Whiteboard, etc.)

**Step 2 — Ask for review**
Once the plan is written, stop. Do not write any code. Present the plan clearly and ask:
"Does this plan look good to you? Any changes before I start building?"

**Step 3 — Wait for approval**
Do not proceed until the user explicitly approves the plan. If they request changes, update the plan and ask again.

**Step 4 — Create a task list**
Once approved, break the plan into a concrete numbered task list (e.g. "1. Scaffold project with Vite, 2. Set up Express + Socket.io server..."). Present this task list and check each item off as you complete it.

**Step 5 — Build**
Only now should you start writing code. Work through the task list in order, confirming each phase is complete before moving to the next.

---

## Your Role
You are an award-winning game developer and UI/UX designer known for creating visually stunning, polished web games with strong aesthetic identities. Think Gartic Phone meets skribbl.io meets a premium classroom game. Every screen you build should feel intentional, beautiful, and fun. No generic UI. No placeholder vibes. Every pixel matters.

---

## What You Are Building
**Feynman Club** — a real-time multiplayer web game where players take turns explaining topics on a shared whiteboard while the audience listens and scores them live.

The game is based on the Feynman Technique: if you can explain something simply, you truly understand it. The player who explains best wins.

---

## Aesthetic & Visual Identity
- **Theme**: Dark chalkboard classroom. Think late-night study session in an old university lecture hall.
- **Color palette**: Deep forest greens (`#1e2e1e`, `#243824`) for backgrounds, chalk-white (`#e8f5e8`) for text and drawings, yellow (`#f5c842`), red (`#e05555`), and blue (`#5599e0`) as accent chalk colors.
- **Typography**: Serif font for topic reveals and headings (dramatic, academic). Monospace for the timer. Clean sans-serif for UI.
- **Animations**: Smooth, purposeful. Topic card should dramatically fade/appear on the board. Timer pulses red in the last 20 seconds. Whiteboard zooms in at round start like a camera pan into the board.
- **Feel**: Premium indie game. Not a school app. Not a corporate SaaS. A game people would genuinely want to open and play.

---

## Core Game Loop
1. Host creates a room (private with code, or public lobby)
2. Players join and wait in the lobby
3. Game starts — a topic card appears on the chalkboard (e.g. "Explain: Mitosis")
4. One player is **on stage** — their mic is live, everyone else is muted
5. The explainer has **90 seconds** to explain using voice + the shared whiteboard
6. Audience watches the whiteboard live and can score 1–5 at any time during the explanation
7. Timer hits zero → whiteboard freezes → scores lock → leaderboard snapshot → next player
8. After all players have explained → final results screen with winner

---

## Screens to Build

### 1. Home Screen
- App name + tagline ("explain it simply. win.")
- Three buttons: Create Room, Join with Code, Browse Public Rooms
- List of live public rooms with subject, player count, and open/full status

### 2. Create Room Modal
- Room name input
- Subject picker (A-levels, GCSEs, SAT, Custom)
- Public or Private toggle
- Max players (2–8)
- Start button

### 3. Lobby
- Room code displayed prominently (copy to clipboard)
- Player cards in a grid with avatars (initials-based), ready/not ready status
- Host can start when 2+ players are ready
- Animated "waiting for players" state

### 4. Game Screen — Explainer View
- Full-screen dark chalkboard canvas
- Topic card pinned at the top of the board
- Drawing toolbar on the left: freehand pen, rectangle, circle, line, text, eraser
- Chalk color swatches: white, yellow, red, blue
- Brush size selector (small / medium / large)
- Timer top right — monospace, counts down from 1:30, pulses red at 0:20
- Audience avatars shown top left as small circles with a live audio waveform indicator
- Mic on/off button bottom left
- "You're explaining" badge

### 5. Game Screen — Audience View
- Same chalkboard canvas, real-time synced, read-only (no drawing tools)
- Explainer's name and topic shown at top
- Live audio waveform showing the explainer is speaking
- Timer top right (same synced countdown)
- Score buttons (1–5) pinned to the bottom of the screen, always visible
- Scores can be submitted at any time and updated until the round ends
- "Listening..." muted mic indicator

### 6. Between Rounds
- Brief leaderboard snapshot showing current standings
- "Next up: [player name]" with their avatar
- 5 second countdown before next round starts

### 7. Results Screen
- Final leaderboard with rank, avatar, name, total points, avg score per round
- Winner highlighted with a gold/chalk-styled crown effect
- "Play again" and "Home" buttons

---

## Technical Stack
- **Frontend**: React + Vite
- **Real-time**: Socket.io (syncs canvas strokes, game state, timer, scores across all players)
- **Canvas/Drawing**: HTML5 Canvas API (custom implementation — broadcast stroke events via Socket.io, replay on all clients — exactly like skribbl.io)
- **Audio**: Livekit SDK (explainer mic live, audience muted during explanation)
- **Backend**: Node.js + Express + Socket.io server
- **Hosting**: Vercel (frontend) + Railway (backend)

---

## Project Structure
```
feynman-club/
├── client/                   
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx          
│   │   │   ├── Lobby.jsx         
│   │   │   └── Game.jsx          
│   │   ├── components/
│   │   │   ├── Whiteboard.jsx    
│   │   │   ├── Timer.jsx         
│   │   │   ├── ScorePanel.jsx    
│   │   │   ├── PlayerList.jsx    
│   │   │   └── TopicCard.jsx     
│   │   ├── hooks/
│   │   │   ├── useSocket.js      
│   │   │   └── useAudio.js       
│   │   └── main.jsx
├── server/                   
│   ├── index.js              
│   ├── rooms.js              
│   ├── gameLoop.js           
│   └── topics.js             
└── package.json
```

---

## Canvas Sync — How It Should Work (skribbl.io style)
- Every stroke event from the explainer is emitted to the Socket.io server: `{ type, x, y, color, size, tool }`
- Server broadcasts to all players in the room
- Audience clients receive and replay the stroke on their canvas in real time
- On round end, canvas is frozen (no more events processed)
- On new round, canvas is cleared for all clients simultaneously

---

## Topics Bank (starter set — expand later)
Organised by subject. Each topic is a single concept. Examples:
- **Biology**: Mitosis, Photosynthesis, Natural Selection, The Immune System, DNA Replication
- **Chemistry**: Covalent Bonds, Oxidation, Le Chatelier's Principle, Electron Configuration
- **Physics**: Newton's Third Law, Wave-Particle Duality, Entropy, Electromagnetic Induction
- **Maths**: The Chain Rule, Proof by Contradiction, Eigenvectors, Integration by Parts
- **History**: The Cold War, The French Revolution, Causes of WW1
- **Economics**: Supply and Demand, Game Theory, Comparative Advantage

---

## Key Constraints & Notes
- The whiteboard is the centrepiece — it must feel smooth and responsive, not laggy
- The timer must be synced server-side, not client-side (prevents drift between players)
- Scores are submitted by audience members live during the explanation — not after
- The game should work with 2 players minimum (for testing)
- Mobile responsive is a bonus — desktop first is fine for MVP
- No user accounts needed for MVP — players just enter a display name when joining

---

## Tone & Personality
The game should feel like something a group of friends would genuinely play together. It's competitive but fun. The UI should have personality — subtle animations, satisfying interactions, a little drama when the topic card drops. Think less "educational tool" and more "this slaps".