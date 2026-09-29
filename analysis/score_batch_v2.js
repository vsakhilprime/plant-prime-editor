#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — batch scorer for the benchmark

   Scores published pegRNA designs using the tool's own scoring engine, loaded
   headlessly from the HTML. Nothing is reimplemented, so the numbers in the
   paper are by definition the numbers the web server produces.

   USAGE
     node analysis/score_batch_v2.js benchmark_input.csv          > benchmark_scored.csv
     node analysis/score_batch_v2.js benchmark_input.csv --report # human-readable log
     node analysis/score_batch_v2.js benchmark_input.csv --html plant_prime_editor_v1.0.html

   INPUT CSV — one row per published pegRNA. Required columns:
     id                  your identifier, e.g. Lin2021_OsALS_T1
     study               first author + year
     study_doi
     species
     locus
     pe_system           PE2 | PE3 | PE3b | PE2max | ePPE | PPE | ePPE3 | twinPE ...
     genomic_seq         the genomic window around the target, 5'->3' plus strand,
                         200-400 nt is plenty. Plain ACGT, no spaces.
     edit_pos            1-based position of the edited base WITHIN genomic_seq
     edit_type           SNP | INS | DEL
     edit_from           reference base(s) — '' for INS
     edit_to             edited base(s)    — '' for DEL
     published_spacer    the 20-nt (or spacer_len) spacer the authors used
     published_pbs_len   PBS length the authors used
     published_rt_len    RT template length the authors used
     measured_efficiency published editing efficiency, %
   Optional columns:
     pam                 defaults to NGG
     spacer_len          defaults to 20
     efficiency_assay, notes

   OUTPUT — every input column, plus:
     composite_score        the tool's score for the AUTHORS' spacer
     raw_score              before the structure adjustment
     dist_term, gc_term, seed_term, gstart_term, polyt_term   individual contributions
     nick_edit_dist, spacer_gc, seed_gc, struct_penalty, struct_risk, ir_score
     pbs_score, pbs_tm, pbs_gc, pbs_dG_worst, pbs_rt_dG
     rt_score, rt_len_used
     n_candidates, published_rank, published_rank_percentile
     best_available_score, best_available_spacer
     status                 OK, or the reason the row could not be scored
   ═══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs'), path = require('path');

// ── locate and load the engine ─────────────────────────────────────────────
const args = process.argv.slice(2);
const REPORT = args.includes('--report');
const htmlIdx = args.indexOf('--html');
const HTML = htmlIdx >= 0 ? args[htmlIdx + 1]
  : path.join(__dirname, '..', 'plant_prime_editor_v1.0.html');
const INPUT = args.find(a => !a.startsWith('--') && a !== HTML);
if (!INPUT) { console.error('usage: node analysis/score_batch_v2.js <input.csv> [--report] [--html <tool.html>]'); process.exit(1); }

process.argv[2] = HTML;                                  // extract_engine reads argv[2]
const { ctx, missing } = require(require('path').join(__dirname,'extract_engine.js'));
for (const fn of ['findSpacers','genPBS','genRT'])
  if (typeof ctx[fn] !== 'function') { console.error(`FATAL: ${fn} not found in the tool HTML.`); process.exit(2); }

