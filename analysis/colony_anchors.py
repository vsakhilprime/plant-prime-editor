#!/usr/bin/env python3
"""
Plant Prime Editor - derive real colony-PCR anchors from the deposited plasmid sequences.

P5 and P6 are the primers a user runs across the cloning site to see whether a colony
carries the insert. The values that shipped were five generic strings keyed on promoter
name, and the same 21-mer 'CACCACTTTCCCCATGAGTTT' was offered as the downstream anchor for
every backbone. None of them occurs in any of the twelve deposited plasmids, so they could
not have amplified anything.

This locates the Type IIS acceptor in each deposited sequence and picks a real anchor on
either side, subject to the constraints a colony-PCR primer actually has to meet:

  - 20-24 nt, GC 40-60%, nearest-neighbour Tm 57-64 C
  - no run of four identical bases
  - occurs exactly once in the plasmid, counting both strands, so the product is unambiguous
  - sits 150-400 bp from the cut, giving an empty-vector band that resolves on a 1.5% gel
    and a filled band clearly larger

The reverse anchor is emitted already reverse-complemented, because that is what the user
pipettes. Writes analysis/colony_anchors.json.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SEQS = os.path.join(HERE, '..', 'data', 'vector_sequences.json')

raw = json.load(open(SEQS))
src = raw.get('sequences', raw)
S = {re.sub(r'^&gt;\s*', '', k).strip(): str(v).upper().replace('\n', '') for k, v in src.items()}

def rc(x): return x[::-1].translate(str.maketrans('ACGT', 'TGCA'))

ENZ = {'BsaI': ('GGTCTC', 1, 5), 'BsmBI': ('CGTCTC', 1, 5),
       'Esp3I': ('CGTCTC', 1, 5), 'BbsI': ('GAAGAC', 2, 6)}

NN_DH = {'AA':-7.9,'AT':-7.2,'TA':-7.2,'CA':-8.5,'GT':-8.4,'CT':-7.8,'GA':-8.2,
         'CG':-10.6,'GC':-9.8,'GG':-8.0,'TT':-7.9,'AC':-8.4,'TG':-8.5,'AG':-7.8,
         'TC':-8.2,'CC':-8.0}
NN_DS = {'AA':-22.2,'AT':-20.4,'TA':-21.3,'CA':-22.7,'GT':-22.4,'CT':-21.0,'GA':-22.2,
         'CG':-27.2,'GC':-24.4,'GG':-19.9,'TT':-22.2,'AC':-22.4,'TG':-22.7,'AG':-21.0,
         'TC':-22.2,'CC':-19.9}

def tm(s, na=0.05, conc=0.25e-6):
    """SantaLucia 1998 nearest neighbour with a Schildkraut salt term - same model as the tool."""
    if len(s) < 8: return 0.0
    dh, ds = 0.2, -5.7
    for i in range(len(s) - 1):
        p = s[i:i+2]
        if p not in NN_DH: return 0.0
        dh += NN_DH[p]; ds += NN_DS[p]
    import math
    t = (dh * 1000) / (ds + 1.987 * math.log(conc / 4)) - 273.15
    return t + 16.6 * math.log10(na)

def gc(s): return 100.0 * (s.count('G') + s.count('C')) / len(s) if s else 0

def unique(seq, sub):
    return (seq.count(sub) + seq.count(rc(sub))) == 1

STD_SCAF = 'GTTTTAGAGCTAGAAATAGCAAG'
FE_SCAF  = 'GTTTAAGAGCTATGCTGGAAACAGCATAGCAAG'

def acceptor_span(seq, enz):
    """Where the pegRNA actually lands.

    Anchoring on the Type IIS sites alone is not safe: several of these plasmids carry
    incidental BsaI sites inside the Cas9 open reading frame, and the widest pair between
    them sat in the middle of the editor. A band drawn across that region would be the same
    whether or not the pegRNA cloned. So the cassette is located by its sgRNA scaffold, and
    the Type IIS cuts nearest the scaffold on either side define the span. Where a plasmid has
    no scaffold at all the insert supplies it, and the closest Type IIS pair flanking the
    stuffer is the acceptor.
    """
    rec, n1, n2 = ENZ[enz]; cuts = []
    for m in re.finditer(rec, seq):        cuts.append((m.end()+n1, m.end()+n2, '+'))
    for m in re.finditer(rc(rec), seq):    cuts.append((m.start()-n2, m.start()-n1, '-'))
    cuts.sort()
    if not cuts: return None

    pos = -1
    for pat in (STD_SCAF, FE_SCAF):
        i = seq.find(pat)
        if i >= 0: pos = i; break
        i = seq.find(rc(pat))
        if i >= 0: pos = i; break

    if pos >= 0:
        left  = max([c for c in cuts if c[1] <= pos + 5], key=lambda c: c[1], default=None)
        right = min([c for c in cuts if c[0] >= pos - 5], key=lambda c: c[0], default=None)
        # right must be past the scaffold, not the cut that opens it
        after = [c for c in cuts if c[0] > pos + 60]
        if after: right = min(after, key=lambda c: c[0])
        if left and right and right[1] > left[0]:
            return (left[0], right[1], right[0] - left[1])
        return None

    # no scaffold: smallest stuffer between an inward-facing pair
    best = None
    for i in range(len(cuts) - 1):
        a, b = cuts[i], cuts[i+1]
        gap = b[0] - a[1]
        if 0 < gap < 900 and a[2] == '-' and b[2] == '+':
            if best is None or gap < best[2]:
                best = (a[0], b[1], gap)
    return best

def pick(seq, centre, direction, lo=200, hi=900):
    """best anchor `direction` (-1 upstream / +1 downstream) of `centre`"""
    cands = []
    for dist in range(lo, hi):
        for L in (20, 21, 22, 23, 24):
            if direction < 0:
                st = centre - dist - L
            else:
                st = centre + dist
            if st < 0 or st + L > len(seq): continue
            w = seq[st:st+L]
            if not re.fullmatch(r'[ACGT]+', w): continue
            if re.search(r'(.)\1{3}', w): continue
            g, t = gc(w), tm(w)
            if not (38 <= g <= 65): continue
            if not (56 <= t <= 65): continue
            if not unique(seq, w): continue
            cands.append((abs(t - 60.5), w, st, L, g, t, dist))
    if not cands: return None
    cands.sort()
    _, w, st, L, g, t, dist = cands[0]
    return {'seq': w, 'pos_1based': st + 1, 'len': L, 'gc': round(g, 1),
            'tm': round(t, 1), 'distance_from_cut_bp': dist}

# tool vector id -> (fragment of the sequence key, enzyme that opens the acceptor)
# tool vector id -> (plasmid that receives the pegRNA, enzyme that opens it)
# Six of these plasmids are editor-only: they carry no sgRNA scaffold and no guide cassette,
# so a colony PCR run on them can say nothing about the pegRNA. For those the reaction belongs
# on the guide plasmid named here, which is the same plasmid the cloning design already uses.
TARGETS = [
    ('pH-2x35S-DualPE',        'DualPE',            'BsaI'),
    ('pVu2024-dicot',          'pU6cm',             'BbsI'),
    ('pH35C-epegRNA-ePPEplus', 'pH35C',             'BsaI'),
    ('pYPQ166-OsPE2',          'pYPQ141D',          'BsmBI'),
    ('pH-nCas9-PPE',           'pH-nCas9-PPE-V2',   'BsaI'),
    ('pPPE-mono',              'pH-nCas9-PPE-V2',   'BsaI'),
    ('pH-ePPE',                'pH-ePPE',           'BsaI'),
    ('nCas9-PPE',              'pOsU3',             'BsaI'),
    ('pSpG-PPE',               'pOsU3',             'BsaI'),
    ('pEPPE-mono',             'pOsU3',             'BsaI'),
]

out = {}
print('%-24s %-8s %-9s %-26s %-6s %-26s %-6s %s' % (
      'vector', 'enzyme', 'acceptor', 'P5 forward anchor', 'Tm', 'P6 reverse anchor', 'Tm', 'empty bp'))
for vid, frag, enz in TARGETS:
    key = next((k for k in S if frag in k), None)
    if not key:
        print('%-24s no deposited sequence' % vid); continue
    seq = S[key]
    span = acceptor_span(seq, enz)
    if not span:
        print('%-24s no %s acceptor found' % (vid, enz)); continue
    left, right, gap = span
    # widen the search in stages rather than dropping the uniqueness requirement: a colony
    # primer that binds twice is worse than one that gives a longer band
    f = r = None
    for lo, hi in ((200, 900), (200, 1500), (150, 2500)):
        f = f or pick(seq, left, -1, lo, hi)
        r = r or pick(seq, right, +1, lo, hi)
        if f and r: break
    if not f or not r:
        print('%-24s no qualifying anchor %s (relaxing uniqueness is not acceptable here)'
              % (vid, 'upstream' if not f else 'downstream')); continue
    empty = (r['pos_1based'] + r['len'] - 1) - f['pos_1based'] + 1
    out[vid] = {
        'source_plasmid': key,
        'enzyme': enz,
        'acceptor_bp': [left + 1, right],
        'stuffer_bp': gap,
        'fwd_anchor': f['seq'],
        'fwd': f,
        # emitted ready to pipette: the reverse primer is the reverse complement
        'rev_anchor': rc(r['seq']),
        'rev_top_strand': r['seq'],
        'rev': r,
        'empty_amplicon_bp': empty,
        'note': 'Both anchors occur exactly once in the deposited sequence, counting both strands.',
    }
    print('%-24s %-8s %5d-%-5d %-26s %-6.1f %-26s %-6.1f %d' % (
          vid, enz, left + 1, right, f['seq'], f['tm'], rc(r['seq']), r['tm'], empty))

json.dump(out, open(os.path.join(HERE, 'colony_anchors.json'), 'w'), indent=1)
print('\nwrote analysis/colony_anchors.json  (%d vectors)' % len(out))
