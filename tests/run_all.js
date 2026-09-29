#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Plant Prime Editor — test suite

     node tests/run_all.js [path/to/plant_prime_editor_v1.0.html]

   Loads the released HTML headlessly and checks its scoring engine against
   published prime editing designs. No network, no build step, no dependencies
   beyond Node itself.
   ═══════════════════════════════════════════════════════════════════════════ */
const { execFileSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const HTML = path.resolve(process.argv[2] || process.env.PPE_HTML ||
             path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'));

if (!fs.existsSync(HTML)) {
  console.error('Tool file not found: ' + HTML);
  console.error('Usage: node tests/run_all.js [path/to/plant_prime_editor_v1.0.html]');
  process.exit(2);
}

const SUITE = [
  ['audit_syntax.js',              'every script block parses',                 /All blocks parse\./],
  ['audit_bio.js',                 'scaffold, tevopreQ1, Tm, codon table, PAM', /^(\d+) passed, 0 failed/m],
  ['audit_geom3.js',               'published PBS reproduced, both strands',    /total\s*:\s*144 \/ 146/],
  ['audit_rt.js',                  'RT template and edit encoding',             /^(\d+) passed, 0 failed/m],
  ['audit_indel2.js',              'insertion and deletion geometry',           /^4 passed, 0 failed/m],
  ['audit_pe3.js',                 'PE3 and PE3b nick sgRNA rules',             /^\d+ passed, 0 failed/m],
  ['audit_mnp.js',                 'multi-base substitutions replace, not insert', /^\d+ passed, 0 failed/m],
  ['audit_tooltable.js',           'the two head-to-head files agree',          /^\d+ passed, 0 failed/m],
  ['audit_fuzz.js',                'random sequences, all four edit classes',   /^\d+ passed, 0 failed/m],
  ['audit_routes.js',              'what each cloning route emits',             /^\d+ passed, 0 failed/m],
  ['audit_pair.js',                'PBS/RT pair check reports without re-ranking', /^\d+ passed, 0 failed/m],
  ['test_organism_detection.js',   'species detection from FASTA headers',      /^13 passed, 0 failed/m],
  ['test_same_codon_variants.js',  'two changes in one codon',                  /^\d+ passed, 0 failed/m],
  ['test_acceptor_overhangs.js',   'acceptor overhangs match the deposited sequences', /^\d+ checks passed, 0 failed/m],
  ['test_vector_records.js',       'vector records are internally consistent',        /^\d+ checks passed, 0 failed/m],
  ['test_colony_anchors.js',       'colony anchors occur once in the real plasmid',   /^\d+ passed, 0 failed/m],
  ['test_alignment_panel.js',      'alignment panel and species note render sanely',             /^\d+ passed, 0 failed/m],
  ['test_strategy_cards.js',       'cloning cards read the vector, not literals',      /^\d+ passed, 0 failed/m],
  ['test_layout_containers.js',    'containers hold what they were built for',        /^\d+ passed, 0 failed/m],
  ['test_table_columns.js',        'every table body matches its header columns',      /^\d+ passed, 0 failed/m],
  ['test_pbs_panels_agree.js',     'heatmap and PBS table report the same numbers',    /^\d+ passed, 0 failed/m],
  ['test_design_rules.js',         'literature design rules are applied',             /^\d+ passed, 0 failed/m],
  ['test_gibson_arms.js',          'homology arms match the linearised vector',       /^\d+ passed, 0 failed/m],
  ['test_re_conflict.js',          'internal restriction sites are caught',           /^\d+ passed, 0 failed/m],
  ['test_primer_roundtrip.js',     'primers make a product that cuts back out',       /^\d+ passed, 0 failed/m],
  ['test_build_and_exports.js',    'build stamp and off-target hand-off',             /^\d+ passed, 0 failed/m],
  ['test_pol3_start_base.js',      'Pol III +1 base, U6 vs U3 cassettes',       /All Pol III start-base checks pass\./],
  ['test_twin_strand_search.js',   'paired-pegRNA opposite-strand search',      /all passed/],
  ['test_csv_export_scope.js',     'CSV export scope and codon context',        /All CSV export scope checks pass\./],
  ['test_gblock_and_scorers.js', 'gBlock enzyme sites, structure risk, spacer specificity', /^\d+ passed, 0 failed/m],
  ['test_exports.js',              'the four export builders run',              /^\d+ passed, 0 failed/m],
  ['test_target_site_registry.js', 'one target site, however many studies numbered it', /^\d+ passed, 0 failed/m],
];

console.log('Plant Prime Editor — test suite');
console.log('tool under test: ' + path.resolve(HTML) + '\n');

let pass = 0, fail = 0, skipped = 0;
for (const [file, what, expect] of SUITE) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) { console.log(`  SKIP  ${what}  (${file} not present)`); skipped++; continue; }
  let out = '', died = null;
  try {
    out = execFileSync(process.execPath, [p, HTML],
          { cwd: __dirname, env: { ...process.env, PPE_HTML: HTML },
            encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 300000 });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    // FIX RUNNER-SWALLOWS-CRASH (23 Aug 2026). Until now this catch threw the failure
    // away and let the regex alone decide. A test that printed its success line and THEN
    // crashed still reported PASS; so did one that called process.exit(3); so did one that
    // timed out, because its partial stdout was regex-tested. All three were verified by
    // appending the fault to a passing test. A test script has to finish cleanly AND match.
    died = e.signal ? ('killed by ' + e.signal + (e.signal === 'SIGTERM' ? ' — timed out' : ''))
         : (typeof e.status === 'number' && e.status !== 0) ? ('exited ' + e.status)
         : (e.code === 'ETIMEDOUT') ? 'timed out'
         : ('did not run: ' + (e.message || 'unknown'));
  }
  // FIX REGEX-HOLES (23 Aug 2026). Sixteen of the 25 rows below use
  // /^\d+ passed, 0 failed/m, which has two holes that were both reachable:
  //   * "0 passed, 0 failed" matches — a script that checked NOTHING passes. Clearing
  //     every colony_verified flag makes test_colony_anchors skip its whole loop and
  //     print exactly that; clearing arms_verified_v does the same to test_gibson_arms.
  //   * the /m flag matches ANY line, so a passing tally early in the output masks a
  //     failing section later.
  // Rather than hand-tune 16 regexes and hope the next one is written correctly, the
  // runner now applies two universal guards to every row. A row's own regex still has
  // to match; these can only take a pass away, never grant one.
  const zeroChecks = /^\s*0 (?:checks )?passed/m.test(out);
  const anyFailed  = (out.match(/(\d+)\s+(?:checks\s+)?failed/g) || [])
                     .some(t => parseInt(t, 10) > 0);
  const ok = !died && !zeroChecks && !anyFailed && expect.test(out);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) {
    if (died) console.log('        script did not terminate cleanly: ' + died);
    if (zeroChecks) console.log('        the script ran but checked nothing (0 passed)');
    if (anyFailed)  console.log('        the output reports a non-zero failure count');
    console.log('        expected to match: ' + expect);
    console.log(out.split('\n').filter(l => l.trim()).slice(-6).map(l => '        ' + l).join('\n'));
  }
}
console.log(`\n${pass} passed, ${fail} failed${skipped ? ', ' + skipped + ' skipped' : ''}`);
process.exit(fail ? 1 : 0);
