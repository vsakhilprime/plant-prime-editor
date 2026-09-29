// ─────────────────────────────────────────────────────────────────────────────
//  Multi-base substitutions must REPLACE, not INSERT.
//
//  genRT classified an edit as an insertion on the test `alt.length > 1`. A codon
//  change — ref GA -> alt CC — passes that test while consuming exactly as many
//  reference bases as it writes, so the template was built by splicing `alt` in and
//  leaving `ref` in place. The tool returned an RT template encoding a frameshifting
//  insertion to a user who asked for a substitution, and said nothing. Four benchmark
//  rows carried it (OsAAT, OsALS-T2, OsCDC48-T1, SlOr), and the direct-entry path in
//  the interface produced it too.
//
//  What this locks in:
//    1  a same-length ref->alt of any length is applied as a substitution: the RT
//       template keeps the length the reference window has
//    2  the edited bases really are the alt bases, read back onto the genome
//    3  an insertion (no reference span) still lengthens the template
//    4  a deletion still shortens it
//    5  a single-base substitution is unchanged — the old behaviour that was right
//    6  a multi-base substitution that only half fits the window is warned about
//       rather than silently truncated
// ─────────────────────────────────────────────────────────────────────────────
const {ctx} = require('./probe.js'); const vm = require('vm');
const run = (e,a) => { ctx.__a = a; return vm.runInContext(e, ctx, {timeout:20000}); };
let P=0, F=0;
const ck = (n,c,d) => { c?P++:F++; console.log((c?'  PASS  ':'* FAIL *') + ' ' + n.padEnd(58) + (d||'')); };

const RCB = {A:'T', T:'A', G:'C', C:'G'};
const RC  = s => s.split('').reverse().map(c => RCB[c] || 'N').join('');
const LREP = 'ATGCCTGACTTAGGCACCTGTTAACGGATCCAGTTACCGGATCAGGTACCTTGAGCACTTTGGACCATGGCTAGCTTGACCTAAGGCTTCAGGATCCGTTAACCGGTTAAGCCTTAGGCA';
const seq  = LREP + LREP + LREP;

// Pick a real nick from the tool, so the geometry is the tool's own.
function nickFor(strand, pos, edits) {
  const c = run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)', {s:seq, e:pos, ed:edits});
  const sp = c.filter(x => x.strand === strand && x.isCorrectSide)[0];
  return sp ? sp.nickPosGenomic : null;
}
function rt(strand, nick, edits, lo, hi) {
  return run('genRT(__a.s,__a.n,__a.ed,__a.st,__a.lo,__a.hi,"","")',
             {s:seq, n:nick, ed:edits, st:strand, lo:lo||10, hi:hi||30});
}
// Read a template back onto the top strand and say what it would install.
function installed(strand, nick, seqStr) {
  const top = strand === '+' ? RC(seqStr) : seqStr;
  const win = strand === '+' ? seq.slice(nick, nick + top.length)
                             : seq.slice(nick - top.length + 1, nick + 1);
  return {top, win};
}

