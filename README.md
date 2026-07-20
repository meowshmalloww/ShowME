<p align="center">
  <img src="assets/icon.png" width="92" alt="ShowME application icon">
</p>

<h1 align="center">ShowME</h1>

<p align="center"><strong>Don't explain it. Make it visible.</strong></p>

<p align="center">
  A Windows-first desktop application that turns anything visible on your screen into a focused, interactive lesson.
</p>

ShowME sits quietly at the top edge of the display. Select an area, point, lasso, arrow, or entire screen; ask what you want to understand; and receive a validated visual lesson instead of a generic chat response.

This repository contains the Electron, TypeScript, and React redesign. It is independent from the legacy Rust/Tauri application, does not include a desktop pet, and stores its data in a separate application directory.

## How it works

1. Open the compact top-edge island or use a global shortcut.
2. Select only the part of the screen relevant to your question.
3. Ask by text, voice shortcut, or the fixed local wake phrase, **ShowME**.
4. ShowME sends the prepared visual context to the configured vision model.
5. The response must pass a closed lesson schema and reference validation.
6. A trusted local renderer presents the explanation as steps, annotations, controls, narration, and evidence.

Screenshots are captured only after an explicit selection action or a recognized wake phrase. They remain in short-lived process memory and are not written to lesson history.

## Highlights

### Compact desktop interface

- Tiny rounded island at the top edge of the active display.
- Separate idle, revealed, listening, transcribing, thinking, speaking, and question states.
- Area, lasso, point-out arrow, point, multiple-region, and entire-screen capture.
- DPI-aware physical-pixel cropping and mixed-scale multi-monitor support.
- Collapsible application sidebar with system, light, and dark themes.
- Side, inline, and focus lesson surfaces.

### Visual lesson compiler

- Step-by-step narration with trusted visual primitives.
- Deterministic orbit, projectile, trigonometry, wave, circuit, event-loop, and function-graph modules.
- Bounded custom shapes and motion without arbitrary code execution.
- Follow-up actions for simpler, deeper, slower, faster, mathematical, alternative-example, and learner-controlled explanations.
- Local captions, step playback, evidence status, citations, and helpful/not-helpful feedback.

### Voice interaction

- Fixed **ShowME** wake phrase for reliable recognition.
- Lightweight Windows wake recognizer that runs locally.
- Configurable microphone and speaker devices with a live input-level test.
- Echo cancellation, noise suppression, automatic gain, silence timing, and recording limits.
- OpenAI or Groq transcription for spoken questions.
- Local Windows narration by default, with optional OpenAI speech.
- No provider audio is sent until the wake phrase is recognized or the user starts voice capture.

### Provider and model control

ShowME supports these routes:

| Provider | Visual input | Structured lesson path | Web research | Voice services |
| --- | --- | --- | --- | --- |
| OpenAI | Yes | Native strict JSON schema | Yes | Transcription and speech |
| NVIDIA NIM | Model-dependent | Validated compatible JSON | No | No |
| Alibaba Cloud Qwen | Model-dependent | Validated compatible JSON | No | No |
| Groq | Model-dependent | Provider/model-dependent schema | No | Transcription |
| Cerebras | Disabled by default | Provider structured output | No | No |
| OpenRouter | Model-dependent | Route/model-dependent schema | No | No |

Model controls are locked until the provider key is saved. ShowME then loads the provider's available models and presents select-only lesson and repair-model fields; model IDs are not entered manually.

For NVIDIA NIM, the catalog merges the live provider response with verified image-input metadata, labels free endpoints, and marks known deprecating models. The current default is `nvidia/nemotron-nano-12b-v2-vl`.

Provider capabilities can change. ShowME keeps advanced overrides behind an explicit disclosure and rejects screenshot-only requests before submission when the selected route is not configured for vision.

## Security and privacy

Model output is treated as untrusted data, never executable application code.

- Renderer windows use Chromium sandboxing, context isolation, no Node integration, no webviews, blocked navigation, and a restrictive Content Security Policy.
- Provider traffic, screen capture, SQLite access, credential access, file dialogs, and worker processes stay in Electron main.
- Lesson plans must pass a closed Zod schema, global ID checks, primitive references, citation references, numerical bounds, simulation bounds, and control-binding rules.
- Model-authored HTML, JavaScript, SVG markup, shell commands, Python, and Rust are never executed.
- Event-loop examples use a narrow static tracer; the selected code is not run.
- On Windows, saved provider keys are encrypted for the current Windows user through DPAPI with application-specific entropy. Plaintext keys are passed to the trusted native worker over standard input, never command-line arguments.
- On other supported desktop platforms, Electron secure storage delegates to the operating-system credential backend.
- Lesson history, feedback, settings, and optional learning memory remain in local SQLite.
- Stored lessons contain the validated lesson presentation, not the original screenshot.
- Exported learning data excludes API keys and screenshots.

