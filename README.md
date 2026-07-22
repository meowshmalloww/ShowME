<div align="center">
  <img src="assets/icon.png" width="78" alt="ShowME icon">
  <h1>ShowME</h1>
  <p><strong>Don't explain it. Make it visible.</strong></p>
  <p>A screen-aware visual lesson compiler for Windows.</p>

  <p>
    <a href="https://github.com/meowshmalloww/ShowME/releases/latest"><strong>Download</strong></a>
    ·
    <a href="#run-from-source"><strong>Run from source</strong></a>
    ·
    <a href="#built-with-codex--gpt-56"><strong>Codex + GPT-5.6</strong></a>
  </p>

  <p>
    <img alt="Electron 43" src="https://img.shields.io/badge/Electron-43-47848F?style=flat-square&logo=electron&logoColor=white">
    <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white">
    <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white">
    <img alt="Rust native worker" src="https://img.shields.io/badge/Rust-native_worker-000000?style=flat-square&logo=rust&logoColor=white">
    <img alt="Python verifier" src="https://img.shields.io/badge/Python-verifier-3776AB?style=flat-square&logo=python&logoColor=white">
  </p>
  <p>
    <img alt="Windows x64" src="https://img.shields.io/badge/Windows-x64-0078D4?style=flat-square&logo=windows11&logoColor=white">
    <img alt="Built with Codex and GPT-5.6" src="https://img.shields.io/badge/Built_with-Codex_%2B_GPT--5.6-111111?style=flat-square&logo=openai&logoColor=white">
    <img alt="Apache 2.0 license" src="https://img.shields.io/badge/License-Apache--2.0-D22128?style=flat-square&logo=apache&logoColor=white">
  </p>
</div>

---

ShowME turns the screen itself into a spoken whiteboard. Select a question, diagram, paragraph, interface, or full display; ask naturally by voice or text; and ShowME draws the explanation directly over the source with grounded arrows, circles, labels, motion, simulations, and one teaching cursor.

It is a desktop application—not a browser extension, pet, or separate chatbot page.

## Why ShowME

| Capability | What it means for the learner |
| --- | --- |
| **Screen-aware** | Lessons are grounded to the exact selected pixels instead of losing context in a copied prompt. |
| **Visual-first** | Declarative arrows, circles, text, shapes, motion art, and trusted simulations appear directly on the source. |
| **Voice-first** | Local wake listening, silence detection, transcription, automatic narration, and spoken follow-ups keep the lesson hands-free. |
| **Adaptive** | Age, grade, history, and feedback shape the explanation without overriding the learner's current question. |
| **Provider-flexible** | OpenAI, Gemini, NVIDIA NIM, Qwen Cloud, Groq, OpenRouter, Deepgram, ElevenLabs, and local Windows speech are wired through explicit adapters. |
| **Fail-closed** | A model response must pass the closed lesson schema, reference checks, bounds, and an independent verifier before rendering. |

```text
select on screen → ask → multimodal lesson plan → verify → draw + animate + speak
```

## Download for Windows

The release publishes two x64 executables:

- **Portable:** `ShowME-Portable-1.0.0-win-x64.exe` — run without installing.
- **Setup:** `ShowME-Setup-1.0.0-win-x64.exe` — per-user NSIS installer with shortcuts.

