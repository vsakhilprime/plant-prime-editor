// check_card_matches_primers.js
//
// The cloning-strategy cards in Module 3 draw a PCR product and a digest. Those are
// pictures of molecules a user will actually make, from primers the same tool emits,
// so the picture and the primers have to describe the same molecule.
//
// They did not. The cards re-derived the construct instead of reading the primers, and
// the re-derivation ignored `supplies_3prime` — the three acceptors that already carry
// the linker, tevopreQ1 and the Pol III terminator, for which runPrimerDesign correctly
// stops the insert at the PBS. On pICH47742::pRPS5a-PE2max-NC with PE2max the card drew
// a 210 bp product and a 188 bp digest from a 56 nt Fw2 and a 65 nt Rw2 that can only
// make 162 bp and 138 bp. It also hardcoded one spacer base where BbsI needs two, so
// every BbsI length was 1 nt short per arm.
//
// This runs the real runPrimerDesign for every vector, captures the real card HTML, and
// compares the bp badge on each card against the product reconstructed from the emitted
// primers — the same reconstruction tests/test_primer_roundtrip.js digests.
//
// Run:  node analysis/check_card_matches_primers.js

const vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { ctx, q } = require(path.join(ROOT, 'tests', 'probe.js'));

const rc = s => s.split('').reverse()
  .map(c => ({ A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }[c] || c)).join('');

const SPACER = 'GAAAACACTAAAGAGCCACT';
const RT     = 'TCTAGTGTTCCGAGATCGCCCAGC';
const PBS    = 'GGCTCTTTAG';
const NICK   = 'TTGCAGTCCATGGATCCTAA';

const SCAF = q('M3_SCAFFOLD');
const VECS = JSON.parse(q(`JSON.stringify(VECTORS.map(function(v){
  return { id:v.id, name:v.name, enzyme:v.enzyme, pe:v.peSystems||null,
           s3:!!v.supplies_3prime };
}))`));

// capture the card pane
const mk = ctx.document.createElement;
const pane = mk('div');
const gbi = ctx.document.getElementById;
ctx.document.getElementById = id => (id === 'primer-result-pane' ? pane : gbi(id));

function run(vecId, pe, strategy) {
  pane.innerHTML = '';
  vm.runInContext(`
    selectedVec = VECTORS.find(function(v){ return v.id === ${JSON.stringify(vecId)}; });
    m2Data = { peSystem: ${JSON.stringify(pe)},
      spacer:{spacer:${JSON.stringify(SPACER)}}, rt:{seq:${JSON.stringify(RT)}}, pbs:{seq:${JSON.stringify(PBS)}},
      selectedNick:{spacer:${JSON.stringify(NICK)},strand:'+'},
      nickSgRNAs:[{spacer:${JSON.stringify(NICK)},strand:'+'}] };
    window._m3EditableSeqs = null; allPrimers.length = 0;
    selectedCloningStrategy = ${JSON.stringify(strategy)};
    try { runPrimerDesign(); } catch (e) { globalThis.__err = e.message; }
  `, ctx);
  const err = q('typeof __err !== "undefined" ? __err : ""');
  vm.runInContext('delete globalThis.__err;', ctx);
  const primers = JSON.parse(q('JSON.stringify(allPrimers.map(function(p){return {n:p.name,s:p.seq};}))'));
  return { err, primers, html: String(pane.innerHTML || '') };
}

// bp badge for a named card
function badge(html, title) {
  const i = html.indexOf('>' + title + '</span>');
  if (i < 0) return null;
  const m = html.slice(i, i + 400).match(/>(\d+) bp<\/span>/);
  return m ? Number(m[1]) : null;
}

let P = 0, F = 0, skipped = 0;
const ck = (name, cond, detail) => { cond ? P++ : F++;
  console.log((cond ? '  PASS  ' : '* FAIL *') + ' ' + String(name).padEnd(52) + (detail || '')); };

console.log('vectors: ' + VECS.length + '   (' + VECS.filter(v => v.s3).length +
            ' supply the 3′ end themselves)\n');

for (const v of VECS) {
  const pes = (v.pe && v.pe.length) ? v.pe : ['PE2'];
  // a tevopreQ1 architecture where the vector allows one — that is where the bug lived
  const pe = pes.find(p => ['PE2max', 'ePPE', 'PPE', 'ePPE3'].includes(p)) || pes[0];
  const { err, primers, html } = run(v.id, pe, 'gg');
  if (err) { console.log('  SKIP   ' + v.id.padEnd(24) + 'runPrimerDesign threw: ' + err); skipped++; continue; }

  const get = n => { const p = primers.find(x => (x.n || '').indexOf(n) === 0);
                     return p ? p.s.toUpperCase().replace(/[^ACGTN]/g, '') : null; };
  const p1 = get('P1'), p3 = get('P3');
  if (!p1 || !p3) { console.log('  SKIP   ' + v.id.padEnd(24) + 'no P1/P3'); skipped++; continue; }

  // What the primers make. P1's 3' end anneals at the scaffold start and P2 at its end,
  // so Step 1 is P1 + the rest of the scaffold. P3's 3' 15 nt anneal there; everything
  // 5' of that is added to the product.
  const step1 = p1 + SCAF.slice(20);
  const prod2 = p1 + SCAF.slice(20) + rc(p3.slice(0, p3.length - 15));

  const cardStep1 = badge(html, 'PCR Product — Step-1 template');
  const cardProd2 = badge(html, 'PCR Product');
  const label = v.id + ' / ' + pe + (v.s3 ? ' [vector supplies 3′]' : '');

  if (cardStep1 === null && cardProd2 === null) {
    console.log('  SKIP   ' + label.padEnd(44) + 'no overlap-extension cards on this route');
    skipped++; continue;
  }
  if (cardStep1 !== null)
    ck('Step-1 card == P1+P2 amplicon  ' + label, cardStep1 === step1.length,
       'card ' + cardStep1 + '  primers ' + step1.length);
  if (cardProd2 !== null)
    ck('Step-2 card == Fw2+Rw2 product ' + label, cardProd2 === prod2.length,
       'card ' + cardProd2 + '  primers ' + prod2.length);
}

ctx.document.getElementById = gbi;
console.log('\n' + P + ' passed, ' + F + ' failed, ' + skipped + ' skipped');
process.exit(F ? 1 : 0);
