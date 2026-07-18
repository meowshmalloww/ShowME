# Privacy and security

## Privacy promise

ShowME does not watch the screen or listen to the microphone in the background. Capture and recording begin only after a visible, explicit user action. The selected crop is the default outbound context, and broader screen context is opt-in for each lesson request.

This document describes the implemented behavior of version `0.1.3`; it is not a substitute for a production legal privacy notice or a provider’s own data-processing terms.

## Data inventory

| Data | Created when | Location and lifetime | Network destination |
| --- | --- | --- | --- |
| Monitor snapshot | User invokes capture | Rust memory until selection is committed/cancelled/replaced | Never by itself; selected based on request switches |
| Selected crop | User commits regions | Rust memory for the active lesson context | Selected model provider |
| Nearby monitor context | Same capture | Rust memory for the active lesson context | Selected provider only when **Nearby context** is on |
| Active-window image/title | Invocation finds a focused non-ShowME window | Rust memory for the active lesson context | Selected provider only when **Active window** is on |
| Microphone recording | User holds the voice button | Browser/Rust memory through transcription | OpenAI audio transcription endpoint |
| Question, copied text, source URL | User supplies them | Request memory; lesson history if memory is enabled | Selected model provider |
| Validated lesson and citations | Provider returns a valid plan | UI memory; SQLite if memory is enabled | OpenAI speech endpoint if narration is played |
| Provider API keys | User saves a key | OS credential vault until deleted | Corresponding provider as an authorization header |
| Settings | User changes settings | Local SQLite | No destination |
| Wikimedia query and metadata | User enables/requests image aids | Request/UI memory | Wikimedia Commons API |
| Diagnostic log | App runs | Rotating local Tauri log, capped at 2 MB | No destination |

Screen images and microphone bytes are not saved in ShowME’s database. A provider may retain request data according to the account, endpoint, and provider policy selected by the user; users should review those terms before sending sensitive material.

## Consent boundaries

- The floating pet, global shortcut, tray command, or visible main-app action starts one snapshot.
- The selection window always appears before a model request. The user can cancel without sending.
- Nearby-screen context, active-window context, web research, and external image aids are separate visible switches.
- Voice recording uses hold-to-talk behavior. Releasing stops the recorder and begins transcription.
- Starting a new capture replaces old pending context. Ending the lesson clears prepared context.
- Memory can be turned off globally. Existing lessons remain inspectable until individually or collectively deleted.

## Credentials

Keys are handled by Rust commands and stored using the `keyring` backend under `com.showme.visual.provider`, one entry per provider. On Windows this maps to Windows Credential Manager; on macOS it maps to Keychain. Keys are not included in settings, database exports, logs, provider summaries, frontend environment variables, or lesson plans.

The UI only receives a configured/not-configured boolean. Saving, connection testing, use, and deletion all happen through the native core. A production threat model should still account for a compromised local user session or an OS-level credential-vault compromise.

## Network allowlist by feature

- OpenAI: `https://api.openai.com/v1/responses`, model checks, audio transcription, and audio speech
- NVIDIA NIM: `https://integrate.api.nvidia.com/v1/...`
- Groq: `https://api.groq.com/openai/v1/...`
- Cerebras: `https://api.cerebras.ai/v1/...`
- OpenRouter: `https://openrouter.ai/api/v1/...`
- Wikimedia Commons: `https://commons.wikimedia.org/w/api.php`
- Wikimedia media display: `https://upload.wikimedia.org/...`

The native HTTP client is HTTPS-only, has connection and total timeouts, limits redirects, and returns typed errors with remediation. User source links may be HTTP or HTTPS but are not fetched by a general app crawler; validated links open externally in the default browser. For a production hardening pass, HTTP source links should be upgraded or restricted to HTTPS.

## Model-output controls

Provider output is hostile until proven valid. Controls include:

