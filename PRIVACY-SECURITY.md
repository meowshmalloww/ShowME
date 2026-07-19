# Privacy and security

## Product promises enforced in code

- ShowME captures the screen only after a visible click, tray action, or user-configured global hotkey.
- Push-to-talk obtains microphone access only while the user records a question.
- There is no wake-word listener, background transcription loop, screenshot timer, analytics SDK, or remote telemetry in this repository.
- Prepared screenshots are held in process memory, capped to a small number, expire after 15 minutes, and are cleared after use or cancellation. They are not inserted into SQLite.
- Provider credentials are encrypted through Electron safeStorage. If secure storage is unavailable, a key is kept for the process session only and the user receives an error explaining that it was not persisted.
- Lesson history, feedback, settings, and learning memory are stored locally in SQLite.
- Export and deletion are explicit user actions.

## Data leaving the device

A provider request can contain:

- the prepared crop or explicitly captured display;
- the learner’s question;
- copied text or a source URL when the learner supplied it;
- selected teaching and language preferences;
- a short local memory summary when learning memory is enabled.

Deep mode can ask the selected provider to perform web research. Wikimedia Commons is queried only when the learner enabled licensed image aids and a lesson requests a search. OpenAI speech sends the selected narration text when cloud speech is selected. The default narration engine is the local system voice.

Provider services apply their own retention and account policies. ShowME sets store:false on OpenAI Responses requests, but users should still review the policy for the provider and account they choose.

## Renderer boundary

Renderer content has no Node integration. Navigation, popups, webviews, and non-HTTP external protocols are blocked. Network access for providers, media search, and speech is owned by Electron main. IPC senders are checked against the local app origin, inputs are schema-validated, and errors are reduced to small, redacted envelopes.

The Content Security Policy permits local scripts/styles and in-memory image/audio data. It denies objects, frames, forms, and renderer connections.

## Prompt injection and untrusted content

Text visible in a screenshot is evidence, never authority. The system prompt tells providers to ignore instructions embedded in the image or copied source. This is reinforced structurally:

- model output must match a closed schema;
- strings render as escaped React text;
- no model HTML, SVG, JavaScript, shell command, Python, or Rust is run;
- simulation kinds and control bindings are allowlisted;
- event-loop code is parsed by a narrow static tracer and never executed;
- citation links are reconciled against observed provider annotations;
- only HTTP and HTTPS citation URLs can be opened externally.

## Permissions

On macOS, users grant Screen Recording and Microphone permissions through System Settings. On Windows, microphone permission appears when recording starts. Electron desktop capture uses the platform capture APIs. ShowME’s permission page reports known platform status and avoids claiming “granted” when Windows does not expose a preflight status.

## Reporting a vulnerability

Do not include real API keys, screenshots, transcripts, or exported learning data in a public issue. Report the minimal reproduction privately to the project maintainers and rotate any credential that may have been exposed.
