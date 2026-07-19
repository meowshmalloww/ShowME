You are the principal engineer, product architect, desktop-systems engineer, AI engineer, UX/product designer, security engineer, researcher, QA lead, and release engineer for a serious product.

Build a complete, production-quality desktop application named ShowME.

Do not stop at planning, wireframes, static mockups, placeholders, disconnected components, fake AI, pre-recorded simulations, hardcoded demo flows, or a generic chatbot UI. Research first, inspect the existing workspace, make sound decisions, implement the real connected product, test it thoroughly, and only then report completion.

Take the time needed. Do not rush. Do not ask me to choose routine package, folder, visual-style, or implementation details. Make strong professional decisions. Do not spawn an unnecessary swarm of subagents or build a fake “company”; work carefully and systematically.

The user’s latest requirements below override conflicting older material.

# 1. PRODUCT THESIS

Product name: ShowME

Tagline:

“Don’t explain it. Make it visible.”

ShowME is a native Windows and macOS desktop visual lesson compiler.

A person sees something confusing on their screen—a physics diagram, PDF, graph, math problem, code editor, video frame, browser page, unfamiliar software interface, music waveform, chemistry image, PCB image, document, or everyday web task—and invokes ShowME.

They can ask by voice or type:

- “I don’t understand this.”
- “Why does this happen?”
- “Make it visual.”
- “Show the math.”
- “Slow down.”
- “I still don’t get it.”
- “Show me another example.”
- “Let me control it.”
- “How do I find this setting?”
- “What happens if I change this?”

ShowME understands the user-selected material plus approved context, then turns the screen into a temporary, live teaching surface.

It teaches using spoken narration, captions, highlighted source material, arrows, labels, shapes, graphs, diagrams, motion art, interactive controls, and real simulations.

The core innovation is not screen capture, a mascot, generic AI chat, summary text, or AI video generation.

The core innovation is:

> ShowME compiles a learner’s question and screen context into the smallest useful interactive visual explanation.

A normal tutor describes an answer. ShowME makes the answer visible and manipulable where the learner got stuck.

# 2. NON-NEGOTIABLE PRODUCT BOUNDARIES

ShowME is:

- A native desktop application, not a Chrome/browser extension.
- A real Windows application; architect it for macOS and verify macOS only if an actual Mac environment is available.
- Voice-first but never voice-only.
- Screen-aware only after explicit user invocation.
- A teacher, visual explainer, and navigational guide.
- Able to point out where to click or explain a workflow, but never silently clicks, types, purchases, sends, modifies, or performs actions for the user.
- A product with real providers and real API calls when configured.
- A production-quality application with graceful no-key, no-network, missing-permission, and unsupported-provider behavior.

ShowME is not:

- A browser extension.
- A generic chat sidebar with decorative arrows.
- A chatbot that happens to receive screenshots.
- A text summarizer.
- A dashboard-first product.
- A pet/mascot product.
- An always-on screen recorder.
- An always-listening microphone.
- An AI video generator.
- A static/pre-recorded simulation gallery.
- A hardcoded orbital-demo launcher.
- A system that diagnoses ADHD, dyslexia, intelligence, fatigue, emotion, or any medical/learning condition.
- A system that scrapes, downloads, or reuses arbitrary copyrighted images/videos because they are publicly online.

# 3. REQUIRED TECHNOLOGY FOUNDATION

Use all four technologies intentionally, with clear responsibilities.

## Electron + TypeScript

Use Electron as the desktop application shell.

Electron main process owns:

- Application lifecycle.
- Secure BrowserWindow creation and management.
- Tray/menu behavior.
- Top-edge launcher window.
- Selection/capture overlay windows.
- Lesson overlay windows.
- Permission flow.
- Secure, typed IPC.
- Network access to model providers and research services.
- Local persistence coordination.
- Provider configuration.
- Secure credential access.
- Platform capability checks.
- Packaging and update-ready architecture.

