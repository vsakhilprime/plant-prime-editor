// ─────────────────────────────────────────────────────────────────────────────
//  genNickSgRNA — the second nick, for PE3 and for PE3b.
//
//  MECHANISM FIX (12 Sep 2026). This file used to assert the inverted rule: that
//  a PE3b nicking sgRNA sits on the SAME strand as the pegRNA and that the
//  installed edit must DESTROY that sgRNA's PAM. Both are wrong, and the old
//  "Zero is the right answer" reasoning was reasoning about a rule that does not
//  exist. Anzalone 2019 (Nature 576:149): "we designed sgRNAs with spacers that
//  matched the edited strand, but not the original allele" — the guide BASE-PAIRS
//  with the edited strand, which means it NICKS the other one, the same non-edited
//  strand PE3 nicks. PE3b does not move the nick; it makes the nick conditional on
//  the edit already being there.
//
//  What this file now locks in:
//    1  PE3  candidates sit on the non-edited strand (opposite the pegRNA)
//    2  PE3  nick-to-nick distance stays inside the 30-100 nt window
//    3  PE3b candidates sit on the SAME non-edited strand — not the pegRNA's
//    4  PE3b every candidate carries at least one edit INSIDE its protospacer
//    5  PE3b every candidate's PAM is intact and identical to the reference
//    6  PE3b the spacer offered is read from the EDITED sequence: it differs from
//       the reference spacer at exactly as many bases as lie in the protospacer
//    7  PE3b a seed-region edit is preferred over a PAM-distal one
//    8  the inverted `pamDisrupted` field is gone and cannot quietly return
//    9  PE3b refuses to guess when an indel is present
//   10  when no candidate is returned, none exists — checked independently here,
//       not asserted
// ─────────────────────────────────────────────────────────────────────────────
const {ctx} = require('./probe.js'); const vm = require('vm'), fs = require('fs'), path = require('path');
const run = (e,a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:20000}); };
let P=0, F=0;
const ck = (n,c,d) => { c?P++:F++; console.log((c?'  PASS  ':'* FAIL *') + ' ' + n.padEnd(58) + (d||'')); };

const RCB = {A:'T', T:'A', G:'C', C:'G'};
const RC  = s => s.split('').reverse().map(c => RCB[c] || 'N').join('');

// An independent statement of the PE3b rule, written here from the mechanism and
// NOT by calling the tool, so check 10 is a second opinion rather than an echo.
// A spacer on `strand` is licensed when the edit falls inside its 20 nt protospacer
// and outside its 3 nt PAM.
function licensedExists(seq, editPos, strand, spacerLen, pamLen) {
  const rc = RC(seq);
  for (let i = spacerLen; i <= seq.length - pamLen; i++) {
    const src = strand === '+' ? seq : rc;
    const pam = src.slice(i, i + pamLen);
    if (!(pam[1] === 'G' && pam[2] === 'G')) continue;
    // protospacer and PAM spans in TOP-strand coordinates
    let ps, pe, ms, me;
    if (strand === '+') { ps = i - spacerLen; pe = i - 1;             ms = i;                  me = i + pamLen - 1; }
    else                { const gp = seq.length - (i + pamLen);
                          ps = gp + pamLen;   pe = gp + pamLen + spacerLen - 1; ms = gp; me = gp + pamLen - 1; }
    if (editPos >= ms && editPos <= me) continue;      // edit in the PAM: excluded
    if (editPos >= ps && editPos <= pe) return true;   // edit in the protospacer: licensed
  }
  return false;
}

// ── Synthetic sequence, both pegRNA strands ──────────────────────────────────
const LREP = 'ATGCCTGACTTAGGCACCTGTTAACGGATCCAGTTACCGGATCAGGTACCTTGAGCACTTTGGACCATGGCTAGCTTGACCTAAGGCTTCAGGATCCGTTAACCGGTTAAGCCTTAGGCA';
const seq  = LREP + LREP + LREP;
const ALT  = {A:'G', G:'A', C:'T', T:'C'};

