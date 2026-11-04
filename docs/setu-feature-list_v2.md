# Setu — Complete Feature Specification

**Target release:** Diwali, Sunday November 8, 2026
**Founders:** Ansh Rai & Shyam Patel
**What it is:** A local-first AI coding agent (like Claude Code), built on a bundled Ollama runtime, with optional routing to cloud models (Claude, OpenAI) only when the user allows it.

---

## 1. Foundation (planned — NOT yet built; only the landing page exists)

> Correction: this section was originally written as "already working code". Nothing in it exists yet — the only thing built so far is the landing page. Every item below has to be built from scratch.

| Feature | Detail |
|---|---|
| **Setu 1.0 model picker & router** | Tags any task as local or cloud and routes it accordingly. Combines a fine-tuned/custom Ollama model, a branded persona/system-prompt layer, and a router that auto-picks between Ollama, Claude, and OpenAI depending on the task. Logic is built and tested. |
| **Live theme customization** | Colors and visual settings change instantly and persist — no reload required. |
| **Custom instructions** | Global instructions, or scoped per programming language, so Setu's defaults adapt to how the user actually codes. |
| **Portable settings** | Full settings export/import. API keys are excluded by default so a shared settings file can never leak a credential. |
| **Checkpoints** | Full-project snapshots the user can undo or restore to at any point. |
| **Basic hardware detection** | Detects RAM and CPU. GPU/VRAM detection exists only as a stub — flagged for completion (see §3). |
| **Bundled Ollama** | Ships inside the app — no separate install step for end users. |
| **Desktop companions** | Floating specialist windows, each running its own task queue in parallel with the main session. Already functional at a basic level. |
| **Installer packaging & app icon** | Packaging config and a real app icon exist, ready for the eventual installer build. |

---

## 2a. Diwali CORE (locked — Sunday, November 8, 2026)

The smallest Setu that is solid and useful. Nothing is added to this list; things can only be cut.

1. **App shell** — Electron + TypeScript + React, Setu Dark theme, Agent home and session screens, Monaco editor panel, terminal, light Editor mode (see setu-layout-spec.md).
2. **Bundled Ollama + first-run model download** — small installer; on first launch Setu picks a model that fits the user's hardware and downloads it with a progress bar.
3. **Chat with local/cloud choice** — local Ollama models, plus Ollama Cloud and OpenRouter free models, plus Claude/OpenAI with the user's own keys. Cloud is off unless the user allows it; keys are stored locally.
4. **Read and edit files, with checkpoints** — changes are shown as a diff for approval, and every change can be undone.
5. **Auto-test-and-fix loop.**
6. **Trust prompts and secret/credential leak detection.**
7. **Installer and auto-update** (signed update files; unsigned installer for now, with a clear install note on the download page).

## 2b. After Diwali — shipped as updates (originally confirmed for v1)

Everything in this section was moved out of the Diwali release to protect the date. Suggested order: local RAG, plain-language error translator, screenshot/error paste to fix, Git-native helpers, themes and wallpaper, token/cost bar, sketch-to-UI, then companions and the rest; plugin system, workflow canvas and pattern memory come last.

### Detail: previously confirmed v1 features

### Core coding loop
- **Auto-test-and-fix loop** — Setu runs the test suite after a change, reads any failure, and proposes a fix in the same pass.
- **Local RAG over the codebase** — the codebase is indexed and searched on-device, so answers are grounded in the user's actual files without anything being sent off-machine.
- **Sketch-to-UI drawing canvas** — draw a rough layout (boxes, nav bar, button placement) and Setu generates real, working code.
  - Cloud vision-capable models (Claude, OpenAI) work fully from day one.
  - Local vision models (e.g. llava) are best-effort — Setu tells the user plainly if the active local model can't read a sketch, rather than guessing.
  - **Companions can trigger sketch-to-UI themselves**, mid-task, without the user manually opening the canvas.