Use modern Electron security practices:

- contextIsolation enabled.
- sandbox enabled where practical.
- nodeIntegration disabled in renderers.
- no remote module.
- minimal, typed preload APIs only.
- strict IPC allowlists and runtime argument validation.
- restrictive Content Security Policy.
- no arbitrary shell execution from renderers.
- no direct filesystem, process, network, or API-key access from React code.
- deny unexpected navigation, popups, external content, and untrusted window creation.

## React + TypeScript

Use React and TypeScript for all user-facing interfaces:

- Launcher.
- Selection experience.
- Teaching overlay.
- Lesson plane.
- Captions/transcript.
- Settings.
- Provider configuration.
- Memory/history.
- Sources/evidence.
- Error states.
- Accessibility controls.

Use a maintainable, strongly typed UI architecture. Choose a high-quality component/accessibility approach and a visual system after researching excellent desktop/product UI references. Do not copy another company’s UI, copyrighted artwork, or branded design; use references for principles and create an original design.

## Rust

Use Rust for performance-sensitive and platform-native operations where it materially helps:

- Native screen/window capture abstraction.
- Multi-monitor and DPI coordinate normalization.
- Native cursor/window hit testing where Electron alone is insufficient.
- High-performance rendering or simulation helpers if research proves useful.
- Native platform bridges for Windows/macOS features.
- Secure, versioned local worker/native-module boundaries.
- Resource-constrained operations that should not run in the UI thread.

Do not use Rust merely for appearance. Give it real, testable responsibilities. Keep it isolated behind explicit typed APIs. Do not let Rust code expose unrestricted OS operations to model output or renderer code.

## Python

Use Python as a constrained local computation and verification worker, not as the primary desktop UI or an uncontrolled local web server.

Python should support real deterministic educational work such as:

- Symbolic/numeric math checking.
- Physics calculations and validation.
- Graph/function verification.
- Circuit or waveform calculations where appropriate.
- Code-trace or algorithm-validation utilities where safe.
- Optional concept-specific simulation validation.

The Python worker must:

- Use a versioned, typed request/response protocol.
- Have no direct access to user files, desktop-control APIs, provider API keys, or arbitrary network access.
- Receive only the minimum structured data needed.
- Have timeouts, memory limits, cancellation, logging, and clear error states.
- Be independently testable.
- Never execute arbitrary model-generated Python on the host.

## Recommended product split

Electron main process:
- Privileged coordinator and only owner of credentials/network/provider calls.

React renderer:
- Beautiful UI, lesson plane, selection UX, captions, and trusted rendering.

Rust:
- Native/platform/performance bridge.

Python:
- Deterministic educational verification worker.

Use one clear persistence owner to avoid SQLite locking or competing writes between Electron, Rust, and Python. Other components must request persistence through the designated owner.

# 4. UI AND INTERACTION DESIGN — LATEST REQUIREMENTS

The current UI must be redesigned from scratch. It must not look like generic “vibe-coded AI software.”

Research high-quality desktop, ambient-assistant, educational, creative-tool, and premium consumer-product UI references. Create an original visual direction from the principles you learn.

## Idle launcher

Do not use a floating pet in this version.

When inactive, ShowME should be almost invisible and unobtrusive:

- A compact, borderless, rounded top-edge launcher inspired by the interaction quality of a Dynamic Island.
- It should hide or minimize when not needed.
- It may reveal on intentional hover, global hotkey, click, or explicitly enabled push-to-talk/wake interaction.
- Do not display a large “ShowME” title, dropdown arrow, generic camera/cross icon, huge taskbar, or a broad always-visible toolbar.
- Do not put mute, settings, launcher controls, or “new capture” buttons in the tiny launcher.
- Those controls belong in the tray menu or proper settings.
- Create a distinctive, understandable original icon; do not use a camera-plus-cross visual.
- It should animate elegantly but never distract from the user’s work.

