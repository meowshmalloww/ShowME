# ShowME

> Don’t explain it. Make it visible.

ShowME is a native-feeling desktop visual lesson compiler for Windows and macOS. Invoke it over anything on screen, select the exact region that is confusing, ask by voice or text, and receive a validated, interactive lesson rather than a chat-shaped explanation.

Version `0.2.0` is a working product build, not a mockup or simulated AI flow. It includes a Tauri 2 desktop shell, invocation-only screen capture, rectangle/lasso/point/annotation selection, real provider adapters, validated visual lesson rendering, deterministic subject simulations, structured citations, local memory controls, and Windows installers. The primary workflow now stays with a compact floating pet: capture, review the approved crop, ask by text or microphone, and open the completed lesson in the main window. The mothership is intentionally limited to setup, history, settings, and finished lessons.

## Install on Windows

- Recommended: [NSIS setup](release/ShowME-0.2.0-Windows-x64-Setup.exe)
- Enterprise/manual deployment: [MSI package](release/ShowME-0.2.0-Windows-x64.msi)

Requirements: Windows 10 or 11 on x64, WebView2, network access for model calls, and an API key for the selected provider. The NSIS installer can bootstrap WebView2 when it is missing.

The installers are development artifacts and are not code-signed. Windows SmartScreen may therefore ask for confirmation. Production distribution should add Authenticode signing, a stable publisher identity, and an update channel.

## First lesson

1. Open ShowME and complete the short privacy-first onboarding.
2. Open **Settings → Providers**, select a provider, paste its API key, and run **Test connection**. Every provider credential is managed in this one screen. Keys go directly from the native settings command into the operating-system credential vault; they are not stored in frontend state, environment files, or SQLite.
3. Press `Ctrl+Shift+Space`, click the floating pet, or choose **New visual lesson** from the tray.
4. Draw a rectangle or lasso around the relevant material. Point, circle, arrow, line, and label tools can make the intended focus explicit.
5. The selected crop returns to the pet. Ask by text or microphone; optional nearby-screen, active-window, web-research, image-aid, copied-text, and source-URL context is available in the compact **Context** panel.
6. Press **Make it visible**. There is no fake or offline response path: generation requires a configured provider and validates the returned lesson before showing it.
7. Manipulate the generated controls, step through the visual, play narration, inspect evidence, or expand the visualization into a focused full-workspace view.

## Provider support

| Provider | Default route | Screenshot input | Strict scene output | Grounded web research | Voice |
| --- | --- | ---: | ---: | ---: | ---: |
| OpenAI | Responses API, `gpt-5.6-sol` | Yes | Yes | Yes | OpenAI transcription and speech endpoints |
| NVIDIA NIM | OpenAI-compatible chat completions | Model-dependent | Model-dependent; conservative default is off | No | No |
| Groq | OpenAI-compatible chat completions | Model-dependent | Model-dependent | No | No |
| Cerebras | OpenAI-compatible chat completions | No by default; paste text | Model-dependent | No | No |
| OpenRouter | OpenAI-compatible chat completions | Routed-model dependent | Routed-model dependent; parameters are required | No ShowME-grounded route | No |

Capability overrides are exposed because compatible providers evolve at model granularity. ShowME fails closed when a requested capability is unavailable instead of silently dropping the screenshot, schema, or research requirement. Voice transcription and narration currently require an OpenAI key even when another provider compiles the lesson.

## What is trusted

The model produces data, never executable UI code. Rust validates a bounded versioned `LessonPlan` before React renders it with a fixed component library. Verified simulations implement orbit, projectile, trigonometry, wave, circuit, event-loop, and function-graph behavior. The fallback custom animation format is declarative and runs in a CSP-constrained sandbox; it cannot contain JavaScript, HTML, CSS, shell, Rust, or arbitrary URLs.

Citations are retained only when they come from an explicit source URL or an actual OpenAI Responses web-search annotation. Provider-invented citation URLs are discarded. Wikimedia assets must use an allowed attribution/public-domain license and an `upload.wikimedia.org` media URL.

## Privacy model

- No background capture and no background microphone access.
- A monitor snapshot is taken only after an explicit invocation.
- The selected crop is the default model input. Nearby-screen and active-window images require per-request consent.
- Screen images and microphone bytes are held in memory and are not written to ShowME’s SQLite database.
- Saved lessons contain the question, plan, citations, provider/model metadata, and feedback; memory can be disabled, inspected, exported as JSON, or deleted.
- API keys are stored in Windows Credential Manager or macOS Keychain through the native keyring.

See [Privacy and security](docs/PRIVACY-SECURITY.md) for the complete data and network inventory.

## Develop locally

Prerequisites:

- Node.js compatible with Vite 8 (Node 20.19+, 22.12+, or a current LTS)
- Rust 1.88 or newer
- Windows: Visual Studio Build Tools with the Desktop development with C++ workload and WebView2
- macOS: Xcode command-line tools; macOS 12.3 or newer

```powershell
npm install
npm run check
npm run tauri -- dev
```

Build a platform-native package on that platform:

```powershell
npm run tauri -- build
```

Provider keys are intentionally not read from `.env`. Enter them through the app so they are stored by the native credential vault. `.env.example` contains only a non-secret frontend development toggle.

## Project map

- `src/components`: desktop views, selection overlay, lesson renderer, and verified simulations
- `src/lib`: types, Zod validation, coordinate mapping, audio capture, and deterministic simulation engines
- `public/sandbox.*`: fixed declarative custom-motion runtime
- `src-tauri/src`: capture, providers, validation, credentials, SQLite, audio, Wikimedia, windows, tray, and commands
- `src-tauri/capabilities`: least-privilege Tauri capability policy
- `docs`: research, architecture, security/privacy, and QA evidence

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Technical research](docs/RESEARCH.md)
- [Privacy and security](docs/PRIVACY-SECURITY.md)
- [QA and release evidence](docs/QA.md)

## Honest platform status

Windows x64 was compiled, linted, tested, packaged as NSIS and MSI, launched natively, and exercised through the real pet → capture overlay → crop handoff. Pet transparency, the compact question panel, provider settings, and saved pet-size control were visually inspected in the packaged application. Live model, speech, and provider connection tests require user-owned credentials and were not fabricated. The macOS paths, minimum version, credential-vault integration, and capture abstraction are implemented in source, but this release was not compiled, permission-tested, signed, or notarized on macOS. A public macOS release must be built and verified on Apple hardware.
