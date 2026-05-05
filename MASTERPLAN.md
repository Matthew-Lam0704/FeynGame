# MASTERPLAN

The plan to take this from a multiplayer drawing party game into a genuinely revolutionary study tool for students. Written 2026-05-05.

---

## 1. North star — what this app is *for*

The current app is "Pictionary, but you explain instead of draw." That's a clever mechanic but it's a *party game with educational flavor*, not a learning tool. The Feynman Technique is one of the most evidence-backed study methods that exists ("if you can't explain it simply, you don't understand it"), and almost no edtech product has built around it seriously.

**Reframe the product** around three modes that share the same whiteboard + voice engine:

| Mode | Audience | Core loop |
| --- | --- | --- |
| **Study Hall** (the current multiplayer mode, polished) | Friends / study groups | Take turns explaining; peers score; coins for good explanations |
| **Solo Study** *(new)* | A student alone with a syllabus | Pick a topic from your course; explain it on the board with voice; AI transcribes + grades the explanation against the concept's expected facts; surfaces gaps; schedules a review |
| **Classroom** *(later — the savemyexams/Skool angle)* | A tutor + their students | Tutor creates a private room, assigns topics from a curriculum bank, watches/listens to explanations, leaves feedback. Recordings persist. |

The existing whiteboard, voice, and scoring infrastructure powers all three. Solo Study is the killer feature — it converts the social mechanic into a daily study habit, and it's defensible because the AI Feynman analysis is hard to copy well.

**Stakeholder framing.** Students don't show up for "a fun voice game" twice. They show up for the thing that makes them feel like they actually learned what they needed to learn for Friday's test. Every design and feature decision below is filtered through that.

---

## 2. The rename

`FeynGame` is dead. `Feynman Club` is the better internal name but doesn't trademark well, ages oddly outside academic circles, and limits the brand if we expand into non-physics topics. Three real candidates, ranked:

1. **Chalkmate** — chalkboard + classmate. One word, no taken `.com` problem at this size, immediately legible, plays on the dark-academic aesthetic without being *about* Feynman specifically. **My pick.**
2. **Lectern** — premium, academic, single noun. Risk: feels formal/lecturer-leaning rather than peer-leaning, and the existing UI is more "study group" than "podium."
3. **Recall** — memory-science term, ties to the active-recall positioning, very brandable. Risk: generic in ML/AI vocabulary, harder to defend.

A 4th option worth raising: **keep "Feynman Club" as the in-product brand** but wrap it inside a parent product called Chalkmate or similar — so the multiplayer mode is "Feynman Club" inside the Chalkmate platform. That preserves what's already a charming name in-app while letting the product breathe.

**Recommendation:** Chalkmate as the product name. Drop "Feynman Club" everywhere except possibly as the name of Study Hall mode (which keeps the cultural anchor for users who already know it).

Surfaces that need updating (every reference logged so the rename is mechanical):

- [client/index.html](client/index.html) — `<title>client</title>` is currently the **default Vite placeholder**, not even the old name.
- [client/src/pages/Auth.jsx:148](client/src/pages/Auth.jsx) — hero
- [client/src/pages/Home.jsx:56](client/src/pages/Home.jsx) — hero
- [client/src/pages/Lobby.jsx:85](client/src/pages/Lobby.jsx) — page title says "Study Hall"; can stay as a mode name
- [client/src/components/OnboardingModal.jsx:7-8](client/src/components/OnboardingModal.jsx) — welcome copy
- The tagline `"explain it simply. win."` should change. Suggested: `"Learn it by teaching it."` (specific, benefit-driven, no jargon).
- `package.json` `name: "feynman-club"` and `client/package.json name: "client"`.

---

## 3. Phase 0 — Critical bug fixes (1–2 weeks)

These are blockers for being taken seriously by any user. Do them first; everything else builds on a stable base.

### 3.1 Whiteboard correctness

The whiteboard is the product. Three of the worst bugs all live here.