Voice wake behavior must be opt-in. Default behavior must not continuously listen. Push-to-talk and hotkey must work without an always-open microphone.

## Active state

When ShowME is capturing, thinking, researching, or teaching:

- Show a subtle, polished activity indicator around the selected region or lesson plane.
- A refined neon-blue or user-configurable accent outline is acceptable when it communicates active analysis; it must not become a crude permanent blue border.
- Make capture and model activity unmistakable without obscuring the original material.
- Provide a clear cancel/stop action.

## Teaching surface

Do not create a large permanent chat panel.

The teaching experience uses a movable/resizable lesson plane with three modes:

1. Inline:
   - Visual annotations appear directly over selected material.

2. Side-by-side:
   - The source remains visible while ShowME opens a clean teaching surface next to it.

3. Focus:
   - Nonessential source material dims and the explanation uses a clean whiteboard-like plane.

The learner can pause, replay, step, slow down, speed up, mute, stop, simplify, go deeper, ask another question, or manipulate the explanation.

Spoken narration must have a readable, non-obstructive live caption/transcript. This is captions/transcript, not a generic “citation” widget. It must remain available even when speech is muted.

## Main app / history

Do not make the opening screen a bland landing page with a long block of marketing copy.

Create a calm, premium, useful home/history experience:

- Continue recent lessons.
- View compact learning receipts.
- Reopen or replay saved explanations.
- See a lightweight optional streak/progress signal only if it is genuinely useful.
- Make memory/history feel like a private learning library, not a business analytics dashboard.
- Avoid noisy cards, dense sidebars, giant hero text, generic gradients, and dead empty states.
- Make every visible button functional.

## Settings

Settings must be clean, minimal, and grouped by actual user intent:

- AI providers and models.
- Voice and captions.
- Teaching behavior.
- Memory and privacy.
- Appearance and reduced motion.
- Capture permissions and shortcuts.

Do not create a messy provider grid containing every provider and every model simultaneously.

The provider flow should be simple:

1. Choose provider.
2. Enter/store API key securely.
3. Test connection.
4. Fetch or choose models.
5. Choose primary VLM/reasoning model.
6. Choose optional text/LLM model if different.
7. Choose voice input/output provider or local system voice.
8. Show an understandable capability summary for the active configuration.

Do not show a forced static model name beneath every card. The user chooses compatible models.

Use only lawful/official brand marks or simple text labels. Do not misuse trademarks. Distinguish Groq from xAI’s Grok; do not treat them as the same provider.

# 5. CORE USER FLOWS

## Flow A: Selection-first learning

1. User invokes ShowME through the hidden top launcher, tray, hotkey, or push-to-talk.
2. A polished selection canvas appears above the desktop.
3. User can select:
   - Rectangle.
   - Freeform/lasso area.
   - Point/object.
   - Visible text where available.
   - Multiple regions.
   - Diagram/image.
   - Code region.
   - Video frame.
   - Hand-drawn circle, underline, arrow, or note.
   - Two related areas, such as an equation and graph.
4. User chooses context scope:
   - Selection only.
   - Include nearby context.
   - Include active window.
   - Include copied/pasted text.
   - Include a pasted URL.
   - Allow web research.
5. User asks by voice or text.
6. ShowME acknowledges quickly, shows what it understood, then begins a progressive visual lesson.
7. User can interrupt at any time with voice or controls.
8. ShowME adapts the scene, narration, level, pacing, or mode.
9. User may save or discard the local learning receipt.

Do not assume arbitrary desktop applications expose browser DOM, URLs, or accessible text. Gracefully use screenshot pixels, local OCR, available accessibility text, copied text, annotations, and explicit URLs.

## Flow B: Voice-first context

A user may say, “ShowME, I don’t understand this question,” without manually selecting a region.

Implement this honestly:

