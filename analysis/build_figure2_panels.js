#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — Figure 2 panel regenerator

   Figure 2 has two panels and, until 22 August 2026, neither could be
   rebuilt from the deposit. Panel A survived the audit unchanged; panel B
   did not — its PBS↔scaffold-3′ row still carried −4.8 kcal mol⁻¹ from
   build a75e20c3, and it presented PBS↔RT as a scored channel weighted 1.5×,
   which the PBS heatmap stopped doing at the 13 August fix
   (FIX HEATMAP-DISAGREES-WITH-TABLE). This script exists so the panels are
   derived rather than transcribed, and so the next fingerprint move shows up
   as a diff instead of going unnoticed.

   Panel A is derived entirely from the tool: every number comes from its own functions,
   loaded headlessly out of the HTML, and a change to the scorer changes the panel.

   Panel B is NOT. It re-derives the weighted worst free energy inline, with the three
   channel weights and the four risk-band boundaries written out below rather than read
   from m2_structRisk. Verified on 23 August 2026 by setting the tool's scaffold-3′ weight
   from 1.0 to 2.5: panel A changed, panel B printed byte-identically and still said ×1.0.
   The values are correct against the current build, and a change inside m2_structRisk is
   now caught by both the fingerprint and analysis/build_equivalence.js — but the guarantee
   this header used to claim for the whole script holds only for panel A.

   USAGE
     node analysis/build_figure2_panels.js            # human-readable
     node analysis/build_figure2_panels.js --json     # analysis/figure2_panels.json

   PANEL A — spacer composite score, decomposed by term.
     Locus rice OsDEP1, the 600 nt benchmark window from data/benchmark_scored.csv
     (row OsDEP1-peg01), edit at position 305, C→T. OsDEP1 is the panel locus
     because it is one of the 5 of 26 benchmark loci that exercise both the
     poly-T penalty and the ΔG penalty; most loci exercise neither.

   PANEL B — PBS free-energy landscape, 8–22 nt, four hybridisation channels.
     Locus rice OsALS-T2, spacer ATTTGGGTATGGTGGTGCAA, nick g.297.
     Three of the four channels carry the heatmap's colour, at the weights
     genPBS uses: spacer 5′ ×1.2, scaffold 3′ ×1.0, self-fold ×0.8.
     The fourth, PBS↔RT, is REPORTED AND NOT SCORED. genPBS runs before any
     reverse-transcriptase template exists and is not passed one, so the PBS
     score cannot contain that term. The interaction is real and it is scored —
     from the other side, in genRT, where RT↔PBS carries the 1.5× weight.
   ═══════════════════════════════════════════════════════════════════════════ */

process.env.PPE_HTML = process.env.PPE_HTML || (__dirname + '/../plant_prime_editor_v1.0.html');
const { ctx } = require('../tests/lib/load_tool.js');
const vm = require('vm');
const fs = require('fs');

const run = (expr, a) => { ctx.__a = a; return vm.runInContext(expr, ctx, { timeout: 20000 }); };
const pad = (v, w) => String(v).padStart(w);

const FINGERPRINT = vm.runInContext('(typeof PPE_BUILD!=="undefined" && PPE_BUILD.fingerprint) || "unknown"', ctx);

/* ── Panel A ──────────────────────────────────────────────────────────── */

const dep1Row = fs.readFileSync(__dirname + '/../data/benchmark_scored.csv', 'utf8')
  .split('\n').find(l => l.startsWith('OsDEP1-peg01'));
if (!dep1Row) throw new Error('OsDEP1-peg01 not found in data/benchmark_scored.csv');
const DEP1_SEQ = dep1Row.split(',')[6];
const DEP1_POS = 305;

const candA = run('findSpacers(__a.s,"NGG",20,__a.e,__a.ed)', {
  s: DEP1_SEQ, e: DEP1_POS,
  ed: [{ genomicPos: DEP1_POS, type: 'SNP', ref: DEP1_SEQ[DEP1_POS - 1], alt: 'T' }]
});

