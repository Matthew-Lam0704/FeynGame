# FeynGame — Implementation Plan
> 7 Bugs + 11 Features — Programmer Handoff Document

---

## Stack Overview

| Layer | Tech |
|-------|------|
| Client | React + Vite, Socket.io-client, LiveKit WebRTC, Supabase auth |
| Server | Node.js + Express + Socket.io, in-memory rooms, LiveKit server SDK |

---

## PART 1: BUGS

---

### Bug 1 & 2 — Microphone: Wrong timing + audience cannot hear explainer

**Root cause:**
`client/src/hooks/useAudio.js` connects all players to the LiveKit room but **never handles incoming remote audio tracks**. LiveKit requires you to listen for the `TrackSubscribed` event and attach the track to an `<audio>` DOM element. Without this, audience members receive zero audio even though the explainer is publishing. The mic permission dialog fires mid-turn (when `isExplainer` first becomes `true`) because no upfront permission request exists.

**File:** `client/src/hooks/useAudio.js`

**Change 1 — Handle incoming audio from remote participants:**
Inside the `connectToRoom` async function, after the room connects (after line 38), add:
```js
newRoom.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === 'audio') {
    const audioEl = track.attach();
    audioEl.setAttribute('data-livekit', 'true');
    document.body.appendChild(audioEl);
  }
});
newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
  track.detach().forEach(el => el.remove());
});
```

**Change 2 — Pre-request mic permission at game load (not mid-turn):**
Still inside `connectToRoom`, after the room connects, add:
```js
// Prompt the browser mic dialog at game load so it doesn't interrupt gameplay
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => stream.getTracks().forEach(t => t.stop()))
  .catch(() => {});
```

**Change 3 — Cleanup injected audio elements on disconnect:**
In the cleanup return function of the first `useEffect`:
```js
document.querySelectorAll('audio[data-livekit]').forEach(el => el.remove());
```

---

### Bug 3 — Textboxes not visible to audience + clicking creates unwanted textboxes

#### Part A — Audience can't see textboxes

**Root cause:** `client/src/components/Whiteboard.jsx` lines 27–33 uses `JSON.stringify` to compare `roomState?.textBoxes` with local state. This comparison is order-sensitive and silently fails when the server returns boxes in a different order. Audience members who join mid-round also miss textboxes that were added before they joined if the socket events already fired.

**Fix (Whiteboard.jsx lines 27–33):** Replace the JSON.stringify guard with a reliable sync keyed on round index and box count:
```js
useEffect(() => {
  setTextBoxes(roomState?.textBoxes || []);
}, [roomState?.currentExplainerIndex, roomState?.textBoxes?.length]);
```

#### Part B — Clicking as explainer always creates a new textbox, can't click away

**Root cause:** In `startDrawing` (Whiteboard.jsx lines 143–154), every `mousedown` while `tool === 'text'` creates a new textbox. After placing one, there is no way to deselect or switch back — the next click creates another.

**Fix:** Add an `onToolChange` callback prop to Whiteboard so it can tell the parent to switch back to `'pen'` after placing a textbox.

In `Whiteboard.jsx`, update the component signature:
```js
export default function Whiteboard({ isExplainer, color, size, tool, socket, roomId, roomState, onToolChange }) {
```

In `startDrawing`, after emitting `textbox:add`:
```js
if (onToolChange) onToolChange('pen');
return;
```

In `Game.jsx`, where `<Whiteboard>` is rendered, pass:
```jsx
<Whiteboard ... onToolChange={(t) => setTool(t)} />
```

---

### Bug 4 — New users cannot create an account

**Root causes:**
1. `client/src/pages/Auth.jsx` line 43 requires a **minimum username length of 8 characters**. Most users expect 3–6 character usernames and give up without understanding why signup fails.
2. Supabase email confirmation may be blocking registration — after `signUp()` succeeds, users are asked to confirm their email, but if email delivery isn't configured, the account is stuck unconfirmed.

**File:** `client/src/pages/Auth.jsx`

**Change line 43:**
```js
// FROM:
if (username.length < 8 || username.length > 20) {
  setError('Username must be 8-20 characters.');
// TO:
if (username.length < 3 || username.length > 20) {
  setError('Username must be 3-20 characters.');
```

**Supabase Dashboard (non-code action):**
Go to: Supabase Project → Authentication → Providers → Email → **disable "Confirm email"**
This lets users log in immediately after signup without needing to verify their email.

---

### Bug 5 — Room codes are case-sensitive when joining

