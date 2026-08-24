// The alignment panel is the first thing a user sees and the first panel of Supplementary
// Figure S3, and it was rendering with the ruler, the sequences and the match bar on three
// different horizontal scales. The cause was structural, not cosmetic: .aln-seq set a
// letter-spacing but never a font, so the rows inherited the proportional interface font and
// a pipe occupied roughly a third of the width of a base. This asserts the properties that
// have to hold for the columns to line up at all, so the panel cannot silently drift again.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.env.PPE_HTML ||
  path.join(__dirname, '..', 'plant_prime_editor_v1.0.html'), 'utf8');
let pass = 0, fail = 0;
const chk = (l, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '* FAIL * ') + l.padEnd(60) + (d || '')); };

const css = (sel) => {
  const m = html.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}'));
  return m ? m[1] : '';
};

// 1. every row that has to align must be monospace
const seq = css('.aln-seq'), ruler = css('.aln-ruler');
chk('.aln-seq declares a monospace font', /font-family:var\(--mono\)/.test(seq), seq.slice(0, 60));
chk('.aln-ruler declares a monospace font', /font-family:var\(--mono\)/.test(ruler));
chk('ligatures are disabled in the sequence rows', /font-variant-ligatures:none/.test(seq));

// 2. a fixed cell width, so ruler, sequences and match bar advance in the same step
const seqSpan = css('.aln-seq span'), rulerSpan = css('.aln-ruler span');
const w1 = (seqSpan.match(/width:([\d.]+)px/) || [])[1];
const w2 = (rulerSpan.match(/width:([\d.]+)px/) || [])[1];
chk('sequence cells have a fixed width', !!w1, w1 + 'px');
chk('ruler cells have the same fixed width', w1 && w1 === w2, w1 + ' vs ' + w2);

// 3. whitespace must survive, or gaps in the ruler and match bar collapse
chk('.aln-seq preserves whitespace', /white-space:pre/.test(seq));
chk('.aln-ruler preserves whitespace', /white-space:pre/.test(ruler));

// 4. no row may carry its own letter-spacing on top of the shared one
chk('match row no longer sets its own letter-spacing',
    html.indexOf('class="aln-seq" style="letter-spacing:.8px"') < 0);

// 5. the ruler is laid out through the same row structure, not a hard-coded offset
chk('ruler no longer uses a hard-coded pixel offset',
    !/\.aln-ruler\{[^}]*padding-left:98px/.test(html) && html.indexOf('margin-left:98px') < 0);

// 6. position labels are not truncated
chk('position labels are not sliced to two digits',
    html.indexOf("String(refPos).slice(-2)") < 0);

// 7. differences are findable: per-block badge and a summary line
chk('blocks containing a difference are badged', /aln-diffbadge/.test(html));
chk('an identity summary is emitted', /aln-summary/.test(html) && /identity over/.test(html));

// 8. substitutions are visually distinct from matches
chk('substituted bases carry an outline as well as a colour', /\.aln-seq \.s\{[^}]*outline:/.test(html));

// ── species-group note ────────────────────────────────────────────────────
// The same panel carried a caveat that said its point three times over, in alarm red,
// directly under the selector. A caveat that fills a third of the panel stops being read.
// The evidence tier and the numbers must stay visible; the reasoning may fold away, but it
// must still be there — this is the one place the tool admits the band is extrapolated.
const vmx = require('vm');
const { ctx: c2 } = require(path.join(__dirname, 'probe.js'));
vmx.runInContext(`
  globalThis.__cap = { style: {}, innerHTML: '' };
  document.getElementById = function (id) {
    return id === 'species-group-note' ? globalThis.__cap
      : { style: {}, innerHTML: '', value: '', classList: { add() {}, remove() {} } };
  };`, c2);
function noteFor(group, organism) {
  vmx.runInContext('_PPE_LAST_ORGANISM=' + JSON.stringify(organism) +
                   '; setSpeciesGroup(' + JSON.stringify(group) + ');', c2);
  const html = String(vmx.runInContext('globalThis.__cap.innerHTML', c2));
  const head = html.split('<details')[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const body = (html.split('<details')[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { html, head, body, headWords: head.split(' ').filter(Boolean).length };
}
const tomato = noteFor('rice_group', 'Solanum lycopersicum');
const rice   = noteFor('rice_group', 'Oryza sativa');
const wheat  = noteFor('triticeae_maize', 'Triticum aestivum');

chk('the always-visible note is one short line', tomato.headWords <= 18, tomato.headWords + ' words');
chk('it still names the evidence tier', /Extrapolated/.test(tomato.head), tomato.head.split('·')[0].trim());
chk('rice is labelled measured, not extrapolated', /Measured/.test(rice.head));
chk('wheat is labelled reported', /Reported/.test(wheat.head));
chk('the numbers stay visible', /16 .C NN/.test(tomato.head) && /30 .C Wallace/.test(tomato.head));
chk('the reasoning is retained behind a disclosure', /<details/.test(tomato.html) && tomato.body.length > 80);
chk('the extrapolation is still stated in full', /No published optimum exists/i.test(tomato.body));
chk('the 8 degree caveat survives', /8 .C on the Wallace scale/.test(tomato.body));
chk('the clade note appears once, not repeated',
    (tomato.body.match(/rice is a monocot/g) || []).length === 1);
chk('wheat carries no clade footnote', !/rice is a monocot/.test(wheat.body));


console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