// ── tiny CSV reader/writer (quoted fields, embedded commas and newlines) ────
function parseCSV(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"' && txt[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(v => v.trim() !== ''))
             .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const esc = v => { v = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

// ── scoring one row ────────────────────────────────────────────────────────
const clean = s => (s || '').toUpperCase().replace(/[^ACGT]/g, '');

function scoreRow(r) {
  const out = { ...r, status: 'OK' };
  const seq = clean(r.genomic_seq);
  const pam = (r.pam || 'NGG').toUpperCase();
  const spacerLen = parseInt(r.spacer_len || '20', 10);
  const editPos1 = parseInt(r.edit_pos, 10);

  if (seq.length < 60)        { out.status = 'genomic_seq too short (<60 nt)'; return out; }
  if (!Number.isFinite(editPos1) || editPos1 < 1 || editPos1 > seq.length)
                              { out.status = 'edit_pos outside genomic_seq'; return out; }
  const editPos0 = editPos1 - 1;

  // edit_from is quoted on the edited (protospacer) strand, which for a minus-strand
  // spacer is the reverse complement of the plus-strand window. Validated empirically
  // across 116 published rows: + strand direct 93%, - strand reverse-complemented 98%.
  const RCB = {A:'T',T:'A',G:'C',C:'G'};
  let _fwdFirst = false, _fwdLast = false;   // which convention matched, set below
  if (r.edit_from) {
    const want = r.edit_from.toUpperCase().replace(/[^ACGT]/g,'');
    const fwd  = seq.slice(editPos0, editPos0 + want.length);
    const rev  = seq.slice(Math.max(0, editPos0 - want.length + 1), editPos0 + 1)
                    .split('').reverse().map(c => RCB[c] || 'N').join('');
    // FOURTH CONVENTION (28 Sep 2026). An edit is quoted on one of two strands and anchored
    // at one of two ends, which is four combinations; this tested two of them. A published
    // edit quoted in GENE orientation at a locus whose protospacer lies on the minus strand
    // is plus-strand text anchored at its last base, and was rejected. Still an exact match,
    // so nothing that genuinely disagrees with the genome is admitted.
    const fwdLast = seq.slice(Math.max(0, editPos0 - want.length + 1), editPos0 + 1);
    if (want && fwd !== want && rev !== want && fwdLast !== want) {
      out.status = `edit_from mismatch: genomic_seq[${editPos1}] reads ${fwd} (+) / ${rev} (-), expected ${want}`;
      return out;   // catching this early prevents a silently wrong benchmark
    }
    // WHICH test matched decides both the strand AND the anchor, and the two are not the
    // same question. Setting the strand from `fwd` alone made the new plus-anchored-at-last
    // row come out as minus-quoted, so its edit was reverse-complemented into a top-strand
    // spelling the genome does not read there. The anchor travels with the match.
    _fwdFirst = (fwd === want);
    _fwdLast  = (!_fwdFirst && fwdLast === want);
    out.edit_strand = (_fwdFirst || _fwdLast) ? '+' : '-';
  }

  // genRT reads ed.alt / ed.genomicPos (ed.ref is informational). Supplying 'to'
  // instead of 'alt' left the edit unapplied, so RT templates were returned as
  // wild-type. findSpacers reads only genomicPos, so spacer ranks were unaffected.
  //
  // ORIENTATION FIX (12 Sep 2026). The block above already establishes that edit_from is
  // quoted on the protospacer strand, and sets out.edit_strand accordingly — and then the
  // edit was handed to the engine UNCONVERTED. The engine's convention is the top strand:
  // genRT splices ed.alt straight into genomicSeq for BOTH strands (see its + and - branches),
  // and the interface only ever produces top-strand edits, because directEdits rows are
  // validated against genomicSeq[pos]. So every minus-quoted row encoded the COMPLEMENT of
  // the intended base in its RT template: 34 of the 103 single-base benchmark rows, six of
  // which came out as no-ops whose "designed" pegRNA installs nothing at all. The edit is
  // now reverse-complemented into top-strand coordinates before it reaches the engine, and
  // both spellings are kept in the row so the benchmark says which is which.
  const _RCS = x => (x || '').toUpperCase().split('').reverse().map(c => RCB[c] || c).join('');
  const _minus = out.edit_strand === '-';
  const _ref = _minus ? _RCS(r.edit_from) : (r.edit_from || '').toUpperCase();
  const _alt = _minus ? _RCS(r.edit_to)   : (r.edit_to   || '').toUpperCase();
  // An edit anchored at its LAST base — whether minus-quoted, which the check above matched
  // reading leftwards, or plus-quoted in gene orientation — starts (length - 1) further left.
  const _anchoredLast = _minus || _fwdLast;
  const _pos = (_anchoredLast && _ref.length > 1) ? editPos0 - _ref.length + 1 : editPos0;
  out.edit_strand_note = _minus
      ? 'edit_from/edit_to quoted on the minus strand; reverse-complemented to '
        + _ref + '>' + (_alt || '-') + ' at top-strand position ' + (_pos + 1)
      : (_fwdLast
          ? 'edit_from/edit_to quoted on the plus strand in gene orientation, anchored at '
            + 'its last base; read as ' + _ref + '>' + (_alt || '-')
            + ' at top-strand position ' + (_pos + 1)
          : '');
  out.edit_from_top = _ref;
  out.edit_to_top   = _alt;
  // DELETION FIX (12 Sep 2026). A deletion arrives here as one row with a multi-base
  // edit_from and an empty edit_to, and was handed to the engine as a single edit —
  // which removes exactly ONE base, whatever the row said. All 17 deletion rows in the
  // benchmark are multi-base (2, 3, 6 and 11 nt), so every one of them was scored against
  // a 1 nt deletion. The interface does not have this bug: it expands a multi-base deletion
  // into one entry per base sharing a _multiDelGroup tag. The batch scorer now does the same,
  // so the benchmark and the interface design the same molecule.
  const _isDel = !_alt && _ref.length >= 1;
  const _isIns = !_ref && _alt.length >= 1;
  let edits;
  if (_isDel && _ref.length > 1) {
    edits = [];
    for (let di = 0; di < _ref.length; di++)
      edits.push({ genomicPos: _pos + di, type: 'DEL', ref: _ref[di], alt: '-',
                   _multiDelGroup: _pos, _multiDelLen: _ref.length });
  } else if (_isIns) {
    edits = [{ genomicPos: _pos, genomicEnd: _pos, type: 'INS', ref: '-', alt: _alt,
               _isInsertion: true, _insertionLen: _alt.length, from: _ref, to: _alt }];
  } else {
    edits = [{ genomicPos: _pos, type: (r.edit_type || 'SNP').toUpperCase(),
               ref: _ref, alt: _alt || '-', from: _ref, to: _alt,
               genomicEnd: _pos + Math.max(0, _alt.length - 1) }];
  }

  let cands;
  try { cands = ctx.findSpacers(seq, pam, spacerLen, editPos0, edits) || []; }
  catch (e) { out.status = 'findSpacers threw: ' + e.message; return out; }

  const usable = cands.filter(c => c.isCorrectSide);
  const ranked = [...usable].sort((a, b) => b.score - a.score);
  out.n_candidates = usable.length;
  out.best_available_score  = ranked[0] ? ranked[0].score  : '';
  out.best_available_spacer = ranked[0] ? ranked[0].spacer : '';

  const wanted = clean(r.published_spacer);
  if (!wanted) { out.status = 'published_spacer empty'; return out; }
  const hitIdx = ranked.findIndex(c => c.spacer === wanted);
  if (hitIdx < 0) {
    out.status = 'published_spacer not among candidates — check strand, PAM, or that the spacer lies inside genomic_seq';
    return out;
  }
  const c = ranked[hitIdx];
  out.published_rank = hitIdx + 1;
  out.published_rank_percentile = usable.length > 1
    ? +(100 * (1 - hitIdx / (usable.length - 1))).toFixed(1) : 100;

  // spacer terms, recomputed from the same rules so each is reportable separately
  const gc = c.gc_pct, seedGC = ctx.m2_gc(c.spacer.slice(8)), d = c.dist;
  out.composite_score = c.score;
  out.raw_score       = c.rawScore;
  out.dist_term   = !c.isCorrectSide ? -80 : d >= 3 && d <= 15 ? 50 : d <= 25 ? 35 : d <= 34 ? 15 : d <= 50 ? 0 : -30;
  out.gc_term     = gc >= 45 && gc <= 60 ? 20 : gc >= 40 && gc <= 65 ? 14 : gc >= 30 && gc <= 75 ? 7 : 2;
  out.seed_term   = seedGC >= 35 && seedGC <= 60 ? 10 : seedGC <= 75 ? 5 : 1;
  // POL3-START-WEIGHT: scored at 0 since Ma X et al. 2015 Mol Plant 8:1274 measured no
  // efficiency difference between regular (G/A) and irregular (T/C) starts, and the tool
  // prepends the promoter's +1 base by construction. Kept as a column so the audit trail
  // shows which spacers would have received the old bonus.
  out.gstart_term = 0;
  out.gstart_base_ok = c.spacer[0] === 'G' ? 1 : 0;
  out.polyt_term  = /TTTT/.test(c.spacer) ? -25 : 0;
  out.nick_edit_dist = d;
  out.spacer_gc = gc;
  out.seed_gc = seedGC;
  out.struct_penalty = c.structPenalty;
  out.struct_risk = c.structRisk;
  out.ir_score = c.otScore;
  out.spacer_strand = c.strand;
  out.nick_pos = c.nickPosGenomic;

  // FIX SPECIES-BAND (12 Sep 2026). Until now this scored every row with whatever
  // _PPE_TM_BAND_KEY happened to default to, which is 'rice'. The five Triticum rows were
  // therefore scored against the rice melting-temperature window (14-20 C NN) rather than
  // the wheat/barley/maize one (26-34 C), so their pbs_score and their warnings described
  // a species they do not belong to. The band is now set per row from the species column,
  // which is what makes a wheat row a wheat row.
  const _sp = String(r.species || '');
  ctx._PPE_TM_BAND_KEY = /Triticum|Hordeum|Zea|wheat|barley|maize/i.test(_sp) ? 'triticeae_maize'
                       : /Oryza|rice/i.test(_sp)                              ? 'rice'
                       :                                                        'default';
  out.pbs_tm_band = ctx._PPE_TM_BAND_KEY;

  // PBS at the published length
  try {
    const pbsRaw = ctx.genPBS(seq, c.nickPosGenomic, c.strand, 8, 22, c.spacer);
    const pbsArr = Array.isArray(pbsRaw) ? pbsRaw : (pbsRaw.candidates || pbsRaw.list || []);
    const wantLen = parseInt(r.published_pbs_len, 10);
    const pick = pbsArr.find(x => x.length === wantLen) || pbsArr[0];
    if (pick) {
      out.pbs_seq = pick.seq; out.pbs_len_used = pick.length;
      out.pbs_score = pick.score; out.pbs_tm = pick.tm; out.pbs_gc = pick.gc_pct;
      out.pbs_dG_worst = pick.dGworst;
      const rtChan = (pick.structDetails || []).find(x => /RT/i.test(x.label));
      out.pbs_rt_dG = rtChan ? rtChan.dG : '';
      out.pbs_struct_risk = pick.structRisk;
      if (wantLen && pick.length !== wantLen) out.status = 'OK (published PBS length unavailable, nearest used)';

      // RT at the published length
      const rtRaw = ctx.genRT(seq, c.nickPosGenomic, edits, c.strand, 10, 40, c.spacer, pick.seq);
      const rtArr = Array.isArray(rtRaw) ? rtRaw : (rtRaw.candidates || rtRaw.list || []);
      const wantRT = parseInt(r.published_rt_len, 10);
      const rpick = rtArr.find(x => x.length === wantRT) || rtArr[0];
      if (rpick) {
        out.rt_seq = rpick.seq; out.rt_len_used = rpick.length; out.rt_score = rpick.score;
        // PBS<->RT template is the strongest single correlate of measured efficiency in
        // this benchmark: rho = +0.457, P = 0.0018 against the 44 Lin 2020 pegRNAs that
        // carry a digitised efficiency, ahead of PBS Tm deviation (+0.131) and level with
        // nick-to-edit distance (+0.446). genPBS runs before the RT template exists, so
        // compute this channel explicitly now that both sequences are known.
        //
        // ATTRIBUTION FIX (12 Sep 2026). This used to read "the dominant failure mode
        // (Chen 2021)". Chen et al. 2021 Cell 184:5635 is the mismatch-repair paper -
        // MLH1dn, PE4 and PE5 - and says nothing about pegRNA secondary structure. The
        // documented pegRNA auto-inhibition is PBS<->SPACER, not PBS<->RT: "The PBS and
        // spacer sequence within the pegRNA are complementary to each other and can
        // potentially form intramolecular and intermolecular interactions through
        // Watson-Crick base pairing" (Nucleic Acids Res 2023 51:6966), and that channel is
        // the one genPBS already scores at its highest weight. The PBS<->RT figure above is
        // this work, measured here, and is cited as such.
        try {
          const d = ctx.m2_maxDuplexAndDG(pick.seq, rpick.seq);
          out.pbs_rt_dG  = (d && (d.dG  !== undefined ? d.dG  : d[1])) ?? '';
          out.pbs_rt_run = (d && (d.run !== undefined ? d.run : d[0])) ?? '';
        } catch (e) { /* leave blank */ }
      }
    }
  } catch (e) { out.status = 'OK (PBS/RT stage failed: ' + e.message + ')'; }

  return out;
}

// ── run ────────────────────────────────────────────────────────────────────
const rows = parseCSV(fs.readFileSync(INPUT, 'utf8'));
const scored = rows.map(scoreRow);

const EXTRA = ['edit_strand','edit_from_top','edit_to_top','edit_strand_note','composite_score','raw_score','dist_term','gc_term','seed_term','gstart_term','gstart_base_ok','polyt_term',
  'nick_edit_dist','spacer_gc','seed_gc','struct_penalty','struct_risk','ir_score','spacer_strand','nick_pos',
  'pbs_tm_band','pbs_seq','pbs_len_used','pbs_score','pbs_tm','pbs_gc','pbs_dG_worst','pbs_rt_dG','pbs_rt_run','pbs_struct_risk',
  'rt_seq','rt_len_used','rt_score',
  'n_candidates','published_rank','published_rank_percentile','best_available_score','best_available_spacer','status'];
const inputCols = Object.keys(rows[0] || {});
const cols = [...inputCols, ...EXTRA.filter(c => !inputCols.includes(c))];

if (REPORT) {
  const ok = scored.filter(r => r.status.startsWith('OK'));
  console.error(`\n  scored ${ok.length} of ${scored.length} rows\n`);
  scored.forEach(r => {
    const flag = r.status.startsWith('OK') ? ' ok ' : 'FAIL';
    console.error(`  [${flag}] ${(r.id||'?').padEnd(26)} score=${String(r.composite_score ?? '-').padStart(3)}` +
                  `  rank ${String(r.published_rank ?? '-').padStart(3)}/${String(r.n_candidates ?? '-').padEnd(3)}` +
                  `  eff=${r.measured_efficiency || '-'}` +
                  (r.status.startsWith('OK') ? '' : `   ${r.status}`));
  });
  const fails = scored.filter(r => !r.status.startsWith('OK'));
  if (fails.length) console.error(`\n  ${fails.length} row(s) need attention before the benchmark is usable.\n`);
  else console.error('\n  all rows scored.\n');
}

process.stdout.write(cols.map(esc).join(',') + '\n');
scored.forEach(r => process.stdout.write(cols.map(c => esc(r[c])).join(',') + '\n'));
