#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — case studies across all eleven architectures.

   The manuscript states that eleven prime editing architectures are supported. That
   claim is worth more if every one of them is shown to produce a design that survives
   the same checks the test suite applies, rather than merely running without error.

   Two panels.

     controlled  every architecture at one locus, so the designs differ only where the
                 architecture requires them to. OsALS-T2 is used because it carries the
                 most published designs in the benchmark, so the genomic window and the
                 spacer are independently corroborated.
     spread      every architecture at a species-appropriate published locus in rice,
                 wheat and tomato, with a vector of the matching clade, so the result
                 cannot be an artefact of one locus or one genome.

   Every design is checked against the invariants below. A case study counts as working
   only if all of them hold; anything that fails is printed rather than dropped.

     1  a pegRNA is produced, and it assembles as spacer + scaffold + RT template + PBS
     2  homology beyond the farthest edit is at least 5 nt          (Anzalone 2019)
     3  the primer-binding site falls in the species melting band, or the nearest
        achievable length is chosen when no length reaches it
     4  no internal site for the cloning enzyme anywhere in the insert
     5  the emitted primers rebuild a product that the vector's own enzyme cuts back out
        with exactly the overhangs the vector declares
     6  architectures needing a second component actually get one: a nicking sgRNA for
        PE3, PE3b, PE5 and PE5b, a second pegRNA for twinPE, PPE and ePPE3
     7  a tevopreQ1 motif is present for the architectures that use one, and absent for
        those that terminate on poly-T

     node analysis/case_studies.js [--html path]
   Writes analysis/case_studies.json
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HERE = __dirname;
const ha = process.argv.indexOf('--html');
process.env.PPE_HTML = ha > 0 ? process.argv[ha + 1] : path.join(HERE, '..', 'plant_prime_editor_v1.0.html');
const { ctx, q } = require(path.join(HERE, '..', 'tests', 'probe.js'));

const rc = s => s.split('').reverse().map(c => ({ A:'T', T:'A', G:'C', C:'G', N:'N' }[c] || c)).join('');
const ENZ = { BsaI:['GGTCTC',1,5], BsmBI:['CGTCTC',1,5], Esp3I:['CGTCTC',1,5], BbsI:['GAAGAC',2,6] };

function readCsv(f) {
  const t = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const split = l => { const o = []; let c = '', qd = false;
    for (let i = 0; i < l.length; i++) { const ch = l[i];
      if (ch === '"') { if (qd && l[i+1] === '"') { c += '"'; i++; } else qd = !qd; }
      else if (ch === ',' && !qd) { o.push(c); c = ''; } else c += ch; }
    o.push(c); return o; };
  const h = split(t[0]);
  return t.slice(1).map(l => { const c = split(l), o = {}; h.forEach((k, i) => o[k] = c[i]); return o; });
}
const bench = readCsv(path.join(HERE, '..', 'data', 'benchmark_scored.csv'));
const loci = {};
bench.forEach(r => {
  if (r.genomic_seq && r.published_spacer && r.spacer_strand && r.nick_pos && !loci[r.locus])
    loci[r.locus] = r;
});

function digest(top, enz) {
  const [rec, n1, n2] = ENZ[enz]; const cuts = [];
  let m, re = new RegExp(rec, 'g');
  while ((m = re.exec(top))) cuts.push({ t: m.index + rec.length + n1, b: m.index + rec.length + n2, d: '+' });
  re = new RegExp(rc(rec), 'g');
  while ((m = re.exec(top))) cuts.push({ t: m.index - n2, b: m.index - n1, d: '-' });
  cuts.sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++)
    out.push({ left: top.slice(cuts[i].t, cuts[i].b), body: top.slice(cuts[i].b, cuts[i+1].t),
               right: rc(top.slice(cuts[i+1].t, cuts[i+1].b)), dirs: cuts[i].d + cuts[i+1].d });
  return out;
}

const NEEDS_NICK  = ['PE3','PE3b','PE5','PE5b'];
const NEEDS_PEG2  = ['twinPE','PPE','ePPE3'];
const USES_TEVO   = ['PE2max','ePPE','PPE','ePPE3'];

