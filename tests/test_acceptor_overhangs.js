// Each verified acceptor overhang is a four-base fact read off a deposited plasmid
// sequence. Nothing in the interface would reveal a typo in one of them — the primers
// would simply fail to clone. This re-derives every one from data/vector_sequences.json
// by simulating the digestion, and fails if the value carried in the tool has drifted.
//
// Two acceptors use two different enzymes in a single double digest (pYPQ141D-peg is
// BsmBI for the spacer slot and BsaI for the extension slot), so each slot is checked
// against the enzyme that actually cuts it rather than against one enzyme for the vector.
const fs = require('fs'), path = require('path');
const rc = s => s.split('').reverse().map(c => ({ A:'T', T:'A', G:'C', C:'G' }[c] || c)).join('');
const ENZ = { BsaI:['GGTCTC',1,5], Esp3I:['CGTCTC',1,5], BsmBI:['CGTCTC',1,5], BbsI:['GAAGAC',2,6] };

function cuts(seq, enz) {
  const [rec, n1, n2] = ENZ[enz]; const out = [];
  let m, re = new RegExp(rec, 'g');
  while ((m = re.exec(seq))) out.push({ top: m.index + rec.length + n1, bot: m.index + rec.length + n2 });
  re = new RegExp(rc(rec), 'g');
  while ((m = re.exec(seq))) out.push({ top: m.index - n2, bot: m.index - n1 });
  return out.sort((a, b) => a.top - b.top);
}

// every overhang pair this enzyme produces in this plasmid, as a flat string
function pairs(seq, enz) {
  const c = cuts(seq, enz), out = [];
  for (let k = 0; k + 1 < c.length; k++) {
    const gap = c[k + 1].top - c[k].bot;
    if (gap > 0 && gap < 700) out.push(seq.slice(c[k].top, c[k].bot) + seq.slice(c[k + 1].top, c[k + 1].bot));
  }
  return out;
}

(function () {
  const toolPath = path.resolve(process.argv[2] || process.env.PPE_HTML ||
                   path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'));
  const html = fs.readFileSync(toolPath, 'utf8');
  const raw  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vector_sequences.json'), 'utf8'));
  const src  = raw.sequences || raw;
  const seqs = {};
  Object.keys(src).forEach(k => { seqs[k] = String(src[k] || '').toUpperCase().replace(/\s/g, ''); });
  const find = frag => Object.keys(seqs).find(k => k.indexOf(frag) >= 0);

  // vector id in the tool  →  fragment identifying the plasmid that carries the acceptor
  const MAP = {
    'pH-2x35S-DualPE':        'DualPE',
    'pVu2024-dicot':          'pU6cm',
    'pH35C-epegRNA-ePPEplus': 'pH35C',
    'pYPQ166-OsPE2':          'pYPQ141D',
  };
  let checked = 0, failed = 0;

  Object.keys(MAP).forEach(id => {
    const i = html.indexOf("id: '" + id + "'");
    if (i < 0) { console.log('FAIL ' + id + ': not found in the tool'); failed++; return; }
    let end = html.indexOf('\n  {', i); if (end < 0) end = i + 8000;
    const block = html.slice(i, end);
    if (block.indexOf('acceptor_verified: true') < 0) { console.log('FAIL ' + id + ': lost acceptor_verified'); failed++; return; }

    const e1  = (block.match(/acceptor_enzyme: '([^']+)'/)  || [])[1];
    const e2  = (block.match(/acceptor_enzyme2: '([^']+)'/) || [])[1] || e1;
    const s1  = (block.match(/acceptor_slot1: \['([ACGT]{4})','([ACGT]{4})'\]/) || []).slice(1, 3);
    const s2  = (block.match(/acceptor_slot2: \['([ACGT]{4})','([ACGT]{4})'\]/) || []).slice(1, 3);
    const seq = seqs[find(MAP[id])];
    if (!seq) { console.log('FAIL ' + id + ': no deposited sequence'); failed++; return; }

    [[s1, e1, 'slot 1'], [s2, e2, 'slot 2']].forEach(([slot, enz, label]) => {
      if (!slot.length) return;
      const want = slot.join(''), got = pairs(seq, enz);
      if (got.indexOf(want) < 0) {
        console.log('FAIL ' + id + ' ' + label + ': ' + slot[0] + '/' + slot[1] +
                    ' is not produced by ' + enz + ' (found ' + got.join(', ') + ')');
        failed++;
      } else checked++;
    });

    const sc = (block.match(/scaffold_seq: '([ACGT]+)'/) || [])[1];
    if (sc) {
      if (seq.indexOf(sc) < 0) { console.log('FAIL ' + id + ': scaffold_seq absent from the deposited sequence'); failed++; }
      else checked++;
    }
  });

  console.log(checked + ' checks passed, ' + failed + ' failed');
  console.log('overhangs and scaffolds re-derived from the deposited plasmid sequences');
  if (failed) process.exit(1);
})();