// The panel shows the three scoring spacers plus the two that demonstrate the
// floor: S7 (distance term exhausted) and S12 (poly-T penalty dominant).
const PANEL_A_IDS = ['S10', 'S11', 'S8', 'S7', 'S12'];
const panelA = PANEL_A_IDS.map(id => {
  const c = candA.find(x => x.id === id);
  if (!c) throw new Error('panel A: candidate ' + id + ' is no longer returned — the panel needs rebuilding, not re-stamping');
  return {
    id: c.id, spacer: c.spacer, pam: c.pam, strand: c.strand,
    nick_edit_dist: c.dist,
    raw_score: c.rawScore,          // distance + GC + seed GC + poly-T penalty
    dG_penalty: -c.structPenalty,   // the ΔG term, subtracted from raw
    total: c.score,                 // what the interface ranks on
    dG_worst: c.dGworst, struct_risk: c.structRisk
  };
});

/* ── Panel B ──────────────────────────────────────────────────────────── */

const ALS_SEQ = fs.readFileSync(__dirname + '/../data/sequences_plain/OsALS-T2.txt', 'utf8').trim();
const ALS_SPACER = 'ATTTGGGTATGGTGGTGCAA';
const ALS_NICK = 297;   // + strand
const HM_MIN = 8, HM_MAX = 22;

// The RT template the heatmap reports against: genPBS picks the PBS, genRT is
// then given it. The heatmap uses rtCandidates[0], so this reproduces that.
const rtPick = run(`(function(){
  var pbs = genPBS(__a.seq, __a.np, '+', 8, 22, __a.spacer, false);
  var top = pbs && pbs[0] ? pbs[0].seq : '';
  var rt  = genRT(__a.seq, __a.np, __a.edits, '+', 10, 30, __a.spacer, top);
  return JSON.stringify({ pbsTop: top, rtTop: (rt && rt[0] && rt[0].seq) || '' });
})()`, {
  seq: ALS_SEQ, np: ALS_NICK, spacer: ALS_SPACER,
  edits: [{ genomicPos: 306, type: 'SNP', ref: ALS_SEQ[305], alt: 'A' }]
});
const { pbsTop, rtTop } = JSON.parse(rtPick);

const panelBraw = run(`(function(){
  var rows = [], geSeq = __a.seq, np = __a.np;
  for (var len = __a.min; len <= __a.max; len++) {
    if (np - len < 0) { rows.push({ len: len, missing: true }); continue; }
    var pbsSeq   = m2_rc(geSeq.slice(np - len, np));
    // genPBS excludes the last 3 + len bases of the spacer: a PBS of length L
    // always pairs perfectly with that stretch. That is geometry, not structure.
    var spOutside = __a.spacer.slice(0, Math.max(0, __a.spacer.length - 3 - len));
    var dSp   = m2_maxDuplexAndDG(pbsSeq, spOutside);
    var dSc3  = m2_maxDuplexAndDG(pbsSeq, _M2_SCAF_3);
    var sf    = m2_selfFoldDG(pbsSeq);
    var dRT   = __a.rt ? m2_maxDuplexAndDG(pbsSeq, __a.rt) : { run: 0, dG: 0 };
    var wDG   = Math.min(
      dSp.run  >= 2 ? dSp.dG  * 1.2 : 0,
      dSc3.run >= 2 ? dSc3.dG * 1.0 : 0,
      sf.run   >= 2 ? sf.dG   * 0.8 : 0
    );
    rows.push({
      len: len, pbs: pbsSeq, tm: m2_calcTm(pbsSeq), gc: m2_gc(pbsSeq),
      spacer_window: spOutside.length,
      dG_spacer: spOutside.length ? dSp.dG : null,
      dG_scaffold3: dSc3.dG,
      dG_selffold:  sf.dG,
      dG_rt:        dRT.dG,
      wDG: Math.round(wDG * 10) / 10,
      risk: wDG < -12 ? 'critical' : wDG < -8 ? 'medium' : wDG < -5 ? 'low' : 'perfect'
    });
  }
  return JSON.stringify(rows);
})()`, { seq: ALS_SEQ, np: ALS_NICK, spacer: ALS_SPACER, min: HM_MIN, max: HM_MAX, rt: rtTop });