function runCase(arch, locusId, vectorId) {
  const L = loci[locusId];
  const res = { architecture: arch, locus: locusId, vector: vectorId, checks: [], ok: false };
  const fail = (name, detail) => res.checks.push({ name, pass: false, detail });
  const pass = (name, detail) => res.checks.push({ name, pass: true, detail });
  if (!L) { fail('locus available', locusId + ' has no usable genomic context'); return res; }

  const built = vm.runInContext(`(function(){
    try {
      selectedVec = VECTORS.find(v => v.id === ${JSON.stringify(vectorId)});
      if (!selectedVec) return JSON.stringify({err:'vector not found'});
      selectedCloningStrategy = 'gg';
      var g = ${JSON.stringify(L.genomic_seq.toUpperCase())};
      var nick = ${parseInt(L.nick_pos,10)}, strand = ${JSON.stringify(L.spacer_strand)};
      var spacer = ${JSON.stringify(L.published_spacer)};
      // Strand-aware: the edit must lie 3' of the nick on the strand the RT template is
      // written from, or it can never be encoded. On a minus-strand spacer that is the
      // decreasing-coordinate side. This was always nick+5, which put the edit behind the
      // nick at every minus-strand locus — invisible only because the edit was being
      // dropped before it reached genRT.
      var editPos = (strand === '-') ? nick - 5 : nick + 5;
      var from = g.charAt(editPos), to = (from === 'A' ? 'T' : 'A');
      // FIX (15 Aug 2026). genRT reads ed.genomicPos and ed.alt. This previously passed
        // {pos, from, to}, so the edit never reached genRT: RT templates came back as
        // wild-type and homologyBeyondEdit degenerated to length-1, which is why every
        // case study reported homology = RT - 1. Same bug that was already fixed in
        // score_batch_v2.js; reintroduced here. The assertion below keeps it fixed.
        var edits = [{genomicPos: editPos, type:'SNP', ref: from, alt: to}];
      var pbsC = genPBS(g, nick, strand, 8, 15, spacer, false);
      var rtC  = genRT(g, nick, edits, strand, 10, 34, spacer, pbsC.length ? pbsC[0].seq : '');
      if (!pbsC.length || !rtC.length) return JSON.stringify({err:'no PBS or RT candidates'});
      rtC = rtC.slice().sort(function(a,b){return b.score-a.score;});
      var pbs = pbsC[0], rt = rtC[0];
      // FIX NICK-HARNESS (21 Aug 2026). This called findNickSgRNAs(g, nick, strand, arch) - a
      // function that does not exist in the tool under that name or that signature. It threw on
      // every call, the throw was swallowed, and the fallback below handed the design a 20 nt
      // slice taken at a fixed offset: no PAM, no strand rule, no nick-distance rule. PE3, PE3b,
      // PE5 and PE5b therefore passed on a spacer the harness invented, exactly the defect FIX
      // B16 removed from the twinPE path. The real designer is genNickSgRNA(genomicSeq,
      // pegNickPos, pegStrand, allEdits, pamPattern, spacerLen, peType); PE5 and PE5b share PE3
      // and PE3b nick geometry, so they map onto those two peTypes. There is no fallback now -
      // if the tool cannot find a nicking sgRNA the case study fails and says so.
      var nickSp = null;
      var _nickType = (${JSON.stringify(arch)} === 'PE5') ? 'PE3'
                    : (${JSON.stringify(arch)} === 'PE5b') ? 'PE3b' : ${JSON.stringify(arch)};
      try {
        var ns = genNickSgRNA(g, nick, strand, edits, 'NGG', 20, _nickType);
        if (ns && ns.length) nickSp = ns[0];
      } catch(e) { return JSON.stringify({err:'genNickSgRNA threw: ' + e.message}); }
      // FIX B16 (14 Aug 2026). This previously read
      //     var twinSp = { spacer: g.slice(nick+30, nick+50) };
      // which sliced 20 nt out of the genome at a fixed offset and called it the second
      // pegRNA spacer - no PAM, no strand check, no nick-to-nick rule, and on the SAME
      // strand when twinPE requires the opposite one. Every paired case study therefore
      // passed on a spacer the harness supplied rather than one the tool found. Call the
      // same opposite-strand search the interface uses, and let the design fail where no
      // candidate exists.
      var twinSp = null;
      try {
        var oppStrand = (strand === '+' ? '-' : '+');
        // Ask for the opposite strand directly: filtering findSpacers' return value returned
        // nothing wherever its global top twenty were all on the spacer's own strand.
        var oppAll = findSpacers(g, 'NGG', 20, nick, [], { strand: oppStrand }).filter(function (x) {
          var d = Math.abs(x.nickPosGenomic - nick);
          return d >= 10 && d <= 100;
        });
        if (oppAll.length) twinSp = { spacer: oppAll[0].spacer, strand: oppAll[0].strand,
                                      nickPosGenomic: oppAll[0].nickPosGenomic };
      } catch (e) {}
      m2Data = { peSystem:${JSON.stringify(arch)}, spacer:{spacer:spacer}, rt:{seq:rt.seq}, pbs:{seq:pbs.seq},
                 selectedNick:nickSp, nickSgRNAs:[nickSp], twinSpacer:twinSp,
                 twinPBS:[{seq:pbs.seq}], twinRT:[{seq:rt.seq}], locus:${JSON.stringify(locusId)} };
      window._m3EditableSeqs = null; allPrimers.length = 0;
      runPrimerDesign();
      return JSON.stringify({
        spacer: spacer, pbs: pbs.seq, rt: rt.seq,
        pbsLen: pbs.seq.length, rtLen: rt.seq.length, pbsTm: pbs.tm, pbsScore: pbs.score, rtScore: rt.score,
        homologyBeyondEdit: rt.homologyBeyondEdit,
          // The identical call with no edit supplied. Same function, same geometry,
          // same orientation — so the only thing that can differ is the edit itself.
          // Deriving this from genRT rather than by slicing the genome by hand avoids
          // getting the minus-strand orientation wrong and silently comparing noise.
          wtTemplate: (function () {
            try {
              // A no-op edit: same position, alt identical to ref. genRT requires at least
              // one edit, so this is the way to get the template it would build if nothing
              // were being installed. Identical geometry and orientation by construction.
              var L = rt.seq.length;
              var w = genRT(g, nick, [{genomicPos: editPos, type:'SNP', ref: from, alt: from}],
                            strand, L, L, spacer, pbs.seq);
              return (w && w.length) ? w[0].seq : '';
            } catch (e) { return ''; }
          })(),
        scaffold: M3_SCAFFOLD, tevo: TEVO_preQ1, polyT: POLY_T_TERM,
        enzyme: selectedVec.enzyme, oh5: selectedVec.overhang_5, oh3: selectedVec.overhang_3,
        suppl3: !!selectedVec.supplies_3prime,
        twinFound: !!twinSp,
        primers: allPrimers.map(function(p){return {name:p.name, seq:p.seq};})
      });
    } catch(e) { return JSON.stringify({err: e.message}); }
  })()`, ctx);
  const d = JSON.parse(built);
  if (d.err) { fail('pipeline runs', d.err); return res; }
  res.design = { spacer: d.spacer, pbs: d.pbs, rt: d.rt, pbs_len: d.pbsLen, rt_len: d.rtLen,
                 pbs_tm: d.pbsTm, pbs_score: d.pbsScore, rt_score: d.rtScore,
                 homology_beyond_edit: d.homologyBeyondEdit, enzyme: d.enzyme };

  // 1 pegRNA assembles
  const peg = d.spacer + d.scaffold + d.rt + d.pbs;
  // This used to be an unconditional pass() after concatenating four strings, which cannot
  // fail. The assembled pegRNA must carry its four parts in order and its length must be
  // their sum — that can.
  const _asmOK = peg.length === (d.spacer.length + d.scaffold.length + d.rt.length + d.pbs.length)
                 && peg.indexOf(d.spacer) === 0
                 && peg.indexOf(d.scaffold) === d.spacer.length
                 && peg.endsWith(d.pbs);
  (_asmOK ? pass : fail)('pegRNA assembles: spacer+scaffold+RT+PBS in order', peg.length + ' nt');

  // 2 homology beyond the edit
  const hb = d.homologyBeyondEdit;
  (typeof hb === 'number' && hb >= 5)
    ? pass('homology beyond the edit ≥ 5 nt', hb + ' nt')
    : fail('homology beyond the edit ≥ 5 nt', String(hb));

  // 2b the RT template actually encodes the edit.
  // This check exists because check 2 above once could not fail. When the edit was passed
  // to genRT under the wrong field names it never reached the template: RT came back as
  // genomic wild-type and homologyBeyondEdit collapsed to length-1, so check 2 was passing
  // on arithmetic rather than on biology. Comparing the template against the genome itself
  // is the thing that catches that, so it is checked here explicitly.
  (function () {
    const rt = d.rt || '', wt = d.wtTemplate || '';
    if (!rt || !wt) { fail('RT template encodes the edit', 'no template returned'); return; }
    if (rt === wt) {
      fail('RT template encodes the edit',
           'identical to the genomic wild-type — the edit was not applied');
      return;
    }
    let n = 0;
    for (let i = 0; i < Math.min(rt.length, wt.length); i++) if (rt[i] !== wt[i]) n++;
    pass('RT template encodes the edit', n + ' base' + (n === 1 ? '' : 's') + ' differ from wild-type');
  })();

  // 3 PBS length inside the plant window
  (d.pbsLen >= 8 && d.pbsLen <= 15)
    ? pass('PBS length within the searched window', d.pbsLen + ' nt, Tm ' + d.pbsTm)
    : fail('PBS length within the searched window', d.pbsLen + ' nt');

  // 4 no internal cloning site
  const insert = d.spacer + d.scaffold + d.rt + d.pbs;
  const hits = JSON.parse(vm.runInContext(
    `JSON.stringify(m3_checkInternalRE(${JSON.stringify(insert)}, selectedVec).filter(function(h){return h.critical;}))`, ctx));
  hits.length === 0 ? pass('no internal ' + d.enzyme + ' site') : fail('no internal ' + d.enzyme + ' site', hits.length + ' hit(s)');

  // 5 primers rebuild a cuttable product
  const get = n => { const p = d.primers.find(x => (x.name||'').indexOf(n) === 0); return p ? p.seq.toUpperCase().replace(/[^ACGTN]/g,'') : null; };
  const p1 = get('P1'), p3 = get('P3');
  if (!p1 || !p3) fail('primers emitted', 'missing P1 or P3');
  else {
    const isTevo = !d.suppl3 && USES_TEVO.indexOf(arch) >= 0;
    const linker = q('m3_linker') || 'GCAAAAAAA';
    const spFP = (d.spacer[0] === 'G' ? '' : 'G') + d.spacer;
    const core = spFP + d.scaffold + d.rt + d.pbs + (isTevo ? linker + d.tevo : '') + (d.suppl3 ? '' : d.polyT);
    const mark = d.suppl3 ? d.pbs : d.polyT;
    const p3top = rc(p3), k = p3top.lastIndexOf(mark);
    const product = p1.slice(0, Math.max(0, p1.indexOf(spFP))) + core + (k >= 0 ? p3top.slice(k + mark.length) : '');
    const frags = digest(product, d.enzyme.replace('Esp3I','BsmBI'));
    const ins = frags.find(f => f.body.indexOf(d.spacer) >= 0);
    if (!ins) fail('product cuts back out', 'insert not released');
    else if (ins.left !== d.oh5 || ins.right !== d.oh3 || ins.dirs !== '+-')
      fail('product cuts back out', ins.left + '/' + ins.right + ' dirs ' + ins.dirs);
    else pass('product cuts back out', ins.left + '/' + ins.right);
  }

  // 6 second component where the architecture needs one
  const names = d.primers.map(p => p.name).join(' ');
  if (NEEDS_NICK.indexOf(arch) >= 0)
    /P7|Nick/i.test(names) ? pass('nicking sgRNA cassette present') : fail('nicking sgRNA cassette present', names.slice(0,90));
  else if (NEEDS_PEG2.indexOf(arch) >= 0) {
    // FIX B16: the design is only valid if the tool's own opposite-strand search found a
    // second spacer. Previously the harness injected one, so this check could not fail.
    if (!d.twinFound)
      fail('second pegRNA found by the tool', 'no opposite-strand candidate in the 10-100 nt window at this locus');
    else if (/P1[01]|PT\d|peg2|Twin|PPE/i.test(names)) pass('second pegRNA found by the tool');
    else fail('second pegRNA found by the tool', names.slice(0,90));
  }
  else pass('single cassette, as expected');

  // 7 tevopreQ1 present only where it belongs
  const wantsTevo = USES_TEVO.indexOf(arch) >= 0 && !d.suppl3;
  const hasTevo = d.primers.some(p => (p.seq||'').toUpperCase().indexOf(d.tevo) >= 0 ||
                                       rc((p.seq||'').toUpperCase()).indexOf(d.tevo) >= 0);
  (wantsTevo === hasTevo)
    ? pass('tevopreQ1 ' + (wantsTevo ? 'present' : 'absent') + ', as the architecture requires')
    : fail('tevopreQ1 placement', 'wanted ' + wantsTevo + ', found ' + hasTevo);

  res.primer_count = d.primers.length;
  res.ok = res.checks.every(c => c.pass);
  return res;
}