**Bug: resizing the window deletes board content** ([client/src/components/Whiteboard.jsx:155-171](client/src/components/Whiteboard.jsx))
The current model snapshots the canvas to a dataURL on resize, then `drawImage`s it back at the new dimensions. This (a) stretches content rather than preserving normalized positions and (b) silently discards content if the snapshot fails or the new aspect ratio differs.

**Fix:** stop treating the canvas pixel buffer as the source of truth. Maintain a per-room `strokes` vector in a ref — every stroke is `{points: [{x,y}], color, size, tool}` in normalized [0,1] coords. On every resize, clear the canvas and replay the entire vector. Server should also persist the same vector on the room object and replay it to late joiners (same problem applies — joining mid-game shows blank board).

```
[client] Whiteboard.jsx          → stroke vector in useRef, redraw on resize/mount
[client] Whiteboard.jsx          → on remote stroke, append to vector + draw the new segment
[server] rooms.js + index.js     → room.strokes = []; replay on join_room
[server] gameLoop.js             → clear room.strokes between rounds
```

**Bug: wider screens cut off taller players' bottom content**
The container has `aspectRatio: '16/9'`, so once both clients have a 16:9 area, normalized coords *should* line up. The cut-off is because there's no max-height clamp — on a tall portrait window, the container can be taller than the visible area. The whiteboard needs to be rendered into a strict letterboxed/pillarboxed 16:9 box that `fits` inside the available space, not an `aspectRatio`-only constraint.

**Fix:** wrap canvas in a flex container with `min(100%, calc(100vh * 16/9))` width and equivalent height clamp. Add visible "off-board" margins outside the 16:9 area so users see the actual drawing region.

**Bug: textbox resize doesn't sync** ([client/src/components/Whiteboard.jsx:460-463](client/src/components/Whiteboard.jsx))
Resize delta is only emitted on `onMouseUp`. Other clients see a snap-jump.

**Fix:** throttle a `textbox:update` emit at ~30 Hz during the resize gesture. Server already accepts `width`/`height` in the handler — no schema change.

**Bug: "Be able to drag textboxes around"**
Per the audit, dragging *is* implemented (Whiteboard.jsx:209-237). The bug report likely means *the affordance is invisible or the drag handle is too small.* Audit and verify; if it works, expose a clearer cursor + handle UI.

### 3.2 Drawing engine upgrade

Even after the resize fix, the drawing feels rudimentary. The current model uses raw point-to-point lines with EMA smoothing and an elasticity slider that already exists ([client/src/pages/Game.jsx:484-497](client/src/pages/Game.jsx)) — that's a great foundation, but the rendering is `lineTo` per point which produces visible polygonal segments at low frame rates.

**Upgrade:** replay strokes as Catmull-Rom splines (or quadratic Béziers, which the code already partly uses at line 308 — extend it through the whole stroke, not just the last point). Add taper-on-velocity (faster strokes get thinner) for a chalk feel. Cache rendered strokes to an offscreen canvas so the live stroke is the only thing repainted per frame.

This is also where the **Concepts-style elasticity slider**, **shapes/icons toolbar**, and **proper color wheel** belong:

- The `ColorWheel.jsx` component already exists ([client/src/components/ColorWheel.jsx](client/src/components/ColorWheel.jsx)) but is not wired into the whiteboard. Hook it up to the pen color state and remove the existing color buttons.
- Shapes: rectangle, circle, line, arrow. Server already has a `shape:draw` socket event ([server/index.js:457](server/index.js)) that's plumbed but unused on the toolbar. Add UI buttons.
- Icons: small sticker library — checkmarks, arrows, brackets, equals, ≈, ∝. These are valuable for math/science explanations specifically. Use lucide for the icon source, place them as locked-position elements (similar to textboxes).

### 3.3 Audio / mic lifecycle

