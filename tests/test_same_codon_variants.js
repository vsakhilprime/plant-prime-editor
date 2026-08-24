/* Two nucleotide changes inside one codon — against the TOOL, not against a local model.

   REWRITTEN 23 August 2026. What was here before tested nothing at all. It re-implemented
   the v1.4 and v1.5 codon logic locally, against a codon table it built itself in the file,
   and printed a side-by-side comparison with no assertion anywhere. Proof:

       node test_same_codon_variants.js /does/not/exist.html

   ran to completion and exited 0. The runner's regex for this row was /v1\.5 shows/, which
   matches a static column header printed before any computation, so the row passed whatever
   the tool did. Mutating the tool in any way left it green.

   WHAT THIS PINS, stated precisely, because overclaiming is the failure being corrected.
   getCodonContext takes the REFERENCE sequence and derives the reference codon from it by
   coordinate. The original v1.4 defect — reporting the target codon with a single base
   reverted — is not expressible against that signature, and I confirmed it: reintroducing
   that arithmetic produces the same answer, because reverting one base of the target using
   the reference base at that position returns the reference codon. So this file does NOT
   pin that specific historical bug, and does not claim to.

   What it does pin, verified by mutation:
     * codon framing. Shifting codonStart by one makes it report CCG (Pro) instead of
       TCC (Ser) and three checks fail.
     * that two variants in the same codon agree on one reference codon and one aaPos,
       rather than disagreeing with each other.
     * that the amino-acid translation follows the codon.

   The case is OsAAT-shaped: reference codon TCC (Ser) at codon 101, edited to TGA (Stop),
   differing at two of the three positions. */
const path = require('path'), vm = require('vm');
process.env.PPE_HTML = process.env.PPE_HTML || path.join(__dirname, '..', 'plant_prime_editor_v1.0.html');
const { ctx } = require(path.join(__dirname, 'probe.js'));
const q = e => vm.runInContext(e, ctx, { timeout: 30000 });

let P = 0, F = 0;
const ck = (n, c, d) => { c ? P++ : F++;
  console.log((c ? '  PASS  ' : '* FAIL *') + ' ' + String(n).padEnd(56) + (d || '')); };

/* getCodonContext is declared inside renderResults and closes over `frame` and
   CODON_TABLE, so it is not a global. Lift the tool's OWN source into the sandbox — the
   same technique test_csv_export_scope.js uses — rather than reimplementing it, which is
   exactly what made the previous version of this file worthless. If the function cannot
   be found, fail; do not skip. Skipping quietly is how the old version passed against a
   file that did not exist. */
const fs = require('fs');
const src = fs.readFileSync(process.env.PPE_HTML, 'utf8');
const at = src.indexOf('  function getCodonContext(');
ck('getCodonContext found in the tool source', at >= 0, at >= 0 ? 'offset ' + at : 'ABSENT');
if (at < 0) { console.log('\n' + P + ' passed, ' + F + ' failed'); process.exit(1); }
let open = src.indexOf('{', at), depth = 0, end = open;
while (end < src.length) {
  if (src[end] === '{') depth++;
  else if (src[end] === '}') { depth--; if (!depth) break; }
  end++;
}
// CODON_TABLE and frame are both already live in the sandbox; the lifted function
// closes over them exactly as it does in the browser. Confirm rather than assume.
ck('CODON_TABLE is live in the sandbox', q('typeof CODON_TABLE') === 'object', q('typeof CODON_TABLE'));
q('frame = 1;');
q(src.slice(at, end + 1));                        // the tool's own code, unmodified
const exposed = q('typeof getCodonContext');
ck('getCodonContext is callable in the sandbox', exposed === 'function', 'typeof = ' + exposed);
if (exposed !== 'function') { console.log('\n' + P + ' passed, ' + F + ' failed'); process.exit(1); }

/* Build a reference CDS whose codon 101 (CDS positions 301-303) is TCC, and edit it to TGA.
   Frame 1, so codon n occupies positions 3n-2 .. 3n. */
const ref = ('ATG' + 'AAA'.repeat(99) + 'TCC' + 'GGG'.repeat(20));
const posOfCodon101 = 301;                       // 1-based CDS position of that codon's first base

const r = JSON.parse(q(`(function(){
  var ref = ${JSON.stringify(ref)};
  // TCC -> TGA changes positions 302 (C->G) and 303 (C->A): two variants, one codon.
  var a = getCodonContext(302, ref, 'G', 'OsAAT', 'SNP', 1);
  var b = getCodonContext(303, ref, 'A', 'OsAAT', 'SNP', 1);
  // and a control: a single change in a different codon
  var c = getCodonContext(4, ref, 'T', 'OsAAT', 'SNP', 1);
  return JSON.stringify({a:a, b:b, c:c, refCodon101: ref.slice(300,303)});
})()`));

ck('the fixture really carries TCC at codon 101', r.refCodon101 === 'TCC', r.refCodon101);

/* THE REGRESSION. Both variants sit in codon 101, so both must report the true reference
   codon TCC. The v1.4 bug reported the target codon with one base reverted — TGC for the
   first variant and TCA for the second — which reads as two different reference codons for
   one position in one gene. */
ck('variant at 302 reports the TRUE reference codon', r.a.refCodon === 'TCC',
   'got ' + r.a.refCodon + (r.a.refCodon === 'TGC' ? '  <- the v1.4 single-base-revert bug' : ''));
ck('variant at 303 reports the TRUE reference codon', r.b.refCodon === 'TCC',
   'got ' + r.b.refCodon + (r.b.refCodon === 'TCA' ? '  <- the v1.4 single-base-revert bug' : ''));
ck('both variants in one codon agree on the reference codon',
   r.a.refCodon === r.b.refCodon, r.a.refCodon + ' / ' + r.b.refCodon);

ck('both variants map to the same amino-acid position', r.a.aaPos === r.b.aaPos,
   'aaPos ' + r.a.aaPos + ' / ' + r.b.aaPos);
ck('the reference amino acid is Ser', r.a.refAA === 'S' && r.b.refAA === 'S',
   r.a.refAA + ' / ' + r.b.refAA);

/* The control must still behave: a lone change in codon 2 reports codon 2's own reference. */
ck('control: a single variant elsewhere reports its own codon',
   r.c.refCodon === 'AAA' && r.c.aaPos === 2,
   r.c.refCodon + ' at aaPos ' + r.c.aaPos);

console.log('\n' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
