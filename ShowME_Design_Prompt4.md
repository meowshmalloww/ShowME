Treat the attached ShowME documents as the full product specification. Read every document completely before acting.

This instruction is the authoritative implementation override. Where the documents conflict, use this priority:

1. This instruction.
2. The newest UI/design-feedback document.
3. The ShowME Master Product Blueprint.
4. The strategic research report.
5. Older implementation prompts.

You are the principal engineer, product architect, desktop-systems engineer, AI engineer, researcher, UX/product designer, security engineer, QA lead, and release engineer.

Build ShowME as a real, polished, production-quality desktop application. Do not stop after research, planning, wireframes, mockups, static screens, or a toy demo. Research current documentation, inspect the workspace, make professional decisions, implement the connected product, rigorously test it, package it, and report only what actually works.

Do not ask me to choose routine libraries, visual styling, folders, or implementation details. Make good decisions yourself. Do not create spaghetti code, fake AI behavior, dead buttons, hardcoded “AI” lessons, pre-recorded simulations, or a generic chatbot with arrows.

## Required stack

Use this stack:

- Electron as the native desktop shell.
- TypeScript for Electron main process, preload layer, shared contracts, provider orchestration, storage coordination, and secure IPC.
- React + TypeScript for all user-facing UI.
- Rust for native/performance-sensitive capabilities such as capture support, coordinate transforms, multi-monitor/DPI handling, overlay hit-testing, and platform bridges where Electron alone is insufficient.
- Python as an isolated local verification worker for deterministic math, physics, graphs, code tracing, and other educational calculations.
- Use one designated persistence owner for local storage so Electron, Rust, and Python never fight over the same database.

Do not use Tauri. Do not turn Python into the desktop UI or an uncontrolled local web server. Do not use Rust or Python only cosmetically; give each clear, tested responsibilities.

Use secure Electron architecture:

- context isolation enabled.
- Node integration disabled in renderer windows.
- Minimal typed preload APIs only.
- Strict IPC allowlists and runtime validation.
- No direct renderer access to filesystem, shell, process APIs, secrets, or arbitrary network requests.
- No arbitrary model-generated code in privileged Electron, Rust, Python, or Node contexts.
- Secure provider keys in OS-backed encrypted storage; never expose them to React, logs, screenshots, source control, or release builds.

## Preserve the ShowME product thesis

ShowME is a native, screen-aware visual lesson compiler:

“Don’t explain it. Make it visible.”

A learner selects something confusing on screen—or explicitly invokes voice help—and ShowME turns the selected context into a spoken, interactive, visual explanation directly over or beside the source material.

It is not a browser extension, generic chat sidebar, text summarizer, AI video generator, dashboard-first app, or screen-recording tool.

It teaches, explains, points, highlights, draws, simulates, and guides. It never secretly clicks, types, purchases, navigates, or performs actions on the user’s behalf.

Preserve the full capabilities described in the attached blueprint:

- Screen capture after user invocation only.
- Rectangle, lasso, text, point, multiple-region, code, diagram, video-frame, and user-annotation selection.
- Voice-first interaction with text fallback.
- Spoken narration plus live captions/transcript.
- User interruption while narration is speaking.
- “Simpler,” “deeper,” “slower,” “faster,” “replay,” “show math,” “show another example,” and “let me control it” must meaningfully change the lesson.
- GPT-5.6 as the primary OpenAI vision/reasoning/structured lesson-planning path.
- Motion art: arrows, labels, diagrams, shapes, paths, graphs, transformations, focus effects, visual metaphors, and live animation.
- Real interactive simulations—not static/pre-recorded demo scenes.
- Physics, mathematics, and programming as deeply supported initial domains.
- Web research, citations, optional lawful external imagery, and local learning memory.
- OpenAI, NVIDIA NIM, Groq, Cerebras, and OpenRouter provider support.
- Local-first privacy controls, export, deletion, and memory disablement.

## Latest UI direction — this overrides older pet/orb instructions

Do not build a floating pet in this version.

When inactive, ShowME should be a very small, elegant, borderless top-edge launcher inspired by a Dynamic Island:

- Hidden or nearly invisible when not needed.
- Reveals on intentional hover, global hotkey, click, or explicitly enabled push-to-talk/wake interaction.
- No large “ShowME” label.
- No dropdown arrow.
- No camera-plus-cross icon.
- No permanent top taskbar.
- No “new capture,” mute, settings, or launcher controls inside the tiny launcher.
- Put those controls in the tray menu and proper settings.
- Create a refined, original, recognizable SVG icon.
- Make the launcher movable/configurable only if it remains clean and unobtrusive.

Voice wake behavior must be disabled by default. Push-to-talk and hotkeys must work without continuous microphone use.

