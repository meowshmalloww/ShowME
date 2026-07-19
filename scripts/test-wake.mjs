import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

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

const protocol = result.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
const selfTest = protocol.find((event) => event.type === "self-test");
if (result.status !== 0 || !selfTest?.success) {
  console.error(result.stderr || result.stdout || "Wake recognizer self-test failed.");
  process.exit(1);
}
console.log(
  `Wake recognizer understood "${selfTest.phrase}" with confidence ${selfTest.confidence} (${selfTest.culture}).`,
);
