# Feynman Club — UI/UX Fine-Tuning Instructions

## Your Role
You are an award-winning UI/UX designer and front-end developer. You are known for creating beautiful, polished, and emotionally engaging web experiences. Every screen you touch should feel considered, premium, and fun. Think the onboarding flow of GeoGuessr meets the personality of Duolingo meets the aesthetic of a dark academic game. No generic UI. No lazy defaults. Every interaction should feel satisfying.

---

## How To Begin — IMPORTANT, Follow This Exactly

Before writing a single line of code, follow these steps in order:

**Step 1 — Create an implementation plan**
Write a detailed plan covering every change listed in this document. For each section, describe:
- What you will build and how
- Where it fits into the existing codebase
- Any libraries or tools you plan to introduce
- Any technical risks or decisions the user should know about

**Step 2 — Ask for review**
Once the plan is written, stop. Do not write any code. Present the plan and ask:
"Does this plan look good to you? Any changes before I start building?"

**Step 3 — Wait for approval**
Do not proceed until the user explicitly approves. If they request changes, update the plan and ask again.

**Step 4 — Create a task list**
Once approved, produce a numbered task list. Check each item off as you complete it.

**Step 5 — Build**
Work through the task list in order. Confirm each phase is complete before moving to the next.

---

## Section 1 — Authentication (Login / Sign Up)

### Overview
Replace the current landing page with a polished login/sign-up flow. This is the first thing a new user sees — it must feel premium and on-brand with the dark chalkboard aesthetic.

### Sign Up Options
Users can sign up via:
- **Google (Gmail)**
- **Apple ID**
- **Username + Email + Password** (manual)

### Username Rules (enforce on front-end and back-end)
- Minimum 8 characters, maximum 20 characters
- Only letters, numbers, and underscores allowed
- No other special characters permitted
- Must be unique (check against existing users)

### Password Rules (enforce on front-end with live validation feedback)
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (e.g. !, @, #, $, %)
- Show a live password strength indicator as the user types (weak / medium / strong)

### Login
- Email/username + password
- "Continue with Google" and "Continue with Apple" buttons
- "Forgot password?" link
- Toggle between Login and Sign Up smoothly (animated transition, not a page reload)

### Design Notes
- Background: the same dark chalkboard aesthetic (`#1e2e1e`)
- The Feynman Club logo and tagline should sit above the auth card
- The auth card itself should feel elevated — subtle border, soft shadow, clean spacing
- Form validation errors should appear inline, in chalk-red, not as alert popups
- Buttons should have satisfying hover/press states

---

## Section 2 — Avatar Creator (Post Sign-Up Step)

### Overview
After a new user completes sign-up (username/email/password or OAuth), before they reach the home page, they go through a one-time avatar creation screen. This should feel like a fun, rewarding moment — not a chore.

### Reference
GeoGuessr's 3D character creator is the visual reference. A 3D avatar rendered in the browser that the user can customise with basic options on first setup.

### Avatar Customisation (Initial Creation)
The user can choose:
- **Skin tone** (5–6 options)
- **Hair style** (5–6 options)
- **Hair colour** (preset swatches)
- **Eye colour**
- **Starter outfit** (2–3 free options to choose from — more unlockable later via the shop)

### 3D Rendering
- Use **Three.js** or **Ready Player Me** (preferred — it handles 3D avatars out of the box and has a free tier) to render the avatar
- The avatar should be displayed on a subtle dark podium/platform, slowly rotating
- The user's customisation choices should update the avatar in real time
- The avatar should have a friendly, slightly stylised (not hyper-realistic) look — think GeoGuessr or a premium mobile game

### Avatar Persistence
- Avatar configuration is saved to the user's profile in the database
- The avatar is used everywhere: lobby player cards, leaderboard, profile icon

### Future Shop System (build the foundation now, don't build the full shop yet)
- The avatar system should be architected so that additional items (shirts, caps, accessories) can be unlocked later via a token shop
- Tokens are earned by scoring well during games (points from explanations convert to tokens)
- For now, just ensure the data model supports `unlockedItems: []` and `tokens: 0` on the user profile
- Do not build the shop UI yet — just lay the groundwork

### Design Notes
- The avatar creator screen should feel celebratory — this is the user's first moment of personalisation
- Use a progress indicator (e.g. "Step 2 of 2") so users know they're nearly in
- A "Randomise" button that picks a random combination is a nice touch
- CTA button: "Let's go" or "Enter the classroom" — not "Submit" or "Save"

---

## Section 3 — Home Page Updates

### What Stays the Same
The existing home page layout (room list, create/join buttons) should remain structurally the same.

### What Changes

**Top-right user profile area:**
- Display the user's avatar (small 3D render or a generated 2D avatar thumbnail) alongside their username
- This should feel like a premium game HUD element — not a generic navbar profile pill
- Clicking the avatar/username opens a **profile dropdown tab** (see below)

**Profile Dropdown Tab:**
- Slides or fades in smoothly on click
- Contains:
  - Avatar (larger view)
  - Username and email
  - Token balance (e.g. "🪙 240 tokens")
  - **Settings** option (placeholder for now — will be expanded later)
  - **Log out** option
- Should feel like a game menu, not a web app dropdown — dark background, chalk-style text, subtle border

---

## Section 4 — General Design Principles (Apply Everywhere)

- **Consistency**: Every screen uses the same dark chalkboard palette, chalk typography, and animation language
- **Microinteractions**: Buttons should have tactile press states. Inputs should highlight on focus. Errors should shake subtly.
- **No placeholder states**: If something is loading, show a skeleton or spinner. Never show a blank screen.
- **Transitions**: Page transitions should be smooth — fade or slide, never jarring jumps
- **Mobile awareness**: Desktop first, but don't break on mobile. The auth and avatar screens especially should be usable on a phone.

---

## What NOT To Build Yet
- The full token shop UI
- Settings page content (just a placeholder "Settings — coming soon" for now)
- Any changes to the in-game whiteboard or scoring screens (those are working and should not be touched)