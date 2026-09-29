#!/usr/bin/env python3
"""
Is every design in Table 1 built on the published edit? Check it, target by target.

Table 1 and the Figure 5 legend both claim the seven tools were given "the same seven
sequences and the same seven edits". That is the claim on which the whole comparison rests:
if two tools designed for different edits, their primer-binding-site lengths are not
comparable. Nothing in the deposit checked it, and data/tool_comparison.csv — the file
Table 1 is built from — has NO EDIT COLUMN. Its columns are target, tool, spacer,
pbs_length_nt, pbs_tm_wallace_C, pbs_tm_nn_C, rt_length_nt, notes. The reverse-transcriptase
template length, the one field that would constrain which edit a tool was designing for, is
blank on all but the four PlantPegDesigner rows.

So the claim cannot be verified directly. What CAN be checked, and is checked here:

  1  every edit Table 1 names is a published edit the benchmark records at that target;
  2  where a target carries more than one published edit AT THE PROTOSPACER the comparison
     uses, the edit Table 1 names is not self-identifying on its own. Two of the seven do:
     OsCDC48-T1 with 16 and OsCDC48-T2 with 7. Counting by label made it three, by pooling
     the two protospacers the label OsEPSPS-T1 covers;
  3  every tool's spacer locates in that target's genomic window, allowing for the two
     conventions competitors use (a 23 nt protospacer+PAM string, and a 5' G substituted for
     Pol III transcription);
  4  the named edit lies 3' of the nick that spacer implies, so the design could encode it.

A row that fails 3 or 4 is a design that cannot have been built on the stated edit, or a
value that cannot be traced. Those are listed individually.

    python3 analysis/check_headtohead_edits.py [--docx PATH]
Exit status 1 if any row cannot be verified.
"""
import argparse, csv, json, os, sys

ap = argparse.ArgumentParser()
ap.add_argument('--docx', default=None)
a = ap.parse_args()

# The submitted manuscript is not part of the code deposit. This follows the same convention as
# the seven other document-dependent checkers: PPE_DOCS names the folder holding it.
if a.docx is None:
    _d = os.environ.get('PPE_DOCS')
    _names = ('final_manuscript_28-09-2026.docx', 'Manuscript_PlantPrimeEditor.docx')
    a.docx = next((os.path.join(_d, n) for n in _names
                   if _d and os.path.exists(os.path.join(_d, n))),
                  os.path.join(_d, _names[0]) if _d else _names[0])
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.need_documents import require as _require
_require([a.docx], 'check_headtohead_edits.py', flag='--docx')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
C = lambda p: list(csv.DictReader(open(os.path.join(ROOT, p), newline='', encoding='utf-8-sig')))
RC = str.maketrans('ACGT', 'TGCA')
rc = lambda s: s.translate(RC)[::-1]

BENCH = C('data/benchmark_scored.csv')
TOOLS = C('data/tool_comparison.csv')
ALL = json.load(open(os.path.join(ROOT, 'data', 'all_tools.json')))

# The published edits AT THE PROTOSPACER the head-to-head uses, not at the label.
#
# Counted by label this reported three of the seven targets as carrying several published
# edits. Two do. The third, OsEPSPS-T1, is the label collision again: that one label names
# TWO protospacers — GCAGTCACGGCTGCTGTCAA, which is the one every tool designed at, carrying
# a single published edit (G>A at 295), and TACTAAATATACAATCCCTT, a different site carrying
# T>A at 302. Counting the label pooled the two and invented an ambiguity the comparison
# does not have.
USED_SPACER = {
    'OsALS-T2 (Lin 2021)': 'GGGTATGGTGGTGCAATGGG',
    'OsEPSPS-T1':          'GCAGTCACGGCTGCTGTCAA',
    'OsCDC48-T2':          'GACCAGCCAGCGTCTGGCGC',
    'OsCDC48-T1':          'GCTAGCTTTGACATAATCTC',
    'OsAAT':               'CAAGGATCCCAGCCCCGTGA',
    'OsACC-T1':            'TTCCTCGTGCTGGACAAGTG',
    'TaGW2':               'CACAAGAAAATCCACCAGGA',
}
WIN, PUB, PUB_LABEL = {}, {}, {}
for r in BENCH:
    WIN.setdefault(r['locus'], r['genomic_seq'])
    e = (r['edit_type'], r['edit_from'], r['edit_to'], int(r['edit_pos']))
    PUB_LABEL.setdefault(r['locus'], set()).add(e)
    if r['published_spacer'] == USED_SPACER.get(r['locus']):
        PUB.setdefault(r['locus'], set()).add(e)

