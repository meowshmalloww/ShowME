# QA and release evidence

## Release under test

- Product: ShowME `0.2.0`
- Date: July 17, 2026
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

Frontend test result: 6 files, 17 tests passed. Coverage targets include normalized coordinate conversion, client-side schema rejection, deterministic orbit outcomes/energy, JavaScript event-loop ordering, the real capture action, provider capability-safe request construction, empty-library recovery, request-language propagation, and narration completion/cancellation.

Rust test result: 18 tests passed. Coverage targets include capture crop mapping, region and URL validation, lesson schema and citation reconciliation, provider parsing/defaults, Alibaba image payload shape, request privacy and context opt-ins, Wikimedia license/metadata handling, SQLite settings/memory behavior, model-route construction, and the launcher’s peek/revealed/panel native window sizes.

The Windows production build budget passed with 206.1 KiB of initial JavaScript (67.3 KiB gzip), 71.8 KiB of initial CSS (16.5 KiB gzip), and 355.3 KiB of JavaScript across all deferred routes. The build fails if startup or total bundle limits regress. The production build contains no sample-lesson or fake browser-capture route.

`npm audit` reported zero known vulnerabilities at build time. This is a point-in-time registry result, not a substitute for continuous dependency monitoring.

## Visual and interaction QA

The light-theme mothership was first exercised through the in-app browser at desktop dimensions, then the optimized Windows executable was exercised through the real native windows. The pass covered:

- onboarding and privacy messaging;
- simple home setup/recent state without a dashboard or chatbot;
- transparent hover-revealed launcher, capture/mic/menu actions, and a 48 × 24 idle native hit target;
- native full-screen capture, rectangle selection, selection count, and crop commit;
- direct capture handoff to the expanded question panel with a real crop thumbnail;
- compact text/microphone entry, per-request context switches, no-key send gating, and Settings recovery;
- centralized cards for OpenAI, Alibaba Cloud Qwen, NVIDIA NIM, Groq, Cerebras, and OpenRouter keys;
- teaching settings including saved 80–145% revealed-launcher sizing;
- privacy/memory settings and destructive-action affordances;
- reduced-motion-sensitive layout behavior;
- responsive scroll behavior in settings and finished lessons.

The automated sizing pass covers the fixed `48 × 24` idle tab, the `316 × 70` revealed launcher at 100% scale, the temporary menu surface, and the `468 × 520` request panel. The wider UI pass covered the main workspace, expanded visualization, library recovery actions, provider/teaching settings, capture transitions, and the application-controlled reduced-motion class.

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

The optimized Windows executable was built successfully. The previous native pass verified process startup, native transparency, menu behavior, the real capture overlay, rectangle drawing, crop commit, panel expansion, crop dimensions/preview, no-key generation gating, and provider settings. The new hover-size behavior is covered by native sizing tests and the production build; it still belongs in the next manual pointer-interaction pass. The current Windows installer payloads were generated successfully by Tauri’s NSIS and WiX pipelines using the reduced icon set.

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
3. Save a test-account OpenAI key, read back only the configured indicator, and run the connection test.
4. Invoke capture on two monitors with different scale factors; verify crop alignment for rectangle, lasso, point, and annotations.
5. Ask for orbit, trigonometry, and event-loop lessons and compare simulator behavior with the deterministic unit cases.
6. Enable web research and verify every displayed citation opens the corresponding source annotation.
7. Record a short push-to-talk question and play narration at multiple rates.
8. Disable memory, create a lesson, and confirm it is absent from history; then export and delete existing memory.
9. Revoke screen/microphone permissions and verify actionable recovery messages.
10. Repeat the platform-specific suite on a signed/notarized macOS build.