**Bug: mic still in use after the session ended**
The audit found the LiveKit cleanup looks robust on paper — but the symptom (browser keeps showing the mic indicator) usually means one of:
1. The initial `getUserMedia` permission stream isn't fully torn down — its tracks are stopped but if `getUserMedia` is called multiple times (once for permission probe, once for publishing), only one of those streams gets cleaned up.
2. LiveKit's `localParticipant.audioTrackPublications` returns publications, but stopping the underlying `MediaStreamTrack` requires walking each publication's `track.mediaStreamTrack` and calling `.stop()` explicitly — the `track.stop()` in livekit-client doesn't always release the OS-level stream.
3. The cleanup runs but the cached `Audio` elements from `useSounds.js` have somehow captured a stream (unlikely but worth ruling out).

**Fix:** introduce a `forceReleaseMicrophone()` utility that:
1. Walks every active local participant's audio publication and calls `track.mediaStreamTrack.stop()` on the underlying track.
2. Stops the initial-permission stream's tracks.
3. Calls `room.disconnect(true)` (the `true` flag ensures everything is torn down).
4. Sets a global `MediaStream` registry guard that warns in dev if any track is still live after cleanup.

Manually verify by checking `navigator.mediaDevices.getUserMedia()` track states after navigation.

### 3.4 Server / socket bugs

**Bug: users get duplicated when they reconnect** ([server/index.js:307-314](server/index.js))
The stale-record cleanup checks `socket.data.userId` — but `register_user` is fire-and-forget from the client and may not have completed before `join_room`. For authenticated users, joining without a registered userId leaves a fresh ghost and an old ghost.

**Fix:** make `join_room` for authenticated users accept the access token directly and verify it server-side before adding a player record. Two changes:
1. Client sends `{ roomId, playerName, accessToken? }` to `join_room`.
2. Server, if `accessToken` is present, calls `supabaseAdmin.auth.getUser(token)` first and uses that userId for stale-record matching. No more race.

**Bug: typing a random code joins a non-existent room**
[client/src/pages/Home.jsx](client/src/pages/Home.jsx) navigates blindly. The server eventually emits `join_error: ROOM_NOT_FOUND`, but the user sees a flash of the lobby first.

**Fix:** pre-flight `GET /rooms/:roomId` from Home before navigating. Show inline "Room not found" if 404. Same check before nav from any deeplink.

**Bug: don't use `O` or `0` in room codes**
[client/src/components/CreateRoomModal.jsx:58-62](client/src/components/CreateRoomModal.jsx) — confirmed the code generation already excludes `0`, `O`, `1`, `I`. The user's bug report is wrong; verify and close.

**Bug: public rooms vanish once a round starts** ([server/index.js:145](server/index.js))
The filter is `room.isPublic && room.status !== 'results'` but the homepage receives only rooms in `'lobby'` because most go straight to `'selecting_topic'` after start. Add a server-side concept of *joinable*: `room.isPublic && room.status !== 'results' && room.players.length < room.maxPlayers && room.allowMidJoin`. Default `allowMidJoin: true` for public rooms.

The home page also needs:
- A **manual refresh button** (already in the bug list).
- A real-time push: when a public room is created/destroyed, broadcast to a `homepage` socket channel so the list updates without polling. Polling every 5s wastes everyone's bandwidth.