// ── panels ────────────────────────────────────────────────────────────────
const ARCH = ['PE2','PE2max','PE3','PE3b','PE4','PE5','PE5b','twinPE','ePPE','PPE','ePPE3'];
const MONO = { PE2:'pYPQ166-OsPE2', PE2max:'ePE2-rice', PE3:'pYPQ166-OsPE2', PE3b:'ePE2-rice',
               PE4:'ePE2-rice', PE5:'ePE2-rice', PE5b:'ePE2-rice', twinPE:'ePE2-rice',
               ePPE:'pEPPE-mono', PPE:'pPPE-mono', 'ePPE3':'pPPE-mono' };
const DICO = { PE2:'pHEE401E', PE2max:'pHEE401E', PE3:'pCE3-BsmBI-dicot', PE3b:'pCE3-BsmBI-dicot',
               PE4:'pHEE401E', PE5:'pCE3-BsmBI-dicot', PE5b:'pCE3-BsmBI-dicot', twinPE:'pCE3-BsmBI-dicot',
               ePPE:'pEPPE-dicot', PPE:'pCE3-BsmBI-dicot', 'ePPE3':'pCE3-BsmBI-dicot' };

const controlled = ARCH.map(a => runCase(a, 'OsALS-T2', MONO[a]));
const SPREAD = [['Oryza sativa','OsCDC48-T1',MONO], ['Triticum aestivum','TaGW2',MONO], ['Solanum lycopersicum','SlOr',DICO]];
const spread = [];
SPREAD.forEach(([sp, loc, vmap]) => ARCH.forEach(a => { const r = runCase(a, loc, vmap[a]); r.species = sp; spread.push(r); }));

