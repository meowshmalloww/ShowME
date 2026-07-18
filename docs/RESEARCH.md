# Strategic and technical research

Research was translated into implementation decisions for ShowME `0.1.3`. Sources below are primary vendor or standards documentation and were checked during the build on July 17, 2026.

## Key conclusions

### OpenAI compilation path

OpenAI documents GPT-5.6 Sol (`gpt-5.6-sol`) as accepting image input and supporting structured outputs and web search. The model itself does not expose native audio input/output, so ShowME composes three explicit API surfaces: Responses for lesson compilation, transcription for push-to-talk, and speech generation for narration.

Implementation consequence: OpenAI is the reference adapter. A screen crop and question are sent to the Responses API with a strict JSON schema. Optional web search is an explicit request switch. Actual response URL annotations are captured independently so the model cannot establish citation provenance merely by typing a URL into JSON.

Primary references:

- [GPT-5.6 Sol model reference](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [Images and vision with the Responses API](https://platform.openai.com/docs/guides/images-vision)
- [Structured outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Web search tool](https://platform.openai.com/docs/guides/tools-web-search)
- [Speech to text](https://platform.openai.com/docs/guides/speech-to-text)
- [Text to speech](https://platform.openai.com/docs/guides/text-to-speech)
- [API-key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)

### Tauri desktop boundary

Tauri 2 supports programmatic windows, system tray integration, global shortcuts, and capability-based permission policy. Its security guidance reinforces treating the WebView as less trusted than the Rust core.

Implementation consequence: there is no always-running browser capture loop or frontend-held secret. Rust creates the main, pet, and selection windows and exposes a narrow command allowlist. The selection overlay is ephemeral. Only bundled code can load, remote scripts/frames are blocked by CSP, and closing the main window hides it while tray quit terminates the process.

Primary references:

- [Tauri window customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri system tray](https://v2.tauri.app/learn/system-tray/)
- [Tauri global shortcut plugin](https://v2.tauri.app/plugin/global-shortcut/)
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri security](https://v2.tauri.app/security/)

### Screen capture and coordinates

Windows Graphics Capture is the modern Windows capture family, while Apple directs modern macOS capture work to ScreenCaptureKit. Windows DPI awareness and per-monitor coordinates make it unsafe to mix CSS pixels, logical pixels, and physical capture pixels without an explicit mapping.

Implementation consequence: xcap provides the cross-platform capture abstraction and is built with its WGC feature on Windows. The overlay is positioned and sized in physical monitor coordinates. All user and lesson geometry is normalized to `[0,1000]`, then converted at the crop or rendering boundary. Capture occurs only after an invocation and uses operating-system permission behavior.

Primary references:

- [Windows screen capture](https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture)
- [Windows DPI awareness](https://learn.microsoft.com/en-us/windows/win32/api/windef/ne-windef-dpi_awareness)
- [Windows application manifests](https://learn.microsoft.com/en-us/windows/win32/sbscs/application-manifests)
- [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit)
- [Capturing screen content in macOS](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos)

### Alibaba Cloud Qwen vision route

Alibaba Cloud Model Studio exposes a pay-as-you-go OpenAI-compatible endpoint in US (Virginia) without a workspace-specific hostname. Its current guidance recommends `qwen3.7-plus` for visual understanding. The model accepts Base64 Data URLs and supports JSON object output in non-thinking mode, but Alibaba documents JSON mode rather than ShowME's strict JSON Schema contract.

Implementation consequence: ShowME has a direct US-region Alibaba Cloud Qwen adapter. It sends selected screenshots using the documented `image_url` shape, forces `enable_thinking: false`, requests JSON mode, and still applies Rust deserialization and semantic validation. Grounded web research and voice remain disabled for this route. Connection testing performs a minimal model request because the chat endpoint is the documented compatibility surface.

Primary references:

- [Alibaba Cloud Model Studio overview and regional endpoints](https://www.alibabacloud.com/help/en/model-studio/what-is-model-studio)
- [Visual understanding model guide](https://www.alibabacloud.com/help/en/model-studio/vision-model)
- [Structured output](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)
- [OpenAI-compatible Chat API](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions)
- [Obtain an API key](https://www.alibabacloud.com/help/en/model-studio/get-api-key)

### Compatible providers are model-dependent

Alibaba Cloud Qwen, NVIDIA NIM, Groq, Cerebras, and OpenRouter expose OpenAI-compatible APIs, but image input, tools, and JSON-schema enforcement differ by model and routing choice. OpenRouter can require requested parameters rather than allow a provider route to ignore them.

Implementation consequence: each provider has a conservative capability profile and an inspectable per-provider override. A request is rejected when its required capability is absent. There is no silent text-only downgrade for a screenshot lesson, no silent removal of research, and no claim that a generic compatible route produced grounded citations.

Primary references:

- [NVIDIA NIM LLM API reference](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
- [Cerebras structured outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)

### Generated UI must remain data

The core product risk is letting a model turn selected content into arbitrary executable markup or scripts inside a privileged desktop app. A schema alone is insufficient if it contains escape hatches such as raw HTML, JavaScript, CSS, URLs, or unconstrained expressions.

Implementation consequence: the lesson grammar contains fixed primitives, fixed simulation tags, numeric values, bounded text, references, and claims. Rust performs semantic validation after JSON decoding. The custom fallback supports only a small entity list and five declarative motions in a sandbox. This creates a clear confidence distinction between a verified simulation, source-grounded diagram, and exploratory output.

### Citations and lawful image aids

MediaWiki exposes `imageinfo` and Commons extension metadata for original/thumbnail URLs, author information, and license fields. Those fields still need allowlisting and safe rendering.

Implementation consequence: image aids search Wikimedia Commons only, reject unsupported MIME types and non-attribution/non-public-domain licenses, require HTTPS media from `upload.wikimedia.org`, strip metadata HTML, and retain title, artist, license, license URL, page URL, and description. The product never performs a general image scrape.

Primary references:

- [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo)
- [CommonsMetadata](https://www.mediawiki.org/wiki/Extension:CommonsMetadata/en)

### Motion and accessibility

WCAG guidance requires controls for moving content in relevant circumstances and recognizes `prefers-reduced-motion` as a way to suppress interaction-triggered motion. A lesson must not encode its meaning only in animation.

Implementation consequence: simulations have explicit pause/reset/step controls where relevant, reduced-motion settings are persisted, ambient animation is disabled under reduced motion, and every visual lesson has text, narration, ordered steps, and keyboard-operable controls.

Primary references:

- [WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [WCAG technique C39: prefers-reduced-motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html)

## Product tradeoffs

| Decision | Benefit | Cost / follow-up |
| --- | --- | --- |
| Invocation-only still capture | Clear consent boundary; low idle resource use | Not a live copilot; user reinvokes for changed content |
| Selected crop by default | Data minimization and better prompt focus | Some questions need explicit nearby/active context |
| Fixed renderer and verified simulations | Predictable safety, QA, and accessibility | Less visual variety than arbitrary generated apps |
| Rust-side provider calls and keyring | Secrets stay out of the WebView and project files | Native credential behavior must be tested per OS |
| Local SQLite memory | Fast, inspectable, exportable, deletion-capable | No cross-device sync in this version |
| OpenAI-only grounded search and voice | One auditable path with source annotations | Alternate provider users still need OpenAI for voice and must omit web research |
| Wikimedia-only image aids | Stronger license metadata and stable allowlist | Smaller asset catalog and attribution UI overhead |

## Release implications

Windows production distribution should add code signing, crash telemetry only with explicit consent, automated mixed-DPI/multi-monitor tests, an updater, and provider integration tests backed by organization-owned test accounts. macOS requires a native build matrix, Screen Recording and microphone permission QA, Apple Silicon and Intel decisions, signing, notarization, and entitlement review. None of those release-process gaps are hidden by the current prototype label.
