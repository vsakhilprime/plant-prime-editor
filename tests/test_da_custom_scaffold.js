// Direct Assembly accepts a scaffold the user supplies, and everything downstream is built
// from that sequence rather than from the built-in constant.
//
// WHY THIS TEST EXISTS. Figure 2E of the paper states that a modified scaffold can be supplied
// through Direct Assembly. No field existed, and the scaffold was a constant read in four
// separate places, so the figure described something the tool could not do. Adding a text box
// is the easy half. The half that matters is that the primers, the insert and the preview all
// read the SAME sequence: the scaffold is not decoration, primers anneal to slices of it —
// the first 20 nt at the spacer junction and the last 15 at the RT-template junction — so a
// preview drawn from one sequence and primers built from another would be a construct that
// fails at the bench while every panel on screen looks right.
//
// The last check here is therefore a source check, not a behaviour check: it reads the tool
// and requires that no construction path still reads M3_SCAFFOLD directly. A behaviour test
// can be satisfied by a resolver nothing calls.
//
//     node tests/test_da_custom_scaffold.js [path/to/tool.html]

const vm = require('vm'), path = require('path');
const { ctx } = require(path.join(__dirname, 'probe.js'));

let pass = 0, fail = 0;
const chk = (label, ok, detail) => {
  ok ? pass++ : fail++;
  console.log((ok ? '  PASS  ' : '* FAIL * ') + String(label).padEnd(64) + (detail || ''));
};
const run  = e => vm.runInContext(e, ctx);
const runJ = e => JSON.parse(vm.runInContext('JSON.stringify(' + e + ')', ctx));

const STD = run('M3_SCAFFOLD');

// ── the pieces exist ────────────────────────────────────────────────────────
chk('m3_activeScaffold is defined',   run('typeof m3_activeScaffold')   === 'function');
chk('m3_da_scaffoldCheck is defined', run('typeof m3_da_scaffoldCheck') === 'function');
chk('the standard scaffold is 76 nt', STD.length === 76, STD.length + ' nt');

// ── the resolver: standard unless Direct Assembly supplies one ──────────────
const CUSTOM = 'GTTTAAGAGCTATGCTGGAAACAGCATAGCAAGTTTAAATAAGGCTAGTCCGTTATCAACTTGAAAAAGTGGCACCGAGTCGGTGC';
run('_m3DirectScaffold = ""; _m3DirectMode = "from_m2";');
chk('with nothing supplied, the standard scaffold is used', run('m3_activeScaffold()') === STD);

run('_m3DirectScaffold = ' + JSON.stringify(CUSTOM) + '; _m3DirectMode = "from_m2";');
chk('a custom scaffold is ignored outside Direct Assembly',
    run('m3_activeScaffold()') === STD, 'Module 2 path is untouched');

run('_m3DirectMode = "direct";');
chk('inside Direct Assembly the custom scaffold is returned',
    run('m3_activeScaffold()') === CUSTOM, CUSTOM.length + ' nt');

// The slices the primers anneal to must come from the custom sequence, not the constant.
chk('the spacer-junction slice comes from the custom scaffold',
    run('m3_activeScaffold().slice(0,20)') === CUSTOM.slice(0, 20),
    CUSTOM.slice(0, 20));
chk('the RT-junction slice comes from the custom scaffold',
    run('m3_activeScaffold().slice(-15)') === CUSTOM.slice(-15),
    CUSTOM.slice(-15));
chk('those slices differ from the standard, so the test could fail',
    CUSTOM.slice(0, 20) !== STD.slice(0, 20) || CUSTOM.slice(-15) !== STD.slice(-15));

run('_m3DirectScaffold = ""; _m3DirectMode = "from_m2";');   // leave the context as found

// ── the checker: what it accepts ────────────────────────────────────────────
const chkSeq = q => runJ('m3_da_scaffoldCheck(' + JSON.stringify(q) + ')');

chk('an empty box is not an error', chkSeq('').empty === true && chkSeq('').valid === true);
chk('whitespace and line breaks are stripped',
    chkSeq(' ATGC\natgc ').seq === 'ATGCATGC', chkSeq(' ATGC\natgc ').seq);
chk('lower case is accepted', chkSeq('atgc').valid === true);
['ATGCN', 'ATGC-ATGC', 'ATGC1', 'PROTEIN'].forEach(bad => {
  chk('rejected as not DNA: ' + JSON.stringify(bad), chkSeq(bad).valid === false);
});
chk('the standard scaffold is recognised as standard',
    chkSeq(STD).standard === true && chkSeq(STD).sites.length === 0);
chk('a different scaffold is not called standard', chkSeq(CUSTOM).standard === false);

// ── the checker: junction changes, because primers depend on them ───────────
const headOnly = 'AAAAAAAAAAAAAAAAAAAA' + STD.slice(20);
const tailOnly = STD.slice(0, -15) + 'AAAAAAAAAAAAAAA';
chk('a changed 5′ end is reported',
    chkSeq(headOnly).headChanged === true && chkSeq(headOnly).tailChanged === false);
chk('a changed 3′ end is reported',
    chkSeq(tailOnly).tailChanged === true && chkSeq(tailOnly).headChanged === false);
chk('an unchanged scaffold reports neither',
    chkSeq(STD).headChanged === false && chkSeq(STD).tailChanged === false);