for (const pegStrand of ['+','-']) {
  const pos   = 150;
  const edits = [{ genomicPos: pos, type: 'SNP', ref: seq[pos], alt: ALT[seq[pos]] }];
  const cands = run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)', {s:seq, e:pos, ed:edits});
  const peg   = cands.filter(x => x.strand === pegStrand && x.isCorrectSide)[0];
  if (!peg) { ck(`peg ${pegStrand}: a usable pegRNA spacer exists`, false); continue; }
  console.log(`\n--- pegRNA on ${pegStrand} strand, nick ${peg.nickPosGenomic} ---`);

  // Both systems nick the non-edited strand. That is the single change this file encodes.
  const nonEdited = pegStrand === '+' ? '-' : '+';

  for (const peType of ['PE3','PE3b']) {
    const ns = run('genNickSgRNA(__a.s,__a.n,__a.st,__a.ed,"NGG",20,__a.t)',
                   {s:seq, n:peg.nickPosGenomic, st:pegStrand, ed:edits, t:peType});
    console.log(`  ${peType}: ${ns.length} candidate(s)`);

    if (!ns.length) {
      if (peType === 'PE3b') {
        // 10 — zero must mean zero exists, established independently above.
        const exists = licensedExists(seq, pos, nonEdited, 20, 3);
        ck('PE3b: empty result is explained', !exists,
           exists ? 'A LICENSED SPACER EXISTS AND WAS NOT RETURNED'
                  : 'no ' + nonEdited + '-strand protospacer covers the edit with its PAM clear');
      } else {
        ck('PE3: at least one candidate', false, 'none returned');
      }
      continue;
    }

    // 1, 3 — strand
    ck(`${peType}: every candidate on the non-edited (${nonEdited}) strand`,
       ns.every(c => c.strand === nonEdited),
       'strands ' + [...new Set(ns.map(c => c.strand))].join(','));

    const top = ns[0];
    console.log(`     top: ${top.spacer} ${top.pam} strand ${top.strand} nick ${top.nickPos} dist ${top.nickDist}`);

    if (peType === 'PE3') {
      // 2 — the Anzalone window
      const d = ns.map(c => c.nickDist);
      ck('PE3: nick-to-nick distance within 30-100 nt',
         d.every(x => x >= 30 && x <= 100), 'range ' + Math.min(...d) + '-' + Math.max(...d));
    }

    if (peType === 'PE3b') {
      // 4 — the edit must be inside the protospacer, because that is what licenses it
      ck('PE3b: every candidate carries an edit in its protospacer',
         ns.every(c => c.editsInProtospacer >= 1),
         'counts ' + [...new Set(ns.map(c => String(c.editsInProtospacer)))].join(','));

      // 5 — the PAM is read from the non-edited strand and must be untouched
      ck('PE3b: every candidate PAM is intact',
         ns.every(c => c.pamIntact === true),
         'flags ' + [...new Set(ns.map(c => String(c.pamIntact)))].join(','));

      const pamMatchesRef = ns.every(c => {
        const refSeq = c.strand === '+' ? seq : RC(seq);
        const i = c.strand === '+' ? c.genomicPos : (refSeq.length - (c.genomicPos + 3) - 20);
        return refSeq.slice(i + 20, i + 23) === c.pam;
      });
      ck('PE3b: the PAM equals the reference PAM', pamMatchesRef);

      // 6 — the oligo offered is the one that matches the EDITED allele
      const editedTop = seq.slice(0,pos) + ALT[seq[pos]] + seq.slice(pos+1);
      const mmOK = ns.every(c => {
        const refSeq = c.strand === '+' ? seq       : RC(seq);
        const edSeq  = c.strand === '+' ? editedTop : RC(editedTop);
        const i = c.strand === '+' ? c.genomicPos : (refSeq.length - (c.genomicPos + 3) - 20);
        let mm = 0; for (let k = 0; k < 20; k++) if (refSeq[i+k] !== c.spacer[k]) mm++;
        return c.spacer === edSeq.slice(i, i+20) && mm === c.editsInProtospacer;
      });
      ck('PE3b: spacer read from the edited sequence, not the reference', mmOK);
      ck('PE3b: provenance recorded on every candidate',
         ns.every(c => c.spacerFrom === 'edited sequence'));

      // 8 — the inverted field must not come back
      ck('PE3b: the inverted pamDisrupted field is gone',
         ns.every(c => c.pamDisrupted === undefined));

      // 7 — a seed edit beats a distal one, all else equal
      const seedC = ns.filter(c => c.editsInSeed >= 1), distC = ns.filter(c => !c.editsInSeed);
      if (seedC.length && distC.length) {
        ck('PE3b: a seed-region edit outranks a PAM-distal one',
           Math.max(...seedC.map(c => c.score)) > Math.min(...distC.map(c => c.score)));
      } else {
        ck('PE3b: seed/distal split reported', true,
           seedC.length + ' seed, ' + distC.length + ' distal — no mixed pair to compare');
      }
      // and a distal one must say so
      ck('PE3b: a PAM-distal edit is warned about',
         distC.every(c => c.warns.some(w => /PAM-distal/.test(w))));
    }
  }
}