See [PRIVACY-SECURITY.md](PRIVACY-SECURITY.md) for the complete data and trust boundaries.

## Requirements

The current release and end-to-end verification target Windows.

- Node.js 24 or newer
- Rust 1.92 or newer for the native DPI/crop and credential worker
- Python 3.12 or newer
- PyInstaller for packaging the Python verification worker

## Development

Install dependencies and start the Electron application:

```powershell
npm install
npm run build:workers
npm run build:icons
npm run dev
```

The first launch guides the user through provider setup. Do not place real API keys in `.env`; keys are entered in the application and encrypted by the operating system.

Default Windows shortcuts:

| Action | Shortcut |
| --- | --- |
| Select something | `Ctrl+Shift+Space` |
| Voice-first capture | `Ctrl+Shift+V` |

Both shortcuts can be changed to one of the provided conflict-safe presets in Settings.

## Verification

Run the complete local gate:

```powershell
npm run check
```

This runs formatting verification, linting, TypeScript checking, renderer and schema tests, wake-recognizer tests, Rust tests, and Python tests.

Individual commands are also available:

```powershell
npm run typecheck
npm test
npm run test:wake
npm run test:rust
npm run test:python
npm run build
```

The current Windows verification includes a real NVIDIA NIM connection, live image-model discovery, a screen-crop-to-lesson generation test, light/dark contrast inspection, Windows credential migration, and a packaged executable launch.

## Build and package

Create an unpacked application directory:

```powershell
npm run pack
```

Create the Windows NSIS installer and portable executable:

```powershell
npm run package:win
```

Artifacts are written to `release/`. Generated application bundles, dependencies, worker binaries, and installers are intentionally excluded from Git because they are reproducible build output.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `src/main/` | Electron authority, capture, providers, encrypted credentials, SQLite, windows, and workers |
| `src/preload/` | Minimal typed IPC bridge exposed to sandboxed renderers |
| `src/renderer/` | React interface, selection overlay, dynamic island, settings, and trusted lesson player |
| `src/shared/` | Types, schemas, coordinates, model metadata, defaults, and deterministic simulations |
| `workers/native/` | Rust DPI/crop and Windows DPAPI operations |
| `workers/python/` | Independent deterministic verification worker |
| `workers/wake/` | Local Windows wake-recognition process |
| `tests/` | Schema, geometry, simulation, provider, persistence, and component tests |
| `assets/` | Application icon source and generated platform icons |
| `scripts/` | Icon, wake-test, and worker build utilities |

For deeper implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md). For the automated and manual release matrix, see [QA.md](QA.md).

## Local data

The redesign uses a dedicated `ShowME-Redesign` data directory so it does not overwrite the legacy Tauri application's database or credentials.

On Windows, application data is stored under:

```text
%APPDATA%\ShowME-Redesign
```

The directory contains local settings, lesson history, learning memory, Chromium application state, and a separate encrypted credential file.

## Current limitations

- Windows is the tested release platform. macOS permission handling and packaging configuration exist, but a macOS release should not be claimed until it passes the physical-device QA matrix.
- Voice questions require an OpenAI or Groq transcription key. NVIDIA NIM and the other lesson providers do not automatically provide speech transcription.
- Citation-bearing Deep research currently requires the OpenAI Responses web-search route.
- Exact vision and structured-output behavior varies by provider and model; the application cannot infer undocumented capabilities perfectly.
- Native OCR and operating-system accessibility-tree extraction are not yet included. Visual context comes from the selected pixels plus text or URLs explicitly supplied by the user.
- Partial model JSON is never rendered. The lesson appears only after the complete plan validates.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Privacy and security](PRIVACY-SECURITY.md)
- [Quality assurance](QA.md)
- [Research notes](RESEARCH.md)
- [Apache License 2.0](LICENSE)

## License

ShowME is licensed under the [Apache License 2.0](LICENSE).