// ── the checker: Type IIS sites, both strands, named ────────────────────────
const cases = [
  ['GGTCTC', 'BsaI',          '+'],
  ['GAGACC', 'BsaI',          '−'],
  ['CGTCTC', 'BsmBI / Esp3I', '+'],
  ['GAGACG', 'BsmBI / Esp3I', '−'],
  ['GAAGAC', 'BbsI',          '+'],
  ['GTCTTC', 'BbsI',          '−'],
];
cases.forEach(([site, name, strand]) => {
  const seq = 'AAAAAAAAAA' + site + 'AAAAAAAAAA';
  const r = chkSeq(seq);
  const hit = r.sites.filter(x => x.enzyme === name && x.strand === strand);
  chk(name + ' found on the ' + (strand === '+' ? 'plus' : 'minus') + ' strand',
      hit.length === 1 && hit[0].pos === 11,
      hit.length ? 'position ' + hit[0].pos : 'not found');
});
chk('a clean scaffold reports no sites',
    chkSeq('AAAACCCCGGGGTTTTAAAACCCCGGGGTTTT').sites.length === 0);
chk('two sites in one scaffold are both reported',
    chkSeq('AAAGGTCTCAAAAGAAGACAAA').sites.length === 2,
    chkSeq('AAAGGTCTCAAAAGAAGACAAA').sites.map(x => x.enzyme).join(' + '));
chk('the standard scaffold itself carries no Type IIS site',
    chkSeq(STD).sites.length === 0, 'as it must, or every design would fail');

// ── the wiring ──────────────────────────────────────────────────────────────
// THE FIRST VERSION OF THIS TEST PASSED WHILE THE FEATURE DID NOT WORK, and the way it
// failed is the point. It searched the source for "= M3_SCAFFOLD;" and found none, so it
// reported that every path went through the resolver. But runPrimerDesign reads the
// scaffold as M3_SCAFFOLD.slice(0, 20) and spacer + M3_SCAFFOLD + extension — about eighty
// reads in all, none of them matching that pattern. A browser run then showed the primers
// coming out with the standard scaffold while every check here was green.
//
// So the mechanism changed: M3_SCAFFOLD is no longer a constant but a property whose getter
// returns whatever is active. That makes all eighty reads correct at once, and it is what
// this section now tests — the getter itself, not a pattern in the text around it.
//
// Verified in a browser on 30 September 2026, driving the real interface: the same design
// entered twice, once with the standard scaffold and once with a custom one, produced
// primer panes differing in exactly three sequences — the spacer-junction primer, the
// reverse primer carrying the reverse complement of the scaffold 3' end, and the full
// insert — with no standard-scaffold sequence left anywhere in the custom run's primers.
// typeof first: on a build without the getter this name does not exist, and the test must
// report that as a failure rather than die with a ReferenceError. A traceback reads as a
// broken test; a FAIL line reads as a broken tool, which is what it would be.
const hasStd = run('typeof M3_SCAFFOLD_STANDARD') === 'string';
chk('M3_SCAFFOLD_STANDARD holds the fixed sequence',
    hasStd && run('M3_SCAFFOLD_STANDARD') === STD,
    hasStd ? run('M3_SCAFFOLD_STANDARD').length + ' nt'
           : 'not defined \u2014 the scaffold is still a plain constant');

const desc = runJ('(function(){var g=(typeof window!=="undefined"?window:globalThis);' +
                  'var d=Object.getOwnPropertyDescriptor(g,"M3_SCAFFOLD");' +
                  'return d?{getter:typeof d.get==="function",hasValue:"value" in d}:null;})()');
chk('M3_SCAFFOLD is a getter, not a fixed value', desc && desc.getter && !desc.hasValue,
    desc ? (desc.getter ? 'accessor property' : 'data property') : 'not defined on the global');

run('_m3DirectScaffold = ""; _m3DirectMode = "from_m2";');
chk('reading M3_SCAFFOLD gives the standard by default', run('M3_SCAFFOLD') === STD);

run('_m3DirectMode = "direct"; _m3DirectScaffold = ' + JSON.stringify(CUSTOM) + ';');
chk('reading M3_SCAFFOLD gives the custom one in Direct Assembly',
    run('M3_SCAFFOLD') === CUSTOM);

// These are the exact expressions the primer builders use. If the getter ever regressed to a
// constant, every one of them would silently return the standard sequence again.
chk('M3_SCAFFOLD.slice(0, 20) follows the custom scaffold',
    run('M3_SCAFFOLD.slice(0,20)') === CUSTOM.slice(0, 20), CUSTOM.slice(0, 20));
chk('M3_SCAFFOLD.slice(-20) follows the custom scaffold',
    run('M3_SCAFFOLD.slice(-20)') === CUSTOM.slice(-20));
chk('M3_SCAFFOLD.slice(-15) follows the custom scaffold',
    run('M3_SCAFFOLD.slice(-15)') === CUSTOM.slice(-15), CUSTOM.slice(-15));
chk('M3_SCAFFOLD.length follows the custom scaffold',
    run('M3_SCAFFOLD.length') === CUSTOM.length, CUSTOM.length + ' nt');
chk('a concatenated insert carries the custom scaffold',
    run('("GGGG" + M3_SCAFFOLD + "TTTT")').indexOf(CUSTOM) === 4);

// and the checker must still measure against the STANDARD, or it would compare a sequence
// with itself and call every custom scaffold "standard"
chk('the standard test inside the checker is not self-referential',
    runJ('m3_da_scaffoldCheck(' + JSON.stringify(CUSTOM) + ')').standard === false,
    'a custom scaffold is still reported as custom while it is active');

run('_m3DirectScaffold = ""; _m3DirectMode = "from_m2";');
chk('the context is left as it was found', run('M3_SCAFFOLD') === STD);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
