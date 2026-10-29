// Builds moonlight-jellyfin.css from src/ and rejects CSS that Chromium 94 (LG webOS 23) lacks.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'moonlight-jellyfin.css');
const FONT_URL = 'https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.1.0/files/inter-latin-wght-normal.woff2';
const FONT_FILE = path.join(__dirname, 'vendor-font', 'inter-latin-wght-normal.woff2');

const UNSUPPORTED = [
  [/:has\(/, ':has()'], [/@container/, '@container'], [/@layer/, '@layer'], [/color-mix\(/, 'color-mix()'],
  [/\boklch\(|\blab\(|\blch\(/, 'oklch/lab/lch'], [/\bdvh\b|\bsvh\b|\blvh\b/, 'dynamic viewport units'],
  [/subgrid/, 'subgrid'], [/scrollbar-width/, 'scrollbar-width'], [/backdrop-filter/, 'backdrop-filter (too costly on TVs)'],
  [/&\s*[.:#\[]/, 'CSS nesting'],
];

const fail = (msg) => { console.log(`FAIL: ${msg}`); process.exit(1); };

const font = fs.readFileSync(FONT_FILE);
if (font.subarray(0, 4).toString('latin1') !== 'wOF2') fail('vendor font is not a woff2');

const layers = fs.readdirSync(SRC).filter((f) => f.endsWith('.css')).sort();
const css = layers.map((f) => `/* ${f} */\n${fs.readFileSync(path.join(SRC, f), 'utf8')}`).join('\n')
  .replace(FONT_URL, `data:font/woff2;base64,${font.toString('base64')}`);

const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
// PC-only rules may use :has(); the TV's Chromium 94 drops them, which is harmless when they are scoped to .layout-desktop.
const tvCode = code.replace(/[^{}]*\.layout-desktop[^{}]*:has\([^{}]*\{[^}]*\}/g, '');
const hits = UNSUPPORTED.filter(([re]) => re.test(tvCode)).map(([, name]) => name);
if (hits.length) fail(`uses ${hits.join(', ')}`);
if (/https?:\/\//.test(code)) fail('the build still references a network URL');
const open = (code.match(/\{/g) || []).length;
if (open !== (code.match(/\}/g) || []).length) fail('unbalanced braces');

fs.writeFileSync(OUT, css);
console.log(`OK: ${layers.length} layers, ${css.length} bytes, ${open} rules`);