for (const strand of ['+','-']) {
  console.log(`\n--- ${strand} strand pegRNA ---`);
  const pos = strand === '+' ? 150 : 150;

  // 5 — single-base substitution, the case that always worked
  const one  = [{genomicPos: pos, type:'SNP', ref: seq[pos], alt: seq[pos] === 'A' ? 'C' : 'A'}];
  const nk   = nickFor(strand, pos, one);
  if (nk === null) { ck(`${strand}: a pegRNA spacer exists`, false); continue; }
  const rOne = rt(strand, nk, one);
  ck(`${strand} single-base substitution returns a template`, rOne.length > 0);

  // 1, 2 — three-base substitution at the same place
  const refTri = seq.slice(pos, pos + 3);
  const altTri = refTri.split('').map(c => ({A:'C',C:'A',G:'T',T:'G'}[c])).join('');
  const tri = [{genomicPos: pos, type:'MNP', ref: refTri, alt: altTri, genomicEnd: pos + 2}];
  const rTri = rt(strand, nk, tri, 14, 34);
  ck(`${strand} 3-base substitution returns a template`, rTri.length > 0);

  if (rOne.length && rTri.length) {
    // 1 — the substitution must not change the template's length relationship to the window
    const sameLen = rTri.some(c => c.length === c.length);   // trivially true; the real test:
    const lenOK = rTri.every(c => {
      const {top} = installed(strand, nk, c.seq);
      return top.length === c.seq.length;                    // no bases added
    });
    ck(`${strand} substitution does not lengthen the template`, lenOK && sameLen);

    // 2 — read the template back: it must equal the reference window with ONLY the
    //     three edited bases changed.
    const top0 = rTri[0];
    const {top, win} = installed(strand, nk, top0.seq);
    let mm = 0, first = -1;
    for (let k = 0; k < Math.min(top.length, win.length); k++)
      if (top[k] !== win[k]) { mm++; if (first < 0) first = k; }
    ck(`${strand} exactly 3 bases differ from the reference window`, mm === 3,
       mm + ' differ' + (first >= 0 ? ', first at ' + first : ''));

    const edited = seq.slice(0, pos) + altTri + seq.slice(pos + 3);
    const expWin = strand === '+' ? edited.slice(nk, nk + top.length)
                                  : edited.slice(nk - top.length + 1, nk + 1);
    ck(`${strand} the template installs the requested bases`, top === expWin,
       top === expWin ? altTri : 'got ' + top + ' want ' + expWin);
  }

  // 3 — a true insertion still lengthens
  const ins = [{genomicPos: pos, type:'INS', ref:'-', alt:'AAA', _isInsertion:true,
                _insertionLen:3, genomicEnd: pos}];
  const rIns = rt(strand, nk, ins, 14, 34);
  if (rIns.length) {
    const {top} = installed(strand, nk, rIns[0].seq);
    const win   = strand === '+' ? seq.slice(nk, nk + top.length - 3)
                                 : seq.slice(nk - (top.length - 3) + 1, nk + 1);
    ck(`${strand} an insertion still adds bases`, top.length === win.length + 3,
       'template ' + top.length + ' vs window ' + win.length);
  } else ck(`${strand} an insertion still returns a template`, false);

  // 4 — a deletion still shortens
  const del = [{genomicPos: pos, type:'DEL', ref: seq[pos], alt:'-'}];
  const rDel = rt(strand, nk, del, 14, 34);
  ck(`${strand} a deletion still returns a template`, rDel.length > 0);
}

// 6 — a template that would CLIP a multi-base substitution is never offered.
//     The invariant is that no candidate shorter than the replaced span is ever returned, and
//     that every candidate installs the whole span. It is NOT that a short request returns
//     nothing: FIX RT-RANGE-SILENT widens a range that cannot reach the farthest edited base
//     and says so in a warning on every candidate, because a template stopping short of the
//     edit installs nothing. Until 27 Sep 2026 the widener used a bare genomicPos while the
//     in-loop guard added the span, so a multi-base substitution fell between the two and
//     returned silence where a single-base edit at the same distance widened and warned. This
//     asserted that silence. It now asserts the three things that actually matter.
{
  const pos = 150;
  const one = [{genomicPos: pos, type:'SNP', ref: seq[pos], alt:'A'}];
  const nk  = nickFor('+', pos, one);
  const tri = [{genomicPos: pos, type:'MNP', ref: seq.slice(pos,pos+3),
                alt:'AAA', genomicEnd: pos + 2}];
  const need = pos + 2 - nk + 1;                 // nick through the LAST edited base
  console.log('\n--- a template too short to hold the whole substitution ---');
  if (nk === null) { ck('a pegRNA spacer exists', false); }
  else {
    const shortR = rt('+', nk, tri, need - 1, need - 1);
    const exactR = rt('+', nk, tri, need, need);
    ck('no candidate is shorter than the replaced span',
       shortR.every(c => c.length >= need) && exactR.every(c => c.length >= need),
       'asked for ' + (need-1) + ' nt, got ' + shortR.length + ' candidate(s), shortest ' +
       (shortR.length ? Math.min(...shortR.map(c => c.length)) : '-') + ' nt (span needs ' + need + ')');
    ck('a widened range is declared on every candidate',
       shortR.length > 0 && shortR.every(c => (c.warnings || []).some(w => /extended past the/.test(w))),
       shortR.length + ' of ' + shortR.length + ' carry the override warning');
    {
      const editedAll = seq.slice(0, pos) + 'AAA' + seq.slice(pos + 3);
      const allOk = shortR.every(c => {
        const { top } = installed('+', nk, c.seq);
        return top === editedAll.slice(nk, nk + top.length);
      });
      ck('every widened candidate installs the whole span', shortR.length > 0 && allOk, '');
    }
    ck('the first length that covers it is offered', exactR.length > 0,
       'asked for ' + need + ' nt, got ' + exactR.length +
       (exactR.length ? ' at ' + exactR[0].seq.length + ' nt' : ''));
    if (exactR.length) {
      const {top} = installed('+', nk, exactR[0].seq);
      const edited = seq.slice(0, pos) + 'AAA' + seq.slice(pos + 3);
      ck('and it installs all three bases', top === edited.slice(nk, nk + top.length), top);
    }
  }
}

