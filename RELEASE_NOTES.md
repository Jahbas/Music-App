# Music – Release notes

<!--
This file is the single source of truth for desktop release notes.

When publishing a new GitHub Release for the Electron app, copy the
section for the new version into the release body so the in‑app
update preview shows the same text.
-->

## 1.7.0 – Desktop updater & version info

- Added an opt‑in desktop updater in Settings that can check GitHub for new Windows builds and install them directly from the app.
- On startup (when enabled), the desktop updater now checks for new versions automatically and shows a clear version label in the top bar (current → latest when an update is available).
- Improved update UX with a short cooldown between manual checks to avoid spamming GitHub, plus clearer status text and error handling for failed checks or downloads.
- Fixed startup CORS noise by avoiding cross‑origin favicon preloads in the renderer.
- Fixed a crash when installing updates from Settings by routing status text through the shared update store.
- Player reliability fixes: restored last‑played track now resumes correctly after restart, and the progress bar shows the correct total duration instead of briefly displaying 0:00.

