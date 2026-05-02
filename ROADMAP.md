# FeynGame — Full Bug Fix & Feature Roadmap

## Context
FeynGame is a real-time multiplayer educational game (Feynman Technique) with: React/Vite frontend, Node.js/Socket.IO backend, LiveKit for audio, Supabase for auth/coins, and a shared whiteboard canvas. This plan covers 17 bugs + 11 features, organised into 5 sequential phases to keep the programmer's workload manageable and each phase shippable independently.

**Implement exactly in phase order.** Phase 1 fixes game-breaking multiplayer bugs that would undermine any cosmetic or feature work done first. Each phase is ~1–2 weeks of work.

---

## PHASE 1 — Critical Multiplayer & Game Logic Bugs
*These bugs break core gameplay. Fix before any UI or feature work.*

### Bug 3: Mic stays active after session ends
**Root cause:** `useAudio.js` cleanup only runs on component unmount. `localTrackRef.current` is muted (not stopped/unpublished) when `isExplainer` becomes false, and LiveKit's `room.disconnect()` doesn't always release the OS mic indicator synchronously.

**Files:** `client/src/hooks/useAudio.js`

**Fix:**
- In the second `useEffect` (line 79), when `isExplainer && micActive` is false, call `track.stop()` + `room.localParticipant.unpublishTrack(track)` and set `localTrackRef.current = null` — not just `mute()`.
- In the cleanup function of the first `useEffect` (line 66–76), before `r.disconnect()`, call `r.localParticipant.unpublishAllTracks()` and stop all local tracks via `r.localParticipant.trackPublications.forEach(pub => pub.track?.stop())`.
- Also stop any in-flight `getUserMedia` stream: wrap line 53–55 in a ref so the stream can be forcibly stopped on cleanup.

---

### Bug 4: Random code joins/creates a non-existent room + O/0 ambiguity
**Root cause (part A):** `server/index.js:249–251` — `join_room` handler auto-creates any room that doesn't exist. So typing gibberish code navigates to a new blank room.

**Root cause (part B):** Room code generator (`Math.random().toString(36).substring(2, 8).toUpperCase()`) can emit `O` and `0`.

**Files:** `server/index.js`, `client/src/pages/Home.jsx`, `client/src/pages/Lobby.jsx`

**Fix:**
1. **New server endpoint** — Add `GET /rooms/:roomId` that returns `{ exists: true, status }` or 404. Keep it lightweight (no auth required).
2. **Server `join_room` handler** — Remove auto-create. If the room doesn't exist, emit `join_error: { code: 'ROOM_NOT_FOUND' }` back to the socket only. Only `POST /rooms` should create rooms.
   - Exception: the host creating via `POST /rooms` then joining is fine.
3. **Client — Lobby.jsx** — On mount, call `GET /rooms/:roomId`. If 404, `navigate('/', { state: { error: 'Room not found' } })`. Show the error on the Home page.
4. **Room code charset fix** — Replace the room ID generator in `Home.jsx` (wherever it creates the random code for `POST /rooms`) with:
   ```js
   const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O, 0, I, 1
   const genCode = () => Array.from({ length: 6 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
   ```
5. **Server validation** — Update the `roomId` regex in `server/index.js:87` to also reject codes containing `O` or `0` if desired, but the charset fix at generation time is sufficient.

---

### Bug 7: Players duplicated on reconnect
**Root cause:** The singleton socket survives navigation, but if it briefly disconnects and reconnects (network hiccup during page transition), it gets a new `socket.id`. The server's `disconnect` handler removes the old record asynchronously — there's a race where the new `join_room` fires before the old player is removed, creating a duplicate.

**Files:** `server/index.js` (`join_room` handler, line 240), `client/src/hooks/useSocket.js`

