# Setu (early build 0.4)

A local-first AI coding agent. It can **work on your project folder**: it reads your files, proposes changes, shows you exactly what will change, saves them only when you approve, and keeps an undo point for every change.

**New in 0.4:** open **Settings** in the sidebar to set a **wallpaper** (any image, GIF or video from your computer, with dim and blur sliders), choose the **reply language** (English, Hindi, Gujarati or Hinglish), and turn on **teaching mode** (every change explained in simple words).

## Get an installer without installing anything on your PC

GitHub can build `Setu-Setup-0.4.0.exe` for you for free, so you don't need Node.js or `npm install`:

1. Make a free account at github.com and create a **private** repository named `setu`.
2. Upload everything inside this folder to it (repository page, **Add file**, **Upload files**, drag the contents in, including the `.github` folder). If `.github` doesn't upload, use **Add file**, **Create new file**, type `.github/workflows/build-installer.yml` as the name, and paste in the contents of `build-installer.yml`.
3. Open the **Actions** tab, choose **Build Windows installer**, click **Run workflow**, and wait about 5 to 10 minutes.
4. Open the finished run, scroll to **Artifacts**, download **Setu-Setup**, unzip it, and run the `.exe`.
5. Windows may show a blue "protected your PC" screen because the installer isn't signed yet. Click **More info**, then **Run anyway**. Choose your D drive as the install folder when the installer asks.

Setu still needs Ollama installed separately for now (the final installer will bundle it).

## Update from 0.2 (you already have it running)

1. Close Setu and the blue PowerShell window.
2. Unzip `setu.zip` into `C:\dev`. When the extract box shows a path ending in `\setu`, delete that last `\setu` so it says `C:\dev`. Click Extract and choose **Replace the files in the destination**.
3. In `C:\dev\setu`, open PowerShell (type `powershell` in the address bar) and run `npm run dev`.

No new packages were added, so you don't need `npm install`.

## First run (new computer)

1. Install Node.js LTS from nodejs.org.
2. Install Ollama for Windows from ollama.com (development only; the final installer will include it).
3. Put the `setu` folder in `C:\dev` (avoid OneDrive, Desktop and Documents).
4. In `C:\dev\setu`: `npm install`, then `npm run dev`.

## How to use it

1. Click **Manage models** and download a model (start with Qwen2.5 Coder 1.5B, about 1 GB; the 7B model is better at following instructions).
2. In the sidebar, click **+** next to **Spaces** and choose a project folder (an empty folder is fine).
3. Ask for something, for example: "make a calculator website with an index.html, styles.css and script.js".
4. Setu shows **Proposed changes**. Click a file name to see the exact lines that change. Untick files you don't want.
5. Click **Save**. Setu first saves an undo point, then writes the files. Use **Undo** on the card, or open **Checkpoints** in the sidebar to go back to any earlier state.

## Safety rules built in

- Setu only touches folders you choose. It can't read or write outside that folder, including through shortcuts (symlinks).
- It never touches `.git`, `.setu` or `node_modules`, and rejects `..` paths and Windows reserved names.
- Nothing is saved until you click Save. If saving fails halfway, everything is put back.
- Checkpoints are stored in Setu's own app-data folder, not in your project.
- Replies that were cut off before the end can't be saved.

## Wallpaper notes

- Images and GIFs (png, jpg, webp, gif, avif) and videos (mp4, webm) up to 300 MB. The file is copied into Setu's own data folder; your original is untouched.
- Video pauses when Setu is minimized, and optionally when your laptop is on battery. Busy videos can slow weak computers.
- This part has only been tested against a simulated app, not the real Electron window. If the wallpaper doesn't show, or a video doesn't play, tell me exactly what you see.

## Known limits of this build

- Small models (1.5B) often ignore the `FILE:` format and just print code. If you see no "Proposed changes" card, try the 7B model or ask again: "Give me each file as FILE: name then a code block."
- Setu sends the file list and the contents of small files to the model, but only about 12,000 characters, so big projects are only partly visible to it. Proper code search (RAG) comes later.
- Hindi and Gujarati replies depend on the model. Small models are often weak at them; the 7B models do better.
- No terminal, no running tests yet (auto-test-and-fix is next).
- Cloud models are not connected yet.

## Folders

- `src/main` - the app's main process: window, Ollama connection, safe file handling (`fsGuard.ts`, `project.ts`, `checkpoints.ts`, `spaces.ts`)
- `src/preload` - the small, safe bridge between the app and the interface
- `src/renderer` - the interface (React)
- `docs` - the feature list and layout spec

## Build the installer on your own computer

`npm run dist:win` (needs Node.js and `npm install` first; the GitHub method above avoids that).

## Before release (security to-do)