// ── 9 — an indel is refused, not guessed ─────────────────────────────────────
{
  const pos   = 150;
  const edits = [{ genomicPos: pos, type: 'INS', ref: '-', alt: 'AGG' }];
  const cands = run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)', {s:seq, e:pos, ed:edits});
  const peg   = cands.filter(x => x.strand === '+' && x.isCorrectSide)[0];
  const ns    = peg ? run('genNickSgRNA(__a.s,__a.n,"+",__a.ed,"NGG",20,"PE3b")',
                          {s:seq, n:peg.nickPosGenomic, ed:edits}) : [];
  console.log('\n--- indel edit ---');
  ck('PE3b: an indel yields no candidate rather than a guess', ns.length === 0,
     ns.length + ' returned');
}

// ── A real locus from the benchmark, end to end ──────────────────────────────
{
  const ROOT = path.resolve(__dirname, '..');
  function parseCSV(l){ const o=[]; let c='', q=false;
    for (const ch of l) { if (ch==='"') q=!q; else if (ch===','&&!q) {o.push(c);c='';} else c+=ch; }
    o.push(c); return o; }
  const csv  = fs.readFileSync(ROOT + '/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
  const HEAD = parseCSV(csv[0]);
  const f = csv.slice(1).map(parseCSV).find(x => x[HEAD.indexOf('locus')] === 'OsGAPDH-T1'
                                             && x[HEAD.indexOf('edit_type')] === 'SNP');
  console.log('\n--- OsGAPDH-T1, from the benchmark ---');
  if (!f) { ck('benchmark row found', false); }
  else {
    const g = f[HEAD.indexOf('genomic_seq')], p = +f[HEAD.indexOf('edit_pos')] - 1;
    // benchmark edit_from/edit_to are quoted on the protospacer strand; normalise to the
    // top strand, which is the convention genRT and genNickSgRNA both read.
    let from = f[HEAD.indexOf('edit_from')], to = f[HEAD.indexOf('edit_to')];
    if (g[p] !== from) { from = RCB[from]; to = RCB[to]; }
    const st = f[HEAD.indexOf('spacer_strand')];
    const ns = run('genNickSgRNA(__a.g,__a.n,__a.st,__a.ed,"NGG",20,"PE3b")',
                   {g, n:+f[HEAD.indexOf('nick_pos')], st,
                    ed:[{genomicPos:p, type:'SNP', ref:from, alt:to}]});
    const nonEdited = st === '+' ? '-' : '+';
    ck('real locus: PE3b returns a candidate', ns.length >= 1, ns.length + ' returned');
    if (ns.length) {
      ck('real locus: on the non-edited strand', ns.every(c => c.strand === nonEdited));
      ck('real locus: PAM intact, edit inside the protospacer',
         ns.every(c => c.pamIntact === true && c.editsInProtospacer >= 1));
      console.log('     top: ' + ns[0].spacer + ' ' + ns[0].pam + ' ' + ns[0].strand +
                  '  dist ' + ns[0].nickDist + '  seed ' + ns[0].editsInSeed);
    }
  }
}

console.log(`\n${P} passed, ${F} failed`);
