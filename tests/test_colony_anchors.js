// A colony-PCR primer that does not occur in the plasmid produces no band, and the user
// concludes the cloning failed. The anchors that shipped were five generic strings keyed on
// promoter name — the same 21-mer downstream for every backbone — and none of them occurs in
// any of the twelve deposited sequences. This asserts that every anchor the tool now claims
// to have verified really is present, really is unique, and really flanks the cassette.
const vm = require('vm'), fs = require('fs'), path = require('path');
const { ctx, q } = require(path.join(__dirname, 'probe.js'));
const rc = s => s.split('').reverse().map(c => ({ A:'T', T:'A', G:'C', C:'G' }[c] || c)).join('');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vector_sequences.json'), 'utf8'));
const src = raw.sequences || raw;
const seqs = {};
Object.keys(src).forEach(k => { seqs[k.replace(/^&gt;\s*/, '').trim()] = String(src[k] || '').toUpperCase().replace(/\s/g, ''); });

const V = q('JSON.parse(JSON.stringify(VECTORS.map(v=>({id:v.id,cv:v.colony_verified,plasmid:v.colony_plasmid,f:v.colony_fwd,r:v.colony_rev,bp:v.colony_empty_bp}))))');
let pass = 0, fail = 0;
const chk = (label, ok, detail) => { ok ? pass++ : fail++; if (!ok) console.log('* FAIL * ' + label + (detail ? ': ' + detail : '')); };

const claimed = V.filter(v => v.cv);
console.log('\n=== colony-PCR anchors ===');
console.log(claimed.length + ' vectors claim sequence-verified anchors\n');

claimed.forEach(v => {
  const key = Object.keys(seqs).find(k => k.indexOf(v.plasmid) === 0);
  chk(v.id + ' names a plasmid we hold', !!key, 'colony_plasmid = ' + v.plasmid);
  if (!key) return;
  const s = seqs[key];
  const fwdN = s.split(v.f).length - 1 + s.split(rc(v.f)).length - 1;
  // the reverse primer is emitted ready to pipette, so it is the reverse complement
  const revN = s.split(v.r).length - 1 + s.split(rc(v.r)).length - 1;
  chk(v.id + ' forward anchor present exactly once', fwdN === 1, fwdN + ' occurrence(s)');
  chk(v.id + ' reverse anchor present exactly once', revN === 1, revN + ' occurrence(s)');
  const fp = s.indexOf(v.f) >= 0 ? s.indexOf(v.f) : s.indexOf(rc(v.f));
  const rp = s.indexOf(rc(v.r)) >= 0 ? s.indexOf(rc(v.r)) : s.indexOf(v.r);
  chk(v.id + ' forward lies upstream of reverse', fp < rp, fp + ' vs ' + rp);
  const span = rp + v.r.length - fp;
  chk(v.id + ' declared empty amplicon matches the sequence', Math.abs(span - v.bp) <= 1, span + ' vs declared ' + v.bp);
  chk(v.id + ' amplicon resolves on a gel', v.bp >= 300 && v.bp <= 3000, v.bp + ' bp');
  console.log('  ' + v.id.padEnd(24) + v.plasmid.padEnd(26) + String(v.bp).padStart(5) + ' bp empty');
});

// nothing may still be carrying the old generic downstream anchor as if it were verified
const OLD = 'CACCACTTTCCCCATGAGTTT';
chk('no verified vector still uses the old generic anchor',
    claimed.every(v => v.f !== OLD && v.r !== OLD && v.f !== rc(OLD) && v.r !== rc(OLD)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