- Add a Content-Security-Policy to `src/renderer/index.html`
- Upgrade Electron to the latest stable version
- Sign the update files (and the installer, when possible)

## v0.5: look
- Black is the default. Settings > Background has 5 backgrounds and 5 accent colours.
- Glass panels (blur + soft edge light). With a wallpaper they get a darker tint.
- `AnimatedButton` lives in `src/renderer/src/components/ui/animated-button.tsx`; import it as `@/components/ui/animated-button`.

## v0.6
- **Saved sessions:** each finished chat is saved on your computer (last 30) and listed under Recent sessions on the home screen. Open or delete them there.
- **Secret warning:** before sending, Setu checks for API keys, tokens, private keys and `password = ...` lines. It warns first, and keys are hidden in the saved copy of a session.

## v0.7: cloud models (Ollama Cloud)
- Manage models > "Cloud models (heavy)". Open the Ollama app and sign in once, then press Add. Cloud models end in `:cloud` and run on Ollama's servers through your local Ollama, so no new setup in Setu.
- A free Ollama account has starter credits and one request at a time; the biggest models may need credits. Check ollama.com/pricing.
- Setu asks once before first use, shows a Cloud chip while a cloud model is selected, and turns sign-in, limit and credit errors into plain steps.
- Featured names (glm-5.3-flash:cloud, deepseek-v4-pro:cloud) come from Ollama's cloud list and can change. "Add by name" takes any other cloud model.

## v0.8: first-run model setup
- With no model installed, the home screen shows "Pick your first model": a download suggested for this computer's memory (about 1 GB for small computers, about 4.7 GB for 16 GB or more), a smaller or better alternative, a heavy cloud option, and Browse all models.
- Warns if the drive looks too full for the download.
- The installer does not contain a model, so it stays small.

## v0.9: Screenshot to fix and Preview

- **Screenshot to fix.** Press the + button, or paste or drop a picture of an error, and send. Setu reads the picture and
  explains the fix. A picture on its own is enough. It needs a model that can read pictures (Setu checks, and offers
  `gemma3:4b` in Manage models). Up to 3 pictures per message, shrunk to 1600 px. Pictures are not saved in session history.
  Cloud models send the picture to Ollama, and the consent notice says so.
- **Preview panel.** The Preview button in the top bar shows the folder's `index.html` next to the chat. It joins local
  `.css` and `.js` files, runs offline in a sandboxed frame (no network, no access to Setu), and reloads after every save or
  undo. It opens by itself after you save an HTML file. Phone width toggle included.
- Not verified in a real Electron window yet: the file picker, clipboard paste from a real screenshot tool, and whether
  `gemma3:4b` is the right model name for your Ollama version. Check these first when you run `npm run dev`.

## v0.10 small extras
- Quick-start chips on the home screen (Fix a bug, Explain code, Write tests, Make it prettier, Add comments). They fill the message box; nothing is sent until you press send.
- Keyboard shortcuts: Ctrl+N new session, Ctrl+K jump to the message box, Ctrl+. show or hide the preview (Cmd on Mac).
- Tour my project: one click on the home screen and Setu explains your project folder in simple words.
- Copy chat: one click copies the whole conversation as text.

## v0.11
- First-run welcome: Setu asks your name, then what to call you (Sir, Madam, Buddy, Boss, Friend, your own word, or just your name). Skippable, and changeable any time under Settings > About you. Setu greets you on the home screen and the model is told how to address you.
- Providers (sidebar): add an OpenRouter key (encrypted on this computer), search hundreds of cloud models, add the ones you want, and pick them in the model list. Cloud use asks for your consent first.
- Your own API keys (Providers > Use your own API key): OpenAI, Anthropic (Claude), Google Gemini, Groq, DeepSeek, Mistral, or any OpenAI-compatible https address. Add the model names you want; they appear in the model list as `api:<provider>:<model>`. Keys are encrypted with the operating system and never reach the interface.

## v0.12
- Setu sets up Ollama itself (Windows): if Ollama is missing, a banner offers "Set up Ollama for me". It downloads the official installer from ollama.com, installs it quietly for the current user and starts it, so the Setu installer stays small. If Ollama is installed but stopped, "Start Ollama" starts it.
- Run (title bar): pick or type a command (npm test, python main.py...) and run it in your project folder. Asks "Do you trust this folder?" first. If it fails, "Fix this with Setu" sends the output to the chat, and after you save the fix the command runs again automatically.
- Editor tab: file list, view and edit files, Save makes an undo point.
- Type @ in the message box to point at a file; Setu puts that file first in what the model sees.
- If a model writes code without Setu's FILE: format, Setu says so and suggests what to try.
- Help (sidebar): 5-step start guide and "Copy bug-report info" (no chats, files or keys).
- `npm test` runs the automated tests in `tests/`.