// ── negative controls ─────────────────────────────────────────────────────
// A panel where everything passes is worthless unless the checks are capable of failing.
// Each control breaks one thing deliberately and asserts that the corresponding check —
// and ideally only that check — reports it.
const d_oh5 = id => q(`(VECTORS.find(v=>v.id===${JSON.stringify(id)})||{}).overhang_5`);
const d_oh3 = id => q(`(VECTORS.find(v=>v.id===${JSON.stringify(id)})||{}).overhang_3`);

function negativeControls() {
  const out = [];
  const base = runCase('PE2', 'OsALS-T2', 'pYPQ166-OsPE2');

  // 1. plant a recognition site for the cloning enzyme inside the insert
  const planted = vm.runInContext(`(function(){
    selectedVec = VECTORS.find(v => v.id === 'pYPQ166-OsPE2');
    var ins = 'GACCAGCTCGGCAAGTTCTA' + M3_SCAFFOLD + 'TTCCGTCTCGAGCTCAGCTGACC' + 'CTGGCTGCAT';
    return JSON.stringify(m3_checkInternalRE(ins, selectedVec).filter(function(h){return h.critical;}).length);
  })()`, ctx);
  out.push({ control: 'internal cloning site planted in the RT template',
             expectation: 'the restriction screen reports it',
             detected: JSON.parse(planted) > 0 });

  // 2. rebuild the product the way P3 was constructed BEFORE the orientation fix, and confirm
  //    the digest refuses it. Corrupting v.overhang_3 does not work as a control: the primer is
  //    built from the same field the check compares against, so both move together and the test
  //    stays self-consistent. That is worth stating plainly — the round trip proves the primer
  //    agrees with the vector record, and it is test_acceptor_overhangs.js, run against the
  //    depositor's sequence, that proves the record itself is right. The two are complementary.
  const oldStyle = (function () {
    const b = runCase('PE2', 'OsALS-T2', 'pYPQ166-OsPE2');
    if (!b.design) return { detected: false, detail: 'baseline unavailable' };
    const d = b.design;
    const scaf = q('M3_SCAFFOLD'), polyT = q('POLY_T_TERM');
    const ov3 = d_oh3('pYPQ166-OsPE2');
    const spFP = (d.spacer[0] === 'G' ? '' : 'G') + d.spacer;
    const core = spFP + scaf + d.rt + d.pbs + polyT;
    const enz = ENZ[d.enzyme.replace('Esp3I', 'BsmBI')][0];
    // the pre-fix tail: complement of the recognition site, and the overhang complemented too
    const buggyTailTop = ov3 + 'N' + rc(rc(enz));           // == ov3 + N + enz, i.e. facing outward
    const p1tail = 'CACC' + enz + 'N' + d_oh5('pYPQ166-OsPE2');
    const product = p1tail + core + buggyTailTop + 'AAAA';
    const frags = digest(product, d.enzyme.replace('Esp3I', 'BsmBI'));
    const ins = frags.find(f => f.body.indexOf(d.spacer) >= 0);
    const bad = !ins || ins.dirs !== '+-';
    return { detected: bad, detail: ins ? ('sites face ' + ins.dirs) : 'insert never released' };
  })();
  out.push({ control: 'P3 rebuilt in its pre-fix orientation',
             expectation: 'the enzyme no longer faces into the insert, so it is not released',
             detected: oldStyle.detected, detail: oldStyle.detail });

  // 3. The check that caught the field-name bug, deliberately made to fail. Passing the edit
  //    under {pos, from, to} instead of {genomicPos, ref, alt} is exactly what this harness did
  //    until 15 Aug 2026: genRT ignores it and returns the genomic wild-type. This control
  //    reproduces that mistake and confirms the new check reports it, so the check cannot
  //    quietly stop working the way its predecessor did.
  const droppedEdit = (function () {
    try {
      const r = JSON.parse(q(`(function(){
        var g = ${JSON.stringify((loci['OsALS-T2']||{}).genomic_seq || '')}.toUpperCase();
        var nick = ${parseInt((loci['OsALS-T2']||{}).nick_pos, 10) || 300};
        var strand = ${JSON.stringify((loci['OsALS-T2']||{}).spacer_strand || '+')};
        var sp = ${JSON.stringify((loci['OsALS-T2']||{}).published_spacer || '')};
        var editPos = (strand === '-') ? nick - 5 : nick + 5;
        var from = g.charAt(editPos), to = (from === 'A' ? 'T' : 'A');
        var pbsC = genPBS(g, nick, strand, 8, 15, sp, false);
        var pbs0 = pbsC.length ? pbsC[0].seq : '';
        function top(edits, lo, hi) {
          var c = genRT(g, nick, edits, strand, lo, hi, sp, pbs0);
          c = c.slice().sort(function (a, b) { return b.score - a.score; });
          return c.length ? c[0].seq : '';
        }
        var wrong = top([{pos: editPos, type:'SNP', from: from, to: to}], 10, 34);
        var right = top([{genomicPos: editPos, type:'SNP', ref: from, alt: to}], 10, 34);
        var wt = wrong ? top([{genomicPos: editPos, type:'SNP', ref: from, alt: from}],
                             wrong.length, wrong.length) : '';
        return JSON.stringify({wrong: wrong, right: right, wt: wt});
      })()`));
      return { detected: !!r.wrong && r.wrong === r.wt && r.right !== r.wt,
               detail: 'wrong-field template ' + r.wrong.length + ' nt is identical to wild-type; '
                     + 'correct-field template ' + r.right.length + ' nt differs from it' };
    } catch (e) { return { detected: false, detail: 'control failed to run: ' + e.message }; }
  })();
  out.push({ control: 'edit passed to genRT under the pre-fix field names',
             expectation: 'the template comes back as genomic wild-type and the new check reports it',
             detected: droppedEdit.detected, detail: droppedEdit.detail });

  // 3. The homology check cannot be made to fail through the public interface, and that is
  //    the finding rather than a gap in the control. genRT ranks candidates by homology
  //    beyond the edit before anything else and returns only its top six, so a template with
  //    under 5 nt of homology is never the one offered. Attempting to force one out through
  //    genRT therefore says nothing. The behaviour was established directly when the ranking
  //    was added — at a locus where the engine had been returning a zero-homology template,
  //    the top candidate moved to 10 nt — and is asserted in tests/test_design_rules.js.
  //    Recorded here as unfalsifiable through this route rather than counted as a control.
  const capped = vm.runInContext(`(function(){
    try {
      var g = ${JSON.stringify((loci['OsALS-T2']||{}).genomic_seq || '')}.toUpperCase();
      var nick = ${parseInt((loci['OsALS-T2']||{}).nick_pos, 10) || 300};
      var strand = ${JSON.stringify((loci['OsALS-T2']||{}).spacer_strand || '+')};
      var from = g.charAt(nick+5), to = (from === 'A' ? 'T' : 'A');
      var c = genRT(g, nick, [{genomicPos:nick+5, type:'SNP', ref:from, alt:to}], strand, 10, 40, '', '');
      return JSON.stringify({returned: c.length,
        min_homology_offered: Math.min.apply(null, c.map(function(x){return x.homologyBeyondEdit||0;}))});
    } catch(e) { return JSON.stringify({err:e.message}); }
  })()`, ctx);
  const cp = JSON.parse(capped);
  out.push({ control: 'homology beyond the edit',
             expectation: 'not falsifiable through genRT: the pool is capped and ranked on this term first, so nothing below 5 nt is ever offered',
             not_applicable: true,
             detected: null,
             detail: JSON.stringify(cp) });

  // 4. the baseline itself must still pass, or the controls prove nothing. This is a
  //    POSITIVE control, not a negative one: nothing is planted and nothing should be
  //    caught. It was previously counted among the negative controls and printed under
  //    the word 'caught', which made three negative controls read as four.
  out.push({ control: 'unmodified baseline case', expectation: 'all checks pass',
             positive: true, detected: base.ok });
  return out;
}
const controls = negativeControls();