**Fix — server:**
In `join_room`, before pushing a new player, scan for any existing player with the same `userId` (if authenticated) or same `name` AND no other active connection:
```js
// If userId is known, replace any stale record with same userId
if (socket.data.userId) {
  const staleIdx = room.players.findIndex(p => p.userId === socket.data.userId && p.id !== socket.id);
  if (staleIdx !== -1) room.players.splice(staleIdx, 1);
}
```
This ensures reconnecting players replace their stale record rather than duplicate.

**Fix — client:**
In `useSocket.js`, before emitting `join_room` (both on connect and on already-connected), emit `leave_room: { roomId }` if the socket is changing rooms. Add a `currentRoomId` ref to track which room the socket is currently joined to.

---

### Bug 9: Resizing window clears canvas contents (local client only)
**Root cause:** `Whiteboard.jsx:96–111` — `updateSize()` sets `canvas.width` and `canvas.height`, which **always clears the canvas** (HTML spec). The existing drawing is lost.

**Files:** `client/src/components/Whiteboard.jsx`

**Fix:** Before resizing, snapshot the canvas to an off-screen image and restore it after:
```js
const updateSize = () => {
  const rect = container.getBoundingClientRect();
  const newW = rect.width;
  const newH = rect.width * (9 / 16);
  if (newW === canvas.width && newH === canvas.height) return; // no-op
  // Snapshot
  const snapshot = canvas.toDataURL();
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#1e2e1e';
  ctx.fillRect(0, 0, newW, newH);
  // Restore scaled
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0, newW, newH);
  img.src = snapshot;
};
```
This scales the existing drawing to the new dimensions — no content is lost. Viewers' canvases are unaffected (they redraw from stroke events, not from resize).

---

### Bug 10: Different aspect ratios cut off board content
**Root cause:** The canvas container uses `flex: 1` and `width: 100%`, so different layouts give different canvas widths → different canvas heights (since `height = width * 9/16`). The canvas itself is fine (normalised 0–1 coords), but the container may be scrolled or visually clipped on shorter screens, hiding content drawn at high y values.

**Files:** `client/src/components/Whiteboard.jsx`, `client/src/pages/Game.jsx`

**Fix:**
- Wrap the Whiteboard in a container that uses `aspect-ratio: 16/9` CSS (or the JS equivalent `paddingBottom: '56.25%'` trick) so all players get the exact same viewport ratio.
- The canvas and container should never overflow — instead, the surrounding layout in `Game.jsx` should use `overflow-y: auto` on the sidebar and let the board area be fixed-aspect.
- In `Whiteboard.jsx`, add a `ResizeObserver` (preferred over `window.resize` listener) on the container to catch layout-driven size changes.

---

### Bug 11: Random/double score adding
**Root cause:** `server/index.js:415` — `room.roundScores[socket.id] = validScore` allows a viewer to re-submit and overwrite their score many times during a round. The average shifts every time, and if the score changes right before `endRound` calculates, the result is unpredictable.

**Files:** `server/index.js` (`submit_score` handler, line 406)

**Fix:** Lock score after first submission per player per round:
```js
socket.on('submit_score', ({ roomId, score }) => {
  ...
  if (room.roundScores.hasOwnProperty(socket.id)) return; // already voted
  room.roundScores[socket.id] = validScore;
  io.to(roomId).emit('room_state_update', room);
});
```
Also update the client UI (scoring buttons in `Game.jsx`) to disable all buttons after the player submits, showing a "Voted!" confirmation.

---

### Bug 12: Public rooms disappear after round 1 starts
**Root cause:** `server/index.js:131` — `GET /rooms` only returns rooms with `status === 'lobby'`. Once a game starts, rooms vanish from the list.

**Files:** `server/index.js`, `client/src/pages/Home.jsx`

**Fix:**
- Change server filter to also include `'playing'` and `'between_rounds'` rooms:
  ```js
  if (room.isPublic && room.status !== 'results') { ... }
  ```