- Ask or show which screen/window/capture scope will be used when it is ambiguous.
- Allow an explicitly approved default capture scope.
- Preview or clearly indicate the captured area.
- Never silently upload the full screen without user permission.
- If speech recognition is uncertain, show the transcript and ask for confirmation or clarification.
- Support barge-in: the user can interrupt narration with “pause,” “go back,” “slower,” “faster,” “explain that part,” or a new question.

## Flow C: Everyday navigation

ShowME may also explain everyday software/web tasks:

- “Where is the pricing page?”
- “How do I log in?”
- “Where is this portal?”
- “What does this control do?”

It may point, highlight, draw a path, label UI elements, and explain step-by-step. It must never autonomously operate the interface.

# 6. VISUAL LESSON COMPILER

This is the most important technical and product system.

The model must not mainly return a wall of prose. It must generate a validated, structured lesson plan that drives a trusted renderer.

Design a versioned lesson/scene contract containing, at minimum:

- User intent and teaching mode.
- Captured-context references.
- Concept identification.
- Confidence state.
- Evidence/source references.
- Narration steps and caption text.
- Relative coordinate anchors.
- Visual primitives and timing.
- Simulation/module selection and parameters.
- Learner controls.
- Follow-up/adaptation routes.
- Safety/validation status.

Use normalized coordinates rather than trusting raw screen pixels from a model. Handle crop, monitor, DPI, window, and scaling transforms explicitly and test them.

The model decides what to teach and which visual primitives best fit. The trusted renderer owns actual geometry, animation, interaction, and system behavior.

Supported visual primitives should include:

- Highlights, spotlights, dimming, blur/isolation, and focus effects.
- Lines, arrows, curved arrows, brackets, labels, captions, equations, and callouts.
- Shapes, graphs, coordinate planes, timelines, state machines, flow diagrams, force vectors, and paths.
- Transformations, reveals, comparisons, scaling, rotation, morphing, and traces.
- Interactive sliders, toggles, draggable objects, variables, replay, stepping, and reset.
- Whiteboard space beside or over a source.
- Original vector diagrams and code-rendered motion art.

Use React for product UI. Use a proper 2D/3D rendering approach such as Canvas/WebGL/SVG for the interactive lesson experience. Do not attempt to animate complex simulations through hundreds of ordinary DOM elements.

Motion art means:

- Lightweight.
- Code-rendered.
- Responsive.
- Replayable.
- Manipulable.
- Changeable during the lesson.
- Much cheaper and more useful than AI-generated video.

Do not use generated video as the default explanation route.

# 7. REAL SIMULATIONS, NOT FAKE DEMOS

The initial product must deeply demonstrate:

1. Physics:
   - Orbit/gravity.
   - Forces and motion.
   - Projectiles.
   - Waves.
   - Circuits.

2. Mathematics:
   - Geometry.
   - Trigonometry.
   - Graphs/functions.
   - Vectors and transformations.

3. Programming:
   - Function/data flow.
   - Event loop.
   - Async behavior.
   - Recursion.
   - State changes and algorithm traces.

Flagship required behavior:

A learner selects an orbital-motion problem and asks:

“Why does the satellite keep falling but never hit Earth?”

ShowME must create a real manipulable explanation:

- Earth, satellite, gravity vector, velocity vector, trajectory, and relevant equation.
- A user-adjustable variable such as velocity.
- Outcomes that change correctly: collision, stable/elliptical orbit, escape.
- Follow-up adaptation: “What happens if gravity stops?”
- Spoken explanation and captions.
- Deterministic calculations rather than pre-recorded animation.

The simulation must not just be a keyword-triggered orbital animation. The model must derive or select the applicable trusted simulation module based on the actual user context and then parameterize the lesson from that context.

Use two safe simulation routes:

1. Trusted verified simulation modules:
   - The preferred route for physics, math, circuits, code traces, and other high-value content.
   - Model chooses the concept/module, parameters, explanation order, visuals, and learner controls.
   - Deterministic code produces the calculations.

