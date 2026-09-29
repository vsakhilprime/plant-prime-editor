// ─────────────────────────────────────────────────────────────────────────────
//  One target site, however many studies numbered it.
//
//  A target SITE is a protospacer in a genomic window. A LABEL is a name a study gave it.
//  In this deposit they are not one-to-one, in both directions:
//
//    * FOUR pairs of labels denote ONE protospacer, because two studies assayed the same
//      site and numbered it differently:
//          OsALS-T1 (Lin 2020) = OsALS-T2 (Lin 2021)
//          OsEPSPS-T1          = OsEPSPS-T2
//          OsAAT               = OsAAT-T1
//          OsGAPDH             = OsGAPDH-T1
//    * FIVE single labels denote TWO different protospacers:
//          OsCDC48-T3, OsEPSPS-T1, SlOr, SlCAB13, SlWH9
//
//  The earlier analysis/als_sites.json registered the first pair and nothing else. Counting
//  distinct labels therefore counted one site twice and two sites once, and the errors did
//  not always cancel: the 162-passing stage reported 33 sites against a true 35, the
//  141-scored stage 26 against 27, and the RT<->PBS weight sweep designed OsGAPDH twice
//  under two names, so Figure 2D drew 31 distinct designs in 32 rows.
//
//  siteOf(label) is kept for callers that genuinely have only a label, but it THROWS on the
//  five ambiguous ones rather than guessing — a label alone cannot identify those sites.
//  Anything iterating over rows should use siteOfRow(row) or siteOfSpacer(spacer).
//
//  The registry is generated from the data by analysis/build_target_sites.py, not
//  maintained by hand, and build_target_sites.py --check fails if it has drifted.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path');

let REG = null;
function load() {
  if (REG) return REG;
  const p = path.join(__dirname, '..', 'target_sites.json');
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error('analysis/target_sites.json is missing or unreadable (' + e.message +
      '). Regenerate it with: python3 analysis/build_target_sites.py');
  }
  const bySpacer = {};
  (raw.sites || []).forEach(s => { bySpacer[s.spacer] = s.id; });
  REG = {
    bySpacer,
    labelToSite: raw.label_to_site || {},
    ambiguous: raw.ambiguous_labels || {},
    sites: raw.sites || [],
  };
  return REG;
}

/** The site a LABEL denotes. Throws for a label that names more than one protospacer. */
function siteOf(label) {
  const r = load();
  const k = String(label == null ? '' : label).trim();
  if (r.ambiguous[k]) {
    throw new Error('"' + k + '" names ' + r.ambiguous[k].length + ' different protospacers (' +
      r.ambiguous[k].join(', ') + '), so a label alone cannot identify the site. ' +
      'Use siteOfRow(row) or siteOfSpacer(spacer).');
  }
  return r.labelToSite[k] || k;
}

/** The site a PROTOSPACER denotes. This is the safe key. */
function siteOfSpacer(spacer) {
  const r = load();
  const k = String(spacer == null ? '' : spacer).trim().toUpperCase();
  return r.bySpacer[k] || k;
}

/**
 * The site a benchmark ROW denotes, keyed on its protospacer and falling back to its label
 * only when the row carries no spacer column.
 *   siteOfRow(row)                      // object with published_spacer / spacer / locus
 *   siteOfRow(fields, name => index)    // a parsed CSV row plus its column resolver
 */
function siteOfRow(row, col) {
  const get = col ? (n => { const i = col(n); return i >= 0 ? row[i] : undefined; })
                  : (n => row[n]);
  const sp = get('published_spacer') || get('spacer');
  if (sp) return siteOfSpacer(sp);
  return siteOf(get('locus') || get('target_id') || get('target'));
}

/** How many distinct SITES a list of protospacers covers. */
function countSitesBySpacer(spacers) {
  return new Set(spacers.map(siteOfSpacer)).size;
}

/** How many distinct SITES a list of labels covers. Throws on an ambiguous label. */
function countSites(labels) {
  return new Set(labels.map(siteOf)).size;
}

/** Every label that denotes the same site as this one, including itself. */
function labelsOfSite(id) {
  const s = load().sites.find(x => x.id === id);
  return s ? s.labels.slice() : [id];
}

module.exports = { siteOf, siteOfSpacer, siteOfRow, countSites, countSitesBySpacer,
                   labelsOfSite, registry: load };
