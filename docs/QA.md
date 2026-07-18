# QA and release evidence

## Release under test

- Product: ShowME `0.2.0`
- Date: July 18, 2026
- Build host: Microsoft Windows NT `10.0.28020.0`, x64
- Toolchain: Node.js `24.12.0`, npm `11.7.0`, rustc/cargo `1.92.0`
- Desktop stack: Tauri 2.11, React 19, TypeScript 7, Rust 2024 edition
- Release targets produced: native executable, NSIS installer, MSI installer

## Automated verification

All of the following passed on the release source tree:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
cargo check --all-features
npm run tauri -- build
```

Frontend test result: 6 files, 22 tests passed. Coverage includes coordinate conversion, snapping, square constraints, arrow geometry, clamped region movement, guided provider setup without endpoint/model-ID inputs, schema rejection, deterministic simulations, real capture actions, capability-safe requests, empty-library recovery, language propagation, and narration cancellation.

Rust test result: 23 tests passed. Coverage includes physical crop bounds, crop-relative annotation remapping, prompt metadata, validation, strict schemas, provider model-list parsing/filtering, regionless Alibaba model IDs, Alibaba image payloads, request privacy, Wikimedia licensing, SQLite behavior, and Windows/macOS launcher dimensions.

The Windows production build budget passed with 211.8 KiB of initial JavaScript, 92.4 KiB of initial CSS, and 368.3 KiB of JavaScript across all deferred routes. The build fails if startup or total bundle limits regress. The production build contains no sample-lesson or fake browser-capture route.

`npm audit` reported zero known vulnerabilities at build time. This is a point-in-time registry result, not a substitute for continuous dependency monitoring.

## Visual and interaction QA

The warm-neutral tool UI was exercised through the optimized Windows executable and real native windows at 125% display scaling. The pass covered:

- onboarding and privacy messaging;
- simple home setup/recent state without a dashboard or chatbot;
- a top-attached 96 by 26 idle capture bar, delayed hover expansion, explicit click expansion, and a single-surface menu;
- full-screen capture with an upper-right cancel action, compact toolbar, guarded idle state, rectangle creation, drag-to-move, handle resizing, Delete removal, and Escape cancellation;
- direct capture handoff to the expanded question panel with a real crop thumbnail;
- compact text/microphone entry, per-request context switches, no-key send gating, and Settings recovery;
- guided provider selection with vector marks, OS-vault key storage, provider-backed model refresh, and no exposed endpoint or free-form model ID;
- teaching settings including saved 80–145% revealed-launcher sizing;
- privacy/memory settings and destructive-action affordances;
- reduced-motion-sensitive layout behavior and screen-space annotation math;
- responsive scroll behavior in settings and finished lessons.

The automated sizing pass covers the Windows `96 × 26` idle bar, notch-safe macOS `220 × 34` idle bar, Windows `320 × 58` revealed state, macOS `448 × 58` revealed state, temporary menu surface, and `468 × 520` request panel.

No browser console errors or warnings were present during the final browser pass. Native QA found and fixed an interaction issue where the compact Context popover covered its original toggle; the final panel includes its own accessible close action.

## Security-oriented checks

- Provider output cannot add raw HTML or executable code to the lesson schema.
- The custom sandbox runs a fixed local interpreter with declarative inputs.
- Tauri CSP denies remote scripts, remote frames, objects, and arbitrary WebView connections.
- The Rust HTTP client is HTTPS-only and timeout-bounded.
- Provider keys have no frontend environment-variable path and are absent from SQLite export.
- Unsupported provider capabilities return explicit errors rather than degrading silently.
- Citation URLs are reconciled against actual tool annotations or an explicit source URL.
- Wikimedia media requires an allowed host and license metadata.
- Screenshots remain in memory and are cleared at context end; database tests confirm memory deletion behavior.

## Native package smoke test

The optimized Windows executable was built successfully. The native pass verified process startup, the exact top-edge hit area, delayed hover reveal, click reveal, menu expansion, the real capture overlay, guarded idle state, rectangle drawing, moving, handle resizing, visible cancellation, Escape closure, no-key generation gating, and guided provider settings at 125% scaling. The Windows installers were generated through NSIS and WiX. Only the editable SVG and the required Windows ICO/macOS ICNS desktop icon formats are retained.

## Artifact manifest

Checksums and exact byte sizes are recorded in `release/ShowME-0.2.0-SHA256SUMS.txt` after the final package copy. The primary artifacts are:

- `ShowME-0.2.0-Windows-x64-Setup.exe`
- `ShowME-0.2.0-Windows-x64.msi`
- `ShowME-0.2.0-source.zip`

## Not verified in this environment

- Live OpenAI, Alibaba Cloud Qwen, NVIDIA, Groq, Cerebras, or OpenRouter requests: no user credentials were available, so success was not simulated or claimed.
- Live microphone transcription and speech synthesis for the same reason.
- Windows Screen Capture permission flows across every Windows release, protected-content case, GPU, and mixed-DPI/multi-monitor topology.
- Installed/uninstalled behavior under standard-user, enterprise policy, antivirus, SmartScreen, and upgrade scenarios.
- Authenticode signatures: artifacts are intentionally unsigned development builds.
- macOS compilation, Screen Recording/microphone permissions, Apple Silicon behavior, signing, entitlements, and notarization.
- Full assistive-technology certification with Narrator, NVDA, VoiceOver, switch devices, or high-contrast modes.

These are release gates for a public production build, not hidden failures in the current engineering handoff.

## Suggested acceptance run

1. Install the NSIS package on a clean Windows 11 x64 VM.
2. Complete onboarding and verify ShowME appears in the tray and the top-edge hover tab reveals without blocking the surrounding screen.
3. Save a test-account OpenAI or Alibaba Cloud key, verify the provider-backed model list loads, read back only the configured indicator, and run the connection test.
4. Invoke capture on two monitors with different scale factors; verify crop alignment for rectangle, lasso, point, and annotations.
5. Ask for orbit, trigonometry, and event-loop lessons and compare simulator behavior with the deterministic unit cases.
6. Enable web research and verify every displayed citation opens the corresponding source annotation.
7. Record a short push-to-talk question and play narration at multiple rates.
8. Disable memory, create a lesson, and confirm it is absent from history; then export and delete existing memory.
9. Revoke screen/microphone permissions and verify actionable recovery messages.
10. Repeat the platform-specific suite on a signed/notarized macOS build.
