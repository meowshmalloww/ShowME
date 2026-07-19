# Implementation research

This redesign was checked against current primary documentation in July 2026.

## Desktop platform

- Electron 43 uses Node 24 and Chromium 150. The app follows Electron’s security checklist: isolated and sandboxed renderers, no Node integration, restricted navigation, no webviews, a CSP, and sender validation. See [Electron 43](https://www.electronjs.org/blog/electron-43-0) and [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).
- Screen acquisition uses Electron’s documented [desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer) surface and BrowserWindow/display geometry.
- Windows capture behavior is documented in [Windows screen capture](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture). Per-monitor DPI design follows Microsoft’s [high-DPI desktop guidance](https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows).
- macOS permission and modern capture behavior are described by [ScreenCaptureKit](https://developer.apple.com/documentation/ScreenCaptureKit).
- Node 24 includes node:sqlite, allowing Electron main to be the only database owner without an additional native database module.

## OpenAI reference path

- GPT-5.6 Sol is used through the Responses API. Quick mode requests low reasoning effort; Deep mode requests high effort and web search. See [model guidance](https://developers.openai.com/api/docs/guides/model-guidance?model=gpt-5.6).
- Lesson plans use Responses API text.format JSON schema output and are validated again locally. See [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
- Selected screenshots are provided as input_image data URLs at high detail. See [images and vision](https://developers.openai.com/api/docs/guides/images-vision).
- Deep mode uses the native web_search tool. Only URL citations observed in response annotations survive reconciliation. See [web search](https://developers.openai.com/api/docs/guides/tools-web-search).
- Push-to-talk uses gpt-4o-transcribe; optional cloud narration uses gpt-4o-mini-tts and labels the result as an AI voice. See [speech to text](https://developers.openai.com/api/docs/guides/speech-to-text) and [text to speech](https://developers.openai.com/api/docs/guides/text-to-speech).

## Other providers

Alibaba Cloud Model Studio, NVIDIA NIM, Groq, Cerebras, and OpenRouter expose OpenAI-compatible API surfaces, but image and strict-output capability remains model-specific. ShowME therefore publishes conservative defaults, allows an advanced override in persisted settings, and rejects a screenshot request before network submission when the active route is not vision-capable.

Groq is identified explicitly as Groq inference—not xAI’s Grok. Groq also supplies the optional Whisper transcription route. Deep cited research remains on the OpenAI reference path until another integration can return native, inspectable source annotations rather than model-authored URLs.

## Design conclusions

The prior app demonstrated useful selection, schema, grounding, and simulation logic but coupled it to a monolithic UI and a desktop-pet metaphor. This version preserves the strong normalized-coordinate and deterministic-module concepts while replacing the presentation with:

- one ambient top-edge affordance instead of a character;
- a short selection-to-question path;
- a visual stage plus compact story controls instead of chat bubbles;
- explicit confidence and evidence states;
- a conventional workspace for history and settings;
- strict renderer, main, and worker trust boundaries.