2. Sandboxed custom visualization route:
   - For unusual concepts not covered by trusted modules.
   - Prefer a constrained declarative visual DSL over arbitrary generated code.
   - If generated code is genuinely required, isolate it in a locked-down sandbox.
   - No Node integration, Electron APIs, preload APIs, filesystem, shell, process APIs, credentials, network, clipboard, desktop capture, or unrestricted parent-window access.
   - No unsafe eval path in privileged Electron contexts.
   - Do not combine sandbox permissions in a way that lets untrusted code escape its sandbox.
   - Enforce schema validation, strict CSP, opaque origin where appropriate, message validation, timeouts, memory limits, frame-rate limits, cancellation, and renderer crash recovery.
   - Custom code must never run on the host through Python, Rust, Node, shell, or Electron main.

# 8. ACCURACY, RESEARCH, SOURCES, AND MEDIA

Accuracy is non-negotiable.

Implement an explicit accuracy system:

- User-selected material first.
- OCR and available accessibility text second.
- Optional approved web research third.
- Trusted source preference.
- Citation/source cards for externally researched factual claims.
- Evidence-to-claim mapping where practical.
- Deterministic math/physics/code validation.
- Confidence states:
  - Verified simulation/module.
  - Source-grounded explanation.
  - Exploratory/uncertain explanation.
- Honest clarification when context is insufficient.
- Protection against prompt injection embedded in screenshots, documents, code comments, websites, pasted text, or web search content.

Never invent citations or pretend a VLM is certain when it is not.

Implement two teaching/research modes:

Quick mode:
- Optimized for latency.
- Uses the selected source, approved local context, existing trusted modules, and model reasoning.
- Avoids external web research unless the user explicitly enables it.
- Still performs deterministic checks where applicable.

Deep mode:
- Explicitly tells the user it will take longer.
- Performs approved web research.
- Cross-checks important claims.
- Shows sources/citations.
- Uses deeper verification and richer contextual explanation.
- May retrieve lawful educational imagery when genuinely helpful.

Images and video:

- Prefer original vector diagrams, motion art, simulations, and generated local visual primitives.
- Do not scrape Google Images.
- Do not download/rehost arbitrary online images or videos.
- When an external image is useful, use lawful/trusted/licensed sources and preserve visible attribution/source metadata.
- When a useful external video exists, show a sourced link or lawful preview/embedding only where allowed; do not pretend ShowME owns or can freely redistribute it.
- The primary explanation remains interactive motion art/simulation, not external media.

# 9. VOICE, CAPTIONS, AND INTERRUPTIBILITY

Voice must work as a real feature, not decorative UI.

Implement:

- Push-to-talk.
- Optional explicitly enabled wake/voice behavior only after permission.
- Text input fallback.
- Visible transcription.
- Spoken narration.
- Voice selection and speed controls.
- Mute, pause, resume, replay, stop, and transcript/caption controls.
- User interruption while narration is happening.
- Intent handling for “pause,” “slower,” “faster,” “go back,” “make it simpler,” “more advanced,” “show the equation,” “show another example,” and “let me control it.”

Use current official provider documentation to choose the right split between the vision/reasoning model, speech-to-text, text-to-speech, and low-latency realtime voice. Do not assume that the main VLM itself handles every voice capability.

# 10. MEMORY AND ADAPTATION

Build a serious, efficient, local-first memory system.

It should not be a giant raw transcript dump and must not abuse disk space.

Store useful local learning memory such as:

- Explicit teaching preferences:
  - Visual-first.
  - Equation-first.
  - Fast.
  - Step-by-step.
  - Formal/technical.
  - Experiment-first.
  - Preferred language and voice.
  - Reduced-motion preference.
- Lesson receipts:
  - Topic.
  - Context summary.
  - What visual module was used.
  - User feedback.
  - Sources.
  - Important learning moments.
  - Replay state where practical.
