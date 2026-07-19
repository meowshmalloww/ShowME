
farzaa/clicky 
ShowME — Master Product Blueprint
Tagline: Don’t explain it. Make it visible.
ShowME is a native Windows and macOS desktop application—not a browser extension. It lives as a small draggable pet on top of the user’s screen. When someone is confused by anything they are viewing (doesn’t limit to studying), they speak to ShowME or select the relevant part of the screen (For example; highlighting it). ShowME turns that exact material into a personalized, narrated, interactive visual lesson.
The screen becomes a temporary whiteboard.
A user does not receive a wall of chat text. They receive moving diagrams, arrows, shapes, graphs, simulations, labels, motion arts, animations, simulation on screen (ai will code simulations on screen) and spoken explanation that adapt to the question they asked.
The core product promise
Anything you are looking at can become explainable.
A learner can be watching a physics video, reading a textbook PDF, viewing a trigonometry diagram, debugging code, editing a video, finding the right buttons on the website, and so much more! or studying music theory.
They say:
“ShowME, I do not understand this.”
ShowME understands the selected content plus approved context, researches when necessary, then creates the smallest useful visual explanation. ShowMe is only the project name, you can set whatever you want to call it any names in the settings.
Examples:
A right triangle becomes an interactive triangle whose sides change as the user moves the angle.
A physics problem becomes a controllable simulation with forces, velocity, and trajectories.
A code snippet becomes a live animation of values moving through functions, event loops, or recursive calls.
A chemistry diagram becomes a labeled process animation.
A music waveform becomes a visual explanation of frequency, harmonics, or compression.
What ShowME is not
Not a Chrome extension.
Not a generic chatbot overlay.
Not a text summarizer.
Not an AI video generator.
Not a mascot with educational features attached.
Not a dashboard.
Not always watching or recording the user’s screen.
Not an app that merely points an arrow at text.
The pet, personality, humor, and pet-like interaction can exist, but they are secondary. The product’s value is the Visual Lesson Compiler.
A learner should never need to learn a complicated workflow. The fundamental interaction is:
See something confusing.
Invoke ShowME.
Ask naturally.
Watch and manipulate the explanation.
Ask for a different explanation if needed.
Example: the first-place demo moment