**Root cause:** `client/src/pages/Home.jsx` line 31 navigates using `joinCode.trim()` without converting to uppercase. The input field has CSS `textTransform: uppercase` which is **visual only** — the stored state value is still whatever the user typed. The server regex `/^[A-Z0-9]{1,20}$/` rejects any lowercase input, so "usjs" and "USJS" route to different rooms.

**File:** `client/src/pages/Home.jsx`

**Change 1 — Uppercase on navigate (line 31):**
```js
// FROM:
navigate(`/room/${joinCode.trim()}`);
// TO:
navigate(`/room/${joinCode.trim().toUpperCase()}`);
```

**Change 2 — Uppercase as the user types (line 72):**
```js
// FROM:
onChange={(e) => setJoinCode(e.target.value)}
// TO:
onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
```

---

### Bug 6 — Choosing a subject/subtopic gives a word from a different subject/subtopic

**Root cause (two parts):**

1. `server/topics.js` lines 24–35: when the subtopic doesn't **exactly** match a wordbank key, the code tries fuzzy matching, and if that fails, picks a **random subtopic from anywhere in the subject**. This is why the wrong words appear.

2. `client/src/components/CreateRoomModal.jsx` lines 5–12: the client has a **hardcoded** `SUBJECT_STRUCTURE` that may not exactly match the keys in `server/wordbank.json`. Any mismatch triggers the unpredictable fallback above.

---

**Fix Part A — Server: remove fuzzy matching, use exact keys only**

**File:** `server/topics.js`

Replace the `getRandomWord` function with:
```js
const getRandomWord = (subject, subtopic) => {
  if (!subject || !wordBank[subject]) {
    console.error(`[TOPIC ERROR] Unknown subject: "${subject}"`);
    return { subject: 'Unknown', subtopic: 'Unknown', term: 'Unknown' };
  }
  const subjectData = wordBank[subject];
  if (!subtopic || !subjectData[subtopic]) {
    console.error(`[TOPIC ERROR] Unknown subtopic: "${subtopic}" in "${subject}"`);
    return { subject, subtopic: 'Unknown', term: 'Unknown' };
  }
  const terms = subjectData[subtopic];
  const term = terms[Math.floor(Math.random() * terms.length)];
  console.log(`[TOPIC] ${term} (${subject} > ${subtopic})`);
  return { subject, subtopic, term };
};
```

---

**Fix Part B — Client: fetch subjects from server instead of hardcoding**

**File:** `client/src/components/CreateRoomModal.jsx`

Remove the `SUBJECT_STRUCTURE` constant (lines 5–12). Replace with a state variable populated from the server's existing `GET /subjects` endpoint:

```js
const [subjectStructure, setSubjectStructure] = useState({});

useEffect(() => {
  const raw = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  const serverUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  fetch(`${serverUrl}/subjects`)
    .then(r => r.json())
    .then(data => {
      setSubjectStructure(data);
      const firstSubject = Object.keys(data)[0];
      if (firstSubject) {
        setSubject(firstSubject);
        setSubtopic(data[firstSubject][0]);
      }
    })
    .catch(() => {});
}, []);
```

Replace all references to `SUBJECT_STRUCTURE` with `subjectStructure`.

---

**Optional: Python validation script (for wordbank maintenance)**

Create `server/validate_wordbank.py`:
```python
import json

with open('wordbank.json') as f:
    wb = json.load(f)

print("Exact keys in wordbank.json:\n")
for subject, subtopics in wb.items():
    print(f"{subject}:")
    for st in subtopics:
        print(f"  - {st!r}")
```
Run with `python validate_wordbank.py` any time `wordbank.json` is updated to get a copy-pasteable list of exact key names.

---

### Bug 7 — Time setting in room creation doesn't apply correctly