- a strict JSON schema where supported;
- a second Rust deserialization and semantic-validation pass;
- normalized coordinate bounds and finite-number checks;
- caps on primitives, steps, controls, claims, citations, points, entities, motions, and durations;
- unique ID and cross-reference validation;
- fixed simulation kinds and exact numeric control bindings;
- no raw HTML, CSS, JavaScript, shell, Rust, or arbitrary expression field;
- citation URL validation and provenance reconciliation;
- text rendering rather than HTML injection;
- a CSP that blocks remote scripts, objects, frames, and arbitrary connections;
- a sandboxed fixed interpreter for custom declarative motion.

Selected screenshots and copied/source content are explicitly marked as untrusted study material in the compiler prompt. Prompt instructions tell the model not to follow embedded commands or claim access to hidden context. The Rust controls remain the true security boundary if a model ignores those instructions.

## Citation integrity

A plan may label claims as selected-source, calculation, web-source, or model-inference. Web citations are accepted only when their normalized URL appears in actual OpenAI Responses annotations. An explicit user source URL is also eligible. Unmatched provider-generated URLs are discarded, and claims cannot reference citation IDs that are absent after reconciliation.

This mechanism provides provenance, not a guarantee that every cited claim is true. Users should open sources for high-stakes decisions; ShowME is an educational visualization tool, not medical, legal, or financial advice.

## Image licensing

External image aids use Wikimedia Commons rather than general web image search. The native parser requires:

- JPEG, PNG, WebP, or SVG metadata;
- an allowed CC0, public-domain, or Creative Commons attribution family label;
- a valid HTTP(S) license URL;
- original and thumbnail media hosted exactly on `upload.wikimedia.org`;
- an attribution record containing title, contributor, license, license link, and Commons page.

HTML in contributor and description metadata is stripped and rendered as plain text. Production legal review should confirm handling of jurisdiction-specific public-domain labels and any share-alike obligations for downstream exports.

## Local inspection, export, and deletion

History exposes stored lesson receipts and plans. Export returns versioned JSON containing settings and lessons, never provider keys or screen images. Users can delete one lesson or delete all memory. The all-memory transaction removes lesson and preference records while preserving settings so privacy cleanup does not silently reset capture defaults.

SQLite uses WAL mode. On a device where forensic deletion is in scope, database pages, WAL files, filesystem snapshots, and OS backups may outlive a logical SQL deletion. Production high-assurance deletion would require an explicit secure-storage design and documented backup behavior.

## Threat model summary

| Threat | Control | Residual risk |
| --- | --- | --- |
| Accidental background surveillance | No startup capture/recording; explicit invocation lifecycle | OS or dependency bugs require platform QA |
| Over-sharing screen context | Crop default and per-request broader-context switches | User may deliberately select sensitive material |
| Key leakage into frontend/storage/logs | Native keyring; only booleans returned; no env-key path | Compromised OS session can access user secrets |
| Prompt injection in screenshot/text | Untrusted-content instruction plus fixed schema and semantic validation | Model can still produce misleading but schema-valid content |
| Generated code execution | No executable fields; fixed renderer; sandboxed declarative fallback | Renderer/interpreter bugs remain possible |
| Citation fabrication | URL-annotation/source-URL reconciliation | A real source can still be low quality or misapplied |
| Malicious external links/assets | URL scheme/host allowlists, native opener, CSP | Opened websites run in the user’s browser trust context |
| Resource exhaustion | Input and scene caps, timeouts, finite numeric validation | Very complex valid SVG scenes can still use resources |
| Local history exposure | Memory off/export/delete controls | Unencrypted SQLite is readable to the local user/session |

## Production hardening backlog

1. Sign Windows binaries and add a reproducible, SBOM-producing CI release pipeline.
2. Build, sign, notarize, and permission-test macOS packages on Apple hardware.
3. Add OS-native permission-status UX and revocation tests for every supported release.
4. Add organization-owned provider contract tests without ever committing keys.
5. Add dependency and supply-chain scanning, updater signature verification, and a coordinated vulnerability disclosure process.
6. Decide whether local lesson history needs application-level encryption and how recovery/export keys would work.
7. Restrict source navigation to HTTPS unless an explicit product requirement justifies HTTP.
8. Commission accessibility, privacy, and licensing reviews before public distribution.
