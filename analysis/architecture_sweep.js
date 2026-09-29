#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Every architecture at every benchmark locus, driven through the real engine.

   The manuscript states "266 of 275 combinations return a complete design" and
   names the nine that do not. That claim was written from a one-off run and was
   never checked by verify_manuscript_numbers.py, so nothing stopped it drifting
   when the engine changed — and the engine has since changed twice, in the PE3b
   rule and in how an edit is encoded. This script recomputes it and writes
   analysis/architecture_sweep.json, which the verifier then reads.

   A combination counts as complete when the engine returns, for that
   architecture at that locus:
     · a spacer
     · a primer-binding site
     · a reverse-transcriptase template that encodes the edit
     · the second component the architecture requires, if it requires one
         PE3, PE3b, PE5, PE5b  →  a nicking sgRNA
         PPE, ePPE3, twinPE    →  a second pegRNA on the opposite strand

   USAGE  node analysis/architecture_sweep.js [--html <tool.html>]
   ══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const hi = args.indexOf('--html');
const HTML = hi >= 0 ? args[hi+1] : path.join(ROOT, 'plant_prime_editor_v1.0.html');
process.argv[2] = HTML;
const { ctx } = require(path.join(__dirname, 'extract_engine.js'));
const run = (e, a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:30000}); };

const RCB = {A:'T', T:'A', G:'C', C:'G'};
const rcs = s => (s||'').toUpperCase().split('').reverse().map(c => RCB[c]||c).join('');

function parseCSV(l){ const o=[]; let c='', q=false;
  for (const ch of l) { if (ch==='"') q=!q; else if (ch===','&&!q) {o.push(c);c='';} else c+=ch; }
  o.push(c); return o; }
const csv  = fs.readFileSync(ROOT+'/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
const HEAD = parseCSV(csv[0]);
const col  = n => HEAD.indexOf(n);

// one row per locus: the substitution row where there is one, because an
// architecture sweep tests the engine, not the edit class
// Key on the SITE, identified by its protospacer, not by its label. Four pairs of labels
// denote one protospacer and five single labels denote two, so a label is not an identity
// (analysis/target_sites.json). Keying on the raw label swept one site twice — 26 loci and
// 286 combinations instead of 25 and 275; keying on the label with only the ALS pair
// registered got the count right by luck, two errors cancelling. Display still uses the label.
const { siteOfRow } = require(require('path').join(__dirname, 'lib', 'target_site.js'));

const byLocus = new Map();
for (const f of csv.slice(1).map(parseCSV)) {
  // "OK (published PBS length unavailable, nearest used)" is a pass with a note, not a
  // failure — testing for equality dropped TaGW2 and made the cohort 24 loci instead of 25.
  if (!/^OK/.test(f[col('status')] || '')) continue;
  const L = siteOfRow(f, col);
  const isSNP = f[col('edit_type')] === 'SNP';
  if (!byLocus.has(L) || (isSNP && byLocus.get(L)[col('edit_type')] !== 'SNP')) byLocus.set(L, f);
}

const SINGLE = ['PE2','PE2max','ePPE','PE4'];
const NICKED = ['PE3','PE3b','PE5','PE5b'];
const PAIRED = ['PPE','ePPE3','twinPE'];
const ALL    = [...SINGLE, ...NICKED, ...PAIRED];

const results = [], failures = [];
for (const [locus, f] of byLocus) {
  const g  = f[col('genomic_seq')];
  const p  = +f[col('edit_pos')] - 1;
  let from = f[col('edit_from_top')] || f[col('edit_from')];
  let to   = f[col('edit_to_top')]   || f[col('edit_to')];
  const st = f[col('spacer_strand')];
  const nk = +f[col('nick_pos')];
  const edits = [{ genomicPos: p, type: f[col('edit_type')], ref: from, alt: to || '-' }];

  const base = run(`JSON.stringify((function(){
    var pbs = genPBS(__a.g, __a.n, __a.st, 8, 22, __a.sp, false);
    var rt  = genRT(__a.g, __a.n, __a.ed, __a.st, 10, 34, __a.sp, pbs.length?pbs[0].seq:'');
    return { pbs: pbs.length, rt: rt.length, rtSeq: rt.length?rt[0].seq:'' };
  })())`, {g, n:nk, st, ed:edits, sp:f[col('published_spacer')]});
  const B = JSON.parse(base);

  for (const arch of ALL) {
    let ok = B.pbs > 0 && B.rt > 0, why = ok ? '' : (B.pbs ? 'no RT template' : 'no primer-binding site');
    if (ok && NICKED.includes(arch)) {
      const peType = arch === 'PE5' ? 'PE3' : arch === 'PE5b' ? 'PE3b' : arch;
      const n = run(`genNickSgRNA(__a.g, __a.n, __a.st, __a.ed, 'NGG', 20, __a.t).length`,
                    {g, n:nk, st, ed:edits, t:peType});
      if (!n) { ok = false; why = 'no nicking sgRNA'; }
    }
    if (ok && PAIRED.includes(arch)) {
      // The tool's own paired search, not a reimplementation of it. findSpacers must be
      // ASKED for the opposite strand: filtering its default return starves this search
      // wherever the global top twenty all lie on the first spacer's strand, which is the
      // TWIN-STRAND-STARVATION defect tests/test_twin_strand_search.js pins.
      const n2 = run(`(function(){
        var opp = __a.st === '+' ? '-' : '+';
        var c = findSpacers(__a.g, 'NGG', 20, __a.p, __a.ed, { strand: opp }) || [];
        c = c.filter(function(s){ return s.isCorrectSide !== false; });
        for (var i=0;i<c.length;i++){
          var sp  = c[i], tnp = sp.nickPosGenomic;
          var pbs = genPBS(__a.g, tnp, opp, 8, 22, sp.spacer);
          if (!pbs.length) continue;
          var rt  = genRT(__a.g, tnp, __a.ed, opp, 10, 34, sp.spacer, pbs[0].seq);
          if (!rt.length) continue;
          // the flaps can only meet if the top-strand nick lies LEFT of the bottom-strand one
          var topNick = __a.st === '+' ? __a.n : tnp;
          var botNick = __a.st === '+' ? tnp   : __a.n;
          if (topNick < botNick) return 1;
        }
        return 0;
      })()`, {g, n:nk, st, ed:edits, p});
      if (!n2) { ok = false; why = 'no opposite-strand pegRNA whose flap can meet the first'; }
    }
    results.push({locus, arch, ok, why});
    if (!ok) failures.push({locus, arch, why});
  }
}

const nLoci = byLocus.size, total = results.length, complete = results.filter(r => r.ok).length;
console.log(`\n${nLoci} loci × ${ALL.length} architectures = ${total} combinations`);
console.log(`${complete} return a complete design, ${total-complete} do not\n`);
const byWhy = {};
failures.forEach(f => { (byWhy[f.why] = byWhy[f.why] || []).push(f.arch+' @ '+f.locus); });
Object.entries(byWhy).forEach(([w, list]) => {
  console.log(`  ${list.length}  ${w}`);
  list.forEach(x => console.log(`       ${x}`));
});

const out = {
  generated: new Date().toISOString().slice(0,10),
  loci: nLoci, architectures: ALL.length, combinations: total,
  complete, incomplete: total - complete,
  locus_list: [...byLocus.keys()].sort(),
  failures: failures.sort((a,b) => (a.locus+a.arch).localeCompare(b.locus+b.arch))
};
fs.writeFileSync(path.join(__dirname,'architecture_sweep.json'), JSON.stringify(out,null,2));
console.log('\nwrote analysis/architecture_sweep.json');
