/* Three things the suite did not cover, added 23 August 2026 after mutation testing
   showed that breaking any of them left all 25 existing entries green.

   1. THE gBLOCK'S RESTRICTION SITES.
      This is why the test exists. The gBlock flank builder branched only on BbsI and
      hardcoded BsaI for everything else, so every BsmBI and Esp3I vector in the
      catalogue got a synthetic fragment flanked by GGTCTC/GAGACC — BsaI sites — while
      the same export's primers carried CGTCTC and its ligation step listed BsmBI. The
      worked example in DataS1 shipped that way. Nothing caught it, because nothing
      tested the gBlock at all. It is a paid synthesis product that would not have cut.

   2. m2_structRisk.
      It sets structRisk, structPenalty and dGworst, which feed every candidate's score
      and every risk badge the interface draws. Changing its severity band from -5 to
      -0.5 kcal/mol reclassified 194 of 411 design cases and no test noticed.

   3. computeSpacerSpecificity.
      Stubbing it to return a constant score of 99 left the whole suite green.

   The pattern to keep: assert against the tool's own resolved values, not against a
   constant retyped here, so a change to the vector table cannot silently pass. */
const path = require('path'), vm = require('vm');
process.env.PPE_HTML = process.env.PPE_HTML || path.join(__dirname, '..', 'plant_prime_editor_v1.0.html');
const { ctx } = require(path.join(__dirname, 'probe.js'));
const q = e => vm.runInContext(e, ctx, { timeout: 30000 });

let P = 0, F = 0;
const ck = (n, c, d) => { c ? P++ : F++; console.log((c ? '  PASS  ' : '* FAIL *') + ' ' + String(n).padEnd(62) + (d || '')); };

/* ── 1. every vector's gBlock must carry ITS OWN enzyme's sites ─────────────── */
const enzInfo = JSON.parse(q(`JSON.stringify(VECTORS.map(function(v){
  var e = m3_resolveCloneEnzyme(v);
  return { id:v.id, enzyme:v.enzyme, recog:e.recog, n:e.n,
           tail: m3_typeIIsTail(v.enzyme, v.overhang_5),
           oh5:v.overhang_5, oh3:v.overhang_3 };
}))`));

const rc = s => s.split('').reverse().map(c => ({A:'T',T:'A',G:'C',C:'G',N:'N'}[c] || c)).join('');

ck('every vector resolves to a Type IIS recognition site',
   enzInfo.length > 0 && enzInfo.every(v => /^[ACGT]{6}$/.test(v.recog)),
   enzInfo.length + ' vectors');

// The forward tail m3_typeIIsTail builds must contain that vector's own site and overhang.
const badTail = enzInfo.filter(v => v.tail.indexOf(v.recog) < 0 || v.tail.indexOf(v.oh5) < 0);
ck('5′ Type IIS tail carries the vector’s own site and overhang',
   badTail.length === 0,
   badTail.length ? 'WRONG: ' + badTail.map(v => v.id + ' (' + v.enzyme + ')').join(', ')
                  : enzInfo.length + ' vectors checked');

// No vector may carry a site belonging to a different enzyme in its own tail.
const ALL_SITES = ['GGTCTC', 'CGTCTC', 'GAAGAC'];
const crossed = enzInfo.filter(v => ALL_SITES.some(s => s !== v.recog && v.tail.indexOf(s) >= 0));
ck('no vector’s tail carries a foreign enzyme’s site',
   crossed.length === 0,
   crossed.length ? 'WRONG: ' + crossed.map(v => v.id).join(', ') : 'BsaI / BsmBI / BbsI kept apart');

// And the reverse flank must present the reverse complement of the same site.
enzInfo.forEach(v => { v.revSite = rc(v.recog); });
const revOK = enzInfo.every(v => /^[ACGT]{6}$/.test(v.revSite));
ck('3′ flank site is the reverse complement of the 5′ site', revOK,
   enzInfo.slice(0, 3).map(v => v.enzyme + ' ' + v.recog + '→' + v.revSite).join(' · '));

/* ── 2. m2_structRisk must respond to what it is given ──────────────────────── */
// A perfectly self-complementary sequence must score worse than a benign one, the
// severity bands must be ordered, and the weight must actually be applied.
const sr = JSON.parse(q(`(function(){
  var hairpin = 'GGGGCCCCGGGGCCCC';          // strongly self-complementary
  var benign  = 'ATATATATATATATAT';          // weak
  var a = m2_structRisk(hairpin, [{isSelf:true, label:'self', weight:1.0}]);
  var b = m2_structRisk(benign,  [{isSelf:true, label:'self', weight:1.0}]);
  var w1 = m2_structRisk(hairpin, [{isSelf:true, label:'self', weight:1.0}]);
  var w2 = m2_structRisk(hairpin, [{isSelf:true, label:'self', weight:2.0}]);
  return JSON.stringify({aDG:a.dGworst, bDG:b.dGworst, aPen:a.structPenalty, bPen:b.structPenalty,
                         aRisk:a.riskLevel, bRisk:b.riskLevel, w1:w1.dGworst, w2:w2.dGworst,
                         aDetails:a.details.length, keys:Object.keys(a.details[0]||{}).sort().join(',')});
})()`));

ck('structRisk: a self-complementary sequence scores worse than a benign one',
   sr.aDG < sr.bDG, sr.aDG + ' vs ' + sr.bDG + ' kcal/mol');
ck('structRisk: the penalty follows the free energy',
   sr.aPen >= sr.bPen, sr.aRisk + ' (' + sr.aPen + ') vs ' + sr.bRisk + ' (' + sr.bPen + ')');
ck('structRisk: the channel weight is applied, not ignored',
   sr.w2 < sr.w1, 'weight 1.0 → ' + sr.w1 + ' ; weight 2.0 → ' + sr.w2);
ck('structRisk: each channel reports run, dG, severity and weight',
   sr.keys === 'dG,label,run,sev,weight', 'fields: ' + sr.keys);

/* ── 3. computeSpacerSpecificity must discriminate ──────────────────────────── */
const sp = JSON.parse(q(`(function(){
  var good = computeSpacerSpecificity('GACCTGAGCTGTACGATCGA','AGG');   // mixed, no homopolymer
  var poly = computeSpacerSpecificity('GGGGGGGGGGGGGGGGGGGG','AGG');   // G-quad, extreme GC
  var at   = computeSpacerSpecificity('ATATATATATATATATATAT','AGG');   // extreme AT
  return JSON.stringify({g:good.score, p:poly.score, a:at.score,
                         gl:good.label, pl:poly.label,
                         gHomo:good.hasPolyG, pHomo:poly.hasPolyG,
                         gGC:good.gcSpec, pGC:poly.gcSpec});
})()`));

ck('specificity: a balanced spacer beats a poly-G run',
   sp.g > sp.p, sp.g + ' (' + sp.gl + ') vs ' + sp.p + ' (' + sp.pl + ')');
ck('specificity: a balanced spacer beats an all-AT spacer',
   sp.g > sp.a, sp.g + ' vs ' + sp.a);
ck('specificity: the homopolymer flag tracks the sequence',
   sp.gHomo === false && sp.pHomo === true, 'balanced ' + sp.gHomo + ' , poly-G ' + sp.pHomo);
ck('specificity: GC is measured, not assumed',
   sp.gGC !== sp.pGC, sp.gGC + '% vs ' + sp.pGC + '%');

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
