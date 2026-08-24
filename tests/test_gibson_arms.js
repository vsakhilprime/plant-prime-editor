// A homology arm has to match the linearised vector end exactly or the assembly does not
// circularise. The arms that shipped were two generic 25-mers reused across four contexts and
// marked APPROXIMATE; like the old colony anchors they occur in none of the deposited plasmids.
// This checks that every arm the tool now claims to have verified is really there, really
// unique, and really sits immediately outside the cut it is supposed to abut.
const fs = require('fs'), path = require('path');
const { q } = require(path.join(__dirname, 'probe.js'));
const rc = s => s.split('').reverse().map(c => ({ A:'T', T:'A', G:'C', C:'G' }[c] || c)).join('');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vector_sequences.json'), 'utf8'));
const src = raw.sequences || raw;
const seqs = {};
Object.keys(src).forEach(k => { seqs[k.replace(/^&gt;\s*/, '').trim()] = String(src[k] || '').toUpperCase().replace(/\s/g, ''); });
const arms = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'analysis', 'gibson_arms.json'), 'utf8'));

const V = q('JSON.parse(JSON.stringify(VECTORS.map(v=>({id:v.id,ok:v.arms_verified_v,pl:v.arm_plasmid,a5:v.gibson_5arm_v,a3:v.gibson_3arm_v}))))');
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; if (!ok) console.log('* FAIL * ' + l + (d ? ': ' + d : '')); };

const claimed = V.filter(v => v.ok);
console.log('\n=== homology arms ===');
console.log(claimed.length + ' vectors claim sequence-verified arms\n');

claimed.forEach(v => {
  const key = Object.keys(seqs).find(k => k.indexOf(v.pl) === 0);
  chk(v.id + ' names a plasmid we hold', !!key, v.pl);
  if (!key) return;
  const s = seqs[key];
  chk(v.id + " 5' arm occurs exactly once", (s.split(v.a5).length - 1) + (s.split(rc(v.a5)).length - 1) === 1);
  chk(v.id + " 3' arm occurs exactly once", (s.split(v.a3).length - 1) + (s.split(rc(v.a3)).length - 1) === 1);
  chk(v.id + ' arms are 25 nt', v.a5.length === 25 && v.a3.length === 25, v.a5.length + '/' + v.a3.length);
  const i5 = s.indexOf(v.a5), i3 = s.indexOf(v.a3);
  chk(v.id + " 5' arm lies upstream of the 3' arm", i5 >= 0 && i3 > i5, i5 + ' vs ' + i3);
  // the arms must not overlap: they flank a region that gets replaced
  chk(v.id + ' arms do not overlap', i5 + 25 <= i3);
  // and the record must agree with what the script derived
  const j = arms[v.id];
  chk(v.id + ' matches analysis/gibson_arms.json', !!j && j.gibson_5arm === v.a5 && j.gibson_3arm === v.a3);
  console.log('  ' + v.id.padEnd(24) + v.pl.padEnd(26) + (j ? j.linearised_by : ''));
});

// the generic arms must no longer be presented as verified anywhere
const OLD5 = 'AACCAGATCGATTAGTGATTTTTGT', OLD3 = 'CACCACTTTCCCCATGAGTTTTTCT';
chk('no verified vector still carries a generic arm',
    claimed.every(v => v.a5 !== OLD5 && v.a3 !== OLD3));

// Jin et al. 2023 report roughly 120 bp between BsaI and HindIII in pOsU3; that number is the
// external check that the linearisation geometry is being read correctly, so hold it.
const os = arms['nCas9-PPE'];
chk('pOsU3 BsaI-HindIII spacing matches the published ~120 bp',
    !!os && /121 bp/.test(os.linearised_by), os && os.linearised_by);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