# How Table 1 words each edit, and the benchmark row it must correspond to.
#
# The four-tuple is the row's OWN quotation, which for three of the seven is on the MINUS
# strand: the source tables quote OsEPSPS-T1 as G>A, OsCDC48-T1 as a CTCCGG deletion and
# TaGW2 as G>C, while on the top strand those are C>T at 295, a CCGGAG deletion at 295-300
# and C>G at 300. edit_pos is the top-strand END of a minus-strand span, not its start, so
# "CTCCGG at 300" applied to the top strand deletes GATTAT — six entirely different bases.
# TOP_STRAND below is what the edit column of data/tool_comparison.csv now states, and every
# span in it is verified against the sequence before use.
TABLE1 = {
    'OsALS-T2 (Lin 2021)': ('G>T substitution',   ('SNP', 'G', 'T', 301)),
    'OsEPSPS-T1':          ('G>A substitution',   ('SNP', 'G', 'A', 295)),
    'OsCDC48-T2':          ('3 nt insertion',     ('INS', '', 'AAA', 302)),
    'OsCDC48-T1':          ('6 nt deletion',      ('DEL', 'CTCCGG', '', 300)),
    'OsAAT':               ('GA>CC substitution', ('MNP', 'GA', 'CC', 302)),
    'OsACC-T1':            ('G>C substitution',   ('SNP', 'G', 'C', 306)),
    'TaGW2':               ('G>C substitution',   ('SNP', 'G', 'C', 300)),
}

# (type, top-strand ref bases, alt bases, 1-based start on the top strand)
TOP_STRAND = {
    'OsALS-T2 (Lin 2021)': ('SNP', 'G', 'T', 301),
    'OsEPSPS-T1':          ('SNP', 'C', 'T', 295),
    'OsCDC48-T2':          ('INS', '', 'AAA', 302),
    'OsCDC48-T1':          ('DEL', 'CCGGAG', '', 295),
    'OsAAT':               ('MNP', 'GA', 'CC', 302),
    'OsACC-T1':            ('SNP', 'G', 'C', 306),
    'TaGW2':               ('SNP', 'C', 'G', 300),
}

OK, BAD, NOTE = [], [], []


def locate(win, spacer):
    """(strand, start, how) for a competitor's spacer string, or None.

    Two conventions have to be allowed for, and neither is recorded in the deposit:
    PlantPegDesigner reports a 23 nt protospacer+PAM in mixed case, and PRIDICT substitutes a
    5' G for Pol III transcription. Both are standard; matching only the literal 20-mer
    reported seven rows as missing that are simply written differently.
    """
    s = spacer.upper().replace(' ', '')
    tries = [(s, 'as reported')]
    for k in range(0, max(0, len(s) - 19)):
        tries.append((s[k:k + 20], 'offset %d of a %d nt string' % (k, len(s))))
    if len(s) >= 20:
        tries.append((s[1:], "5' G dropped (Pol III convention)"))
        for b in 'ACGT':
            tries.append((b + s[1:], "5' base %s->G (Pol III convention)" % b))
    for cand, how in tries:
        if len(cand) < 19:
            continue
        for strand, seq in (('+', win), ('-', rc(win))):
            i = seq.find(cand)
            if i >= 0:
                return strand, i, len(cand), how
    return None


