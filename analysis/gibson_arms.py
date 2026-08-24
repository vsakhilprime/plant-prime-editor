#!/usr/bin/env python3
"""
Plant Prime Editor - derive homology arms for the exonuclease cloning routes.

A Gibson or ClonExpress arm has to match the linearised vector end exactly. The arms that
shipped were two generic 25-mers reused across four of the five promoter contexts and marked
"APPROXIMATE" in a comment, which is the same failure that made the colony anchors fictional:
they do not occur in the plasmids they claim to describe.

Two geometries occur, and they are not interchangeable.

  A. The Gao-laboratory route (Jin et al. 2023 Nat Protoc 18:831). The vector is opened with
     BsaI AND HindIII and the ~120 bp between them is discarded; the insert is joined by
     exonuclease one-step cloning. The arms therefore sit outside the BsaI cut on one side and
     outside the HindIII cut on the other. pOsU3 gives 115 bp between the two enzymes against
     the ~120 bp the protocol reports, which is what confirms the geometry is read correctly.

  B. A Type IIS acceptor used with Gibson instead of ligation. The vector is linearised by the
     Type IIS pair alone, so both arms abut those cuts.

Arms are 25 nt, taken immediately outside the cut, and each is required to occur exactly once
in the plasmid so the assembly cannot resolve in more than one way.

    python3 analysis/gibson_arms.py      ->  analysis/gibson_arms.json
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
raw = json.load(open(os.path.join(HERE, '..', 'data', 'vector_sequences.json')))
src = raw.get('sequences', raw)
S = {re.sub(r'^&gt;\s*', '', k).strip(): str(v).upper().replace('\n', '') for k, v in src.items()}

def rc(x): return x[::-1].translate(str.maketrans('ACGT', 'TGCA'))

ENZ = {'BsaI': ('GGTCTC', 1, 5), 'BsmBI': ('CGTCTC', 1, 5),
       'Esp3I': ('CGTCTC', 1, 5), 'BbsI': ('GAAGAC', 2, 6)}
ARM = 25

def typeIIS_cuts(seq, enz):
    rec, n1, n2 = ENZ[enz]; out = []
    for m in re.finditer(rec, seq):     out.append((m.end() + n1, m.end() + n2, '+'))
    for m in re.finditer(rc(rec), seq): out.append((m.start() - n2, m.start() - n1, '-'))
    return sorted(out)

def unique(seq, sub): return (seq.count(sub) + seq.count(rc(sub))) == 1

def arms_two_enzyme(seq, e_left, e_right):
    """acceptor opened by two different Type IIS enzymes, one per slot (pYPQ141D-peg)"""
    cl, cr = typeIIS_cuts(seq, e_left), typeIIS_cuts(seq, e_right)
    if not cl or not cr: return None
    left  = min(cl, key=lambda c: c[0])
    right = max([c for c in cr if c[0] > left[1] and c[0] - left[1] < 900], key=lambda c: c[1], default=None)
    if not right or right[1] - left[0] > 900: return None
    return (seq[left[0] - ARM:left[0]], seq[right[1]:right[1] + ARM],
            'TypeIIS %s + %s, %d bp excised' % (e_left, e_right, right[1] - left[0]), left[0], right[1])

def arms_typeIIS(seq, enz, scaffold_anchor=True):
    """Both ends from the Type IIS cluster that opens the cassette.

    The OUTERMOST cuts of the cluster are the backbone boundary. Taking the cuts nearest the
    scaffold instead left the recognition sequences on the arm, but those sit in the stuffer
    and are discarded with it, so the arm described sequence that is not in the linearised
    vector at all. A Gibson insert replaces everything between the outermost cuts, scaffold
    included, so the insert has to supply the scaffold.
    """
    cuts = typeIIS_cuts(seq, enz)
    if len(cuts) < 2: return None
    pos = -1
    for pat in ('GTTTTAGAGCTAGAAATAGCAAG', 'GTTTAAGAGCTATGCTGGAAACAGCATAGCAAG'):
        i = seq.find(pat)
        if i < 0: i = seq.find(rc(pat))
        if i >= 0: pos = i; break
    if pos < 0 or not scaffold_anchor:
        best = None
        for i in range(len(cuts) - 1):
            a, b = cuts[i], cuts[i + 1]
            gap = b[0] - a[1]
            if 0 < gap < 900 and a[2] == '-' and b[2] == '+':
                if best is None or gap < best[2]: best = (a, b, gap)
        if not best: return None
        pos = (best[0][1] + best[1][0]) // 2
    cluster = [c for c in cuts if abs(c[0] - pos) < 700]
    if len(cluster) < 2: return None
    left, right = min(cluster, key=lambda c: c[0]), max(cluster, key=lambda c: c[1])
    return (seq[left[0] - ARM:left[0]], seq[right[1]:right[1] + ARM],
            'TypeIIS %s, %d bp excised' % (enz, right[1] - left[0]), left[0], right[1])

def arms_bsaI_hindIII(seq):
    """Jin 2023: linearise with BsaI and HindIII, discard the ~120 bp between them"""
    bs = typeIIS_cuts(seq, 'BsaI')
    hd = [m.start() + 1 for m in re.finditer('AAGCTT', seq)]     # A^AGCTT, top cut after the first A
    if not bs or not hd: return None
    # BsaI may cut more than once inside the discarded region. The backbone boundary is the
    # LEFTMOST of those cuts, not the one nearest HindIII; taking the nearest one put the arm
    # inside the fragment that gets thrown away.
    best = None
    for h in hd:
        near = [b for b in bs if 0 < h - b[1] < 400]
        if not near: continue
        b = min(near, key=lambda c: c[0])
        d = h - b[1]
        if best is None or d < best[2]: best = (b, h, h - b[0])
    if not best: return None
    b, h, d = best
    return seq[b[0] - ARM:b[0]], seq[h:h + ARM], ('BsaI + HindIII, %d bp excised' % d), b[0], h

# tool vector id -> (plasmid the insert joins, route)
TARGETS = [
    ('nCas9-PPE',              'pOsU3',            'A'),
    ('pSpG-PPE',               'pOsU3',            'A'),
    ('pEPPE-mono',             'pOsU3',            'A'),
    ('pH-nCas9-PPE',           'pH-nCas9-PPE-V2',  'A'),
    ('pPPE-mono',              'pH-nCas9-PPE-V2',  'A'),
    ('pH-ePPE',                'pH-ePPE',          'A'),
    ('pH-2x35S-DualPE',        'DualPE',           'B-BsaI'),
    ('pVu2024-dicot',          'pU6cm',            'B-BbsI'),
    ('pH35C-epegRNA-ePPEplus', 'pH35C',            'B-BsaI-stuffer'),
    ('pYPQ166-OsPE2',          'pYPQ141D',         'C-BsmBI-BsaI'),
]

out = {}
print('%-24s %-24s %-30s %-27s %-27s' % ('vector', 'plasmid', 'linearised by', "5' arm", "3' arm"))
for vid, frag, route in TARGETS:
    key = next((k for k in S if frag in k), None)
    if not key: print('%-24s no sequence' % vid); continue
    seq = S[key]
    if route == 'A':
        got = arms_bsaI_hindIII(seq)
    elif route == 'B-BsaI-stuffer':
        got = arms_typeIIS(seq, 'BsaI', scaffold_anchor=False)
    elif route.startswith('C-'):
        _, el, er = route.split('-')
        got = arms_two_enzyme(seq, el, er)
    else:
        got = arms_typeIIS(seq, route.split('-')[1])
    if not got: print('%-24s could not resolve the linearised ends' % vid); continue
    a5, a3, how, p5, p3 = got
    if not (unique(seq, a5) and unique(seq, a3)):
        print('%-24s arm is not unique in the plasmid - rejected' % vid); continue
    # Whether the arm carries the recognition sequence depends on which way the sites face,
    # and both arrangements are legitimate. Sites pointing inward toward the stuffer leave the
    # recognition on the backbone, so the arm contains it and the assembled plasmid regenerates
    # a cut site; sites pointing outward take it away with the stuffer. This is recorded rather
    # than rejected, because it tells the user whether the finished construct can be re-cut.
    live = sorted({e for e, (rec, _, _) in ENZ.items()
                   if rec in a5 or rc(rec) in a5 or rec in a3 or rc(rec) in a3})
    out[vid] = {'plasmid': key.split(' Addgene')[0].split(' Whole')[0], 'linearised_by': how,
                'gibson_5arm': a5, 'gibson_3arm': a3,
                'arm_5_ends_at': p5, 'arm_3_starts_at': p3 + 1, 'arms_verified': True,
                'site_regenerated': live,
                'arm_note': ('The assembled plasmid regenerates a ' + '/'.join(live) + ' site: the '
                             'recognition sequence sits on the backbone side of the cut. Harmless for '
                             'an exonuclease assembly, but do not then attempt a Golden Gate on it.')
                            if live else
                            'Neither arm carries a Type IIS recognition sequence; the sites leave with the stuffer.'}
    print('%-24s %-24s %-30s %-27s %-27s' % (vid, out[vid]['plasmid'][:24], how[:30], a5, a3))

json.dump(out, open(os.path.join(HERE, 'gibson_arms.json'), 'w'), indent=1)
print('\nwrote analysis/gibson_arms.json  (%d vectors)' % len(out))
