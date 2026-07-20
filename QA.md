# Quality assurance

## Automated checks

Run the full local gate with npm run check.

| Area | Coverage |
| --- | --- |
| Type safety | Strict TypeScript 7, exact optional properties, unchecked-index protection, separate main and web configs |
| Lesson trust | Closed Zod schema, JSON schema export, reference validation, simulation/control binding checks |
| Coordinates | Logical-to-normalized conversion, physical crop conversion, multi-region padding, arrow snapping |
| Simulations | Orbit classification, projectile path, event-loop ordering, circuit derivation |
| Persistence | SQLite settings and explicit-memory round trip |
| Wake phrase | Synthesized positive phrase, ordinary-speech rejection, browser PCM conversion, utterance segmentation, and level normalization |
| Rust worker | Physical crop conversion and full-screen fallback |
| Python worker | Orbit, projectile, and invalid custom-motion checks |
| Production assets | Electron Vite main, preload, and renderer bundles |

## Manual desktop matrix

Before a release, test these on physical Windows and macOS systems.

### Capture and displays

- Primary display at 100%, 125%, 150%, and 200% scale.
- Two displays with different scale factors and negative display origins.
- Selection on each display after moving the cursor and hotspot.
- Area, lasso, point-out arrow with Shift snapping, point, multiple regions, undo/redo, Enter, Escape, and entire-screen commit.
- Confirm the launcher is absent from the captured image and the source display is not persisted to lesson history.
- macOS Screen Recording denied, then granted after restart.

### Launcher and hotkeys

- Idle grip reveals and conceals without stealing focus from normal work.
- Global selection and voice-first shortcuts from a full-screen app.
- Tray open, capture, and quit behavior.
- A shortcut conflict does not break startup; confirm the configured preset is registered on the test machine.
- Closing the main window hides it; explicit Quit exits every process.
- With the selected microphone, confirm the idle waveform moves with speech, “Show me” wakes exactly once, ordinary conversation does not capture, and the separate question recorder begins only after wake.

### Providers

For each provider: invalid key, expired key, rate limit, nonexistent model, model discovery, connection test, cancellation/network loss, and a valid Quick lesson. Confirm non-vision providers reject screenshot-only requests before submission.

For OpenAI: valid GPT-5.6 Sol Quick lesson, Deep lesson with clickable citations, no-citation downgrade, transcription, OpenAI speech, and local system speech. Also verify Deepgram and ElevenLabs transcription plus ElevenLabs narration with provider test credentials. Verify API keys never appear in logs or UI after save.

### Lesson renderer

- Every primitive at extreme valid coordinates and with long safe text.
- Every deterministic module with control minimum, maximum, and rapid updates.
- Side, inline, and focus surfaces on small and large work areas.
- Step navigation, story playback, reduced motion, captions, local narration, cloud narration disclosure, follow-up question, each adaptation, citations, and helpful/not-helpful feedback.
- Licensed-image aids enabled and disabled, Wikimedia attribution/source opening, no-result state, and offline media-search recovery.
- Pause and reduced-motion state preserves the current simulation frame instead of jumping back to the beginning.
- Malformed plans, unknown IDs, bad URLs, invalid bindings, NaN/infinite values, and excessive arrays are rejected instead of partially rendered.

### Privacy and recovery

- Secure storage unavailable: key remains session-only and the user sees remediation.
- Microphone permission can be requested from Privacy settings, the test stream is released immediately, and denied access has useful recovery text.
- Provider capability overrides remain behind the Advanced disclosure and affect preflight capability gates after saving.
- Learning memory disabled: no new preference or concept records.
- Export contains settings, lessons, and memories but no keys or screenshots.
- Delete one lesson, one memory, and all data; restart and verify state.
- Database interruption, WAL recovery, and corrupt settings JSON fallback.
- Renderer attempts to navigate, open a popup or webview, call an unknown IPC channel, or use a non-HTTP external URL are blocked.

## Release gate

A release candidate is acceptable only when all automated checks pass, the production bundle builds, both workers package, icons exist, the installer launches on a clean user profile, capture permissions have useful remediation, and at least one real end-to-end OpenAI lesson has been visually inspected. Provider-dependent tests require the tester’s own credentials and are not faked in CI.