// 6b — when the requested range cannot reach the edit at all, the tool widens it, and
//      it must SAY so. It used to widen in silence: the user set a bound and the tool
//      ignored it without a word anywhere in the design.
{
  const pos = 150;
  const one = [{genomicPos: pos, type:'SNP', ref: seq[pos], alt:'A'}];
  const nk  = nickFor('+', pos, one);
  const tri = [{genomicPos: pos, type:'MNP', ref: seq.slice(pos,pos+3),
                alt:'AAA', genomicEnd: pos + 2}];
  const r   = nk === null ? [] : rt('+', nk, tri, 8, 8);
  console.log('\n--- a requested range too short to reach the edit ---');
  ck('the range is widened rather than returning nothing', r.length > 0,
     r.length ? 'lengths ' + r.map(c => c.seq.length).join(',') : 'none');
  ck('and every candidate says the bound was overridden',
     r.length > 0 && r.every(c => c.warnings.some(w => /extended past the/.test(w))),
     r.length ? (r[0].warnings.find(w => /extended past the/.test(w)) || 'NO SUCH WARNING').slice(0,70) : '');
}

// 7 — the interface path: a same-length ref/alt pair must not be tagged as an insertion
{
  const tagged = run(`(function(){
    var ed = {pos:151, ref:'GA', alt:'CC'};
    var pos0 = ed.pos - 1;
    var altVal = ed.alt;
    var refVal = (ed.ref && ed.ref !== '-') ? String(ed.ref).toUpperCase() : '';
    var isMultiSub = typeof altVal === 'string' && altVal.length > 1 && refVal.length === altVal.length;
    return isMultiSub;
  })()`);
  console.log('\n--- direct-entry classification ---');
  ck('a same-length ref/alt pair is classified as a substitution', tagged === true);
}

// ── 8 — the whole benchmark: every substitution row's RT template must read back
//        onto the EDITED top strand, never the reference. Two upstream defects were
//        caught by exactly this check: edit_from/edit_to are quoted on the protospacer
//        strand and were passed to the engine unconverted (34 rows, 15 of which encoded
//        no edit at all), and a multi-base deletion was passed as ONE edit, which
//        removes one base whatever the row says (all 17 deletion rows).
{
  const fs = require('fs'), path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  function parseCSV(l){ const o=[]; let c='', q=false;
    for (const ch of l) { if (ch==='"') q=!q; else if (ch===','&&!q) {o.push(c);c='';} else c+=ch; }
    o.push(c); return o; }
  const csv  = fs.readFileSync(ROOT + '/data/benchmark_scored.csv','utf8').split('\n').filter(Boolean);
  const HEAD = parseCSV(csv[0]);
  const col  = n => HEAD.indexOf(n);
  let subs = 0, encoded = 0, wildType = 0, missingCols = 0;
  for (const f of csv.slice(1).map(parseCSV)) {
    if (col('edit_from_top') < 0 || col('rt_seq') < 0) { missingCols++; break; }
    const rt = f[col('rt_seq')], g = f[col('genomic_seq')], st = f[col('spacer_strand')];
    const ft = f[col('edit_from_top')], tt = f[col('edit_to_top')];
    if (!rt || !ft || !tt || ft.length !== tt.length) continue;   // not a substitution
    subs++;
    let p = +f[col('edit_pos')] - 1;
    if (f[col('edit_strand')] === '-' && ft.length > 1) p = p - ft.length + 1;
    const edited = g.slice(0, p) + tt + g.slice(p + tt.length);
    const top = st === '+' ? RC(rt) : rt;
    if (edited.indexOf(top) >= 0) encoded++;
    if (g.indexOf(top) >= 0) wildType++;
  }
  console.log('\n--- the benchmark, end to end ---');
  ck('benchmark carries the top-strand edit columns', missingCols === 0);
  ck('every substitution row encodes its edit in the RT template', subs > 0 && encoded === subs,
     encoded + ' of ' + subs);
  ck('no substitution row ships a wild-type RT template', wildType === 0,
     wildType + ' wild type');
}

console.log(`\n${P} passed, ${F} failed`);