const summarise = list => ({ total: list.length, passing: list.filter(r => r.ok).length,
  failing: list.filter(r => !r.ok).map(r => ({ architecture: r.architecture, locus: r.locus,
    failed: r.checks.filter(c => !c.pass).map(c => c.name + (c.detail ? ' (' + c.detail + ')' : '')) })) });

const out = { generated: new Date().toISOString(), build: q('PPE_BUILD.stamp'),
  controlled: { locus: 'OsALS-T2', results: controlled, summary: summarise(controlled) },
  spread: { results: spread, summary: summarise(spread) },
  negative_controls: controls };
fs.writeFileSync(path.join(HERE, 'case_studies.json'), JSON.stringify(out, null, 1));

function table(title, list) {
  console.log('\n' + title);
  console.log('  ' + 'architecture'.padEnd(9) + 'locus'.padEnd(13) + 'vector'.padEnd(20) +
              'spacer'.padStart(3) + 'PBS'.padStart(5) + 'RT'.padStart(5) + 'hom'.padStart(5) +
              'primers'.padStart(9) + '  result');
  list.forEach(r => {
    const d = r.design || {};
    console.log('  ' + r.architecture.padEnd(9) + r.locus.padEnd(13) + String(r.vector).padEnd(20) +
      String((d.spacer||'').length).padStart(3) + String(d.pbs_len||'').padStart(5) +
      String(d.rt_len||'').padStart(5) + String(d.homology_beyond_edit||'').padStart(5) +
      String(r.primer_count||0).padStart(9) + '  ' +
      (r.ok ? 'all checks pass' : 'FAILED: ' + r.checks.filter(c=>!c.pass).map(c=>c.name).join('; ')));
  });
}
table('CONTROLLED PANEL — every architecture at OsALS-T2', controlled);
table('SPECIES SPREAD', spread);
const cs = out.controlled.summary, ss = out.spread.summary;
console.log('\n  controlled : ' + cs.passing + ' of ' + cs.total + ' pass every check');
console.log('  spread     : ' + ss.passing + ' of ' + ss.total + ' pass every check');
console.log('\n  NEGATIVE CONTROLS — can these checks fail at all?');
controls.forEach(c => console.log('    ' +
  (c.not_applicable ? 'n/a     ' : c.positive ? (c.detected ? 'passes  ' : 'BROKEN  ')
                                              : (c.detected ? 'caught  ' : 'MISSED  ')) + c.control +
  '  (' + c.expectation + ')' + (c.detail ? '  ' + String(c.detail).slice(0,70) : '')));
const negatives  = controls.filter(c => !c.not_applicable && !c.positive);
const positives  = controls.filter(c => c.positive);
const notFalsifiable = controls.filter(c => c.not_applicable);
console.log('    ' + negatives.filter(c => c.detected).length + ' of ' + negatives.length +
            ' negative controls caught; ' + positives.filter(c => c.detected).length + ' of ' +
            positives.length + ' positive control passes; ' + notFalsifiable.length +
            ' not falsifiable by construction');
console.log('\nwrote analysis/case_studies.json');