**Root cause:**
`client/src/pages/Game.jsx` line 26: `useState(roomState?.timer || 90)` defaults to `90` because `roomState` is `null` on first render (socket hasn't connected yet). React's `useState` only uses the initial value once, so even after the correct `roomState.timer` arrives, the displayed value stays at `90` until a `timer_sync` socket event fires.

---

**Fix Part A — Client timer sync (Game.jsx)**

**Change line 26:**
```js
// FROM:
const [timeRemaining, setTimeRemaining] = useState(roomState?.timer || 90);
// TO:
const [timeRemaining, setTimeRemaining] = useState(90); // properly overwritten by useEffect below
```

**Replace lines 52–56** with a more reliable sync that watches `roomState.timer` directly:
```js
useEffect(() => {
  if (roomState?.timer !== undefined) {
    setTimeRemaining(roomState.timer);
  }
}, [roomState?.timer, roomState?.currentExplainerIndex]);
```

---

**Fix Part B — Prevent room creation race condition (CreateRoomModal.jsx)**

Currently the `handleCreate` function doesn't check if the POST succeeded before navigating. If the POST fails (e.g., rate limit), the socket creates the room with default settings (90s). Add error handling:

```js
const handleCreate = async (e) => {
  e.preventDefault();
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const raw = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  const serverUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  
  const resp = await fetch(`${serverUrl}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: roomCode, name: roomName, isPublic, maxPlayers, roundDuration, roundsPerPlayer, subject, subtopic }),
  });
  
  if (!resp.ok) {
    console.error('Room creation failed:', await resp.json());
    return; // don't navigate if room wasn't created with correct settings
  }
  
  navigate(`/room/${roomCode}`);
};
```

---

## PART 2: FEATURES

---

### Feature 1 — Chat Box

**New file:** `client/src/components/ChatBox.jsx`
**Modified files:** `server/index.js`, `client/src/pages/Game.jsx`

**Server (index.js) — add socket handler:**
```js
socket.on('chat:message', ({ roomId, playerName, text }) => {
  if (typeof text !== 'string' || text.trim().length === 0) return;
  const sanitized = text.trim().slice(0, 200);
  io.to(roomId).emit('chat:message', { playerName, text: sanitized, ts: Date.now() });
});
```

**Client — ChatBox.jsx:**
- Scrollable message list that auto-scrolls to the bottom on new messages
- Input field + send button; also submits on Enter key
- Displays: `[playerName]: message`
- Max height with `overflow-y: auto`
- Passed props: `socket`, `roomId`, `playerName`

**Game.jsx:**
- Add `const [chatMessages, setChatMessages] = useState([])`
- Listen for `chat:message` socket event and append to state
- Render `<ChatBox>` alongside the whiteboard

---

### Feature 2 — Chalkboard Frame

**Modified files:** `client/src/components/Whiteboard.jsx`, `client/src/index.css`

In `Whiteboard.jsx`, wrap the existing `<div ref={containerRef}>` in an outer frame div:
```jsx
<div className="chalkboard-frame">
  <div ref={containerRef} style={{ ... }}>
    {/* existing canvas + textbox overlay */}
  </div>
</div>
```

In `index.css`:
```css
.chalkboard-frame {
  background: #5c3a1e; /* wood brown */
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 2px 4px rgba(0,0,0,0.4);
}
```

---

### Feature 3 — Done Button: 5-Second Countdown with Undo

**Modified files:** `server/index.js`, `client/src/pages/Game.jsx`

**Server (index.js):**

Replace the existing `end_turn` socket handler with a countdown-based one:
```js
const endTurnTimers = new Map(); // declare outside all socket handlers

socket.on('end_turn', ({ roomId }) => {
  const room = getRoom(roomId);
  if (!room || room.status !== 'playing') return;
  if (endTurnTimers.has(roomId)) return; // already counting down

  io.to(roomId).emit('turn_ending', { secondsLeft: 5 });
  let countdown = 5;
  const interval = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(interval);
      endTurnTimers.delete(roomId);
      endRound(io, roomId);
    } else {
      io.to(roomId).emit('turn_ending', { secondsLeft: countdown });
    }
  }, 1000);
  endTurnTimers.set(roomId, interval);
});