- Concept relationships and prerequisite links when evidence supports them.
- Repeated explicit user feedback:
  - “Too basic.”
  - “Too hard.”
  - “This visual method helped.”
  - “I prefer derivations.”

Use memory to adapt future lessons, but never infer a diagnosis, intelligence score, mental state, or disability.

A good example:

If the learner repeatedly chooses visual-first explanations and asks for slower pacing in trigonometry, future trigonometry explanations should start with visual intuition and moderate pacing. If they ask for a formal proof later, honor the immediate request over any stored preference.

Users must be able to:

- Inspect memory.
- Search learning receipts.
- Edit or delete individual entries.
- Export their data.
- Delete all memory.
- Disable memory entirely.

# 11. PROVIDERS AND MODEL SETTINGS

Build a real extensible provider architecture.

Primary hackathon provider:

- OpenAI API.
- GPT-5.6 is the primary vision/reasoning/lesson-planning model.
- Use current official OpenAI documentation for Responses API, image input, structured outputs, tool/function calling, web research, speech, and API-key safety.
- Clearly demonstrate real GPT-5.6 use in the product, README, and demo.

Additional provider support:

- NVIDIA NIM.
- Groq.
- Cerebras.
- OpenRouter.

Design provider adapters so more providers can be added later without rewriting the application.

Implement:

- Secure API-key entry/storage.
- Provider selection.
- Model discovery when supported, with manual model entry fallback when appropriate.
- Separate compatible model choices for VLM/reasoning and optional text model.
- Voice-provider selection or native-system voice selection.
- Connection testing.
- Capability matrix:
  - Vision.
  - Structured output.
  - Streaming.
  - Tool use.
  - Web research.
  - Speech-to-text.
  - Text-to-speech.
- Clear unsupported-capability behavior.
- Visible active provider/model per session.
- Safe fallbacks rather than silent substitution.

OpenAI must be the most polished and fully tested path.

Never hardcode API keys. Never send them to React renderers, logs, screenshots, crash reports, source control, or release artifacts.

# 12. PRIVACY, PERMISSIONS, AND TRUST

ShowME sees sensitive screen content, so make privacy a product strength.

Implement:

- First-run onboarding explaining capture, microphone, provider, web research, and memory permissions in plain language.
- Explicit capture-on-request.
- No continuous background screenshotting by default.
- No continuous microphone by default.
- Clear visual indication of what is being captured/sent.
- Capture-scope controls.
- Web research consent.
- Local-first memory.
- User deletion controls.
- Secure secrets.
- Minimal diagnostic logs that exclude screenshots, raw sensitive text, and keys.
- Warning/redaction strategy for obviously sensitive contexts.
- Clean no-permission and revoked-permission recovery.
- Permission state that is remembered after user approval, while still allowing changes in settings.

Do not build stealth, hidden-from-screen-share behavior, proctoring bypass behavior, or covert assistance. ShowME is intentionally visible and ethical.

# 13. PERFORMANCE AND PLATFORM QUALITY

The application must feel smooth and premium.

Targets:

- Top launcher/hotkey response: immediate.
- Selection canvas: immediate/local.
- Crop capture and initial context preparation: fast enough to feel responsive.
- Show a meaningful acknowledgement while deeper work is underway.
- Stream progressive lesson construction; do not wait for an entire long lesson before displaying anything.
- Maintain smooth animation under normal load.
- Avoid blocking the Electron UI thread.
- Reuse approved context intelligently rather than recapturing the entire screen repeatedly.
- Handle high DPI, multiple monitors, window scaling, resize, and coordinate transforms correctly.
- Avoid overlay self-capture/recursive “hall of mirrors” behavior.
- Ensure click-through overlays do not block the user from their underlying application except in the visible interactive ShowME lesson hit areas.

Research current Windows and macOS capture, permission, accessibility, and transparent-overlay behavior before committing to platform-specific code.

