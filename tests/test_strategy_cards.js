// A Golden Gate overhang belongs to the acceptor plasmid, never to the strategy. The five
// method cards printed ACCG/AAAC as a literal on every vector, and hardcoded BsaI's GGTCTC as
// the recognition sequence, while the summary bar at the foot of the SAME screen read the real
// values off the vector record. On pEPPE (Monocot/Rice) that produced "ACCG/AAAC" in three
// cards and "GGCG/AAAC" in the summary — one screen contradicting itself, with the wrong pair
// being the one a user would copy into a primer.
//
// The recommendation star had the same shape of fault: it followed "Golden Gate is not
// blocked" rather than the recommendation actually computed, so on any vector whose published
// chemistry is not Golden Gate it contradicted the banner directly above it.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.PPE_HTML ||
  path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'), 'utf8');
const { q } = require(path.join(__dirname, 'probe.js'));
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '* FAIL * ') + l.padEnd(62) + (d || '')); };

// 1. no card may carry a literal overhang pair
chk('card subtitles read the vector, not a literal',
    !/sub: 'BsaI \(GGTCTC\) · ACCG\/AAAC/.test(src) && /_cardOhTxt/.test(src));
chk('the reTag line reads the vector too',
    !/reTag: ggBlocked \? null : 'GGTCTC \\u2192 ACCG\/AAAC/.test(src));
chk('strategy metadata no longer stores overhangs',
    /recog:'GGTCTC', ovh5:null, ovh3:null/.test(src));
chk('the vector wins over strategy metadata',
    /var _stratOvh5\s*=\s*v\.overhang_5 \|\| _stratMeta2\.ovh5/.test(src));

// 2. the star follows the computed recommendation
chk('recommendation star follows bestId', /const _isBest = function \(id\) \{ return id === bestId; \}/.test(src));
chk('gg card no longer stars itself whenever unblocked',
    !/primary: !ggBlocked,/.test(src) && /primary: _isBest\('gg'\)/.test(src));
chk('one-step card can be starred', /primary: _isBest\('onestep_gibson'\)/.test(src));

// 3. no vector description may contradict its own overhang fields
// Only PROSE is scanned. acceptor_slot1 and acceptor_slot2 legitimately hold a different pair:
// they are the two slots of a two-slot acceptor, whereas overhang_5/overhang_3 are the outermost
// pair that flanks the whole insert. Treating those as contradictions would be wrong.
const PROSE = ['fullname','addgene_desc','desc','cloning_method','cloning_note','notes',
               'nick_note','efficiency_note','stuffer_note','addgene_note','arm_note_v'];
const V = q('JSON.parse(JSON.stringify(VECTORS.map(function(v){var t=[];' +
            PROSE.map(f => `if(v.${f}) t.push(String(v.${f}));`).join('') +
            'return {id:v.id,o5:v.overhang_5,o3:v.overhang_3,' +
            's1:(v.acceptor_slot1||[]).join("/"),s2:(v.acceptor_slot2||[]).join("/"),' +
            'blob:t.join(" ")};})))');
let contradictions = 0;
V.forEach(v => {
  if (!v.o5 || !v.o3) return;
  const real = v.o5 + '/' + v.o3;
  // a pair that the vector itself declares as one of its acceptor slots is not a contradiction:
  // a two-slot acceptor genuinely has a spacer pair and an extension pair alongside the
  // outermost pair held in overhang_5/overhang_3
  const allowed = new Set([real, v.s1, v.s2].filter(Boolean));
  const claims = (v.blob.match(/\b[ACGT]{4}\/[ACGT]{4}\b/g) || []).filter(x => !allowed.has(x));
  if (claims.length) {
    contradictions++;
    console.log('        ' + v.id + ' declares ' + real + ' but its text says ' + [...new Set(claims)].join(', '));
  }
});
chk('no vector description contradicts its own overhangs', contradictions === 0,
    contradictions ? contradictions + ' vector(s)' : V.length + ' vectors clean');

// ── panels must describe the chemistry that is actually selected ──────────
const vmx = require('vm');
const { ctx: c3 } = require(path.join(__dirname, 'probe.js'));
chk('a helper decides whether the route uses sticky ends', /function m3_usesOverhangs/.test(src));
chk('Golden Gate routes use overhangs',
    vmx.runInContext("m3_usesOverhangs('gg') && m3_usesOverhangs('bsmbi') && m3_usesOverhangs('esp3i')", c3) === true);
chk('homology routes do not',
    vmx.runInContext("!m3_usesOverhangs('onestep_gibson') && !m3_usesOverhangs('gblock') && !m3_usesOverhangs('infusion')", c3) === true);
chk('overhang fidelity is conditional on the route', /\$\{m3_usesOverhangs\(\) \? 'Overhang Fidelity/.test(src));
chk('the strategy footer is re-rendered on selection', /m3-strategy-footer/.test(src) &&
    /foot\.innerHTML/.test(src));
chk('expected band uses the verified colony anchors', /_colonyEmpty \+ fullInsert\.length/.test(src));

// ── QC severity must discriminate ─────────────────────────────────────────
chk('an absent GC clamp is a note, not a warning',
    /if \(!gcClamp\) tips\.push/.test(src));
chk('self-complementarity severity depends on loop size',
    /const tight = loop <= 30/.test(src));
chk('synthetic fragments are not run through priming QC',
    /priming checks do not apply/.test(src));
const sc = vmx.runInContext(`JSON.stringify({
  tight: m3_selfComp('GGGGCCCCAAAATTTTGGGGCCCC'),
  loose: m3_selfComp('GCACCGA' + 'ATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGC' + 'TCGGTGC')
})`, c3);
const scj = JSON.parse(sc);
chk('a distant stem is not called high risk', scj.loose.risk !== 'high', scj.loose.risk + ' — ' + (scj.loose.detail || 'no stem'));

// ── nothing rendered may hardcode an overhang or a strategy id ────────────
chk('vector anatomy diagram reads the vector',
    /\[\$\{v\.enzyme\}▸\$\{v\.overhang_5/.test(src) && !/\[\$\{v\.enzyme\}▸ACCG\]/.test(src));
chk('Golden Gate diagram heading reads the vector',
    !/Golden Gate Assembly — \$\{enzyme\} \(ACCG\/AAAC overhangs\)/.test(src));
chk('BsmBI comparison card reads the vector',
    !/same ACCG\/AAAC overhangs as BsaI/.test(src));
chk('strategy descriptions no longer name a fixed overhang pair',
    !/creates 4-nt ACCG\/AAAC sticky ends/.test(src) &&
    !/generates identical ACCG\/AAAC overhangs/.test(src));
chk('run report prints the strategy label, not its id',
    /FIX REPORT-CHEMISTRY/.test(src) && /meta\.label \|\| sid/.test(src));
chk('run report omits overhangs on homology routes',
    /joined by homology arms, no Type IIS overhang/.test(src));

// ── impossible melting temperatures must not be displayed ────────────────
chk('primer table shows a dash where no Tm is valid',
    /\(qc && qc\.tm === null\) \? '—'/.test(src));
const shortArm = vmx.runInContext(`JSON.stringify(m3_checkPrimer('AAAAAATTTTTT','TTTTTT','Gibson reverse arm'))`, c3);
chk('a 6 nt annealing arm reports no Tm', JSON.parse(shortArm).tm === null,
    'tm = ' + JSON.parse(shortArm).tm);
const frag = vmx.runInContext(`JSON.stringify(m3_checkPrimer('ACGT'.repeat(50),'ACGT'.repeat(50),'Direct synthesis (gBlock strategy)'))`, c3);
chk('a synthetic fragment reports no Tm', JSON.parse(frag).tm === null);

// ── the one-step PCR product must include both homology arms ─────────────
chk('one-step product size counts the arms',
    /the \$\{insertLen\} bp insert plus a 25 bp vector homology arm at each end/.test(src));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