### Git & debugging helpers (added)
- **Git-native helpers** — commit message generation, branch-aware context (Setu knows which branch you're on and what changed on it), and plain-language conflict explanation. Tied into the auto-generated changelog and export-as-PR-description features so all three share one diff-summarizing engine.
- **Screenshot / error paste to fix** — drop or paste a screenshot of a bug or console error and Setu proposes a fix. Reuses the vision routing built for sketch-to-UI: cloud vision models work fully from day one; local vision models are best-effort and Setu says so plainly if the active model can't read the image. Feeds into the plain-language error translator and the auto-test-and-fix loop.

### Free cloud model providers (added)
- **Ollama Cloud** — sign-in from settings, so users can use `:cloud` models (e.g. GLM) through the same bundled Ollama, on Ollama's free plan (light usage, limits not fully published).
- **OpenRouter** — user adds their own API key to access its free models (rate-limited; free model list changes over time).
- Both follow Setu's existing rules: cloud is off unless the user allows it, and keys are kept in the local secrets vault, never in exported settings.
- Setu never hosts free cloud models itself; each user connects their own free account.

### Safety & hygiene
- **Secret/credential leak detection** — scans diffs for leaked keys and tokens before they're applied or committed.
- **Trust prompt when opening a project** — the first time a project folder is opened or imported, Setu asks "Do you trust the author of this project?" (similar to workspace trust in code editors). Running tests, shell commands and companions on someone else's project runs their code, so untrusted projects open in a restricted mode (read-only, no test runs or shell commands, no plugins) until the user chooses to trust them.
- **Local secrets vault** — encrypted local storage for the user's real project secrets. Referenced by name in code/prompts; never sent to a model. Pairs directly with leak detection.
- **Plain-language error translator** — stack traces are rewritten in a sentence or two of plain language before Setu explains what actually broke. The raw traceback is still available.

### Memory & history
- **Local pattern memory (project-scoped)** — Setu learns the conventions it observes (naming, folder structure, preferred libraries) and reapplies them on later suggestions. Flagged internally as the feature most likely to need real design iteration (risk of feeling intrusive if done wrong).
- **Searchable chat history** — full local text index; every past conversation is fully searchable.
- **Auto-generated changelog entries** — written automatically from diffs after each session.

### Reliability & onboarding
- **Dependency health check** — flags outdated or vulnerable packages before install, fully offline.
- **First-run guided onboarding** — walks the user through a real first task rather than dropping them into a blank interface.

### Customization
- **Named, switchable theme presets** — built on top of the already-working live theme system.
- **Extension/plugin system (revised, open-capability model)**:
  - Plugins can request file-system, shell, network, or UI access — not restricted to UI-only.
  - **Trust prompt first:** before anything else at install, Setu asks in plain language "Do you trust the author of this plugin?", showing who published it and where it came from.
  - Each plugin declares its required scope upfront; the user approves that specific scope once, at install.
  - Setu monitors runtime behavior and flags anything a plugin does *outside* its declared scope ("this plugin did something it wasn't approved for — remove it or investigate").
  - Deliberately not flag-only: permission grants are the real boundary, runtime flagging is a second layer on top, not a replacement.
- **Live/animated wallpaper — built in and free for everyone (no plugin needed) — BUILT in v0.4** — users can set any image, GIF, or video from their own computer as the Setu background. Files stay local. Plugins can also provide wallpapers, but basic wallpaper never depends on them.
  - Readability controls: dim/blur slider so text stays legible over any video.
  - Performance: pauses when Setu is in the background or on battery, and is off by default in low-spec situations.
  - Built-in wallpapers are media files only (images, GIFs, videos).
  - Plugins can also supply wallpapers, including code-based ones (HTML/scripts, interactive or generated visuals), under the normal plugin rules: the plugin declares its scope upfront, the user approves it once at install, and Setu flags anything done outside that scope.

### Reach features (added Oct 4 — both built in v0.4)
- **Reply language: English, Hindi, Gujarati, Hinglish** — explanations come back in the chosen language; code, file names and commands stay in English. Quality depends on the model (small models are weak; 7B+ is better). Moved up from the v2 backlog.
- **Teaching mode** — every change is explained in simple words, as if to a beginner. Moved up from "deferred past v1" (it was listed there as Learning / explain mode).

### Companions (expanded)
- **Companion presets shipped by default**: Test-writer, Reviewer, Docs-writer.
- **Diff-aware companion handoff** — when a companion finishes a task, its output opens directly into the Reviewer companion's queue instead of just firing a notification, closing the loop between companions automatically.
- **Per-companion cost breakdown** — see token/cost bar below.

### Usage & continuity
- **Token/cost usage bar** — shows real token counts and estimated cost for both local (free) and cloud calls, regardless of which provider is active or whether a companion made the call. Broken down per companion. (Provider usage data + tracker module already exist in code; not yet wired into the UI.)
- **Session handoff / resume** — reopening Setu gives a short summary of exactly where the user left off, built from local chat history and pattern memory.
- **Export-fix-as-PR-description** — a finished auto-test-and-fix result can be turned into a shareable PR description in one click, reusing the changelog generator.
- **Checkpoint diff view** — see exactly what changed between two checkpoints instead of restoring blind.

### Workflow wiring (new, n8n-style)
- A visual node/wiring canvas for chaining Setu's own pieces together — companions, triggers, actions, and conditions — without needing everything to happen inside one chat thread.
- **Node types:**
  - *Trigger* — on save, on commit, on schedule, on test failure.
  - *Action* — run a companion, apply a fix, open a diff, send a notification.
  - *Condition* — branch on test results, diff size, or a companion's verdict.
  - *Companion* — companions themselves are wireable nodes.
- **Starter templates included**, so the canvas isn't empty on first use:
  - "On PR open → Reviewer → notify"
  - "On test failure → auto-fix → re-run tests"
  - "On save → Docs-writer (if public API changed)" — conditional, not every save
  - "Nightly → dependency health check → changelog entry if anything's outdated"
- Runs through the same local-first router as everything else — no separate cloud dependency.
- Conceptually overlaps with diff-aware companion handoff: that handoff is effectively a *built-in default* workflow between two companions, while the wiring canvas is how a user customizes or extends beyond the defaults.

### GPU/VRAM detection (completion)
- Finishing what's currently a stub, so the router can make smarter local-vs-cloud decisions automatically based on real hardware capability, instead of guessing.

---

## 3. Explicitly deferred past v1

Cut for the Diwali deadline, not cut as ideas — each needs its own design pass rather than being rushed in:

- **Swarm mode** (parallel agents) — most hardware-dependent, riskiest to get right under a deadline.
- **Project recipes / templates** — more valuable once a marketplace exists to hold them.
- ~~Learning / explain mode~~ — pulled into v1 as Teaching mode (built in v0.4).
- **Theme & instruction marketplace backend** (Firebase-backed) — deferred per earlier decision.
- **Full OS-level computer control** — a different risk class, needs its own design pass.
- **Fine-tuning Setu 1.0 on real usage data** — needs real users and real data first.
- **Hardware/platform partnerships** (Ollama, NVIDIA, etc.) — deferred.

---

## 3b. v2 backlog (ideas parked for after Diwali)

- Cloud privacy ledger (log of everything sent to cloud providers, with inspectable payloads)
- Auto-redaction of secrets/emails/keys before any cloud call
- Cloud spend cap (hard monthly limit)
- Ask-before-escalating (one-click "this needs cloud, send it?")
- Agent permission modes (ask every time / auto-edit only / full auto, with shell approve/deny)
- Model manager (hardware-based recommendations, resumable downloads, disk usage, tokens/sec benchmark)
- ~~Hindi / Gujarati / Hinglish prompts and explanations~~ — moved into v1 (built in v0.4)
- Local voice input (whisper.cpp)
- Low-spec mode for 8 GB RAM machines
- Battery/thermal-aware routing
- MCP support (decide how it relates to the plugin system)
- "Open in VS Code / JetBrains" bridge
- Opt-in crash reports and auto-update

---

## 4. Business & positioning notes

- Setu is meant to be widely recognized as "the best" in its category.
- Monetization plan is to **not** directly charge end users (model and specifics deferred/undecided).
- Partnership outreach (hardware/platform) is deferred until after the feature set and launch are locked.
- Process discipline: **no further building until the feature list is fully locked.** Once locked, the build order is: landing page first, then the desktop app itself — the installer/app has not been built yet as of this document.

---

## 5. Legal / compliance

- The public landing page's email signup is built to align with **India's Digital Personal Data Protection Act, 2023 (DPDP Act)**:
  - Consent checkbox is unticked by default and states the single purpose (launch notification only — no selling, no sharing).
  - A dedicated Privacy & Data section explains what's collected, the lawful basis, how to withdraw consent or request deletion, and a grievance contact point.

---

*This document reflects every feature decision made in conversation as of the current build. It does not include implementation details of the landing page itself (visual design, animations, tech stack) — only the product feature set.*