print('Table 1 — is every design built on the published edit?\n')
print('1. The edit Table 1 names, against the benchmark')
for t, (worded, key) in TABLE1.items():
    have = key in PUB.get(t, set())
    (OK if have else BAD).append(('%s: %r is a published edit' % (t, worded), have))
    n, nl = len(PUB.get(t, ())), len(PUB_LABEL.get(t, ()))
    print('   %-22s %-20s %s   (%d published edit%s at this protospacer%s)'
          % (t, worded, 'found' if have else 'NOT IN THE BENCHMARK', n, '' if n == 1 else 's',
             '' if n == nl else '; %d under the label, which covers two sites' % nl))
    if n > 1:
        NOTE.append('%s carries %d published edits at the protospacer the comparison uses; '
                    'Table 1 names one and the edit column now records which' % (t, n))

print('\n2. The top-strand coordinates, checked against the sequence')
for t, (ty, ft, tt, lo) in TOP_STRAND.items():
    g = WIN[t]
    good = True if ty == 'INS' else (g[lo - 1:lo - 1 + len(ft)] == ft)
    print('   %-22s %-4s %-8s at %d%s   %s'
          % (t, ty, ft or '(none)', lo,
             '-%d' % (lo + len(ft) - 1) if len(ft) > 1 else '',
             'matches the sequence' if good else 'DOES NOT MATCH THE SEQUENCE'))
    OK.append((t + ' top-strand span', good)) if good else \
        BAD.append(('%s: the top-strand span does not match the sequence' % t, False))

print('\n3. Every tool\'s spacer, and whether the named edit is reachable from it')
print('   %-22s %-19s %-9s %-7s %s' % ('target', 'tool', 'located', 'nick', 'edit 3\' of the nick'))
for r in TOOLS:
    t, tool = r['target'], r['tool']
    if t not in WIN:
        BAD.append(('%s/%s: no genomic window' % (t, tool), False)); continue
    loc = locate(WIN[t], r['spacer'])
    if not loc:
        # How far off is it? A string one or two bases from a window substring is a
        # transcription slip; one that matches nothing is a design at another site.
        u = r['spacer'].upper()
        best = min(((sum(1 for x, y in zip(u, seq[i:i + len(u)]) if x != y), st, i)
                    for st, seq in (('+', WIN[t]), ('-', rc(WIN[t])))
                    for i in range(len(seq) - len(u) + 1)), default=(99, '?', 0))
        print('   %-22s %-19s %s (closest window match %s%d, %d mismatch%s)'
              % (t, tool, 'NOT FOUND', best[1], best[2], best[0],
                 '' if best[0] == 1 else 'es'))
        BAD.append(('%s/%s: the reported spacer is not in the window; the closest substring '
                    'differs by %d base%s' % (t, tool, best[0], '' if best[0] == 1 else 's'),
                    False))
        continue
    strand, i, L, how = loc
    # The nick sits 3 nt inside the PROTOSPACER's PAM-proximal end, so it is i + 17 for a
    # 20 nt protospacer however long the reported string is. Using the matched length put the
    # nick three bases too far into a 23 nt protospacer+PAM string and reported
    # OsCDC48-T2/PlantPegDesigner as unable to encode an edit it reaches comfortably.
    nick = i + 17 if strand == '+' else i + 3
    pos0 = TOP_STRAND[t][3] - 1
    ep = pos0 if strand == '+' else len(WIN[t]) - 1 - pos0
    reach = ep >= nick
    print('   %-22s %-19s %s%-8d %-7d %s%s'
          % (t, tool, strand, i, nick, 'yes' if reach else 'NO',
             '' if how == 'as reported' else '   [%s]' % how))
    OK.append(('%s/%s reaches the edit' % (t, tool), reach)) if reach else \
        BAD.append(('%s/%s: the named edit is 5\' of the nick, so this design cannot '
                    'encode it' % (t, tool), False))

