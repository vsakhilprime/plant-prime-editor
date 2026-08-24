/* Extracts the scoring engine from the Plant Prime Editor HTML into a headless
   Node module. The whole application script block is loaded inside a minimal DOM
   shim, so the functions are the *same code* the web tool runs — no reimplementation,
   nothing to drift out of sync. */
const fs = require('fs'), vm = require('vm'), path = require('path');

const HTML = process.argv[2] || require('path').join(__dirname,'..','plant_prime_editor_v1.0.html');
const html = fs.readFileSync(HTML, 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const app = blocks.reduce((a, b) => (b.length > a.length ? b : a), '');   // the big one
console.error(`[extract] application block: ${app.length} chars`);

// ── minimal DOM shim ───────────────────────────────────────────────────────
function stubEl() {
  const el = {
    style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {}, children: [], value: '', textContent: '', innerHTML: '', checked: false,
    appendChild(){}, removeChild(){}, setAttribute(){}, getAttribute(){ return null; },
    removeAttribute(){}, addEventListener(){}, removeEventListener(){}, focus(){}, blur(){},
    click(){}, scrollIntoView(){}, closest(){ return null; }, remove(){},
    querySelector(){ return stubEl(); }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,right:0,bottom:0}; },
    insertAdjacentHTML(){}, getContext(){ return null; },
  };
  return el;
}
const documentShim = {
  getElementById(){ return stubEl(); },
  querySelector(){ return stubEl(); },
  querySelectorAll(){ return []; },
  createElement(){ return stubEl(); },
  createTextNode(){ return stubEl(); },
  addEventListener(){}, removeEventListener(){},
  body: stubEl(), documentElement: stubEl(), head: stubEl(),
  readyState: 'complete',
};

const sandbox = {
  console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },   // silence app chatter
  document: documentShim,
  navigator: { userAgent: 'node', clipboard: { writeText(){ return Promise.resolve(); } } },
  location: { href: 'https://akprimeedit.com/', search: '', hash: '' },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){}, clear(){} },
  sessionStorage: { getItem(){ return null; }, setItem(){}, removeItem(){}, clear(){} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (f) => setTimeout(f, 0),
  fetch: () => Promise.reject(new Error('network disabled in batch mode')),
  alert(){}, confirm(){ return true; }, prompt(){ return null; },
  Math, JSON, Date, RegExp, Array, Object, String, Number, Boolean, Promise, Map, Set,
  Intl, Error, TypeError, RangeError, isNaN, isFinite, parseInt, parseFloat,
  encodeURIComponent, decodeURIComponent, structuredClone,
  Blob: class { constructor(){} }, URL: { createObjectURL(){ return ''; }, revokeObjectURL(){} },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const ctx = vm.createContext(sandbox);
try {
  new vm.Script(app, { filename: 'plant_prime_editor_app.js' }).runInContext(ctx);
} catch (e) {
  console.error('[extract] app block threw during load (often harmless — DOM wiring):');
  console.error('          ' + e.message.split('\n')[0]);
}

// ── report which scoring symbols survived ──────────────────────────────────
const WANT = ['findSpacers','genPBS','genRT','computeSpacerSpecificity','m2_calcTm',
              'm2_duplexDG','m2_maxDuplexAndDG','m2_gc','m2_rc','m2_structRisk',
              'NN_DH','NN_DS','SCAFFOLD_SEQ','TEVO'];
const found = {}, missing = [];
for (const k of WANT) {
  const v = ctx[k];
  if (typeof v === 'undefined') missing.push(k); else found[k] = typeof v;
}
console.error('[extract] available:', JSON.stringify(found, null, 0));
  // The probe that used to print '[extract] MISSING : NN_DH, NN_DS, SCAFFOLD_SEQ, TEVO'
  // on every run was wrong: all four exist in the tool, but as const bindings, which
  // vm.runInContext never attaches to the sandbox object. It was reporting the loader's
  // scoping rule as a missing symbol, and nothing read its result. Removed 23 Aug 2026.

module.exports = { ctx, found, missing };
if (require.main === module) {
  console.log(JSON.stringify({ available: Object.keys(found), missing }, null, 2));
}
