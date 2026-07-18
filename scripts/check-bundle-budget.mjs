import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const manifestPath = join(dist, ".vite", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = Object.values(manifest).filter((item) => item.isEntry);

if (entries.length !== 1) {
  throw new Error(`Expected one production entry in ${manifestPath}; found ${entries.length}.`);
}

const entry = entries[0];
const initialFiles = new Set();
const visited = new Set();

function collectInitial(item) {
  if (!item || visited.has(item.file)) return;
  visited.add(item.file);
  initialFiles.add(item.file);
  for (const css of item.css ?? []) initialFiles.add(css);
  for (const imported of item.imports ?? []) collectInitial(manifest[imported]);
}

collectInitial(entry);

async function bytesFor(files) {
  let total = 0;
  for (const file of files) total += (await stat(join(dist, file))).size;
  return total;
}

const allJavaScript = [...new Set(Object.values(manifest).map((item) => item.file))].filter(
  (file) => file.endsWith(".js"),
);
const initialJavaScript = [...initialFiles].filter((file) => file.endsWith(".js"));
const initialCss = [...initialFiles].filter((file) => file.endsWith(".css"));
const chunkSizes = await Promise.all(
  allJavaScript.map(async (file) => ({ file, bytes: (await stat(join(dist, file))).size })),
);
const largestChunk = chunkSizes.toSorted((left, right) => right.bytes - left.bytes)[0];
const measurements = {
  initialJavaScript: await bytesFor(initialJavaScript),
  initialCss: await bytesFor(initialCss),
  totalJavaScript: await bytesFor(allJavaScript),
  largestChunk: largestChunk?.bytes ?? 0,
};
const budgets = {
  initialJavaScript: 260 * 1024,
  initialCss: 96 * 1024,
  totalJavaScript: 500 * 1024,
  largestChunk: 220 * 1024,
};

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
console.log("ShowME production bundle budget");
console.log(
  `  Initial JavaScript: ${kib(measurements.initialJavaScript)} / ${kib(budgets.initialJavaScript)}`,
);
console.log(`  Initial CSS:        ${kib(measurements.initialCss)} / ${kib(budgets.initialCss)}`);
console.log(
  `  Total JavaScript:   ${kib(measurements.totalJavaScript)} / ${kib(budgets.totalJavaScript)}`,
);
console.log(
  `  Largest chunk:      ${kib(measurements.largestChunk)} / ${kib(budgets.largestChunk)} (${largestChunk?.file ?? "none"})`,
);

const failures = Object.entries(measurements).filter(([name, bytes]) => bytes > budgets[name]);
if (failures.length > 0) {
  throw new Error(
    `Bundle budget exceeded: ${failures.map(([name, bytes]) => `${name}=${kib(bytes)}`).join(", ")}`,
  );
}