# 14. RESEARCH PHASE — REQUIRED BEFORE MAJOR IMPLEMENTATION

Before making major architecture choices:

1. Inspect the workspace, repository, existing code, package metadata, build scripts, and any prior implementation.
2. Read all product/research documents present in the workspace.
3. Research current official documentation for:
   - Electron security and desktop-window behavior.
   - Windows screen capture, overlay windows, permissions, and UI Automation.
   - macOS ScreenCaptureKit, accessibility permissions, transparent window behavior, and notarization/build constraints.
   - Rust integration/native module or sidecar best practices for Electron.
   - Python worker isolation and resource limits.
   - OpenAI GPT-5.6, Responses API, structured outputs, image/vision, web search, audio, realtime options, API-key safety, and evaluation practices.
   - NVIDIA NIM, Groq, Cerebras, and OpenRouter APIs and capability differences.
   - Accessibility and reduced-motion practices.
   - Lawful educational image/media sourcing.
   - Relevant screen-aware tutor/overlay competitors, including Clicky, only to differentiate—not copy.
4. Record material architectural decisions, assumptions, source links, and rejected alternatives in concise project documentation.
5. Use official documentation as the primary source for technical/API claims.
6. Do not rely on stale assumptions, made-up package behavior, or unsupported model capabilities.

# 15. IMPLEMENTATION ORDER

After research, make a practical internal plan and execute it. Do not stop after writing the plan.

Suggested order:

1. Inspect and preserve existing work.
2. Establish secure Electron architecture, build tooling, TypeScript boundaries, Rust/Python workers, tests, and packaging baseline.
3. Build the top-edge launcher, tray, shortcuts, onboarding, privacy controls, and clean main/history/settings surfaces.
4. Build secure overlay windows and selection/capture flows.
5. Build coordinate mapping, multi-monitor/high-DPI handling, and click-through/interactive hit testing.
6. Build provider adapters and a real tested OpenAI GPT-5.6 lesson-planning path.
7. Build voice input/output, captions, text fallback, and interruption.
8. Build the validated structured lesson-plan contract.
9. Build the trusted visual renderer and whiteboard/lesson plane.
10. Build verified physics, trigonometry, and programming visualization modules.
11. Build research, evidence, citations, and lawful media support.
12. Build efficient local memory and adaptation.
13. Build additional provider support and capability-aware degradation.
14. Polish performance, privacy, accessibility, failure handling, and design.
15. Test, package, document, and verify honestly.

You may reorder only when dependencies require it.

# 16. ENGINEERING QUALITY RULES

- Use strict typing and runtime validation at every trust boundary.
- Keep Electron main, preload, renderer, Rust, Python, providers, storage, research, scene planning, renderer, simulation, and safety modules clearly separated.
- No giant unmaintainable files.
- No fragile string parsing of model output.
- Validate every model-generated lesson plan before rendering.
- No dead controls, “coming soon” buttons, fake settings, fake loading, or disconnected UI.
- Keep code modular and easy to change.
- Include cancellation and recovery at all asynchronous boundaries.
- Use structured privacy-safe logging.
- Handle offline/no-key/invalid-key/rate-limit/no-microphone/capture-denied/unsupported-model/malformed-model-output states gracefully.
- Build keyboard navigation, readable contrast, focus management, captions, text fallback, reduced motion, replay, and pause controls.
- Do not hide important controls behind unexplained gestures.
- Do not make a giant visual experience that overwhelms the original source material.
- Use test fixtures only in explicit test/demo modes. Never use fixture output as disguised live AI behavior in normal operation.

# 17. VERIFICATION REQUIREMENTS

Do not declare completion until all applicable verification is complete.

## Build and code quality

- Run installation, build, packaging, type checking, linting, formatting, Rust checks/tests, Python tests, and frontend tests.
- Fix failures rather than listing them as future work.
- Verify release builds, not only development mode.