**Bug: host returning home doesn't transfer host** ([server/index.js:263-288](server/index.js))
Current behavior: if the host leaves while in `'results'`, room dissolves entirely; if outside results, host transfers to `room.players[0]`. The user wants:
- When the *host* clicks "Return Home" *from results*: host transfers to a remaining player (or dissolve if no one's left).
- When *any* player clicks "Return Home" after game ends: they're kicked from the room (currently they remain on the page seeing a stale state).

**Fix:** add a `'lobby_after_game'` state. On `leave_room`:
- Always kick the leaver from the room and clear their socket subscription.
- If they were host and others remain, promote next player.
- Only delete the room when `players.length === 0`.

**Bug: all players ready by default after game ends**
[server/gameLoop.js:60](server/gameLoop.js) already sets `isReady = false` when transitioning to results, so the bug must be: when the room transitions back to `'lobby'` via the rejoin path ([server/index.js:330-341](server/index.js)), `isReady` is reset only for the rejoiner — but other players' state had `isReady` left from before the round started, which was `true` (they had to be ready to start). 

**Fix:** reset `isReady = false` on every player when the room *first* enters results, and additionally when transitioning back to `'lobby'` from `'lobby_after_game'`. Block `start_game` until all are explicitly ready again.

**Bug: random scores added sometimes**
Two likely causes:
1. The score ranges check (`1..5`) currently uses `Number.isInteger`, but if a client sends `2.0` from a slider, that passes — fine. But if it sends `0` or `6`, it's silently dropped, leaving a score of `undefined` in `room.roundScores`. `Object.values()` then produces a `NaN` average.
2. Late submissions (after `endRound` fires) hit a different room state and may mutate `roundScores` of the *next* round.

**Fix:** validate and clamp on the server; when entering `between_rounds`, snapshot `roundScores` into the explainer's score record immediately and *clear* the dictionary. Late submissions then have nothing to corrupt. Add a per-round `roundId` and reject submissions whose `roundId` doesn't match.

### 3.5 Settings, frames, sounds

**Bug: volume slider not in line** ([client/src/components/SettingsModal.jsx:321](client/src/components/SettingsModal.jsx) wraps [client/src/components/VolumeSlider.jsx](client/src/components/VolumeSlider.jsx))
The slider is custom-built with absolute-positioned thumb. Replace with a styled native `<input type=range>` — better accessibility, fewer alignment bugs, smaller code surface. The chalk theme can be applied via `::-webkit-slider-thumb` and `::-moz-range-thumb`.

**Bug: purchase fails for avatar frames** ([server/index.js:179-216](server/index.js))
Code path is correct on the surface. Most likely failure modes, in order of probability:
1. `SUPABASE_SERVICE_ROLE_KEY` is missing in the deployed environment → falls through to 503. Verify Railway has it set.
2. `purchase_frame` RPC isn't deployed to the Supabase project (migration `002_profile_functions.sql` is applied manually). Run a `select proname from pg_proc where proname='purchase_frame'` to confirm.
3. The `awarded_frames` text[] column is empty for users who signed up before migration 001 was applied; the trigger should backfill them, but if the trigger fired before this column was added, those users are broken.

**Fix:** add an `/api/health/purchase` debug endpoint that runs the same code path with a `dry_run: true` flag. Return clear diagnostic messages instead of generic "Purchase failed."

**Bug: remove the clock and "done" countdown sounds**
[client/src/hooks/useSounds.js](client/src/hooks/useSounds.js) — remove the TICK and BELL plays. Keep CHALK (drawing) and WHOOSH (transitions) — both add to the feel without nagging.

### 3.6 Phase 0 acceptance

After Phase 0:
- The whiteboard never loses content for any reason short of `clear`.
- Resizing, joining mid-game, and switching tabs all preserve drawings.
- Reconnecting users never duplicate.
- Mic indicator goes away when leaving a session.
- Public rooms list refreshes manually and shows in-progress joinable rooms.
- Frames purchase works against the deployed Supabase.

---

## 4. Phase 1 — Visual & UX overhaul (2–3 weeks)

The current visual system has good *bones* (color tokens, glass panels, dark-academic palette) and the wrong *details* (scattered spacing, mixed motion systems, generic empty states, no chalk handwriting font). Don't rip it up — **systematize it**.

### 4.1 Design system foundation

Build before redesigning any page. Net new file: `client/src/styles/tokens.css`.

| Token family | What to add | Why |
| --- | --- | --- |
| Spacing | `--space-1` through `--space-12` on a 4px grid | Replaces the ~50 hard-coded paddings/margins flagged in the audit |
| Typography | Type scale `--text-xs/sm/md/lg/xl/2xl/3xl/4xl` with paired line-height | Eliminates the 15-different-font-size sprawl |
| Radius | `--radius-sm/md/lg/xl/full` | Replaces the 4/6/8/10/12/16/20/24 spread |
| Motion | `--ease-soft`, `--ease-spring`, `--duration-fast/med/slow` | One animation language across CSS and Framer |
| Elevation | `--shadow-1` through `--shadow-4` (already partly there) | Keep, extend |

**Add a fourth font: a chalk handwriting display face.** The audit nailed this — without it, the chalkboard aesthetic is implied but never delivered. Candidates:
- **Caveat** (free Google Font, highly legible, friendly)
- **Patrick Hand** (more traditional handwriting)
- **Indie Flower** (more playful, riskier for an academic product)

Use it for:
- Hero titles and modal headings (replacing DM Serif Display in those spots)
- The room code display
- Topic word reveal in-game
- "Time's up!" and round transitions

DM Sans stays for body. DM Serif Display is redundant once we have chalk + sans — drop it.

### 4.2 Component primitives

Build these once and replace per-page custom versions:

- **`<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" loading>`** — the audit found buttons are individually overridden across every page. One component kills that.
- **`<Modal>`** — three modals today have three different shells. Unify with `AnimatePresence` for enter/exit, blur backdrop, focus trap, esc-to-close.
- **`<Input>` / `<Select>` / `<Slider>`** — chalk-themed form controls with consistent focus rings, error states, leading/trailing icons.
- **`<EmptyState>`** — illustration slot, headline, subline, CTA. Replaces the lifeless "No public rooms currently available." text.
- **`<Card>`** — chalk-bordered container with optional header, used for player cards, public-room rows, results rows.

### 4.3 Page-by-page redesign brief

**Auth** ([client/src/pages/Auth.jsx](client/src/pages/Auth.jsx))
Already the most polished page. Refresh the input visuals (chalk-style underlines instead of bordered boxes), introduce the chalk display font for the hero, replace generic OAuth buttons with custom-styled ones that fit the theme. Add a small animated chalk-dust particle effect behind the auth card on mount.

**Home (rebrand to "Lobby" / "Library")** ([client/src/pages/Home.jsx](client/src/pages/Home.jsx))
The three-column grid (Create / Join / Public) is fine structurally. Make:
- The "Create Room" card visually dominant (larger, primary color, prominent CTA), not equally weighted with Join.
- The public-rooms list a **live ticker** with player counts that animate when they change, topic tags as colored chips, and a "Join now" button on hover — not bare list items.
- Add a fourth card: **Solo Study** (greyed out / "coming soon" if it's not built yet, but signal the direction).
- Empty state: a chalk illustration of an empty classroom, with "Be the first one in. Start a room." CTA.

**Lobby (Study Hall)** ([client/src/pages/Lobby.jsx](client/src/pages/Lobby.jsx))
- Redesign player cards as podiums with the avatar and frame visible at a real size, ready badge as a chalk tick that draws itself in.
- Host settings panel: replace bare `<select>` dropdowns with custom segmented controls and dials. Difficulty selection is a major one — visualize it as `EASY (1×) / NORMAL (1.5×) / HARD (2×)` with the multiplier shown.
- Room code display: keep the dashed pill but make it clickable-to-copy with a satisfying chalk-write copy confirmation animation.

**Game** ([client/src/pages/Game.jsx](client/src/pages/Game.jsx))
- The whiteboard takes ~70% of the screen; tools collapse into a floating dock, not a fixed sidebar.
- Topic reveal animates: the chalk display font writes the word on screen, with a soft tone (no clock tick).
- Score voting: replace the 1–5 buttons with a star-row that fills in when you tap, plus an optional one-line written feedback field saved server-side and shown to the explainer at the end.
- Color-code each player's strokes by their avatar's accent color so collaborative drawings reveal who drew what.

**Results** ([client/src/pages/Results.jsx](client/src/pages/Results.jsx))
- Animated leaderboard reveal — third place first, second next, then a longer pause before the winner. Confetti only on winner reveal.
- Per-player cards show: avg score, total points, coins earned, the topic they explained best on. Replaces text-dump.
- "Play again" and "Return home" CTAs are equal-weighted; "Play again" puts everyone back in `'lobby_after_game'` with `isReady = false`.

**Profile** ([client/src/pages/Profile.jsx](client/src/pages/Profile.jsx))
- Editable username (currently read-only — the bug list calls this out).
- Editable display name (separate from username).
- Avatar customization moves *here*, away from SettingsModal — frames, future hair/face options live in one consistent profile screen.
- Stats become visual: progress ring for "explanations given," bar chart of per-topic average scores, coins-over-time sparkline.
- Add an account section: change email, change password, delete account.

**SettingsModal** ([client/src/components/SettingsModal.jsx](client/src/components/SettingsModal.jsx))
Shrink scope. Settings is for: audio devices, master volume, notifications, theme. Move the frame shop to its own "Shop" page (linked from Profile). Move the "manage account" pane to Profile's account section. SettingsModal becomes a small focused dialog instead of a 555-line tabbed monster.

**OnboardingModal** ([client/src/components/OnboardingModal.jsx](client/src/components/OnboardingModal.jsx))
Currently four slides of static text. Rebuild as an interactive 3-step tour:
1. **Watch a demo round** — a 30-second sped-up sample game plays on the avatar customizer screen.
2. **Pick your starter avatar** — quick customize (skin tone, hair, frame from owned).
3. **Try a 60-second practice round** — explain "photosynthesis" or similar with the AI as your audience. This converts onboarding into actual value delivery in the first 90 seconds.

### 4.4 Motion system

Standardize on Framer for *interactive* motion (modals, page transitions, hovers, state changes); keep CSS for ambient / decorative motion (chalk dust, idle pulses). Concrete rules:
- All modals use `AnimatePresence` with a 200ms fade + scale-from-0.95 enter, 150ms exit.
- All buttons get `whileTap: { scale: 0.97 }` and a CSS-driven hover state — Framer for tactile, CSS for the rest.
- Page transitions: 250ms fade-cross between routes (wrap routes in `AnimatePresence` in `App.jsx`).
- Score submission: stars fill with spring; subtotal counter ticks up to the new value.

---

## 5. Phase 2 — The features that make this revolutionary (4–6 weeks)

This is where Chalkmate becomes a study tool, not just a polished party game.

### 5.1 AI Feynman Analysis (the killer feature)

When the explainer talks (and draws), capture audio → transcribe → analyze the explanation against the canonical concept and return a structured Feynman score: clarity, completeness, accuracy, and *gaps*.

**Architecture:**
1. **Capture.** During a round, LiveKit already streams the explainer's audio to peers. Add a server-side recorder (LiveKit egress to webhook, or capture the raw stream into the game server) that persists the WAV/Opus per round.
2. **Transcribe.** Use Whisper (via OpenAI API or self-hosted faster-whisper) to produce a transcript at end of round.
3. **Analyze.** Send transcript + topic + canonical reference (a short paragraph describing what a good explanation contains) to Claude. The prompt asks for: a 1-100 score, three strengths, three gaps, a misconception flag if any, and a one-sentence "what to study next."
4. **Display.** On the Results screen, the explainer sees per-round AI feedback: "You explained the *what* well but didn't connect *why* it matters. You may be confusing X with Y. Suggested follow-up: ____."
5. **Persist.** Store the (transcript, score, gaps) in Supabase keyed by `(user_id, topic_id, round_at)` for spaced-repetition surfacing later.

This requires:
- A new `recordings` and `explanations` table in Supabase (transcripts may be sensitive, RLS strict).
- An OpenAI / Anthropic API key on the server.
- A backend job runner — Whisper transcription is slow; do it after the round ends and surface results when ready, not blocking the next round.
- Cost guardrails: Whisper API + Claude per round = ~$0.05 per explanation at current pricing. Free tier should cap at N analyzed rounds per day; paid tier removes the cap.

This single feature changes the product positioning from "fun voice game" to "study tool with AI tutor."

### 5.2 Solo Study mode

Once 5.1 is built, Solo Study comes nearly for free. UI flow:
1. Pick a topic (from your saved topics, syllabus, or a free-text field).
2. 90-second whiteboard + voice explanation, alone — no peers required.
3. AI Feynman Analysis runs as above.
4. Results page is a single-player version of the results screen, with the AI feedback prominent and a "Schedule review in 3 days" CTA.

This is the daily-active-use loop.

### 5.3 Curriculum-aligned topic banks

The current word bank is good for casual play; useless for a student studying for GCSE Biology. Add **structured topic banks**:
- GCSE / A-Level (UK)
- IB (international)
- AP (US)
- University intro courses (Physics 101, Calc, Organic Chem, etc.)

Each topic in a bank includes: term, subject, subtopic, difficulty (1–5), canonical reference paragraph (used by AI Feynman Analysis), expected key concepts list.

Storage moves from `server/wordbank.json` into a Supabase `topics` table with rich metadata. Authoring is initially manual (seed CSVs from past papers + LLM-assisted generation); long-term, partner with content providers.

### 5.4 Topic difficulty + dynamic coin scaling

Already partially in: difficulty multiplier exists in `gameLoop.js:29`. Wire it through:
- Host can set difficulty 1–5, not just easy/normal/hard.
- Coin payout scales linearly with difficulty.
- Solo mode: difficulty is auto-suggested based on the user's running score on that subtopic.

### 5.5 Topic voting + custom topic creation

**Voting:** new state `'voting'` between `'selecting_topic'` and `'playing'`. The system proposes 3 topics; everyone votes; winner is played. Keeps audience engaged during transitions and reduces the "the explainer always picks the easy one" problem. Private rooms only at first per the user's note.

**Custom topics:** host adds a list of custom words during room creation. Already supported in [server/index.js:99-100](server/index.js) (`customWords` array). Surface this in the create-room UI — currently it's not exposed. Add a "Custom Topics" tab in the create-room modal where the host can paste a comma-separated list or upload a file.

### 5.6 Refresh button + live public-rooms updates

Already covered in Phase 0 (3.4). Mention here as the user-facing feature delivery.

### 5.7 Persistent identity & account customization

- Editable username (with the same 8–20 char rule as in [Instructions.md](Instructions.md)).
- Editable display name.
- Avatar customization (5 skin tones, 6 hair styles, hair color, eye color, starter outfit) — already drafted in [Instructions.md](Instructions.md). The data model already supports this via `user_metadata`. Build the avatar creator using a 2D layered SVG approach first (cheap, fast, fits the chalk aesthetic). Don't pull in Three.js or Ready Player Me until 2D feels insufficient — they're heavy and break the aesthetic.

---

## 6. Phase 3 — Platform expansions (6+ weeks, after we've proven product-market fit on Phase 2)

These are real bets, not certain features. List them so the architecture decisions in Phase 0–2 don't lock us out.

- **Classroom mode.** Tutor account type with a "create class" flow, student invitations, assignment-based rooms, persistent recordings, written tutor feedback. This is the Skool / Zoom for studying play.
- **Notes.** Upload PDFs/images of class notes; OCR + LLM extracts concept list; you explain those concepts back to the system. The user mentioned this; agree it should be Phase 3, not earlier — it requires real document infra.
- **Spaced repetition scheduler.** Topics you scored badly on resurface 3, 7, 21 days later. Compounds Solo Study into a real study habit.
- **Group study sessions / "always-on" rooms.** Permanent rooms tied to a study group, with persistent chat and shared topic banks. Discord-server-for-studying angle.
- **Mobile app.** The current SPA breaks on mobile (audit confirmed) and a tablet-friendly drawing app is a big market. React Native + a shared core would make sense once the web product is stable.

---

## 7. Architecture upgrades needed to support Phase 2+

### 7.1 Persist room state

Currently rooms are an in-process `Map` ([server/rooms.js:1](server/rooms.js)). A server crash drops every active game, every recording-in-progress, every score. For a study tool people pay for, this is unacceptable.

**Move to Redis** for ephemeral game state (rooms, strokes, current scores) and **Supabase** for durable state (transcripts, AI feedback, user history). Requires:
- A `rooms` adapter abstraction in `server/rooms.js` so swapping the backing store is one file.
- Redis on Railway (their addon is fine).
- Socket.IO Redis adapter so multiple server instances can broadcast to the same rooms.

### 7.2 Horizontal scalability

Same change unlocks running multiple game-server instances behind a load balancer. Required before a marketing push.

### 7.3 Background job queue

Whisper transcription, AI analysis, and (future) email digests need a queue. Use BullMQ on Redis. Single Node process for now is fine; isolate workers when load justifies.

### 7.4 Observability

The codebase currently has `console.log`s scattered through gameLoop. Replace with a real logger (Pino), add request IDs, ship logs to a service (Better Stack / Axiom). Add basic metrics: rooms-active, rounds-played, AI-analysis-jobs-queued, mic-cleanup-failures.

### 7.5 Test coverage

There are zero tests today. At minimum:
- Unit tests for `gameLoop.js` state transitions (Vitest).
- Integration test for the room socket lifecycle (a single happy-path "create → join → play → end" flow).
- Browser-based smoke test with Playwright covering the auth + create + join flow.

These don't need to be exhaustive but they need to exist before Phase 2 lands; AI Feynman Analysis introduces a lot of new failure modes.

---

## 8. Phasing summary & sequencing

| Phase | Duration | Output |
| --- | --- | --- |
| 0 — Critical bug fixes | 1–2 weeks | Stable whiteboard, mic, room state, frame purchases |
| 1 — Design system + page redesign | 2–3 weeks | The "AI slop" smell is gone; Chalkmate brand is in place |
| 2 — Revolutionary features | 4–6 weeks | AI Feynman Analysis, Solo Study, curriculum topics, custom topics, voting |
| 3 — Platform expansions | 6+ weeks | Classroom mode, Notes, spaced repetition, mobile |
| Architecture upgrades | Threaded across phases | Redis, queue, observability, tests |

Phase 0 is the gating commitment — without it, every feature on top is built on sand. Phase 1 should not start until Phase 0 ships, because the redesign work is half-pointless if you're still re-fixing the canvas resize bug in week 6.

---

## 9. Open questions before we start

These need your input before any code lands:

1. **Name.** Chalkmate, Lectern, Recall, keep "Feynman Club", or something else entirely?
2. **AI provider for Feynman Analysis.** Do you have an OpenAI / Anthropic relationship already, or should we shop? Cost target per analysis?
3. **Curriculum scope for v1.** GCSE only? GCSE + A-Level? US AP? Picking one to seed first matters for content authoring effort.
4. **Solo Study or polish-the-multiplayer first?** Both are compelling. Solo Study is the bigger moat; polishing multiplayer is faster to ship and validates retention. My recommendation: ship Phase 0 + 1, then build Solo Study, in that order.
5. **Free / paid model.** Is this freemium with paid AI analysis, paid classroom mode, ad-supported, or something else? Affects what we cap and where.
6. **Mobile importance.** If mobile is critical, design constraints in Phase 1 change (no hover states, drawing UX needs to work on touch, etc.).

---

## 10. What this plan deliberately does *not* do

- It doesn't propose a rewrite. The codebase is in much better shape than the bug list implies — most issues are scattered fixes, not architectural failures. A rewrite would set the project back a quarter for no reason.
- It doesn't pull in heavy dependencies (Three.js, Ready Player Me, complex UI kits). The chalk aesthetic is its own thing; off-the-shelf component libraries will fight it.
- It doesn't try to build everything at once. Phase 0 first. Phase 1 next. Talk after each.

The path to "genuinely revolutionary for students" runs through Phase 2's AI Feynman Analysis. Everything before it is the price of entry; everything after it is what makes Chalkmate a product worth paying for.