AI will start coding the simulation or whatever also motion art or coding videos. 
A learner is watching a physics lesson about orbital motion.
They say:
“ShowME, why does a satellite keep falling but never hit Earth?”
They circle the satellite or select the relevant video frame.
ShowME replies through the speaker:
“Gravity is pulling it downward the entire time. The missing piece is sideways velocity. Let me make that visible.”
A clean whiteboard opens beside the source material. It draws Earth, the satellite, a gravity vector, a velocity vector, and a trajectory (maybe it will pull images online or shapes 
The learner moves a velocity slider:
Too little sideways velocity: the satellite hits Earth.
Correct velocity: it enters orbit.
More velocity: the orbit expands or it escapes.
Then the learner asks:
“What happens if gravity stops?”
The simulation changes immediately.
This is the hook: the AI did not tell the learner the answer; it built the exact experiment needed to understand the answer.
Primary user experience
1. Ambient Pet
ShowME is available as:
A small draggable pet.
System-tray icon.
Global hotkey.
Optional push-to-talk voice shortcut.
It is quiet by default. It does not constantly capture the screen or microphone.
2. Selection mode
When invoked, the desktop becomes a temporary selection canvas.
The learner can select:
A rectangle.
A freeform lasso.
Text.
A diagram or image.
A point on the screen.
Multiple regions.
A handwritten arrow or circle.
Two connected regions: “How does this equation relate to this graph?”
A video frame.
Code and its output.
The selected content is the focus. The user can also choose:
Selected item only
Include nearby screen context
Include active window
Use copied or pasted source URL
Research trusted sources
ShowME should not promise access to every page’s DOM or URL. On arbitrary desktop software, it may only have a screenshot, OCR, accessibility text, and user-provided context. That is normal and should be designed into the product.
3. Voice-first teaching
The learner can speak naturally:
“Explain this like I’m new.”
“Why does this happen?”
“Make it visual.”
“Show the equation version.”
“Slow down.”
“That is too basic.”
“Give me another example.”
“Let me control it.”
“Show me why my answer is wrong.”
They can speak anything they wants
Voice is the primary interaction, but every important action also has clickable controls for quiet places, accessibility, and reliability.
4. The lesson plane
Instead of covering the entire source with chat, ShowME opens a movable, resizable lesson plane.
It can work in three modes:
Inline mode: annotations appear directly over the selected content.
Side-by-side mode: the original material stays visible while the lesson plane appears beside it.
Focus mode: distracting content dims and the lesson fills a clean whiteboard.
The learner can pause, replay, slow down, step through, drag variables, or return to the original screen at any time.
We have own design of story memory database locally. 
The Visual Lesson Compiler
This is the core technical and product invention.
GPT-5.6 does not produce arbitrary prose. It creates a structured visual lesson plan describing:
What the learner selected.
What concept is being explained.
Which evidence/source claims support the explanation.
Which teaching mode to use.
Which visual primitives should appear.
What narration should play.
What variables the learner may control.
What the next useful explanation would be.
The renderer then transforms that plan into a live experience.
Trusted visual primitives
ShowME has a large visual vocabulary:
Draw line, arrow, curve, bracket, label, equation.
Highlight, spotlight, blur, dim, isolate.
Rotate, scale, transform, morph, compare.
Reveal a hidden relationship.
Animate graph points and function traces.
Display timelines, state machines, flow diagrams, force vectors.
Create draggable sliders and parameter controls.
Show before/after or side-by-side models.
Draw custom shapes on a transparent canvas.
Play prebuilt micro-animations where appropriate.
The model chooses the right primitives. The renderer owns the actual geometry and animation.
Simulation routes
ShowME should use two routes.
Verified simulation route
For high-value topics—geometry, mechanics, circuits, basic chemistry, code execution—the app uses deterministic math or simulation modules. GPT-5.6 chooses parameters and explanation order, but the physics and calculations come from trusted code.
Sandboxed generated simulation route
For unusual concepts, GPT-5.6 can generate a small visual simulation program. It executes inside a locked-down canvas/WASM sandbox:
No desktop access.
No file access.
No network access.
No ability to execute OS commands.
No access to API keys.
Strict time, memory, and rendering limits.
That gives ShowME the “it created this experiment just for me” magic without letting model-generated code control the user’s computer.
Teaching modes
ShowME should not always teach the same way. GPT-5.6 selects a mode based on the learner’s request and the source.
Mode
Example
Visual intuition
“Why does a satellite orbit?”
Worked derivation
“How do I solve this trigonometry question?”
Interactive experiment
“What changes if I increase resistance?”
Diagram annotation
“What are these parts of the cell?”
Code execution view
“Why is this callback running later?”
Compare-and-contrast
“Why is sine correct here, not cosine?”
Simplified explanation
“Explain this paragraph without jargon.”
Advanced explanation
“Show the formal proof or equation.”

The learner can always override the chosen mode.
Initial subject coverage
The product can eventually support almost any visual learning problem. The hackathon build should prove depth in a few domains.
Flagship: physics
Orbital motion.
Projectile motion.
Forces and free-body diagrams.
Electricity and circuits.
Waves and frequency.
Conservation of energy.
Physics is ideal because it creates visually stunning, interactive simulations.
Secondary: mathematics
Geometry.
Trigonometry.
Graphs and functions.
Calculus intuition.
Probability.
Vectors and transformations.
Third proof of platform: programming
Event loops.
Functions and state changes.
Recursion.
API requests.
Data flow.
Algorithms.
Later modules can include chemistry, biology, music theory, video editing, finance, architecture, engineering, and software tutorials.
Accuracy architecture
ShowME cannot pretend to be accurate when it is uncertain.
Its reliability model:
User-selected source first
The selected visual, text, document, or URL is the primary context.
Trusted source retrieval second
If external research is needed, retrieve credible educational sources, documentation, university material, or vetted concept-pack sources.
Evidence-to-claim mapping
Important claims in the lesson should map to source evidence.
Deterministic computation where possible
Math, geometry, physics, graphs, and code traces should use actual engines—not model guesses.
Confidence states
Verified lesson pack.
Source-grounded explanation.
Exploratory explanation with uncertainty.
Refuse or clarify when needed
If ShowME cannot identify a diagram or establish enough context, it should ask:
“I can give a general visual explanation, but I need the source or a little more context to be precise.”
No fake expertise
It should never diagnose a learner’s neurotype, intelligence, fatigue, dyslexia, ADHD, or emotional state.
Web research and image policy
ShowME may research online when the learner permits it.
It should:
Show the user when web research is used.
Prefer credible educational sources.
Preserve source links in the lesson receipt.
Use original vector diagrams whenever possible.
Only use external images with source attribution and permission-aware handling.
Never scrape or hotlink random Google Images.
Web images are a supporting feature, not the core experience. The core visual output is generated through code and vector graphics.
Personalization and memory
ShowME should remember teaching preferences locally:
Visual-first versus equation-first.
Fast versus step-by-step.
Voice on/off.
Preferred language.
Reduced-motion preference.
Topics previously studied.
Which explanation modes helped.
It should not assume a person needs simpler explanations because they once clicked “I don’t understand.” It should treat feedback as a preference for that session or concept, not a diagnosis.
The learner can explicitly choose:
“Visual and fast”
“Step-by-step”
“Formal and technical”
“Exam practice”
“Let me experiment”
Recommended stack
Desktop shell: Tauri 2.
Shared core: Rust.
Interface: React, TypeScript, Vite.
Animation: PixiJS/Canvas/WebGL for motion; SVG for labels, arrows, and equations.
Local storage: SQLite plus encrypted local secrets.
Backend: TypeScript service or Rust service.
OpenAI runtime: GPT-5.6 through the Responses API.
Voice: speech-to-text and text-to-speech through dedicated audio services or native OS speech.
Model abstraction: provider adapter for testing other VLMs, while GPT-5.6 remains the primary hackathon model.
Tauri is suitable because it supports cross-platform desktop apps with web UI plus native Rust/Swift/Kotlin integrations, and supports custom transparent windows. Tauri documentation
GPT-5.6 supports image input, structured outputs, function calling, and web search tools, but its output is text rather than direct audio; voice needs a separate speech layer. GPT-5.6 documentation
Platform-native integrations
macOS
ScreenCaptureKit for explicit screen/window capture permission.
Accessibility APIs for available text/context.
Transparent always-on-top overlay window.
Windows
Windows Graphics Capture for explicit user-approved screen/window capture.
UI Automation for available text/context.
Transparent topmost overlay window.
Windows capture requires user consent and recommends avoiding heavy work on the UI thread, which supports the design choice to analyze snapshots only when the learner invokes ShowME—not continuously. Microsoft capture guidance
Privacy and trust
ShowME needs an unusually clear privacy posture because it sees screens.
It never watches continuously by default.
It never records screen video by default.
It never listens continuously by default.
It clearly previews what is being sent before a model request.
Screenshots are held locally unless the learner initiates a request.
Session history is local by default.
Cloud sync is opt-in.
The learner can delete any session, source, or memory.
API keys never live in the desktop client; the backend holds secrets. OpenAI API-key safety guidance
ShowME must also include a prominent motion toggle and reduced-motion mode. Motion is valuable here, but users must be able to pause or reduce nonessential animation. W3C animation guidance
Performance targets
Interaction
Target
Pet and hotkey response
Immediate
Selection canvas
Immediate/local
Screen crop and annotation capture
Under 300 ms target
First useful model response
Stream within a few seconds
Visual renderer
60fps target
Voice
Starts with the first lesson step
Follow-up adaptation
Reuse existing context where possible

ShowME should never wait to generate an entire long lesson before displaying anything. It should progressively show:
“I see the triangle.”
“Let’s isolate the angle.”
First visual movement.
Voice explanation.
Interactive controls.
What belongs in the hackathon build
Must have
Native desktop overlay.
Pet/hotkey invocation.
Rectangle, lasso, and text/point selection.
Voice question plus text fallback.
Screenshot/context pipeline.
GPT-5.6 structured visual lesson planning.
Interactive Canvas/SVG renderer.
Spoken narration.
“Simpler,” “more advanced,” “replay,” and “let me control” controls.
Physics flagship simulation.
Trigonometry secondary simulation.
One coding visualization.
Citations/source panel.
Local session receipt.
A polished three-minute demo.
Nice to have
Multiple-selection relationships.
Optional web image aids.
Interactive pet reactions.
User-drawn annotations.
Full multi-monitor support.
Advanced simulation code sandbox.
macOS and Windows release packages.
Later
Larger concept-pack marketplace.
Teacher sharing.
Study plans and spaced recall.
Offline/local models.
Collaborative learning.
More subjects.
Personal learning analytics.
Explicitly cut
Generic chat panel.
Auto-rewriting the entire screen.
Background monitoring.
Always-on microphone.
AI video generation.
Browser automation.
Universal support for every topic on day one.
Claims of diagnosing learning conditions.
Unlicensed image scraping.
Hackathon positioning
Project name: ShowME
Tagline: Don’t explain it. Make it visible.
Track: Education
One-line description: A voice-first desktop AI that turns any confusing screen into a live, personalized visual lesson and interactive simulation.
How it earns each score
Criterion
Proof in the submission
Technological Implementation
Native overlay, multimodal GPT-5.6 pipeline, structured visual compiler, simulations, sandboxing, citations, real tests, Codex-built codebase
Design
One coherent flow: see confusion → ask naturally → watch it become visible → interact
Potential Impact
Learning happens on screens everywhere; ShowME helps learners understand rather than merely receive answers
Quality of Idea
A new response format: AI-generated explanation interfaces, not AI-generated chat responses

The official submission requires a runnable project, repository/README, under-three-minute public YouTube demo with audio explaining GPT-5.6 and Codex use, plus a Codex /feedback session ID. Hackathon overview
The final product sentence
ShowME is a desktop visual lesson compiler: speak to it about anything confusing on your screen, and it creates the interactive explanation you needed to see.