- Add a `status` field to the returned room object so the client can label rooms as "In Progress".
- In `Home.jsx`, show an "In Progress" badge on those cards. A player joining a mid-game room gets added to `room.players` but sits as a spectator until the next round starts (server should not make them an explainer until `startNextRound` cycles to them).
- Add server guard in `start_game` handler: only count existing players at game start for `room.totalRounds`, not late joiners. Late joiners are appended to `room.players` but `room.totalRounds` is frozen.

---

### Bug 13: Host clicking "Return to Home" doesn't transfer host
**Root cause:** The socket singleton never disconnects on client-side navigation, so the server's `disconnect` handler (which contains the host transfer logic at line 437) never fires when the host navigates home via React Router.

**Files:** `server/index.js`, `client/src/pages/Results.jsx` (or wherever the return-home button is)

**Fix:**
- Add a `leave_room` socket event on the server:
  ```js
  socket.on('leave_room', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;
    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    socket.leave(roomId);
    if (room.players.length === 0) { deleteRoom(roomId); return; }
    if (player.isHost) room.players[0].isHost = true;
    io.to(roomId).emit('room_state_update', room);
  });
  ```
- In the client's "Return to Home" button handler, emit `leave_room` before calling `navigate('/')`.

---

### Bug 14: Players not kicked when host returns to home after game
**Root cause:** The host navigating home leaves other players stuck on the results screen with no mechanism to force them home.

**Files:** `server/index.js`, `client/src/pages/Results.jsx`, `client/src/hooks/useSocket.js`

**Fix:**
- When the host emits `leave_room` and `room.status === 'results'` and the host is leaving, server emits `room_dissolved` to all players before deleting the room:
  ```js
  if (player.isHost && room.status === 'results') {
    io.to(roomId).emit('room_dissolved');
    deleteRoom(roomId);
    return;
  }
  ```
- In the client (Results page and Game page), listen for `room_dissolved` and `navigate('/')`.
- Add the listener in `useSocket.js` so it's active regardless of which page the player is on.

---

### Bug 15: All players are ready by default after game ends
**Root cause:** `isReady` is set when players toggle it in the lobby and is never reset. The game loop never transitions back to 'lobby', so `isReady` stays `true` from the previous session. If the host somehow re-triggers `start_game` (or a new room is created from the same session), players appear ready.

**Files:** `server/gameLoop.js` (`startNextRound`), `server/index.js`

**Fix:**
- In `startNextRound`, when transitioning to `'results'`, reset all players' `isReady = false`:
  ```js
  room.players.forEach(p => { p.isReady = false; });
  ```
- This ensures if a "Play Again" flow is ever added, the lobby starts clean.
- Also add a guard to `start_game` handler: reject if any player's `isReady` is false (except for single-player testing scenarios).

---

### Bug 17: Avatar frame purchase fails
**Root cause:** The `purchaseFrame` action in `useUserStore.js` must send an `Authorization: Bearer <token>` header to `POST /api/purchase-frame`. If the Supabase session is expired or the store isn't passing the token correctly, the server returns 401.

**Files:** `client/src/store/useUserStore.js`, `server/index.js`

**Investigate first:**
1. Open browser DevTools → Network → filter for `purchase-frame`. Check the actual response (401, 400, 500?).
2. Verify `useUserStore`'s `purchaseFrame` action correctly gets the session via `supabase.auth.getSession()` and passes `session.access_token` in the Authorization header (same pattern as `handleDeleteAccount` in `SettingsModal.jsx:77–81`).
3. Check that `purchase_frame` Supabase RPC exists in the DB and `owned_frames` column is typed correctly (text[]).

**Fix:** Align `purchaseFrame` in `useUserStore.js` with the working `delete-account` call pattern — get a fresh session token, pass it as Bearer. If the RPC returns an owned_frames array, update both `profile.tokens` (coins) and `profile.ownedFrames` in the store so the UI refreshes without a page reload.

---

### Feature 10: Refresh button for public rooms (trivial — do in Phase 1)
**Files:** `client/src/pages/Home.jsx`