When ShowME is actively capturing, reasoning, researching, or teaching, use a subtle visible active-state treatment around the selected source or lesson plane. A thin neon-blue or user-configurable outline is acceptable, but do not create an ugly permanent blue page border.

Redesign the current homepage/history/library experience. It must not be a boring hero page, giant wall of text, generic AI dashboard, or card overload. Make it a calm private learning library with recent lessons, useful memory, and optional lightweight streak/progress only where it adds real value.

Research excellent desktop/product UI references, including design galleries if useful, but create an original design. Do not copy another product’s UI or copyrighted artwork.

## Teaching experience

The teaching surface is the product. Do not put the main experience inside a chat panel.

Support:

- Inline teaching over the selected material.
- Side-by-side movable lesson plane.
- Focus/whiteboard mode that dims distractions.
- Clean live captions that do not obstruct the source.
- Pause, replay, step-through, speed control, mute, stop, and interaction controls.

The model must generate a validated structured lesson/scene plan, not primarily a text answer. The renderer must own geometry, animations, interactions, and screen placement.

Use trusted visual primitives and a versioned scene schema. Validate every model result before rendering.

For real physics, math, circuits, graphs, and code flow:

- Use deterministic verified modules/calculations.
- Let the model choose the appropriate module, parameters, teaching order, and visual language based on the user’s actual selected context.
- Do not make the orbital demo a keyword-triggered hardcoded animation.

For unusual concepts, support a constrained sandboxed custom visualization route. Prefer a declarative visual DSL. If generated code is necessary, isolate it completely with no Node, Electron, filesystem, shell, network, credential, or desktop privileges. Enforce strict schema checks, CSP, validated messages, cancellation, timeouts, memory limits, and crash recovery.

## Voice, providers, and memory

Voice must be real:

- Push-to-talk.
- Text fallback.
- Visible transcription.
- Spoken narration.
- Captions.
- Barge-in/interruption.
- Voice settings with local/system voice and supported external voice-provider choices, including ElevenLabs only if actually integrated and tested.

Provider settings must be simple, not a messy grid:

1. Select provider.
2. Enter/store API key securely.
3. Test connection.
4. Fetch/select model.
5. Select VLM/reasoning model.
6. Select optional LLM model.
7. Select speech input/output provider.
8. Show capability status.

The user chooses models. Do not force a model name under every provider card. OpenAI and GPT-5.6 must be the strongest, fully tested hackathon path, but users may select other supported providers/models.

Build a genuinely useful, efficient local memory system. It should remember explicit teaching preferences, helpful explanation modes, lesson receipts, concepts studied, feedback, and relevant context without becoming a raw transcript dump or diagnosing the user. Users must inspect, export, delete, or disable memory.

## Research, sources, media, and privacy

Research before implementation using current official documentation for Electron, Windows/macOS capture and permissions, OpenAI, all configured providers, Rust/Python integration, accessibility, and safe media sourcing.

Implement Quick and Deep modes:

- Quick: selected context, model reasoning, trusted local modules, fast response, no external research unless explicitly enabled.
- Deep: user-approved web research, source checks, citations, richer verification, and optional lawful media support.

Do not scrape Google Images. Non-commercial/open-source status does not grant permission to use arbitrary media. Prefer original vector diagrams and motion art. Use externally sourced images/videos only when the source/license/embedding terms allow it, with attribution and source links.

Never continuously capture the screen or listen to the microphone by default. Make capture scope, web research, memory, and provider data use clear and controllable.

## Required verification and delivery

Do not declare completion until you have:

- Built, linted, type-checked, tested, and packaged the app.
- Run React/TypeScript tests, Rust tests, Python tests, integration tests, and practical end-to-end tests.
- Tested real provider configuration with OpenAI when credentials are available.
- Tested no-key, bad-key, no-network, denied capture, denied microphone, unsupported provider, invalid model output, worker failure, and cancellation states.
- Tested selection, voice/text questions, visual lessons, narration, captions, adaptation, real simulations, web citations, memory, provider switching, privacy deletion, and settings.
- Tested coordinate transforms and overlay behavior across display scaling where possible.
- Verified Windows on real Windows.
- Verified macOS on real macOS only if available; otherwise do not claim it is verified.

Deliver a complete README, architecture document, provider-capability matrix, privacy/security documentation, memory documentation, test report, known limitations, sample test content, packaging instructions, and hackathon demo guide.

The application is done only when a real user can select something confusing on screen, ask by voice or text, have GPT-5.6 understand the context, receive a validated live visual lesson with narration and captions, manipulate a real simulation, adapt the lesson, use research/sources when approved, and control/delete local memory.

Begin by reading all attached documents and inspecting the workspace. Then research, build, verify, and deliver the real application.