socket.on('cancel_end_turn', ({ roomId }) => {
  const t = endTurnTimers.get(roomId);
  if (t) { clearInterval(t); endTurnTimers.delete(roomId); }
  io.to(roomId).emit('turn_end_cancelled');
});
```

**Client (Game.jsx):**
- Add state: `const [turnEnding, setTurnEnding] = useState(false)` and `const [turnEndCountdown, setTurnEndCountdown] = useState(5)`
- Listen for `turn_ending` → set `turnEnding = true`, update countdown
- Listen for `turn_end_cancelled` → set `turnEnding = false`
- Replace Done button UI:
  - When `!turnEnding`: green "Done" button → emits `end_turn`
  - When `turnEnding`: show `"Ending in Xs"` + red "Cancel" button → emits `cancel_end_turn`

---

### Feature 4 — Topic Filter Tags for Public Rooms

**Modified files:** `server/index.js`, `client/src/pages/Home.jsx`

**Server (index.js) — extend `GET /rooms` response (lines 108–113):**
```js
publicRooms.push({
  id: room.id,
  name: room.name,
  players: room.players.length,
  maxPlayers: room.maxPlayers,
  subject: room.subject,    // ADD THIS
  subtopic: room.subtopic,  // ADD THIS
});
```

**Client (Home.jsx):**
- Add `const [subjectFilter, setSubjectFilter] = useState(null)`
- Render clickable subject filter chips above the public rooms list (derive unique subjects from `publicRooms`)
- Apply filter: `publicRooms.filter(r => !subjectFilter || r.subject === subjectFilter)`
- Show small tag badges next to each room name: e.g. `Chemistry · Atomic Structure`

---

### Feature 5 — Make Room Public/Private After Creation (in Lobby)

**Modified files:** `server/index.js`, `client/src/pages/Lobby.jsx`

**Server (index.js) — add socket handler:**
```js
socket.on('update_room_visibility', ({ roomId, isPublic }) => {
  const room = getRoom(roomId);
  if (!room || room.status !== 'lobby') return;
  if (room.players[0]?.id !== socket.id) return; // host only
  room.isPublic = !!isPublic;
  io.to(roomId).emit('room_state_update', room);
});
```

**Client (Lobby.jsx):**
- Determine if current user is host: `socket.id === roomState.players[0]?.id`
- Show a Public/Private toggle switch **only** to the host
- On toggle, emit `update_room_visibility` with the new boolean value

---

### Feature 6 — Change Room Settings After Creation (in Lobby)

**Modified files:** `server/index.js`, `client/src/pages/Lobby.jsx`

**Server (index.js) — add socket handler:**
```js
socket.on('update_room_settings', ({ roomId, roundDuration, roundsPerPlayer, subject, subtopic }) => {
  const room = getRoom(roomId);
  if (!room || room.status !== 'lobby') return;
  if (room.players[0]?.id !== socket.id) return; // host only
  if (Number.isInteger(roundDuration) && roundDuration >= 30 && roundDuration <= 300)
    room.roundDuration = roundDuration;
  if (Number.isInteger(roundsPerPlayer) && roundsPerPlayer >= 1 && roundsPerPlayer <= 5)
    room.roundsPerPlayer = roundsPerPlayer;
  if (typeof subject === 'string') room.subject = subject;
  if (typeof subtopic === 'string') room.subtopic = subtopic;
  io.to(roomId).emit('room_state_update', room);
});
```

**Client (Lobby.jsx):**
- Add compact settings controls visible only to host: duration chip buttons, rounds stepper, subject/subtopic dropdowns
- Fetch subject structure from `GET /subjects` to populate dropdowns (same as CreateRoomModal fix in Bug 6)
- On any change, emit `update_room_settings` immediately

---

### Feature 7 — Display Room Settings Widget Before Session

**Modified file:** `client/src/pages/Lobby.jsx`

Add a read-only info card visible to **all players** in the lobby:

```
⏱ 90s per turn  ·  🔄 2 rounds each  ·  📚 Chemistry › Atomic Structure
```

Read from: `roomState.roundDuration`, `roomState.roundsPerPlayer`, `roomState.subject`, `roomState.subtopic`.

Display as a horizontal pill/badge row or a small card alongside the player list. This widget should update live when the host changes settings (Feature 6) because it reads from `roomState` which is already synced via `room_state_update`.

---

### Feature 8 — Lines, Shapes, and Ruler Tools

**Modified files:** `client/src/components/Whiteboard.jsx`, `client/src/pages/Game.jsx`, `server/index.js`

**New tools to add:** Line, Rectangle, Circle

**Whiteboard.jsx approach:**
- Add state: `const [shapeStart, setShapeStart] = useState(null)` and `const [previewShape, setPreviewShape] = useState(null)`
- On `mousedown` when tool is `line`/`rect`/`circle`: store the normalized start point
- On `mousemove`: update `previewShape` and draw a temporary preview (use a second overlay canvas or clear+redraw each frame)
- On `mouseup`: finalize the shape on the main canvas, emit `shape:draw` socket event, clear preview

**Socket event (emitted client → server):**
```js
socket.emit('shape:draw', {
  roomId, type: tool, // 'line' | 'rect' | 'circle'
  x1, y1, x2, y2,   // normalized 0–1 coordinates
  color, size
});
```

**Server (index.js) — relay to room:**
```js
socket.on('shape:draw', ({ roomId, ...shapeData }) => {
  socket.to(roomId).emit('shape:replay', shapeData);
});
```

**Whiteboard.jsx — audience listens:**
```js
socket.on('shape:replay', (shape) => {
  // draw shape on canvas using canvas 2D API
});
```

**Game.jsx toolbar:** Add `Minus` (line), `Square` (rect), `Circle` icons from `lucide-react` to the tool selector buttons.

---

### Feature 9 — Fit to Screen (No Scrolling Required)

**Modified files:** `client/src/pages/Game.jsx`, `client/src/index.css`

**Layout restructure (Game.jsx):**
- Top-level game container: `display: flex; height: 100vh; overflow: hidden`
- Left/center panel (whiteboard): `flex: 1; display: flex; flex-direction: column; overflow: hidden`
- Right sidebar (timer, mic, controls, score): `width: 280px; overflow-y: auto; max-height: 100vh`
- Tool toolbar: fixed strip at the top or bottom of the whiteboard panel — never scrolled away

**index.css:** Remove any `minHeight` or `padding` on `.game-container` or similar wrappers that push content below the fold.

**Whiteboard canvas:** Already calculates height as `rect.width * (9/16)` — ensure the container constrains this so it stays within the viewport height.

---

### Feature 10 — Confirm Dialog Before Clearing Whiteboard

**Modified file:** `client/src/pages/Game.jsx`

Add state: `const [confirmClear, setConfirmClear] = useState(false)`

Replace the Clear button's `onClick` with:
```js
onClick={() => setConfirmClear(true)}
```

Add a confirmation dialog (rendered inline or as a small modal):
```jsx
{confirmClear && (
  <div className="confirm-dialog">
    <p>Clear the entire whiteboard?</p>
    <button onClick={() => {
      socket.emit('canvas_clear', { roomId });
      setConfirmClear(false);
    }}>
      Yes, clear it
    </button>
    <button onClick={() => setConfirmClear(false)}>Cancel</button>
  </div>
)}
```

---

### Feature 11 — Profanity Filter for Usernames

**Install:**
```bash
# Client
cd client && npm install leo-profanity