Download them from the [latest GitHub Release](https://github.com/meowshmalloww/ShowME/releases/latest). These hackathon builds are unsigned, so Windows SmartScreen may require **More info → Run anyway**.

On first launch, open **Settings**, select a provider, save your own API key, refresh its live model catalog, and select vision and lesson models. Keys are never committed to this repository.

## How a lesson is built

1. **Deliberate capture** — `Ctrl+Shift+Space` opens selection; `Ctrl+Shift+V` starts voice-first capture. The wake name is **ShowME**; saying “hey” first is optional.
2. **Grounded understanding** — only the chosen region is sent to the selected multimodal provider with normalized display geometry.
3. **Structured planning** — the model returns a compact lesson plan made from supported primitives and simulations.
4. **Local verification** — Zod validation, primitive-reference reconciliation, numerical bounds, and the Python verifier reject unsafe or incomplete plans.
5. **Native teaching** — the click-through whiteboard draws at real screen coordinates while local Windows speech, Deepgram Aura, or ElevenLabs narrates automatically.
6. **Adaptive follow-up** — a learner can say “slower,” “show the math,” or “I still don't get it,” and the next explanation adjusts.

## Built with Codex + GPT-5.6

I used **Codex with GPT-5.6 as the primary engineering partner** for the production rebuild of ShowME. The work was repository-wide rather than a single generated component: Codex traced behavior across Electron main, preload IPC, React renderers, Rust and Python workers, provider APIs, audio playback, Windows capture, testing, and packaging.

| Area | How Codex with GPT-5.6 accelerated the project |
| --- | --- |
| **Architecture migration** | Inspected the earlier Rust/Tauri prototype and helped migrate the product into an Electron + TypeScript desktop architecture with strict main/renderer boundaries. |
| **Lesson compiler** | Designed and iterated the closed Zod plan schema, primitive references, coordinate grounding, simulations, incomplete-response recovery, and fail-closed rendering path. |
| **Provider integration** | Traced real OpenAI, Gemini, NVIDIA NIM, Qwen, Groq, OpenRouter, Deepgram, and ElevenLabs request/response failures instead of substituting mocked success paths. |
| **Voice lifecycle** | Repaired wake recognition, silence-to-thinking transitions, provider-specific transcription, automatic narration, media interruption races, and local-speech fallback. |
| **Visual teaching** | Improved contrast, adaptive label backgrounds, arrows, circles, shapes, animation timing, screen-pixel placement, and the single non-glowing teaching cursor. |
| **Verification and release** | Added regression coverage, exercised real Windows flows, built the installer and portable EXE, checked hashes, and prepared the judge package and narrated demo. |

I retained the product decisions: ShowME is not a pet or browser extension; capture must be deliberate; screenshots stay out of lesson history; OpenAI is not used for audio; and model-authored HTML, JavaScript, SVG, shell commands, Python, or Rust are never executed.

At runtime, `gpt-5.6-sol` is the default OpenAI vision and lesson model. GPT-5.6 output still goes through exactly the same local schema and verification gate as every other provider. The saved submission examples were generated with Qwen through that provider-independent pipeline rather than a hard-coded demo path.

## Technology

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 43, electron-vite, Chromium |
| Interface | React 19, TypeScript 7, CSS, Lucide |
| Contracts | Zod 4 closed schemas and shared TypeScript types |
| Native boundary | Rust capture/credential worker and Windows PowerShell wake bridge |
| Verification | Python worker packaged with PyInstaller |
| Local data | SQLite lesson history and OS-protected credentials |
| Testing | Vitest, Testing Library, Rust tests, Python tests, wake-path checks |
| Packaging | electron-builder with Windows NSIS and portable targets |

## Run from source

Requirements: Windows 10/11, Node.js 24+, Rust 1.92+, Python 3.12+, and PyInstaller.

```powershell
git clone https://github.com/meowshmalloww/ShowME.git
cd ShowME
npm install
npm run build:workers
npm run build:icons
npm run dev
```

Enter provider credentials inside ShowME, not in `.env`. Saved credentials are protected for the current Windows account and return to the interface only as a masked/saved state.

## Verify and package

```powershell
npm run check
npm run package:win
```

`npm run check` covers formatting, lint, TypeScript, renderer/schema tests, wake recognition, Rust tests, and Python tests. `npm run package:win` produces the Setup and Portable executables in `release/`.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/main` | Capture, providers, credentials, IPC, windows, storage, and lesson orchestration |
| `src/renderer` | Main application, selection tools, dynamic island, and desktop whiteboard |
| `src/shared` | Closed schemas, types, models, geometry, and simulation contracts |
| `workers/native` | Rust native boundary and Windows capture support |
| `workers/python` | Independent plan verifier and packaged worker |
| `workers/wake` | Local Windows wake-listening bridge |
| `tests` | Provider, schema, audio, storage, grounding, and renderer regressions |

## Security model

- Renderer windows use context isolation and have no Node.js access.
- Capture, provider traffic, credentials, SQLite, and worker processes stay in Electron main.
- Original screenshots are not stored in lesson history.
- API keys are protected by the operating system and are never returned to the renderer in plaintext after saving.
- Model plans are parsed as untrusted data and rendered only from the local allowlist of primitives.

## License

Licensed under [Apache-2.0](LICENSE). Additional implementation notes and source references are collected in [RESEARCH.md](RESEARCH.md).
