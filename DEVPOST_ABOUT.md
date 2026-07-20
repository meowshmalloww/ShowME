## Inspiration

I built ShowME because asking for help often starts with unnecessary work. If I am looking at a diagram, equation, application, or piece of code, I first have to describe everything on my screen before I can ask the question I actually care about.

I wanted that interaction to feel more natural. I should be able to point at something and say, **“Show me.”**

An earlier Rust and Tauri prototype proved that screen selection could work, but the product was not where I wanted it to be. The interface was crowded, the desktop pet distracted from the main idea, and the architecture made each improvement harder. During Build Week, I rebuilt ShowME as a new Electron application focused on one clear experience: select something visible and turn it into an explanation I can see, hear, and interact with.

> Don’t explain it. Make it visible.

## What it does

ShowME is a screen aware learning assistant that lives in a compact island at the top of the desktop.

I can say **“Show me,”** use a keyboard shortcut, or open the island manually. I can then select an area, draw a lasso, point at one detail, mark several steps, draw an arrow, or capture the full screen.

After I ask a question, ShowME uses the selected visual context to build a structured lesson. A lesson can contain written explanations, numbered annotations, diagrams, narrated steps, interactive controls, and verified simulations.

For example, ShowME can transform a physics diagram into an orbital simulation, explain the order of a program event loop, plot a function, visualize a circuit, or break down a complicated interface one step at a time.

It is not another chat window placed over the desktop. The thing I am already looking at becomes the starting point of the lesson.

Privacy is part of the interaction. Wake phrase recognition runs locally on Windows. Screen capture happens only after a deliberate selection or recognized wake phrase. Screenshots remain in memory and expire instead of being stored in lesson history.

## How we built it

I rebuilt ShowME with **Electron, TypeScript, React, and Node.js**. The application uses separate windows for the top island, screen selection, settings, and lessons. A typed preload layer keeps the renderer isolated from privileged desktop operations.

The Electron main process owns screen capture, window behavior, model requests, local storage, and native workers. A Rust worker handles physical pixel conversion for high DPI displays and protects provider credentials with Windows DPAPI. A constrained Python worker independently verifies calculations used by interactive simulations. SQLite stores settings, lesson history, feedback, and optional learning memory locally.

The most important architectural decision was to treat model output as untrusted data. GPT-5.6 does not generate interface code that ShowME executes. It returns a declarative lesson plan through the OpenAI Responses API. That plan must pass a strict JSON schema, Zod validation, semantic checks, and deterministic simulation verification before trusted React components can render it.

This allows the model to decide **what should be explained** while the application remains responsible for **what is safe and valid to display**.

I used **Codex with GPT-5.6** throughout the redesign. I gave Codex the earlier prototype, five detailed product specifications, screenshots of broken states, and direct feedback from repeated Windows tests. Codex helped me trace coordinate conversions across Electron and Rust, build the lesson contract, connect provider adapters, diagnose microphone behavior, repair interface regressions, package the Windows application, and run the complete verification gate.

I made the product decisions throughout that process. I removed the pet, fixed the wake name to ShowME, kept screen capture deliberate, rejected generated interface code, redesigned the top island, and sent back implementations that did not feel right.

Inside the product, `gpt-5.6-sol` is the default OpenAI lesson model. It receives the selected image and question, produces structured lesson data, supports Quick and Deep reasoning modes, and can perform web research when a lesson needs sources.

## Challenges we ran into

Screen capture was much harder than simply taking a screenshot. ShowME has to translate coordinates correctly across multiple displays, different scaling settings, logical pixels, and physical pixels. Transparent selection windows also have to disappear at exactly the right moment so they do not appear inside the captured image.

The top island created another set of challenges. It needed to remain small while idle, expand smoothly when needed, stay out of screenshots, support click through behavior, and avoid invisible window regions that could block other applications.

Voice activation required careful balancing. An early implementation was too permissive and sometimes treated ordinary conversation as the wake phrase. Making the confidence threshold stricter stopped the false activations but also caused ShowME to ignore a real voice. I replaced the continuous overlapping audio windows with complete local utterance detection, a short audio lead in, silence detection, dictation screening, and a closed ShowME grammar.

The final major challenge was making model generated lessons expressive without allowing arbitrary generated code to run. The declarative lesson format and local verification pipeline became the foundation of the product.

## Accomplishments that we're proud of

I am proud that ShowME became a working desktop system instead of remaining a visual prototype.

It now includes real screen selection, local wake phrase recognition, secure credential storage, microphone and speaker selection, model discovery, structured lesson generation, local history, learning memory controls, narration, citations, and interactive simulations.

The lesson renderer can safely combine explanations with diagrams, overlays, controls, and simulations without executing model generated JavaScript.

I am also proud of the verification work. The project has automated TypeScript, Rust, Python, schema, provider, coordinate, simulation, audio, and wake phrase tests. It has also been packaged and launched as both a Windows installer and portable application.

Most importantly, the interaction now feels close to the original idea. I can point at something, ask what I want to understand, and watch the explanation form around the exact thing that confused me.

## What we learned

I learned that the strongest AI interface is not always another text box. Screen context, spatial selection, voice, and interactive visuals can remove much of the effort required to ask a useful question.

I also learned that AI products become more reliable when responsibilities are clearly divided. The model is good at planning and explaining. The application should continue to own permissions, credentials, validation, rendering, and deterministic calculations.

Working with Codex also changed how I approached problems that crossed several languages and processes. Instead of debugging the renderer, IPC layer, native worker, and packaged application separately, I could follow one failure through the entire system and verify the final behavior in context.

The most important lesson was simple: model output should be treated as a plan, not trusted as executable software.

## What's next for ShowME

Next, I want to improve wake recognition across more accents, rooms, and microphone environments. I also want to expand accessibility testing and make longer lessons appear progressively while deeper reasoning continues.

The simulation library can grow beyond the current physics, mathematics, electronics, and programming modules. I want ShowME to support more visual subjects while keeping each interactive result deterministic and locally verified.

Longer term, I see ShowME becoming a general learning layer for the desktop. Anything visible should be something I can point at, question, explore, and understand.

## Built with

`Codex`, `GPT-5.6`, `OpenAIResponsesAPI`, `Electron`, `ElectronVite`, `ElectronBuilder`, `TypeScript`, `React`, `Node.js`, `Vite`, `Zod`, `JSONSchema`, `Rust`, `Python`, `PowerShell`, `SQLite`, `WindowsDPAPI`, `WindowsSpeechRecognition`, `LucideReact`, `SimpleIcons`, `Sharp`, `Vitest`, `Biome`, `PyInstaller`, `NSIS`
