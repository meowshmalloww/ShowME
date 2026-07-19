import { spawn, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "win32") {
  console.log("Wake recognizer self-test skipped outside Windows.");
  process.exit(0);
}

const powershell = resolve(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const script = resolve("workers", "wake", "showme-wake.ps1");
const result = spawnSync(
  powershell,
  [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-SelfTest",
    "-WakePhrase",
    "ShowME",
  ],
  { encoding: "utf8", windowsHide: true, timeout: 20_000 },
);

const protocol = parseProtocol(result.stdout);
const selfTest = protocol.find((event) => event.type === "self-test");
if (result.status !== 0 || !selfTest?.success) {
  console.error(result.stderr || result.stdout || "Wake recognizer self-test failed.");
  process.exit(1);
}

const pcmPath = join(tmpdir(), `showme-wake-${process.pid}-${Date.now()}.pcm`);
try {
  const generated = spawnSync(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("scripts", "generate-wake-test-pcm.ps1"),
      "-OutputPath",
      pcmPath,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 20_000 },
  );
  if (generated.status !== 0) throw new Error(generated.stderr || "Could not generate wake PCM.");
  const streamed = await recognizeStream(readFileSync(pcmPath));
  console.log(
    `Wake recognizer understood "${selfTest.phrase}" with confidence ${selfTest.confidence} (${selfTest.culture}); stdin PCM recognized "${streamed.phrase}" at ${streamed.confidence}.`,
  );
} finally {
  try {
    unlinkSync(pcmPath);
  } catch {
    // The temporary PCM is already gone.
  }
}

function parseProtocol(text) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function recognizeStream(speech) {
  return new Promise((resolvePromise, rejectPromise) => {
    const worker = spawn(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-StreamInput",
        "-WakePhrase",
        "ShowME",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    const audio = Buffer.concat([Buffer.alloc(9_600), speech, Buffer.alloc(32_000)]);
    let output = "";
    let fed = false;
    let settled = false;
    const timeout = setTimeout(
      () => finish(new Error("Streaming wake recognition timed out.")),
      15_000,
    );
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.stdin.destroy();
      worker.kill();
      if (value instanceof Error) rejectPromise(value);
      else resolvePromise(value);
    };
    worker.stderr.setEncoding("utf8");
    worker.stderr.on("data", (chunk) => {
      const message = chunk.trim();
      if (message) finish(new Error(message));
    });
    worker.stdout.setEncoding("utf8");
    worker.stdout.on("data", (chunk) => {
      output += chunk;
      const lines = output.split(/\r?\n/);
      output = lines.pop() || "";
      for (const event of parseProtocol(lines.join("\n"))) {
        if (event.type === "ready" && !fed) {
          fed = true;
          worker.stdin.write(
            `${JSON.stringify({ type: "audio", pcm: audio.toString("base64") })}\n`,
          );
        } else if (event.type === "wake") {
          finish(event);
        } else if (event.type === "error") {
          finish(new Error(event.message || "Streaming wake recognizer failed."));
        }
      }
    });
    worker.on("error", finish);
    worker.on("exit", (code) => {
      if (!settled) finish(new Error(`Streaming wake recognizer exited with code ${code}.`));
    });
  });
}