## Functional tests

Manually verify complete journeys:

- Launch app.
- Complete first-run permissions/privacy onboarding.
- Configure OpenAI provider.
- Add API key securely.
- Test connection.
- Use top launcher, tray, hotkey, and push-to-talk.
- Select rectangle, lasso, point, text when available, and multiple regions.
- Test capture over another browser/application.
- Ask by text and voice.
- Verify transcript/captions.
- Receive a real GPT-5.6 structured lesson plan.
- Render a real visual explanation.
- Hear narration.
- Pause, replay, interrupt, simplify, deepen, and change pacing.
- Manipulate a real orbit simulation.
- Manipulate a trigonometry visualization.
- View a programming-flow visualization.
- Enable deep research and inspect real citations.
- Retrieve a lawful attributed image only when appropriate.
- Inspect/delete/export/disable local memory.
- Change teaching preference and prove it changes later lesson behavior.
- Switch providers and verify unsupported capabilities are explained clearly.
- Test missing key, bad key, no network, rate limit, denied capture, denied microphone, malformed lesson plan, unsupported provider/model, worker failure, and canceled capture.

## Automated tests

Add meaningful tests for:

- Lesson-plan schema validation.
- Coordinate transforms.
- DPI/multi-monitor calculations where testable.
- IPC permission boundaries.
- Provider capability logic.
- Secret redaction.
- Memory deletion/export/disable behavior.
- Quick versus Deep research behavior.
- Simulation calculations.
- Python worker timeouts and invalid input.
- Rust native worker contracts.
- Click-through/hit-test logic.
- Visual renderer major states.
- Prompt-injection resistance at ingestion boundaries.

## Honest platform verification

- Verify Windows on an actual Windows environment.
- Verify macOS on actual macOS only if available.
- If macOS cannot be tested, do not claim it is verified. Document exact remaining Mac verification steps and keep platform-specific code isolated and buildable where possible.

# 18. REQUIRED FINAL DELIVERY

Deliver:

- Runnable application source.
- Windows build/package if the environment permits.
- macOS build/package only if genuinely built/tested.
- Complete README:
  - Setup.
  - Permissions.
  - Provider setup.
  - API key handling.
  - Development.
  - Testing.
  - Packaging.
  - Troubleshooting.
  - Known limitations.
- Architecture document.
- Security and privacy document.
- Provider capability matrix.
- Memory/data controls document.
- Test report.
- Feature completion checklist.
- Sample test material for physics, trigonometry, programming, and UI navigation.
- Hackathon demo guide.
- Clear explanation of how Codex and GPT-5.6 were genuinely used.
- The Codex /feedback session ID required for the hackathon submission.

# 19. FINAL DEFINITION OF DONE

ShowME is complete only when it is a real, polished desktop application where a user can:

1. Invoke an unobtrusive top-edge launcher, hotkey, tray item, or push-to-talk.
2. Select something confusing on screen or explicitly choose capture context.
3. Ask by voice or text.
4. Have a real configured vision/reasoning model understand the selected context.
5. Receive a validated, source-aware visual lesson—not a chat wall.
6. See arrows, labels, shapes, diagrams, motion art, and meaningful screen-grounded explanation.
7. Hear narration and read captions.
8. Interrupt and adapt the lesson in real time.
9. Manipulate a real simulation.
10. Use Quick or Deep research modes.
11. Review sources and lawful media attribution when external material is used.
12. Retain, inspect, export, or delete local learning memory.
13. Change providers/models safely and understand capability limitations.
14. Recover gracefully from missing permissions, unavailable providers, or bad inputs.

Do not report completion with a toy prototype, static demo, pre-rendered video, fake lesson, generic chat overlay, or feature list that does not connect end-to-end.

Begin by inspecting the repository and research documentation. Then make the necessary professional decisions, build ShowME completely, verify it rigorously, and report only what you have actually implemented and tested.