Add a "Refresh" button with a spinning icon (Lucide: `RefreshCw`) next to the "Public Rooms" heading. On click: call the existing `fetchPublicRooms()` function and show a 1s disabled+spinning state to prevent spam. The existing 5s auto-poll stays.

---

## PHASE 2 — UI / UX Polish
*After Phase 1, the game works correctly. Now make it look and feel good.*

### Bug 1: Volume slider fill not aligned with track
**Root cause:** `SettingsModal.jsx:328–333` — The yellow fill `<div>` is positioned absolutely inside a relative container, `top: 50%` with `translateY(-50%)`. On some browsers, the native range input has internal padding that shifts the track away from the element's visual center, misaligning the fill.

**Files:** `client/src/components/SettingsModal.jsx`

**Fix:** Replace the native `<input type="range">` + overlay div with a fully custom slider:
- A `<div>` track with `cursor: pointer` and `onPointerDown/Move/Up` handlers that compute the value from pointer position.
- The fill is a child `<div>` with `width: {volume}%`, no absolute positioning needed.
- This eliminates all browser-specific track alignment issues and gives full styling control.

---

### Bug 8: Textbox resize not reflected on other players' screens
**Root cause:** `Whiteboard.jsx:281` — textarea has `resize: both` but only `text` is synced via `textbox:update`. Width/height changes are never emitted.

**Files:** `client/src/components/Whiteboard.jsx`, `server/index.js`

**Fix:**
1. Store `width` and `height` in each textbox object (server-side in `room.textBoxes`, client-side in `textBoxes` state).
2. On the textarea, add an `onMouseUp` handler that reads `e.target.offsetWidth/offsetHeight` and emits `textbox:resize: { roomId, id, width, height }`.
3. Server handles `textbox:resize`: updates `room.textBoxes` record and broadcasts to others.
4. Viewer side: renders the textbox div with the stored `width`/`height` instead of `minWidth/maxWidth`.

---

### Bugs 2, 5, 6: Design overhaul + font change
**Root cause:** Inline style objects scattered across all components create inconsistency. Font is Playfair Display + Inter — acceptable but not distinctive.

**Files:** `client/src/index.css`, `client/src/App.css`, all component files

