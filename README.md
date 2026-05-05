# Chalkmate

Learn it by teaching it. A real-time multiplayer study tool built around the Feynman Technique — players take turns explaining a topic on a shared whiteboard with voice chat while peers rate how clearly they explained it.

See [CLAUDE.md](CLAUDE.md) for the full architecture brief and [MASTERPLAN.md](MASTERPLAN.md) for the product roadmap.

## Quick start

```bash
npm run install-all   # installs root, client, and server deps
npm start             # runs client (:5173) + server (:3001) concurrently
```

Required env vars:
- **Server**: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, optionally `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_URL`, `PORT`
- **Client** (`client/.env`): `VITE_SERVER_URL`, `VITE_LIVEKIT_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