print('\n4. PlantPegDesigner\'s own output marks the edit it was given')
# PlantPegDesigner returns the protospacer in lower case and CAPITALISES the edited base(s).
# That capitalisation is an independent record of the edit submitted — the only one anywhere
# in the deposit — and it is exact at all seven targets, including the insertion, which has
# no reference base to capitalise and correspondingly carries no capitals.
ppd_ok = 0
for r in TOOLS:
    if r['tool'] != 'PlantPegDesigner':
        continue
    caps = ''.join(c for c in r['spacer'] if c.isupper())
    ty, fr, to, _ = TABLE1[r['target']][1]
    good = (caps == fr) or (fr and caps == rc(fr)) or (ty == 'INS' and caps == '')
    ppd_ok += bool(good)
    print('   %-22s %-24s caps %-8s vs published %s %s>%s   %s'
          % (r['target'], r['spacer'], caps or '(none)', ty, fr or '-', to or '-',
             'matches' if good else 'DOES NOT MATCH'))
    if not good:
        BAD.append(('%s/PlantPegDesigner: the capitalised bases %r are not the published '
                    'edit' % (r['target'], caps), False))
print('   -> %d of 7 mark exactly the published edited base(s)' % ppd_ok)
OK.append(('PlantPegDesigner capitalisation matches the published edit at all seven',
           ppd_ok == 7))

print('\n5. What the deposit records about the edit each tool was given')
cols = list(TOOLS[0].keys())
print('   data/tool_comparison.csv columns: %s' % ', '.join(cols))
print('   an edit column: %s' % ('yes' if any('edit' in c.lower() for c in cols) else 'NO'))
blank = sum(1 for r in TOOLS if not r['rt_length_nt'].strip())
print('   rt_length_nt blank on %d of %d rows' % (blank, len(TOOLS)))
print('   the only statement that the edits were the same: all_tools.json _provenance —')
print('     %r' % ALL['_provenance']['note'])
if not any('edit' in c.lower() for c in cols):
    NOTE.append('tool_comparison.csv records no edit per row, and rt_length_nt — the only '
                'field that would constrain it — is blank on %d of %d rows' % (blank, len(TOOLS)))
else:
    # The column exists now; it must say the same thing as Table 1 and the benchmark.
    mism = []
    for r in TOOLS:
        ty, ft, tt, lo = TOP_STRAND[r['target']]
        if ty == 'INS':
            # "before", not "after": reconstructing rt_seq from the engine's own output
            # reproduces it only when the insertion goes BEFORE the base at edit_pos
            # (11 of the 17 INS rows in the benchmark reproduce exactly; none do under
            # the other reading). "after 302" would place it one base too far.
            want = 'INS %d nt %s before top-strand %d' % (len(tt), tt, lo)
        elif ty == 'DEL':
            want = 'DEL %d nt %s at top-strand %d-%d' % (len(ft), ft, lo, lo + len(ft) - 1)
        else:
            span = '%d' % lo if len(ft) == 1 else '%d-%d' % (lo, lo + len(ft) - 1)
            want = '%s %s>%s at top-strand %s' % (ty, ft, tt, span)
        src = TABLE1[r['target']][1]
        if src[1] != ft or src[2] != tt:
            want += ' (the source table quotes %s>%s on the minus strand)' % (src[1] or '-',
                                                                              src[2] or '-')
        if r['edit'] != want:
            mism.append('%s/%s: %r vs %r' % (r['target'], r['tool'], r['edit'], want))
    OK.append(('the edit column agrees with the benchmark on all %d rows' % len(TOOLS),
               not mism))
    for m in mism:
        BAD.append(('edit column disagrees with the benchmark — ' + m, False))
    print('   the edit column agrees with the benchmark on %d of %d rows'
          % (len(TOOLS) - len(mism), len(TOOLS)))

fails = [d for d, ok in BAD if not ok] if BAD and isinstance(BAD[0], tuple) else []
print('\n%d row(s) verified, %d could not be' % (len(OK), len(BAD)))
for d, _ in BAD:
    print('  CANNOT VERIFY  ' + d)
print()
for n in NOTE:
    print('  PROVENANCE GAP  ' + n)
sys.exit(1 if BAD else 0)
