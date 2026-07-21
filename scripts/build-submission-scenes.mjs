import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "artifacts", "submission", "scenes");
await mkdir(output, { recursive: true });

const shell = (content) => `
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07090e"/><stop offset="1" stop-color="#10131d"/></linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <rect x="46" y="42" width="1828" height="996" rx="34" fill="none" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/>
  <g transform="translate(82 74)" fill="none" stroke="#f7f4ee" stroke-width="4"><path d="M0 14V0H14 M42 0H56V14 M56 42V56H42 M14 56H0V42"/><rect x="21" y="21" width="14" height="14" fill="#f7f4ee" stroke="none"/></g>
  <text x="158" y="112" fill="#f7f4ee" font-family="Segoe UI,Arial" font-size="34" font-weight="800">ShowME</text>
  <text x="1750" y="108" fill="#9aa4b2" font-family="Segoe UI,Arial" font-size="20" text-anchor="end">VISUAL LESSON</text>
  ${content}
</svg>`;

const history = shell(`
  <text x="112" y="218" fill="#8bdcff" font-family="Segoe UI,Arial" font-size="20" font-weight="700" letter-spacing="5">READING + HISTORY</text>
  <text x="112" y="292" fill="#ffffff" font-family="Segoe UI,Arial" font-size="58" font-weight="800">Ideas travel with people</text>
  <text x="112" y="340" fill="#aeb6c4" font-family="Segoe UI,Arial" font-size="25">The Silk Road becomes a moving explanation — not another wall of text.</text>
  <g opacity=".42" font-family="Georgia,serif" font-size="22" fill="#d8dce4">
    <text x="114" y="428">Across a network of land and sea routes, merchants carried far more than silk.</text>
    <text x="114" y="462">Paper, mathematics, stories, beliefs, and technologies moved between communities.</text>
    <text x="114" y="496">Every exchange changed both the traveler and the place that received the idea.</text>
  </g>
  <path d="M210 780 C470 600 660 870 905 675 S1320 580 1680 760" fill="none" stroke="#8bdcff" stroke-width="8" stroke-dasharray="18 18" filter="url(#glow)"/>
  <g font-family="Segoe UI,Arial" text-anchor="middle">
    <g transform="translate(210 780)"><circle r="18" fill="#8bdcff" filter="url(#glow)"/><rect x="-92" y="38" width="184" height="72" rx="16" fill="#151b26" stroke="#8bdcff"/><text y="70" fill="#fff" font-size="22" font-weight="750">CHANG'AN</text><text y="96" fill="#8bdcff" font-size="16">paper + silk</text></g>
    <g transform="translate(670 755)"><circle r="18" fill="#ffbd5a" filter="url(#glow)"/><rect x="-105" y="38" width="210" height="72" rx="16" fill="#1e1a15" stroke="#ffbd5a"/><text y="70" fill="#fff" font-size="22" font-weight="750">SAMARKAND</text><text y="96" fill="#ffbd5a" font-size="16">exchange</text></g>
    <g transform="translate(1115 620)"><circle r="18" fill="#b89cff" filter="url(#glow)"/><rect x="-90" y="38" width="180" height="72" rx="16" fill="#191727" stroke="#b89cff"/><text y="70" fill="#fff" font-size="22" font-weight="750">BAGHDAD</text><text y="96" fill="#b89cff" font-size="16">mathematics</text></g>
    <g transform="translate(1680 760)"><circle r="18" fill="#ff7d78" filter="url(#glow)"/><rect x="-82" y="38" width="164" height="72" rx="16" fill="#241719" stroke="#ff7d78"/><text y="70" fill="#fff" font-size="22" font-weight="750">VENICE</text><text y="96" fill="#ff7d78" font-size="16">new routes</text></g>
  </g>
  <rect x="740" y="544" width="400" height="56" rx="18" fill="#07090e" fill-opacity=".9" stroke="#ffffff" stroke-opacity=".2"/>
  <text x="940" y="580" fill="#ffffff" font-family="Segoe UI,Arial" font-size="24" font-weight="750" text-anchor="middle">goods → ideas → change</text>
`);

const physics = shell(`
  <text x="112" y="218" fill="#ffbd5a" font-family="Segoe UI,Arial" font-size="20" font-weight="700" letter-spacing="5">PHYSICS SIMULATION</text>
  <text x="112" y="292" fill="#ffffff" font-family="Segoe UI,Arial" font-size="58" font-weight="800">Why the path is a parabola</text>
  <text x="112" y="340" fill="#aeb6c4" font-family="Segoe UI,Arial" font-size="25">One motion, split into independent horizontal and vertical components.</text>
  <g opacity=".18" stroke="#aeb6c4" stroke-width="1"><path d="M170 400V920 M320 400V920 M470 400V920 M620 400V920 M770 400V920 M920 400V920 M1070 400V920 M1220 400V920 M1370 400V920 M1520 400V920 M1670 400V920"/><path d="M170 440H1720 M170 560H1720 M170 680H1720 M170 800H1720 M170 920H1720"/></g>
  <path d="M220 840 Q930 170 1660 840" fill="none" stroke="#8bdcff" stroke-width="8" stroke-dasharray="20 14" filter="url(#glow)"/>
  <line x1="220" y1="840" x2="1710" y2="840" stroke="#e8edf5" stroke-width="4"/><line x1="220" y1="900" x2="220" y2="390" stroke="#e8edf5" stroke-width="4"/>
  <g font-family="Segoe UI,Arial" font-weight="750">
    <rect x="270" y="395" width="430" height="142" rx="22" fill="#111824" stroke="#8bdcff"/>
    <text x="306" y="448" fill="#8bdcff" font-size="30">x = v₀ cos(θ) · t</text>
    <text x="306" y="494" fill="#ffffff" font-size="20">constant horizontal velocity</text>
    <rect x="1210" y="395" width="430" height="142" rx="22" fill="#201917" stroke="#ffbd5a"/>
    <text x="1246" y="448" fill="#ffbd5a" font-size="30">y = v₀ sin(θ)t − ½gt²</text>
    <text x="1246" y="494" fill="#ffffff" font-size="20">gravity changes vertical velocity</text>
    <circle cx="940" cy="505" r="56" fill="none" stroke="#b89cff" stroke-width="8" filter="url(#glow)"/>
    <text x="940" y="590" fill="#b89cff" font-size="23" text-anchor="middle">APEX: vertical velocity = 0</text>
  </g>
`);

const cursor = `<svg width="92" height="112" xmlns="http://www.w3.org/2000/svg"><defs><filter id="g"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="34" cy="34" r="25" fill="none" stroke="#8bdcff" stroke-width="6" opacity=".9" filter="url(#g)"/><path d="M23 18 L72 61 L48 65 L60 94 L43 102 L31 72 L13 88 Z" fill="#f7f4ee" stroke="#071018" stroke-width="5"/></svg>`;
const ball = `<svg width="90" height="90" xmlns="http://www.w3.org/2000/svg"><defs><filter id="g"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="45" cy="45" r="27" fill="#ffbd5a" stroke="#fff4d5" stroke-width="6" filter="url(#g)"/></svg>`;

await Promise.all([
  sharp(Buffer.from(history)).png().toFile(join(output, "history-scene.png")),
  sharp(Buffer.from(physics)).png().toFile(join(output, "physics-scene.png")),
  sharp(Buffer.from(cursor)).png().toFile(join(output, "teaching-cursor.png")),
  sharp(Buffer.from(ball)).png().toFile(join(output, "projectile-ball.png")),
]);

console.log(output);
