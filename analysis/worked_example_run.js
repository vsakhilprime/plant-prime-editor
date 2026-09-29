/* Emit analysis/worked_example_run.json — every number the end-to-end narrative states.
 *
 * The Supplementary section "Worked example: from allele to ordered oligonucleotides" and the
 * Results paragraph that introduces it were written by hand and maintained by hand. By
 * 14 September 2026 they described a different design from the one that actually produced
 * Supplementary Data S1 and Supplementary Figure S3, while saying they were the same run: a
 * tryptophan-to-leucine substitution at OsALS residue 548, a 6,278 nt genomic window, the
 * spacer CAACCAACATTTGGGTATGG, a 23 nt reverse-transcriptase template, a 179 nt pegRNA in a
 * 188 nt insert, cloned into ePE2 with BsaI. The shipped build returns none of that for the
 * worked example. Some of the values had been refreshed (P1, P2 and P3 melting temperatures)
 * and others had not (P1 and P3 lengths, the verification primers' melting temperatures), which
 * is what a hand-maintained paragraph looks like after the engine moves twice.
 *
 * Every value the narrative needs is written here, computed from the shipped engine and from
 * analysis/worked_example.json, so the prose can be rebuilt from it and checked against it.
 *
 *     node analysis/worked_example_run.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const ROOT = path.dirname(HERE);
const { ctx } = require(path.join(ROOT, 'tests', 'probe.js'));

const run = (expr, a) => { ctx.__a = a; return vm.runInContext(expr, ctx, { timeout: 60000 }); };

const W = JSON.parse(fs.readFileSync(path.join(HERE, 'worked_example.json'), 'utf8'));
const F3 = JSON.parse(fs.readFileSync(path.join(HERE, 'figure3_editable_data.json'), 'utf8'));

const g = fs.readFileSync(path.join(ROOT, W.sequence_file), 'utf8')
  .split('\n').filter(l => !l.startsWith('>')).join('').replace(/\s+/g, '').toUpperCase();
const from = g.charAt(W.edit_pos0);
const edits = [{ genomicPos: W.edit_pos0, type: W.edit_type, ref: from, alt: W.edit_to }];

const d = JSON.parse(run(`JSON.stringify((function(){
  var a = __a;
  var sp  = findSpacers(a.g, 'NGG', 20, a.ep, a.ed);
  var idx = -1; for (var i = 0; i < sp.length; i++) { if (sp[i].spacer === a.sp) { idx = i; break; } }
  if (idx < 0) throw new Error('the worked-example spacer is not among the candidates');
  var c   = sp[idx];
  var pbs = genPBS(a.g, a.nk, a.st, a.pmin, a.pmax, a.sp, false);
  var rt  = genRT(a.g, a.nk, a.ed, a.st, a.rmin, a.rmax, a.sp, pbs[0].seq);
  var vec = VECTORS.filter(function(v){ return v.id === a.vid; })[0];
  var ctxt = (typeof getCodonContext === 'function')
    ? getCodonContext(a.g, a.ep, a.alt) : null;
  return {
    window_nt: a.g.length,
    spacers_returned: sp.length,
    chosen_rank: idx + 1,
    tied_at_top: sp.filter(function(s){ return s.score === sp[0].score; }).map(function(s){ return s.spacer; }),
    spacer: { seq: c.spacer, pam: c.pam, strand: c.strand, gc_pct: c.gc_pct,
              nick_to_edit_nt: c.dist, nick_pos0: c.nickPosGenomic, score: c.score,
              struct_risk: c.structRisk, specificity: c.otScore, specificity_label: c.otLabel,
              warnings: c.warnings || [] },
    pbs: pbs.slice(0, 3).map(function(p){
      return { len: p.length, seq: p.seq, tm_nn: p.tm, tm_wallace: p.wtm, gc_pct: p.gc_pct, score: p.score };
    }),
    rt: { len: rt[0].length, seq: rt[0].seq, gc_pct: rt[0].gc_pct,
          edit_dist_from_nick: rt[0].edit_dist, edit_pos_in_rt: rt[0].editPositionsInRT,
          homology_beyond_edit: rt[0].homologyBeyondEdit, score: rt[0].score,
          struct_risk: rt[0].structRisk,
          runner_up_len: rt[1] ? rt[1].length : null, runner_up_score: rt[1] ? rt[1].score : null },
    vector: { id: vec.id, name: vec.name, enzyme: vec.enzyme, overhang_5: vec.overhang_5,
              overhang_3: vec.overhang_3, cassettes: vec.cassettes, addgene: vec.addgene,
              marker: vec.marker || null },
    codon: ctxt
  };
})())`, { g: g, ep: W.edit_pos0, sp: W.spacer, nk: W.nick_pos0, st: W.strand, ed: edits,
          alt: W.edit_to, vid: W.vector_id,
          pmin: W.pbs_min, pmax: W.pbs_max, rmin: W.rt_min, rmax: W.rt_max }));

/* the design must be the one the canonical record states, or the narrative would describe a
   run nobody else in the paper draws — which is the failure this file exists to close */
const E = W.expect, bad = [];
if (d.pbs[0].seq !== E.pbs) bad.push('PBS ' + d.pbs[0].seq + ' vs ' + E.pbs);
if (d.rt.seq !== E.rt) bad.push('RT ' + d.rt.seq + ' vs ' + E.rt);
if (d.rt.homology_beyond_edit !== E.homology_beyond_edit)
  bad.push('homology ' + d.rt.homology_beyond_edit + ' vs ' + E.homology_beyond_edit);
