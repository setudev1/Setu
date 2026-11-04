# Setu - how to get the installer (3 steps)

You need: a free GitHub account and Git installed (git-scm.com). Nothing else. GitHub builds the installer for you on a Windows computer in the cloud.

## Step 1: put the folder on GitHub (once)
1. On github.com create a new EMPTY repository named `Setu` under `setudev1` (do not add a README).
2. Double-click `UPLOAD-TO-GITHUB.bat` in this folder. Sign in to GitHub if it asks.
   (If you prefer: GitHub Desktop -> Add this folder -> Publish.)

## Step 2: make the installer (one button)
1. Open the repo on GitHub -> **Actions** tab -> **Build Windows installer** -> **Run workflow** -> green button.
2. Wait about 10-15 minutes.
3. Open the finished run. Under **Artifacts** download **Setu-Setup**. Inside is `Setu-Setup-0.1.0.exe` (and a .sha256 file).
   This is the file you send to creators and to bhaiya for the Windows test.

## Step 3: launch day (8 Nov)
Double-click `RELEASE-8-NOV.bat` (or Actions -> Run workflow -> tick "publish"). This makes the public download
`github.com/setudev1/Setu/releases/latest/download/Setu-Setup.exe`, which the website button uses.

## Other things in this folder
- `website/` - the landing page. Put it on any free host (Netlify / GitHub Pages / Cloudflare Pages), then replace `YOUR-DOMAIN` in index.html, sitemap.xml, robots.txt.
- `docs/` - feature list and layout notes.
- The first build has no `package-lock.json`, so GitHub shows a yellow warning. It still works. For exact versions, run `npm install` once on a PC with internet and commit the new `package-lock.json`.
- Windows will warn "unknown publisher" because the installer is not code-signed yet. Tell people: **More info -> Run anyway**.
- Do NOT test Setu on bhaiya's PC before this build; use the installer from Step 2.