# Server
cd server && npm install leo-profanity
```

**Client (Auth.jsx):**
```js
import { filter } from 'leo-profanity';

// In handleSubmit, before calling supabase.auth.signUp():
if (filter.isProfane(username)) {
  setError('Username contains inappropriate language.');
  return;
}
```

**Server (index.js) — also validate at room join:**
```js
const { filter } = require('leo-profanity');

// In join_room socket handler, before adding player:
if (filter.isProfane(playerName)) {
  socket.emit('error', { message: 'Username contains inappropriate language.' });
  return;
}
```

---

## Critical Files Reference

| File | Used in |
|------|---------|
| `client/src/hooks/useAudio.js` | Bugs 1, 2 |
| `client/src/components/Whiteboard.jsx` | Bug 3, Features 2, 8, 10 |
| `client/src/pages/Game.jsx` | Bugs 3, 7, Features 1, 3, 8, 9, 10 |
| `client/src/pages/Auth.jsx` | Bug 4, Feature 11 |
| `client/src/pages/Home.jsx` | Bug 5, Feature 4 |
| `client/src/components/CreateRoomModal.jsx` | Bugs 6, 7 |
| `client/src/pages/Lobby.jsx` | Features 5, 6, 7 |
| `server/index.js` | Bugs 6, 7, Features 1, 3, 4, 5, 6, 11 |
| `server/topics.js` | Bug 6 |
| `server/gameLoop.js` | Feature 3 |

---

## Verification Checklist

### Bugs
| # | How to test |
|---|-------------|
| 1 | Join a room — browser mic permission prompt appears at page load, not mid-turn |
| 2 | Open two browser tabs in the same room; explainer speaks — audience tab hears audio |
| 3a | Explainer adds a textbox — audience tab sees it appear in real-time |
| 3b | In text mode, placing a textbox auto-reverts tool to pen; subsequent clicks don't create extra textboxes |
| 4 | Register with a 3-character username — account is created and user can log in immediately |
| 5 | Type "abc123" in the join field — navigates to room "ABC123" (same as typing "ABC123") |
| 6 | Select Chemistry → Atomic Structure — word shown is always from that specific subtopic |
| 7 | Set 30s in room creation — game timer counts down from 30, not 90 |

### Features
| # | How to test |
|---|-------------|
| 1 | Messages sent in chat appear for all players in real-time |
| 2 | Whiteboard has a visible wooden-style border frame |
| 3 | Done button shows a 5s countdown; Cancel button reverts; round ends at 0 |
| 4 | Public rooms show subject/subtopic tags; filter chips hide non-matching rooms |
| 5 | Host toggles Public in the lobby — room appears/disappears from public room list within 5s |
| 6 | Host changes time/rounds/subject in lobby — all players see the settings widget update live |
| 7 | Settings widget is visible to all players in the lobby before the game starts |
| 8 | Line/rect/circle tools draw shapes that appear on all players' screens |
| 9 | No vertical scrolling needed to access any tool, button, or UI element during gameplay |
| 10 | Clicking Clear shows a confirm dialog; Cancel aborts; Confirm clears for all players |
| 11 | Profane username is rejected at signup with an error message |