**Font:** Switch body font from `Inter` to `DM Sans` (Google Fonts) — warmer and more playful while remaining readable. Keep `Space Mono` for numbers/data. Replace `Playfair Display` with `DM Serif Display` for headings.

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=Space+Mono:wght@400;700&display=swap');
```

**Design improvements (specific):**
- **Home page:** Replace the card grid with a cleaner layout. Room cards should show player avatars (DiceBear thumbs), not just numbers. The "Join by Code" input should be larger and more prominent (it's the primary action for most users).
- **Lobby:** Player list should show avatars. Ready state should use a green glow/ring on the avatar, not just text.
- **Game:** The toolbar (pen, eraser, color, size) should be a floating pill at the bottom of the whiteboard, not inline. Score buttons (1–5) should be larger and more tactile.
- **Results:** Add confetti animation (use `canvas-confetti` npm package — tiny, no React dependency needed) for the winner.
- **General:** Reduce use of glass-morphism `backdrop-filter: blur()` — it's overused and makes the UI feel generic. Use solid panels with subtle borders instead. Limit blur to overlays/modals only.
- Move all repeated inline styles to named CSS classes in `index.css`/`App.css` using the existing CSS variable system. Don't introduce Tailwind.

---

### Bug 16: Remove clock tick and done-button countdown sounds
**Root cause:** `Game.jsx:41` calls `play('TICK')` every second when `time <= 10`. `Game.jsx:47` calls `play('TICK')` on `done_countdown_start`.

**Files:** `client/src/pages/Game.jsx`, `client/src/hooks/useSounds.js`

**Fix:** In `Game.jsx`, remove `play('TICK')` from both the `onTimerSync` callback (line 41) and the `onDoneStart` callback (line 47). Keep `play('WHOOSH')` (round start) and `play('BELL')` (between rounds). Delete the `TICK` entry from `SOUNDS` in `useSounds.js` entirely.

---

## PHASE 3 — Drawing Experience Overhaul
*Rewrite the whiteboard with a richer toolset. Pure canvas, no new libraries.*

### Feature 1: Smoother drawing (bezier curve smoothing)
**Files:** `client/src/components/Whiteboard.jsx`

**Approach:**
- Track the previous point in a ref (`prevPoint = useRef(null)`).
- In `draw()`, instead of `ctx.lineTo(x, y)` + `ctx.stroke()`, compute the midpoint and use `ctx.quadraticCurveTo(prevX, prevY, midX, midY)`.
- Emit strokes as before (normalised x/y). Viewers replay with the same quadratic curve logic.
- Add a small stroke buffer (10ms debounce on `emitStroke`) to reduce socket events without visible latency.

---

### Feature 2: Shapes and icons toolbar
**Files:** `client/src/components/Whiteboard.jsx`, `server/index.js`

**New tools to add:** Line, Rectangle (outline), Circle (outline), Arrow.

**Approach:**
- Add `tool` options: `'line'`, `'rect'`, `'circle'`, `'arrow'` alongside existing `'pen'`, `'eraser'`, `'text'`.
- On `mousedown`: record `shapeStart = {x, y}`.
- On `mousemove` while drawing: clear to last saved snapshot + draw the shape preview (use an off-screen canvas snapshot saved at `mousedown` to avoid permanent marks while dragging).
- On `mouseup`: finalise the shape onto the main canvas. Emit a `shape:draw` socket event with `{ tool, x1, y1, x2, y2, color, size }`.
- Server: add `socket.on('shape:draw', ...)` — validate and broadcast `shape:replay` (same pattern as `stroke:draw`/`stroke:replay`).
- Viewer side: render shapes from `shape:replay` events using the same geometry math.

---

### Feature 3: Ink elasticity slider (Concepts-inspired)
**Files:** `client/src/components/Whiteboard.jsx`, toolbar UI

**Approach:** Implement exponential smoothing (EMA) on pointer positions:

```js
// elasticity: 0 = raw, 1 = very smooth
const smooth = (prev, curr, elasticity) => prev + (curr - prev) * (1 - elasticity);
```

- Add an `elasticity` state (0.0–0.8, default 0.3).
- In the draw handler, smooth the x/y before drawing/emitting:
  ```js
  smoothX = smooth(smoothX, rawX, elasticity);
  smoothY = smooth(smoothY, rawY, elasticity);
  ```
- Add a slider in the toolbar labelled "Ink Flow" with extremes "Sharp" → "Smooth".
- The smoothed coords are emitted to the server, so all viewers see the same smoothed path.

---

### Feature 4: Color wheel
**Files:** `client/src/components/Whiteboard.jsx`

**Approach:** Replace the 4 hardcoded color buttons with a color wheel rendered on a small `<canvas>`:
- Draw an HSL wheel using `createConicGradient` (Chrome 99+) or a pixel-by-pixel loop for compatibility.
- Add a lightness strip alongside the wheel.
- On click/drag on the wheel canvas, compute HSL from canvas pixel coords and convert to hex.
- Show the selected color as a swatch next to the toolbar.
- The selected color is the existing `color` state — no socket changes needed.

---

### Feature 11: Drag textboxes
**Files:** `client/src/components/Whiteboard.jsx`, `server/index.js`

**Approach:**
- On each textbox container div, add `onPointerDown` → start tracking drag.
- On `onPointerMove` (with `setPointerCapture`), update `tb.x` and `tb.y` locally and emit `textbox:move: { roomId, id, x, y }` (throttled to 60fps).
- Server adds `socket.on('textbox:move', ...)` — updates `room.textBoxes` record, broadcasts to others.
- Viewer side applies the x/y update immediately on `textbox:move` event (no room state update needed — real-time speed matters here).
- Distinguish drag from text-editing: only drag when `pointerdown` is on the textbox border/handle, not the textarea itself.

---

## PHASE 4 — Account & Social Features

### Feature 5: Account customisation — new /profile page
**Files:** `client/src/App.jsx` (add route), new `client/src/pages/Profile.jsx`, `server/index.js`, Supabase

**New route:** `/profile`

**Profile page sections:**
1. **Avatar** — show current DiceBear avatar. Add a "Regenerate" button (changes seed, updates `user_metadata.avatarSeed`). Optional: type a custom seed.
2. **Display name / username** — `<input>` pre-filled with current username. On save: call `supabase.auth.updateUser({ data: { username: newName } })`.
3. **Email** — show current email, "Change email" button (opens a confirm flow, sends verification to new email via `supabase.auth.updateUser({ email: newEmail })`).
4. **Game stats** — total games played, average score, total coins earned (pull from Supabase `profiles` table).
5. **Owned frames** — thumbnail grid (same as Shop but without buy buttons).

**Navigation:** Add a "Profile" link in `ProfileHUD.jsx` dropdown alongside Settings and Logout.

---

### Feature 6: Topic voting (private rooms only)
**Files:** `server/index.js`, `server/gameLoop.js`, `client/src/pages/Game.jsx`

**Flow:**
1. At the start of each round (before `room.status = 'playing'`), server picks 3 topic candidates using `getRandomWord()` and emits `topic_vote_start: { candidates, duration: 15 }`.
2. `room.status = 'voting'` for 15 seconds.
3. Clients show a voting overlay with 3 topic cards (show subject/difficulty only — don't reveal the term). Players click one.
4. Client emits `vote_topic: { roomId, candidateIndex }`.
5. Server accumulates votes in `room.voteResults = { 0: 0, 1: 0, 2: 0 }` — one vote per `socket.id`.
6. After 15s, server picks the candidate with the most votes (tie-break: random), sets it as `room.topic`, transitions to `'playing'`.

**Guard:** Only apply this flow when `room.isPublic === false`.

---

### Feature 7: Custom topic creation (private rooms only)
**Files:** `client/src/pages/Lobby.jsx`, `server/index.js`

**In Lobby (host view):**
- Add a "Custom Topics" section below the subject picker.
- Text input + "Add" button. Host can add up to 20 custom topics.
- Topics appear as a list with delete buttons.
- On add/remove: emit `update_custom_topics: { roomId, topics: string[] }`.

**Server:**
- Store `room.customTopics = []` in the room object.
- Handle `update_custom_topics` (host-only, lobby-only).
- In `gameLoop.js`, when `room.customTopics.length > 0`, draw from `customTopics` with 50% probability (or 100% if host prefers — make this a toggle).
- Custom topics have no subject/subtopic — display "Custom" in the topic card.

**Guard:** Only available when `room.isPublic === false`.

---

### Feature 8: Topic difficulty levels + coin multiplier
**Files:** `server/topics.js`, `server/wordbank.json`, `server/gameLoop.js`

**Approach:**
- Add a `difficulty` field (1 = easy, 2 = medium, 3 = hard) to each entry in `wordbank.json`, or maintain a separate `difficulty.json` map from term → difficulty.
- `getRandomWord` returns `{ subject, subtopic, term, difficulty }`.
- `COINS_PER_POINT` becomes `COINS_PER_POINT * difficulty` in `awardCoinsForRoom`.
- In the Lobby, host can set a "Difficulty preference" toggle: Any / Medium+ / Hard only. This filters `getRandomWord` candidates.
- Display difficulty in the topic reveal popup (e.g., ⭐⭐⭐ for hard) and in the results screen.

---

## PHASE 5 — Onboarding & Discoverability

### Feature 9: Onboarding and model explanations
**Files:** new `client/src/components/OnboardingModal.jsx`, `client/src/pages/Home.jsx`

**Approach:**
- On first visit (check `localStorage.getItem('onboarded')`), show a 4-step modal:
  1. "What is FeynGame?" — the Feynman Technique in one sentence + illustration.
  2. "As Explainer" — draw, talk, use the whiteboard. You get scored.
  3. "As Viewer" — watch and rate the explanation 1–5 stars.
  4. "Earn Coins" — scores earn coins, spend them on avatar frames.
- Navigation: Next/Back/Skip buttons. On close or finish: `localStorage.setItem('onboarded', '1')`.
- Add a "?" help button in `ProfileHUD.jsx` that re-opens the modal.

---

## Verification Checklist

After each phase, verify these scenarios before moving on:

**Phase 1:**
- [ ] Type a fake room code → redirected to home with "Room not found" message
- [ ] Room codes never contain O, 0, I, or 1
- [ ] Join a room, refresh the page → only one player record appears (no duplicates)
- [ ] Draw on the whiteboard, resize the browser window → drawing persists
- [ ] Submit a score → buttons disable; submitting again does nothing
- [ ] Create a public room, start the game → room still appears in Home as "In Progress"
- [ ] Host clicks Return to Home on results → all other players are sent home automatically
- [ ] After game ends, all players show `isReady: false`
- [ ] Purchase a frame → coins deduct, frame appears as owned, UI updates immediately
- [ ] Refresh button on Home page triggers an immediate room list update

**Phase 2:**
- [ ] Volume slider fill tracks the thumb position exactly in Chrome, Firefox, Safari
- [ ] No clock ticking sound during final 10 seconds
- [ ] No countdown sound when Done button is pressed
- [ ] Font renders correctly on Windows and Mac
- [ ] Textbox resize on explainer's screen is reflected on viewer's screen

**Phase 3:**
- [ ] Drawing looks smooth (no jagged corners on curves)
- [ ] Rectangle/circle/line tools work for explainer and replay correctly for viewers
- [ ] Moving the elasticity slider changes ink smoothing visibly
- [ ] Color wheel updates the drawing color; viewers see the correct color
- [ ] Textboxes can be dragged and viewers see the new position in real-time

**Phase 4:**
- [ ] Profile page: username change persists after logout/login
- [ ] Voting: in a private room, 3 topics appear before each round; most-voted is used
- [ ] Custom topics: host adds topics in lobby; they appear during the game
- [ ] Hard topics yield more coins than easy topics on the results screen

**Phase 5:**
- [ ] First-time visitor sees the onboarding modal
- [ ] Returning visitor does not see it
- [ ] "?" button re-opens onboarding at any time

---

## Critical Files Reference

| File | Relevance |
|------|-----------|
| `client/src/components/Whiteboard.jsx` | Bugs 8, 9, 10; Features 1, 2, 3, 4, 11 |
| `client/src/hooks/useAudio.js` | Bug 3 (mic leak) |
| `client/src/hooks/useSocket.js` | Bug 7 (duplicates), Bugs 13/14 (leave_room) |
| `client/src/hooks/useSounds.js` | Bug 16 (sounds) |
| `client/src/pages/Game.jsx` | Bug 11, 16; Feature 6 (voting UI) |
| `client/src/pages/Home.jsx` | Bugs 4, 12; Feature 10 |
| `client/src/pages/Lobby.jsx` | Bugs 4, 15; Feature 7 |
| `client/src/pages/Results.jsx` | Bug 14 |
| `client/src/components/SettingsModal.jsx` | Bugs 1, 17 |
| `client/src/store/useUserStore.js` | Bug 17 (purchase token) |
| `server/index.js` | Bugs 4, 7, 11, 12, 13, 14; Features 6, 7 |
| `server/gameLoop.js` | Bug 15; Feature 8 |
| `server/topics.js` + `wordbank.json` | Feature 8 (difficulty) |
| `client/src/index.css` | Bugs 2, 5, 6 (design/font) |
