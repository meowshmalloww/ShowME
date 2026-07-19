# ShowME

> Don’t explain it. Make it visible.

ShowME is a screen-aware visual lesson compiler for Windows and macOS. Invoke the small top-edge island, select the exact part of the screen that is confusing, ask a question by text or push-to-talk, and receive a validated, interactive lesson instead of another chat transcript.

This repository is the Electron + TypeScript redesign. It does not use Tauri and it does not contain the old desktop pet.

## What is implemented

- A tiny top-edge dynamic-island launcher with explicit selection and voice-first hotkeys.
- DPI-aware, multi-monitor screen capture with area, lasso, point-out arrow, point, multiple-region, and entire-screen selection.
- Text and push-to-talk questions with Quick and cited Deep modes.
- OpenAI Responses API integration with GPT-5.6 Sol, strict structured output, image input, native web-search citations, transcription, and optional speech.
- OpenAI-compatible routes for Alibaba Cloud Qwen, NVIDIA NIM, Groq, Cerebras, and OpenRouter, with conservative capability gates.
- A trusted React renderer for primitives and deterministic orbit, projectile, trigonometry, wave, circuit, event-loop, function-graph, and constrained custom-motion modules.
- Independent Python verification and Rust display-geometry workers with TypeScript fallbacks.
- Side, inline, and focus lesson surfaces; step playback; captions; narration; follow-up adaptations; evidence states; citations; and feedback.
- Optional Wikimedia Commons visual references are fetched by Electron main, embedded as CSP-safe local data, and shown with source, creator, and license metadata.
- Local SQLite lesson history and explicit learning memory, encrypted provider credentials, JSON export, and deletion controls.
- First-run setup, provider model discovery/testing, teaching preferences, voice/language settings, and runtime readiness reporting.
- A separate `com.showme.desktop` application identity and `ShowME-Redesign` data directory, so the legacy Rust/Tauri installation and its data are left untouched.

ShowME intentionally does not create a fabricated demo lesson when no model is configured or a provider is unavailable. The UI explains the missing capability and offers remediation.

## Run locally

Prerequisites:

- Node.js 24+
- Rust 1.92+ for the native geometry worker
- Python 3.12+ and PyInstaller for the packaged verifier

    npm install
    npm run build:workers
    npm run build:icons
    npm run dev

The first launch asks for a provider and API key. Keys are encrypted with Electron safeStorage, which delegates to the operating-system credential system. No keys belong in .env; .env.example documents provider names only.

## Verification

    npm run typecheck
    npm test
    npm run test:rust
    npm run test:python
    npm run build

Create Windows installers with:

    npm run package:win

The NSIS and portable artifacts are written to release/.

## Repository map

    src/main/                 Electron authority: windows, capture, network, secrets, SQLite
    src/preload/              Minimal typed IPC bridge
    src/renderer/             Sandboxed React windows and trusted visual renderer
    src/shared/               Schemas, coordinates, types, deterministic TypeScript modules
    workers/native/           Rust geometry/DPI process
    workers/python/           Python numerical verifier
    tests/                    Schema, geometry, simulation, and persistence tests
    assets/                   Source and generated application icons

For the full boundaries and flow, see [ARCHITECTURE.md](ARCHITECTURE.md). For data handling, see [PRIVACY-SECURITY.md](PRIVACY-SECURITY.md). For tested and manual scenarios, see [QA.md](QA.md).

## Provider behavior

OpenAI is the reference path because it supports the complete combination of image input, strict Responses API output, web-search annotations, transcription, and speech. Other provider integrations use their official OpenAI-compatible endpoints and are capability-gated. A provider or model that cannot see images will not be asked to interpret a screenshot unless the user supplies copied text or deliberately overrides its capability.

Deep mode requires a native, citation-bearing web-search route. In the current build that means OpenAI. Quick mode avoids web research unless the user enabled it as a default.

## Known limitations

- Push-to-talk and global voice capture are implemented; continuous wake-word listening is intentionally not present.
- Arbitrary desktop context currently uses selected screenshot pixels and user-supplied text/URLs. Native OCR and Windows UI Automation/macOS Accessibility text extraction are not integrated yet.
- Generation reports honest pipeline progress, but the trusted visual lesson appears only after the complete structured plan validates; partial model JSON is never rendered as a lesson.
- This release is built and tested on Windows. The Electron architecture includes macOS permission handling, but no macOS release is claimed without testing on an actual Mac.
- Provider-dependent end-to-end checks require the tester’s own credentials and are never replaced by fixture output in the production app.

## License

Apache-2.0. See [LICENSE](LICENSE).
