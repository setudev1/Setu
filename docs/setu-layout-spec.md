# Setu — Interface Layout Spec (v0.1)

Based on three screenshots of Devin's desktop app. We borrow the **structure** (where things go), not the look: Setu gets its own logo, icons, wording and colors.

**Stack:** Electron + TypeScript + React, Monaco for the code editor, xterm.js for the terminal.
**Default theme ("Setu Dark"):** taken from the landing page — background `#000000`, surface `#14171b`, border `#262b31`, text `#e7e9ec`, dim text `#8b929b`, accent `#5fd3a3` (mint), secondary `#7a9cff` and `#e8a33d`. Fonts: IBM Plex Sans (interface) and IBM Plex Mono (code and labels).

## What the screenshots show (my reading)

1. **Agent home:** left sidebar (New session, Sessions, Automations, Security, Review, Wiki, then a "Spaces" list of project folders with age), a big centered composer card, "Recent sessions" below it, and a footer with plan name and Settings.
2. **Session view:** chat on the left (user bubble, collapsible "Thought for 1s", file links, thumbs up/down, copy actions, a banner above the composer) and a code editor on the right with tabs, breadcrumb path, line numbers and minimap.
3. **Editor mode:** an activity bar (Explorer, Search, Source Control, and more), a file tree, Outline/Timeline at the bottom, a command-search box in the title bar, and a status bar.

The top bar has an **Agent | Editor** toggle, a classic menu bar, and an update pill ("Downloading Update"). As far as I can tell, Devin's app is built on a VS Code-style editor.

## Global rules

- Every color comes from a theme token. Nothing is hard-coded.
- Sidebar, chat and title bar panels are semi-transparent so a wallpaper can show behind them. The editor and terminal stay near-solid for readability.
- Use one icon set and Setu's own logo mark.

## Window frame

- **Title bar:** Agent | Editor toggle, search, sidebar toggle; session title in the middle; on the right a panel toggle, an **update pill** (needed for auto-update) and window controls.
- **Menu bar (v1):** File, Edit, View, Help only.
- No account/avatar area in v1, since there are no accounts.

## Screen 1 — Home (new session)

- **Sidebar:** New session · Sessions · Review (the Reviewer companion's queue) · Security (leak detection and trust status). Below that, **Spaces**: project folders with "last used" age, plus search and add. Bottom: Providers (local, Ollama Cloud, OpenRouter, keys) with a count.
- **Center:** Setu logo mark and the composer card.
- **Composer row:** attach (+) for screenshots and the sketch canvas · mode chip (Code) · model chip · **Local/Cloud pill** (Setu's own, off by default) · send.
- **Under the composer:** environment chip, current space chip, "Go to sessions list".
- **Recent sessions:** last five with age, and "View all".
- **Footer:** usage/cost summary and Settings.

## Screen 2 — Session view

- **Left (chat, about 40%):** user bubble, agent message with collapsible "Thinking", file chips, message actions, and the pinned composer.
- **Inline cards (Setu's own):** test-and-fix steps (ran tests → failed → fix → passed), **checkpoint markers** (Restore · Diff), trust and cloud-consent prompts.
- **Right (workspace tabs):** Editor (Monaco with tabs, breadcrumbs, minimap) · Diff (Accept/Reject) · Terminal.

## Screen 3 — Editor mode

- **v1 (light):** file explorer, search, Git status, editor, terminal.
- **Not in v1:** extensions panel, remote, debug, Outline/Timeline.

## Only in Setu (not in Devin)

Local/Cloud pill and token/cost bar · floating companion windows · checkpoint diff view · trust prompts · wallpaper layer and dim/blur slider · first-run onboarding and model download progress.

## UI build order

1. Window frame, sidebar and theme tokens
2. Home screen and composer
3. Session split view with Monaco
4. Terminal and diff view
5. Light Editor mode
6. Wallpaper layer

## Decisions still open

1. **Editor foundation:** I recommend Electron + Monaco (light, buildable in our timeline) over forking VS Code (gives more for free, but is much heavier to build and maintain). A fork can be revisited after Diwali.
2. **Scope:** smaller Diwali core vs later date (see chat).
