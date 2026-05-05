# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The product is **Chalkmate** (formerly FeynGame / Feynman Club) — a real-time multiplayer study tool built around the Feynman Technique. The repo directory is still `FeynGame`; don't rename it.

## Repo layout

- [client/](client/) — Vite React SPA (auth, home, lobby, whiteboard game, results).
- [server/](server/) — Express + socket.io game server (CommonJS).
- [server/migrations/](server/migrations/) — Supabase SQL, applied manually via the Supabase SQL Editor.
- [MASTERPLAN.md](MASTERPLAN.md) — the long-form product/engineering plan; refer to this for sequencing.
- [Instructions.md](Instructions.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [ROADMAP.md](ROADMAP.md), [Gemini.md](Gemini.md) — earlier product/UI design briefs. They describe **planned/in-progress** intent and may not match shipped code; read them for direction, not as ground truth.

## Common commands

From repo root:
- `npm run install-all` — installs root, client, and server deps.
- `npm start` — runs server and client concurrently (server `:3001`, client `:5173`).
- `npm run server` / `npm run client` — run individually.

In [client/](client/):
- `npm run dev` — Vite dev server.
- `npm run build` — production build.
- `npm run lint` — ESLint (flat config in `eslint.config.js`).
- `npm run preview` — preview a built bundle.

There is **no test suite**. The server's `npm test` is the default `exit 1` stub — don't invoke it and don't claim coverage.

## Required environment variables

**Server** (read in [server/index.js](server/index.js) / [server/gameLoop.js](server/gameLoop.js)):
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — required. The server calls `process.exit(1)` on boot if either is missing, so local dev needs at least placeholder values even when not testing voice.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — optional locally. Without them, coin awards, frame purchases, and account deletion silently no-op (this is expected, not a bug).
- `CLIENT_URL` — CORS origin, default `http://localhost:5173`.
- `PORT` — default `3001`.

**Client** (Vite, prefixed `VITE_`, set in [client/.env](client/.env)):
- `VITE_SERVER_URL` — default `http://localhost:3001`.
- `VITE_LIVEKIT_URL` — LiveKit WebSocket URL, default `ws://localhost:7880` (read in [client/src/hooks/useAudio.js](client/src/hooks/useAudio.js)).
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Architecture

### Client routing & auth gate ([client/src/App.jsx](client/src/App.jsx))
Routes: `/auth`, `/` (Home), `/profile`, `/room/:roomId` (Lobby), `/game/:roomId` (Game), `/results/:roomId` (Results). Everything except `/auth` is wrapped in `RequireAuth`, which reads `useUserStore`, shows a spinner while `isLoading`, and redirects unauthenticated users to `/auth` with `mode: 'signup' | 'login'` chosen from a `localStorage.hasVisited` flag.

### User store ([client/src/store/useUserStore.js](client/src/store/useUserStore.js))
Zustand store; single source of truth for the logged-in user and their profile (`tokens`, `selectedFrameId`, `ownedFrames`, `avatarUrl`).
- `initAuth()` hydrates from `supabase.auth.getSession()` and listens to `onAuthStateChange`. A `lastHydrateId` token discards stale concurrent hydrations.
- Re-emits `register_user` to the socket on every reconnect so the server can re-attach `userId` to existing player records after transient drops.
- `purchaseFrame` is server-authoritative (POST `/api/purchase-frame`); `setSelectedFrame` writes Supabase directly (RLS allows it on that column).
- `loginAsGuest()` creates an in-memory user with id `guest_<suffix>` and never touches Supabase. Guests can't earn coins or buy frames.

### Singleton socket ([client/src/lib/socket.js](client/src/lib/socket.js))
The socket.io client is constructed at module load — there is **one socket per tab**. Don't construct your own `io()` clients elsewhere; import this one.

### Server entry ([server/index.js](server/index.js))
HTTP routes:
- `POST /rooms` — create or update a room (rate-limited 5/min).
- `GET /rooms` — list public, non-finished rooms.
- `GET /rooms/:roomId`, `GET /subjects`.
- `GET /token` — mint a LiveKit JWT (rate-limited 20/min); the requester must already be a member of the room.
- `POST /delete-account`, `POST /api/purchase-frame` — auth-gated.

Authenticated REST endpoints route through `verifyBearer(req)` (calls `supabase.auth.getUser(token)` — a real signature check, not a base64 decode). Reuse it for any new authed endpoint.

Socket events (all enforce authorization inline): `register_user`, `join_room`, `leave_room`, `toggle_ready`, `start_game` (host-only), `update_room_visibility` / `update_room_settings` (host-only, lobby-only), `topic:select` / `stroke:clear` / `end_turn_request` / `cancel_end_turn` (current explainer only), `stroke:draw`, `shape:draw`, `textbox:add|update|delete`, `submit_score` (non-explainer, one vote per round), `chat:message`. Player names and chat run through `leo-profanity`.

### Room state machine ([server/rooms.js](server/rooms.js), [server/gameLoop.js](server/gameLoop.js))
Rooms live in a process-local `Map` — **restarting the server drops every active game**. There is no Redis adapter.

Status transitions: `lobby → selecting_topic → playing → between_rounds → (next round) | results`.
- `startNextRound` increments `currentExplainerIndex`, picks 3 topic choices (from `room.customWords` if any, else `getRandomWord(subject, subtopic)`), runs a 10s selection timer, then calls `startExplaining` which runs the `roundDuration` countdown.
- When `currentExplainerIndex >= totalRounds` the room transitions to `results` and `awardCoinsForRoom` runs once (idempotent via `room.coinsAwarded`).
- `totalRounds` is frozen at `players.length * roundsPerPlayer` when the host hits `start_game`. Late joiners don't extend the game.
- `endRound` averages `roundScores` (integers 1–5 from non-explainers), updates the explainer's `totalPoints` / `roundsPlayed` / `avgScore`, then runs a 5s `between_rounds` window before the next round.

### Coin economy ([server/gameLoop.js](server/gameLoop.js))
- Awards happen server-side at room end only. Per player: `round(totalPoints * COINS_PER_POINT * multiplier)` where multiplier is `easy:1`, `normal:1.5`, `hard:2`.
- Persisted via `supabase.rpc('award_coins', ...)` against the service-role admin client. Guests (no `userId`) get nothing.
- Frame purchases call `supabase.rpc('purchase_frame', ...)`. The RPC raises `insufficient coins` / `already owned` / `profile not found` and the route maps those to specific HTTP errors.
- [server/frames.js](server/frames.js) is the **price source of truth** and must mirror [client/src/lib/frames.js](client/src/lib/frames.js). Never trust a client-supplied price.

### Profiles schema ([server/migrations/001_profiles.sql](server/migrations/001_profiles.sql), [server/migrations/002_profile_functions.sql](server/migrations/002_profile_functions.sql))
- A `profiles` row is auto-created by the `on_auth_user_created` trigger with 240 starting coins.
- RLS lets users read and update their own row, but column grants restrict UPDATE to `selected_frame_id` and `updated_at` only — `coins` and `owned_frames` are service-role-only. **Adding any user-mutable column means extending the `grant update (...)` list.**
- Migrations are applied manually in the Supabase SQL Editor; there's no migration runner.

### Voice chat (LiveKit)
The client requests `GET /token?room=...&username=...` and the server returns a JWT scoped to that room. The `username` query param **must match** the requester's `player.name` in the room or the server returns 403. Connection / track plumbing lives in [client/src/hooks/useAudio.js](client/src/hooks/useAudio.js).

### Whiteboard
- The client maintains a **vector list** of strokes (`{points: [{x,y}], color, size, tool}`) keyed in normalized `[0,1]` coordinates. `Whiteboard.jsx` re-renders the entire canvas from that vector on every resize and on every incoming remote stroke. The canvas pixel buffer is **not** the source of truth.
- The server keeps a parallel `room.strokes` / `room.shapes` / `room.textBoxes` list and replays the full board to any joiner via `board:replay` after a successful `join_room`. Mid-join works as a result.
- Server validates stroke coords are normalized; rejects strokes that aren't from the current explainer; clears the list on round transition.
- `endRound` snapshots `roundScores` into the explainer record immediately and resets the dictionary, so a late `submit_score` from the previous round can't corrupt the next one. A `roundId` is bumped per round and clients must echo it back when scoring.

### Public rooms
- `GET /rooms` returns rooms with `joinable: true|false` (room is non-results, has seats, and `allowMidJoin` is true). Home page also subscribes to a `home_lobby` socket channel that pushes a fresh list whenever any public room mutates — no polling.
- Join-by-code does a `GET /rooms/:roomId` pre-flight check and only navigates if the room exists and is joinable.

## Conventions & pitfalls

- **Module systems differ between client and server.** Server uses CommonJS (`"type": "commonjs"`, `require/module.exports`); client uses ESM (`"type": "module"`, `import/export`). Don't paste between them without converting.
- The client deploys as a static SPA — [client/vercel.json](client/vercel.json) rewrites all paths to `index.html`. The server is hosted separately (its URL goes in `VITE_SERVER_URL`).
- Player names are clamped to 30 chars and profanity-filtered. Chat is clamped to 200. Stroke coords outside `[0,1]` are dropped silently.
- Existing markdown design docs (`Instructions.md`, `Gemini.md`, `IMPLEMENTATION_PLAN.md`, `ROADMAP.md`) describe planned direction and frequently lead the code. Verify against the implementation before quoting them.