if (d.vector.enzyme !== E.vector_enzyme) bad.push('enzyme ' + d.vector.enzyme + ' vs ' + E.vector_enzyme);
if (bad.length) { console.error('does not match analysis/worked_example.json: ' + bad.join('; ')); process.exit(1); }

/* Module 1's variant row, as the shipped exporter writes it */
const s1c = path.join(ROOT, 'DataS1', 'S1c_variant_table.csv');
if (fs.existsSync(s1c)) {
  const lines = fs.readFileSync(s1c, 'utf8').trim().split('\n');
  const head = lines[0].split(','), row = lines[1].split(',');
  d.variant = {}; head.forEach((h, i) => { d.variant[h] = row[i]; });
}

/* The codon, read off the window rather than out of the export's column names.
   S1c labels its two codon columns Target_Codon and Reference_Codon from the query's point of
   view, so taking "reference" from that header prints the change backwards: the legend of
   Supplementary Figure S3 said the change backwards once for exactly this reason. The reference base at the edit position is in the sequence; use it. */
(function () {
  const p = W.edit_pos0;
  const cp = String(W.edit_pos1 % 3 === 0 ? 3 : W.edit_pos1 % 3);   // 1-based position in codon
  const start = p - (cp - 1);
  const ref = g.slice(start, start + 3);
  const alt = ref.slice(0, cp - 1) + W.edit_to + ref.slice(cp);
  if (ref.charAt(cp - 1) !== from)
    throw new Error('codon frame disagrees with the reference base at the edit');
  d.codon = { ref: ref, alt: alt, position_in_codon: Number(cp),
              protein_position: d.variant ? d.variant.Protein_Position : null,
              impact: d.variant ? d.variant.Protein_Impact : null,
              aa_ref: d.variant ? d.variant.Reference_AA : null,
              aa_alt: d.variant ? d.variant.Target_AA : null };
})();

/* Module 3's primer set and restriction screen, as Figure 3 draws them */
d.insert_nt = F3.panelA.insertLen;
d.scaffold_nt = F3.panelA.scafLen;
d.polyT_nt = F3.panelA.polyTLen;
d.enzymes_screened = F3.panelA.backboneEnzymes.length + 1;
d.screen_hits = F3.panelA.cases[0].hits.length;
d.route = F3.panelA.cases[0].bestName;
d.ranking_first = { name: F3.panelA.ranking[0].name, enzyme: F3.panelA.ranking[0].enzyme,
                    addgene: F3.panelA.ranking[0].addgene };
d.ranking_of_chosen = F3.panelA.ranking.findIndex(v => v.id === W.vector_id) + 1;
d.primers = F3.panelB.primers.map(p => ({
  name: p.name, len: p.len, tm: p.tm, gc: p.gc, status: p.status,
  group: p.group, warnings: p.warnings.length
}));
d.primers_flagged = d.primers.filter(p => p.status === 'warn').length;
d.primers_total = d.primers.length;
d.named = { heterodimer: F3.panelB.named.heterodimer.risk,
            p3fold: F3.panelB.named.p3fold.label,
            dTm: F3.panelB.named.dTm };
d.build = F3.build;
d.locus = W.locus;
d.pe_system = W.pe_system;
d.edit = from + ' to ' + W.edit_to + ' at position ' + W.edit_pos1;
d.pbs_window = W.pbs_min + '–' + W.pbs_max;
d.rt_window = W.rt_min + '–' + W.rt_max;

/* the full primer set the run reports, against the number the selected route uses */
const s1a = path.join(ROOT, 'DataS1', 'S1a_synthesis_vendor_bulk_order.csv');
if (fs.existsSync(s1a)) {
  d.bulk_order_rows = fs.readFileSync(s1a, 'utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#') && !l.startsWith('Name,')).length;
}
/* allPrimers is every oligo the run emits across all routes; the selected route uses the six
   above. The Data S1 legend quotes the first number and S1a lists the second, and nothing said
   they were different counts of different things. */
d.primers_all_routes = JSON.parse(run(`JSON.stringify((function(){
  var a = __a;
  m2Data = { peSystem:'PE2', spacer:{spacer:a.sp}, rt:{seq:a.rt}, pbs:{seq:a.pbs},
             selectedNick:null, nickSgRNAs:[], twinSpacer:null,
             twinPBS:[{seq:a.pbs}], twinRT:[{seq:a.rt}], locus:'OsALS-T2' };
  selectedVec = VECTORS.filter(function(v){ return v.id === a.vid; })[0];
  window._m3EditableSeqs = null; allPrimers.length = 0;
  runPrimerDesign();
  return allPrimers.length;
})())`, { sp: W.spacer, rt: d.rt.seq, pbs: d.pbs[0].seq, vid: W.vector_id }));

const out = path.join(HERE, 'worked_example_run.json');
fs.writeFileSync(out, JSON.stringify(d, null, 1) + '\n');
console.log('  worked-example run written to analysis/worked_example_run.json');
console.log('    %s, %s in %s (%s) · spacer %s, rank %d of %d',
  d.locus, d.pe_system, d.vector.id, d.vector.enzyme, d.spacer.seq, d.chosen_rank, d.spacers_returned);
console.log('    PBS %d nt (%s °C NN, %s °C Wallace) · RT %d nt · homology %d nt · insert %d nt',
  d.pbs[0].len, d.pbs[0].tm_nn, d.pbs[0].tm_wallace, d.rt.len, d.rt.homology_beyond_edit, d.insert_nt);
console.log('    %d of %d primers flagged · ΔTm P1:P2 %s °C · P3 fold %s',
  d.primers_flagged, d.primers_total, d.named.dTm, d.named.p3fold);
