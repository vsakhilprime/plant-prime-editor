#!/usr/bin/env python3
"""
Generate analysis/target_sites.json — the registry of distinct target SITES.

A target site is a protospacer in a genomic window. A label is a name a study gave it.
They are not one-to-one in this deposit:

  * four pairs of labels denote ONE protospacer, because two studies assayed the same site
    and numbered it differently — OsALS-T1 (Lin 2020) / OsALS-T2 (Lin 2021),
    OsEPSPS-T1 / OsEPSPS-T2, OsAAT / OsAAT-T1, OsGAPDH / OsGAPDH-T1;
  * five single labels denote TWO different protospacers — OsCDC48-T3, OsEPSPS-T1, SlOr,
    SlCAB13, SlWH9.

analysis/als_sites.json registered the first of the four pairs and nothing else, so anything
counting "sites" by label was wrong at two of the three cascade stages, and the RT<->PBS
weight sweep designed one site twice under two names (Figure 2D).

This script keys on the protospacer instead and writes the result out, so the identity is
derived from the data rather than maintained by hand. It refuses to write if the assumption
the whole scheme rests on fails — that a protospacer occupies exactly one genomic window.

    python3 analysis/build_target_sites.py [--check]
--check compares against the committed registry and exits 1 on any difference.
"""
import argparse, collections, csv, datetime, hashlib, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--check', action='store_true')
a = ap.parse_args()

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'target_sites.json')
C = lambda p: list(csv.DictReader(open(os.path.join(ROOT, p), newline='', encoding='utf-8-sig')))
win = lambda s: hashlib.md5(s.encode()).hexdigest()[:10]

# Every deposited file that names a target and carries its protospacer.
#
# Rows that did not pass the parse are excluded. A row whose spacer could not be located in
# the retrieved sequence (NOT FOUND) or that disagreed with it (MISMATCH) contributes no
# usable site, and counting those inflated the registry from 35 sites to 68 — including a
# second, spurious "OsAAT" that made a clean label look ambiguous.
SOURCES = [
    ('data/targets_verified.csv',  'target_id', 'spacer',           'genomic_seq', 'study', 'status'),
    ('data/benchmark_scored.csv',  'locus',     'published_spacer', 'genomic_seq', 'study', 'status'),
    ('data/CaseStudy_Targets.csv', 'target_id', 'published_spacer', None,          'source', None),
]

rows = []
for path, lab, sp, gs, study, status in SOURCES:
    for r in C(path):
        if not r.get(sp): continue
        if status and not str(r.get(status, '')).startswith('OK'): continue
        rows.append(dict(label=r[lab].strip(), spacer=r[sp].strip(),
                         species=r.get('species', '').strip(),
                         gene=r.get('gene', '').strip(),
                         pam=r.get('pam', '').strip(),
                         window=win(r[gs]) if gs and r.get(gs) else None,
                         study=r.get(study, '').strip(), file=os.path.basename(path)))

SPN = {'rice': 'Oryza sativa', 'wheat': 'Triticum aestivum', 'tomato': 'Solanum lycopersicum'}
for r in rows: r['species'] = SPN.get(r['species'], r['species'])

# ── the two assumptions everything else rests on ─────────────────────────────────
# The key is the protospacer ALONE, not species + protospacer: targets_verified.csv carries
# no species column, so keying on the pair silently split every site that appears in both
# that file and the benchmark, giving 60 sites where there are 35. A 20-mer shared between
# two species would break that, so it is checked rather than assumed.
byspacer = collections.defaultdict(set)
species_of = collections.defaultdict(set)
for r in rows:
    if r['window']: byspacer[r['spacer']].add(r['window'])
    if r['species']: species_of[r['spacer']].add(r['species'])
bad_window = {k: sorted(v) for k, v in byspacer.items() if len(v) > 1}
bad_species = {k: sorted(v) for k, v in species_of.items() if len(v) > 1}
if bad_window or bad_species:
    print('REFUSING TO WRITE: the protospacer is not a safe key for site identity.',
          file=sys.stderr)
    for k, v in bad_window.items():
        print('   %s occupies %d genomic windows: %s' % (k, len(v), v), file=sys.stderr)
    for k, v in bad_species.items():
        print('   %s is assigned to %d species: %s' % (k, len(v), v), file=sys.stderr)
    sys.exit(2)