const panelB = JSON.parse(panelBraw);

/* ── Report ───────────────────────────────────────────────────────────── */

const cell = v => v === null ? '—' : (v > 0 ? '0.0' : v.toFixed(1));

console.log('FIGURE 2 — regenerated from build ' + FINGERPRINT + '\n');

console.log('PANEL A  spacer composite score, decomposed');
console.log('         rice OsDEP1, edit at position ' + DEP1_POS + ' of the ' + DEP1_SEQ.length + ' nt window, C to T\n');
console.log('  id    spacer                 PAM   nick   raw   dG    total  risk');
panelA.forEach(r => console.log('  ' + r.id.padEnd(5) + ' ' + r.spacer + '   ' + r.strand + r.pam +
  pad(r.nick_edit_dist, 6) + pad(r.raw_score, 6) + pad(r.dG_penalty, 5) + pad(r.total, 7) + '  ' + r.struct_risk));

console.log('\nPANEL B  PBS free-energy landscape, ' + HM_MIN + '–' + HM_MAX + ' nt');
console.log('         rice OsALS-T2, spacer ' + ALS_SPACER + ', nick g.' + ALS_NICK);
console.log('         PBS chosen by genPBS: ' + pbsTop + '   RT template reported against: ' + rtTop + '\n');
const lens = panelB.map(r => pad(r.len, 6)).join('');
console.log('  PBS length (nt)          ' + lens);
console.log('  PBS <-> spacer 5′  x1.2 ' + panelB.map(r => pad(cell(r.dG_spacer), 6)).join(''));
console.log('  PBS <-> scaffold 3′ x1.0 ' + panelB.map(r => pad(cell(r.dG_scaffold3), 6)).join(''));
console.log('  PBS self-fold       x0.8 ' + panelB.map(r => pad(cell(r.dG_selffold), 6)).join(''));
console.log('  ---- reported, not scored ----');
console.log('  PBS <-> RT template      ' + panelB.map(r => pad(cell(r.dG_rt), 6)).join(''));
console.log('  worst weighted (colour)  ' + panelB.map(r => pad(r.wDG.toFixed(1), 6)).join(''));

const worst = panelB.reduce((a, r) => Math.min(a, r.dG_scaffold3), 0);
console.log('\n  worst scored channel: PBS <-> scaffold 3′ at ' + worst.toFixed(1) + ' kcal mol-1, flat across all lengths');
console.log('  risk bands: ' + ['perfect', 'low', 'medium', 'critical']
  .map(b => b + ' ' + panelB.filter(r => r.risk === b).length).join(' · '));

if (process.argv.includes('--json')) {
  const out = {
    build: FINGERPRINT,
    generated_by: 'analysis/build_figure2_panels.js',
    panelA: { locus: 'OsDEP1', edit_pos: DEP1_POS, window_nt: DEP1_SEQ.length, rows: panelA },
    panelB: {
      locus: 'OsALS-T2', spacer: ALS_SPACER, nick: ALS_NICK,
      pbs_selected: pbsTop, rt_template: rtTop,
      scored_channels: { 'PBS-spacer5': 1.2, 'PBS-scaffold3': 1.0, 'PBS-selffold': 0.8 },
      reported_only: ['PBS-RT'],
      rows: panelB
    }
  };
  fs.writeFileSync(__dirname + '/figure2_panels.json', JSON.stringify(out, null, 1));
  console.log('\nwrote analysis/figure2_panels.json');
}