## v0.13
- **Update check:** on start Setu looks for a newer version and shows a small banner. Off until you set `UPDATE_FEED` in `src/main/config.ts` (a GitHub `releases/latest` API address or your own JSON `{ "version", "url" }`).
- **Project rules:** a `SETU.md` file in the project folder is read in every chat. Home > "Project rules" creates one.
- **Commit message:** Home > "Write commit message" reads your Git changes (read only) and writes the message.
- **Explain this code:** Editor > "Explain selection" / "Explain this file".
- **Search text:** Editor > "Search text" searches all project files; click a result to jump to the line.
- **Usage meter:** Providers shows cloud tokens used this month (counted on this PC) and an optional monthly limit; at the limit cloud sends are blocked.
- **Command palette:** Ctrl+Shift+P.
- **Save chat as a file:** button under the chat (Markdown).
- **Light theme:** Settings > Theme.
- Tests: `npm test` (20 unit tests) plus the UI mock tests.

## v0.14
- **Slash commands:** type `/` at the start of the message box for ready prompts (`/fix`, `/explain`, `/tests`, `/comments`, `/pretty`, `/simplify`, `/review`, `/secure`). Save your own under Settings > My / commands.

## v0.15
- **Model advice:** Manage models shows your computer's memory, the best pick for it, and a tag on every model: runs well, may be slow, or too big (use a cloud model).
- **Up-arrow history:** in the message box, press Up to bring back what you sent before, Down to go forward.

## v0.16
- **Copy as prompt:** when a Run fails, a button copies the command and its output as a ready prompt (to paste into any chat).
- **Saved draft:** what you are typing is kept on this computer and comes back after a crash or restart.

## v0.17
- **Built-in wallpapers:** 8 slow, soft animated backgrounds (see v0.18 for the final list) under Settings > Wallpaper. They are drawn with CSS, so nothing is downloaded and the installer stays small. They pause when Setu is hidden or on battery (if that option is on). A wallpaper you pick yourself replaces them.

## v0.18
- **New look for the built-in wallpapers:** near-black with soft glowing colour clouds. Dusk, Aurora, Sunset, Ocean, Diwali glow, Nebula, Forest mist, Rose dusk. (Neon grid was replaced by Dusk.)
- The landing page now has a wallpaper picker in the "Make it yours" section.

## v0.19
- **Live code wallpaper** (Settings > Wallpaper > Live code): code symbols and the names of your own project files drift across the background.
  - Your mouse pushes them aside and lights up the ones near it.
  - While Setu is writing a reply it speeds up and glows in your accent colour.
  - When a Run finishes, a green ripple (worked) or red ripple (failed) spreads from the centre.
  - It pauses when Setu is hidden or on battery (if that option is on), and stands still if Windows is set to reduce motion.

## v0.20: Project notes (Setu remembers)
Each project has its own short notes. Open them from the Home "Notes" chip or Ctrl+Shift+P → "Project notes". Setu reads them in every chat for that project (newest 4000 characters). Under any answer, "Remember this" adds its first line to the notes. Notes are saved in Setu's own data folder, not in your project.

## v0.21: Loop
Type `/loop 10m check my tests` in the message box and Setu sends that prompt now and then again every 10 minutes (1 minute to 4 hours), up to 10 runs, only while Setu is open. A banner shows the run count and a Stop loop button. `/loop stop` also stops it. It stops by itself if you change the project folder or a message can't be sent. A loop never saves files on its own: Setu still shows the changes and waits for you.

## v0.22: Make an image, and Setu learns from you
- **Make an image** (Home chip or Ctrl+Shift+P): uses your own free Cloudflare account (Workers AI, FLUX schnell model). Paste your Account ID and an API token once; they are encrypted on this PC. The picture is saved in the project's `images` folder. Only your picture description is sent to Cloudflare. The free daily allowance is set by Cloudflare and can change.
- **Learns from you:** under each answer, 👍 or 👎 lets you say what you liked or what to change. Setu keeps up to 20 short notes on this computer and adds them to every chat. You can see, add and delete them in Settings, "What Setu learned about you". The model itself is not retrained.

## v0.22 extras (pre-installer checks)
- Only one Setu window at a time: opening it again brings the first one forward.
- Links and navigation inside the app open in your browser instead of replacing the app page.
- Background errors are logged instead of showing a crash box.
- Checked: 32 unit tests pass; main, preload and renderer all bundle; installer icon has the 256 px size Windows needs.

> Version note: the first public release is numbered **0.1.0**. The earlier "v0.20 to v0.22" headings above are internal build numbers from development.