# ── group rows into sites ────────────────────────────────────────────────────────
def gene_of(rs):
    named = [r['gene'] for r in rs if r['gene']]
    if named: return collections.Counter(named).most_common(1)[0][0]
    s = sorted(rs, key=lambda r: r['label'])[0]['label'].split(' (')[0]
    return s[:-3] if s[-3:] in ('-T1', '-T2', '-T3') else s

groups = collections.defaultdict(list)
for r in rows: groups[r['spacer']].append(r)

# The representative label of a site is the label that names it most often, ties broken
# alphabetically so the id does not depend on row order. Two DIFFERENT sites can pick the
# same representative, because five labels name two protospacers each — an id that is only
# a label is therefore not unique, and the first version of this script silently collapsed
# those pairs back together, hiding four of the five ambiguous labels. Colliding ids get a
# site letter, assigned by protospacer so it is stable.
rep_of, claim = {}, collections.defaultdict(list)
for spacer, rs in groups.items():
    labels = sorted({r['label'] for r in rs})
    freq = collections.Counter(r['label'] for r in rs)
    rep_of[spacer] = sorted(labels, key=lambda l: (-freq[l], l))[0]
    claim[rep_of[spacer]].append(spacer)
for lab, sps in claim.items():
    if len(sps) < 2: continue
    for i, sp in enumerate(sorted(sps)):
        rep_of[sp] = '%s (site %s)' % (lab, chr(ord('A') + i))

sites, label_sites = [], collections.defaultdict(set)
for spacer, rs in groups.items():
    species = next((r['species'] for r in rs if r['species']), '')
    labels = sorted({r['label'] for r in rs})
    rep = rep_of[spacer]
    gene = gene_of(rs)
    sites.append(dict(
        id=rep, gene=gene, species=species, spacer=spacer,
        pam=next((r['pam'] for r in rs if r['pam']), ''),
        window=next((r['window'] for r in rs if r['window']), None),
        labels=labels,
        studies=sorted({r['study'] for r in rs if r['study']}),
        seen_in=sorted({r['file'] for r in rs})))
    for l in labels: label_sites[l].add(rep)

sites.sort(key=lambda s: (s['species'], s['gene'], s['id']))

assert len({s['id'] for s in sites}) == len(sites), 'site ids are not unique'
aliases = {s['id']: [l for l in s['labels'] if l != s['id']] for s in sites if len(s['labels']) > 1}
split = {l: sorted(v) for l, v in label_sites.items() if len(v) > 1}
label_to_site = {l: sorted(v)[0] for l, v in label_sites.items() if len(v) == 1}

reg = {
 '_why': 'A target site is a protospacer in a genomic window; a label is a name a study gave '
         'it. They are not one-to-one. Key on the site, display the label. Labels listed under '
         '"ambiguous_labels" name two different protospacers and CANNOT be resolved without the '
         'row: use siteOfRow/siteOfSpacer, not siteOf.',
 'generated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
 'generated_by': 'analysis/build_target_sites.py',
 'keyed_on': 'protospacer; verified that every protospacer occupies exactly one genomic '
             'window and is assigned to at most one species across every deposited file '
             'that names one',
 'supersedes': 'analysis/als_sites.json, which registered the OsALS pair and no other',
 'n_sites': len(sites),
 'n_labels': len(label_sites),
 'aliases': aliases,
 'ambiguous_labels': split,
 'label_to_site': label_to_site,
 'sites': sites,
}

if a.check:
    if not os.path.exists(OUT):
        print('FAIL registry absent: %s' % OUT); sys.exit(1)
    have = json.load(open(OUT))
    drop = lambda d: {k: v for k, v in d.items() if k != 'generated'}
    if drop(have) != drop(reg):
        print('FAIL the committed registry does not match the data it is derived from')
        for k in sorted(set(drop(have)) | set(drop(reg))):
            if have.get(k) != reg.get(k): print('   differs: %s' % k)
        sys.exit(1)
    print('ok   target_sites.json matches the data (%d sites, %d labels)'
          % (reg['n_sites'], reg['n_labels']))
    sys.exit(0)

json.dump(reg, open(OUT, 'w'), indent=2)
print('wrote %s' % OUT)
print('  distinct sites            : %d' % len(sites))
print('  distinct labels           : %d' % len(label_sites))
print('  sites carrying >1 label   : %d' % len(aliases))
for k, v in sorted(aliases.items()): print('      %-22s also called %s' % (k, ', '.join(v)))
print('  labels naming >1 site     : %d' % len(split))
for k, v in sorted(split.items()): print('      %-22s -> %s' % (k, ', '.join(v)))
