# ShowME architecture

ShowME treats model output as an untrusted lesson plan and keeps every privileged operation outside the renderer. The model can select from a bounded vocabulary; it cannot author runtime code, HTML, SVG markup, IPC calls, or arbitrary simulations.

## Process boundaries

    +-----------------------+       typed IPC        +---------------------------+
    | Sandboxed React UI    | <--------------------> | Electron main process     |
    |                       |                        |                           |
    | launcher              |                        | window lifecycle          |
    | selection overlay     |                        | explicit screen capture   |
    | main workspace        |                        | provider network requests |
    | desktop whiteboard    |                        | encrypted credentials     |
    +-----------------------+                        | SQLite persistence        |
                                                     +------------+--------------+
                                                                  |
                                                bounded JSON      | bounded JSON
                                                       +----------+----------+
                                                       |                     |
                                               +-------v------+      +-------v--------+
                                               | Rust worker |      | Python verifier |
                                               | crop / DPI  |      | deterministic   |
                                               | hit testing |      | module checks   |
                                               +--------------+      +----------------+

Renderer windows run with sandbox enabled, context isolation enabled, Node integration disabled, web security enabled, no webviews, denied popups, blocked navigation, a restrictive Content Security Policy, and a minimal preload API. The renderer cannot read keys, open files, call providers, access SQLite, or spawn workers.

## Capture flow

1. A user clicks the island/tray action or presses an explicit global hotkey.
2. The launcher hides before Electron desktopCapturer reads the display nearest the cursor.
3. The screen bitmap is held in a short-lived in-memory capture record.
4. A full-display selection window lets the user mark one or more normalized [0,1000] regions.
5. Rust computes a physical-pixel crop using the captured dimensions. TypeScript contains an equivalent fallback.
6. The original display bitmap is discarded; only the prepared in-memory crop remains for the model request.
7. Lesson history stores the validated lesson presentation, not the screenshot.

This design avoids continuous screen polling, background capture, and ambiguous “always watching” states. On macOS, the user must grant Screen Recording permission. Windows uses the system-supported desktop capture path exposed by Electron.

## Lesson compilation

The request pipeline is:

    Prepared visual context + explicit question + allowed preferences
        → capability gate
        → provider request
        → provider-appropriate structured JSON contract
        → strict local lesson schema
        → semantic reference validation
        → citation reconciliation against observed provider annotations
        → independent deterministic verification
        → trusted React/SVG renderer
        → local lesson receipt and optional learning memory

OpenAI and supported routed models receive a strict JSON schema. Groq Llama 4 and NVIDIA use best-effort schema mode, while Qwen Cloud and Cerebras use JSON-object mode because their current strict-schema contracts do not accept ShowME's full lesson schema. Qwen Cloud requests use the validated OpenAI-compatible API Host paired with the user's pay-as-you-go, Token Plan, or Coding Plan key. Every route then passes the same local schema. It validates global IDs, step-to-primitive references, claim-to-citation references, normalized coordinates, numerical bounds, simulation shape, and control bindings. A malformed plan is retried once with the validation summary, then rejected transparently.

NVIDIA's `/v1/models` response is treated as a catalog only. ShowME annotates known image-input entries but never labels the catalog as a list of free or organization-enabled models. A model-specific completion test is the access check; HTTP 403 `Authorization failed` is surfaced as an NVIDIA Public API Endpoints entitlement problem rather than as a successful connection.

OpenAI Responses output annotations are the authority for web citations. Model-authored citation URLs are removed if the provider response did not actually attach them. A source-grounded plan without observed sources is downgraded to exploratory.

## Trusted simulation vocabulary

The renderer owns these modules:

- Orbit: velocity-Verlet integration and impact/bound/escape classification.
- Projectile: bounded numerical integration with gravity and drag.
- Trigonometry: unit-circle and waveform relationships.
- Wave: amplitude/frequency/wavelength/phase visualization.
- Circuit: Ohm’s law, power, and RC time constant.
- Event loop: static script/microtask/task trace visualization; source is never executed.
- Function graph: enumerated linear, quadratic, exponential, and inverse functions; no eval.
- Custom: enumerated shapes and motion functions only.

Controls bind only to a module’s allowlisted numeric fields. Python independently checks the parameters. If that worker is unavailable, a deterministic TypeScript checker runs and the UI reports the engine used.

## Persistence and memory

One Electron-main owner uses Node 24’s node:sqlite API in WAL mode. Tables store settings, lesson presentations, feedback, and explicit learning memories. Images are not stored. Credential material is kept in a separate OS-encrypted file.

Learning memory is advisory and local. It records concepts and explicit preferences, can be disabled, inspected through summary UI, exported, deleted item by item, or deleted in full.

On Windows, provider credentials are protected through a small Rust worker that calls DPAPI with application-specific entropy. Plaintext is passed over standard input rather than command-line arguments. On other supported platforms, Electron secure storage delegates to the operating-system credential backend. Credentials remain outside SQLite and renderer processes.

## Wake and voice flow

When wake listening is enabled on Windows, the launcher opens only the selected microphone. The renderer measures the local signal and groups it into a bounded utterance with a short lead-in and silence tail. A local Windows speech worker first screens the utterance as short dictation, then checks it against the fixed ShowME grammar. Ordinary audio is discarded locally. Only a recognized wake starts explicit screen capture and a separate recorded question, which uses the selected Groq, Deepgram, or ElevenLabs transcription route. Narration stays local by default or uses the explicitly selected Deepgram Aura or ElevenLabs route; OpenAI is never called for audio.

## Window model

- Launcher: tiny top-edge idle grip; one capture affordance when revealed; question and progress states only when actively used.
- Selection: one short-lived full-display window on the selected monitor.
- Main: onboarding, dashboard, library, and settings; closing hides it to the tray.
- Lesson: full-display transparent, click-through whiteboard projected back onto the captured crop with DPI-aware coordinates. It renders only trusted primitives and declarative simulations, never model-supplied executable markup.

All windows load the same renderer entry with a role query and share only the typed preload surface.