## Test like a person (beta)
Home > "Test like a person", or Ctrl+Shift+P > "Test like a person (beta)". Setu opens your page (a localhost address, an https address, or an .html file in your project) in a small sandboxed test window. A model that can read images looks at the screen and chooses one step at a time: click, type, press a key, or scroll. It stops after 20 steps or 5 minutes, then shows a report with the screenshots, what looks wrong and any errors the page printed. "Ask Setu to fix it" puts the report into the chat.
- The test window has no access to Setu or to the computer: no Node, its own empty session, no downloads, no permissions, no extra windows.
- Only web pages for now. Testing real Windows apps (clicking outside Setu) is planned for later because it needs control of the whole screen.
- Not yet tried in a real Electron window: check it with a cloud model that can see images (or a local one such as llava).

## Chat memory fit and free-limit notes
- Long chats no longer lose the project files on local models. Setu now estimates tokens (about 4 characters each) and drops the oldest chat messages to stay inside the 8,192-token window (minus the instructions and room for the reply). It tells you when it does, and warns when a local chat is nearly full.
- Cloud models get at most 24,000 tokens of chat history (Ollama Cloud models 16,000), so long chats do not get expensive.
- Rate-limit messages from OpenRouter, your own API keys and Ollama Cloud now say that free limits are set by the provider, and suggest waiting, picking another model, or using a local one. The Providers screen explains that Setu cannot see a provider's remaining free allowance.

## Model library by work
Models screen now groups 24 local models (plus 2 cloud) by what they are for: Coding (7), Deep thinking (5), Vision (6), Everyday chat (4) and Tiny (2). Each row shows its download size and whether it fits this computer. Thinking models' `<think>` text is hidden in the chat. Gemma 3 1B is no longer treated as a picture reader (only the larger Gemma 3 sizes are). Sizes for qwen2.5-coder 3B/14B, deepseek-coder-v2, qwen3-coder, llama3.2-vision, phi4-mini, llama3.1, gemma3 and glm are from memory, so check them against ollama.com before launch.

## Explain simply (Run panel)
When a command fails, the Run panel shows one plain sentence about the likely cause (works with no model) and an "Explain simply" button. It asks Setu to explain the error like to a beginner, without changing files. "Fix this with Setu" still applies the fix.

## Updates
Setu checks the latest GitHub release (setudev1/Setu) 4 seconds after start and every 6 hours after that. If a newer version exists, a banner shows what's new with a Download button that opens the installer (or the release page). "Later" hides that version. Settings has a "Check for updates" button. Update is manual: download, run the installer over the old one; projects and chats stay. Nothing about the user is sent. To publish an update: raise `version` in package.json, upload setu.zip, run the build workflow; it makes the Release.

## Reviews
Home has a "Reviews" chip and the palette has "Reviews: see and write". It shows live reviews (average, a bar for each star count, Good 4-5 stars and Needs improvement 1-3 stars) and refreshes every minute while open. Reviews are public GitHub issues titled "[Review] N out of 5" with a "Rating: N/5" line in the repo set as REVIEWS_REPO in src/main/config.ts. "Post on GitHub" opens a prefilled issue (needs a free GitHub account). To remove a review, close or delete that issue. Issues must stay enabled on the repo.

## Problems and crashes
- If a screen crashes, Setu shows "Something went wrong" with Reload and Report buttons instead of a blank window. Saved projects and chats are not touched.
- Errors are written to `setu.log` in Setu's app-data folder (it restarts when it passes 200 KB).
- Palette (Ctrl+Shift+P) has "Report a problem". It opens a prefilled public GitHub issue ("[Bug] ...") with the note, version, system name and the last 5 error lines, with personal folder names and keys removed. The person presses Submit on GitHub themselves; Setu sends nothing on its own.

## Fast and flat look
Settings, "Speed and look", has "Fast and flat look" (on by default). It removes blur, glowing buttons, the moving background and text shadows, and uses solid surfaces, thin lines and small corners. Turn it off for the glass look. Note that `npm run dev` is always slower than the installed app because it is not minified.

## Speed

- Answers appear in smooth steps, not one redraw per word.
- The chosen model is loaded into memory in advance and kept there for 30 minutes, so the first answer does not wait.
- Computers with 8 GB of RAM or less use a smaller memory window (6,144 instead of 8,192) so models load and answer faster.
- When Setu starts Ollama, it turns on flash attention.

Tests in `tests/ollama-fake.test.ts` run Setu's model code against a fake Ollama server (list, chat, stop, errors, download). A real model still needs a test on a real computer.

## Share my build

In the Preview panel, **Share my build** saves a picture (1080 x 1350) of your page with the project name and "Built with Setu". It is drawn on your computer and nothing is uploaded. Post it with #MadeWithSetu.

## Daily challenge

The home screen shows one small project a day (30 of them, Easy to Hard). **Start** puts the request in the box; **I finished it** adds to your streak. Everything stays on your computer.
