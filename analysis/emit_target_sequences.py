#!/usr/bin/env python3
"""Emit, for each of the seven head-to-head targets, the genomic window with the published
edit located on the TOP STRAND, verified base by base against the sequence."""
import csv, os, sys, textwrap

RC = str.maketrans('ACGT', 'TGCA'); rc = lambda s: s.translate(RC)[::-1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = list(csv.DictReader(open(os.path.join(ROOT, 'data/benchmark_scored.csv'))))

USED = {'OsALS-T2 (Lin 2021)': 'GGGTATGGTGGTGCAATGGG',
        'OsEPSPS-T1':          'GCAGTCACGGCTGCTGTCAA',
        'OsCDC48-T2':          'GACCAGCCAGCGTCTGGCGC',
        'OsCDC48-T1':          'GCTAGCTTTGACATAATCTC',
        'OsAAT':               'CAAGGATCCCAGCCCCGTGA',
        'OsACC-T1':            'TTCCTCGTGCTGGACAAGTG',
        'TaGW2':               'CACAAGAAAATCCACCAGGA'}
ORDER = ['OsALS-T2 (Lin 2021)', 'OsEPSPS-T1', 'OsCDC48-T2', 'OsCDC48-T1',
         'OsAAT', 'OsACC-T1', 'TaGW2']
# the one edit Table 1 names, as the benchmark quotes it (minus-strand quotation kept)
TABLE1 = {'OsALS-T2 (Lin 2021)': ('SNP', 'G', 'T', 301),
          'OsEPSPS-T1':          ('SNP', 'G', 'A', 295),
          'OsCDC48-T2':          ('INS', '',  'AAA', 302),
          'OsCDC48-T1':          ('DEL', 'CTCCGG', '', 300),
          'OsAAT':               ('MNP', 'GA', 'CC', 302),
          'OsACC-T1':            ('SNP', 'G', 'C', 306),
          'TaGW2':               ('SNP', 'G', 'C', 300)}

rec = {}
for r in B:
    L = r['locus']
    if L not in USED or r['published_spacer'] != USED[L]:
        continue
    key = (r['edit_type'], r['edit_from'], r['edit_to'], int(r['edit_pos']))
    if key != TABLE1[L]:
        continue
    rec.setdefault(L, r)
missing = [L for L in ORDER if L not in rec]
if missing:
    sys.exit('no benchmark row for: %s' % missing)

fail = []
out, fasta, csvrows = [], [], []
out.append('Seven head-to-head targets: the published edit located on the top strand')
out.append('=' * 78)
out.append(textwrap.fill(
    'Each window is 600 nt of the published locus, given 5\'->3\' on the TOP (plus) strand. '
    'Positions are 1-based within the window. Where the source table quotes the edit on the '
    'minus strand, both forms are given; the top-strand form is the one to use for any '
    'coordinate arithmetic. Every base shown below was re-read from data/benchmark_scored.csv '
    'and checked against the sequence before printing.', 78))
out.append('')

for L in ORDER:
    r = rec[L]
    s = r['genomic_seq']
    typ, efrom, eto, pos = TABLE1[L]
    tfrom = r.get('edit_from_top') or efrom
    tto = r.get('edit_to_top') or eto
    minus = (r.get('edit_strand') or '+') == '-'

    # ── locate the edit on the top strand ────────────────────────────────────
    if typ == 'INS':
        start = pos          # 1-based base the insertion sits BEFORE
        end = pos - 1        # empty span
        span = '%d/%d (between)' % (pos - 1, pos)
        i0, i1 = pos - 1, pos - 1
    else:
        # edit_pos is 1-based; for a minus-strand span it is the top-strand END
        if minus and len(tfrom) > 1:
            end = pos; start = pos - len(tfrom) + 1
        else:
            start = pos; end = pos + len(tfrom) - 1
        i0, i1 = start - 1, end
        span = '%d' % start if start == end else '%d-%d' % (start, end)
        got = s[i0:i1]
        if got != tfrom:
            fail.append('%s: top-strand %s at %s reads %r, expected %r' % (L, typ, span, got, tfrom))

    # ── locate the spacer ────────────────────────────────────────────────────
    sp = USED[L]
    plus = s.find(sp)
    minus_off = rc(s).find(sp)
    if plus >= 0 and minus_off < 0:
        strand, pstart, pend = '+', plus + 1, plus + 20
        pam = s[plus + 20:plus + 23]
        nick_l, nick_r = plus + 17, plus + 18       # 1-based, nick between them
        reach = (start if typ != 'INS' else pos) > nick_l
    elif minus_off >= 0:
        m = minus_off
        strand = '-'
        pstart, pend = len(s) - m - 19, len(s) - m   # 1-based top-strand span
        pam = rc(s)[m + 20:m + 23]
        nick_l = len(s) - m - 17
        nick_r = nick_l + 1
        reach = (end if typ != 'INS' else pos - 1) <= nick_l
    else:
        fail.append('%s: spacer not in the window' % L); continue
    if pam[1:] != 'GG':
        fail.append('%s: PAM %r is not NGG' % (L, pam))
    if not reach:
        fail.append('%s: the edit is not 3\' of the nick' % L)

    # ── product sequence ─────────────────────────────────────────────────────
    if typ == 'INS':
        prod = s[:pos - 1] + tto + s[pos - 1:]
    else:
        prod = s[:i0] + tto + s[i1:]
    # The product must be exactly what the engine's own RT template encodes. rt_seq is the
    # template, so it is the reverse complement of the newly synthesised strand, read off the
    # PRODUCT immediately 3' of the nick along that strand. Checking only that rt_seq is
    # "somewhere in the product" is too weak: it passes an insertion placed one base off, and
    # for a deletion abutting the nick the template is also present in the reference.
    rt = r.get('rt_seq') or ''
    if rt:
        delta = len(prod) - len(s)
        if strand == '+':                      # top strand nicked, synthesis runs upward
            seg = prod[nick_l:nick_l + len(rt)]
            want = rc(seg)
        else:                                  # bottom strand nicked, synthesis runs downward
            k = nick_l + delta
            seg = prod[k - len(rt):k]
            want = seg
        if want != rt:
            fail.append('%s: the RT template the engine recorded is %r, but this product '
                        'gives %r' % (L, rt, want))
        n_used = int(r['rt_len_used']) if r.get('rt_len_used') else None
        if n_used is not None and len(rt) - n_used != len(tto) - len(tfrom):
            fail.append('%s: len(rt_seq) - rt_len_used = %+d, edit changes length by %+d'
                        % (L, len(rt) - n_used, len(tto) - len(tfrom)))

    dl = len(prod) - len(s)
    want_dl = len(tto) - len(tfrom)
    if dl != want_dl:
        fail.append('%s: product length change %+d, expected %+d' % (L, dl, want_dl))

    # ── context view ─────────────────────────────────────────────────────────
    lo = max(0, min(i0, pstart - 1) - 12)
    hi = min(len(s), max(i1, pend, nick_r) + 12)
    ctx = s[lo:hi]
    mark = [' '] * len(ctx)
    for j in range(pstart - 1, pend):
        mark[j - lo] = '-'
    mark[(pend - 1 if strand == '+' else pstart - 1) - lo] = '>' if strand == '+' else '<'
    nk = [' '] * len(ctx)
    nk[nick_l - lo] = '/'
    ed = [' '] * len(ctx)
    if typ == 'INS':
        ed[pos - 1 - lo] = '^'
    else:
        for j in range(i0, i1):
            ed[j - lo] = '*'

    out.append('-' * 78)
    out.append('%s   %s, %s   [%s]' % (L, r['species'], r['study'], r['id']))
    out.append('-' * 78)
    out.append('  protospacer  %s  %s  PAM %s   top-strand %d-%d (%s strand)'
               % (sp, '' if strand == '+' else 'on the minus strand', pam, pstart, pend, strand))
    out.append('  nick         between top-strand %d and %d%s'
               % (nick_l, nick_r, '' if strand == '+' else ' (the bottom strand is nicked)'))
    if typ == 'INS':
        out.append('  edit         insert %s (%d nt) BEFORE top-strand base %d'
                   % (tto, len(tto), pos))
    elif typ == 'DEL':
        out.append('  edit         delete %s (%d nt) at top-strand %s' % (tfrom, len(tfrom), span))
    else:
        out.append('  edit         %s>%s at top-strand %s' % (tfrom, tto, span))
    if minus:
        out.append('  as published the source table quotes this on the MINUS strand as %s'
                   % (('%s>%s' % (efrom, eto)) if typ != 'DEL' else ('%s deletion' % efrom)))
    out.append('  efficiency   %s' % (r.get('measured_efficiency') or 'n.r.'))
    out.append('')
    out.append('  window %d-%d' % (lo + 1, hi))
    out.append('    ref  %s' % ctx)
    out.append('         %s   edit' % ''.join(ed))
    out.append('         %s   nick' % ''.join(nk))
    out.append('         %s   protospacer (%s)' % (''.join(mark), strand))
    if typ == 'INS':
        pctx = prod[lo:hi + len(tto)]
    else:
        pctx = prod[lo:hi + len(tto) - len(tfrom)]
    out.append('    edited %s' % pctx)
    out.append('')
    out.append('  full 600 nt window, top strand:')
    for k in range(0, len(s), 60):
        out.append('    %3d  %s' % (k + 1, s[k:k + 60]))
    out.append('')

    fasta.append('>%s|%s|%s|spacer=%s|PAM=%s|top_strand_%d-%d|nick_%d/%d|edit=%s'
                 % (L.replace(' ', '_'), r['species'].replace(' ', '_'), r['study'].replace(' ', '_'),
                    sp, pam, pstart, pend, nick_l, nick_r,
                    ('ins_%s_before_%d' % (tto, pos)) if typ == 'INS'
                    else ('del_%s_%s' % (tfrom, span)) if typ == 'DEL'
                    else ('%s%s>%s' % (span, tfrom, tto))))
    for k in range(0, len(s), 60):
        fasta.append(s[k:k + 60])
    csvrows.append(dict(
        locus=L, species=r['species'], study=r['study'], benchmark_id=r['id'],
        spacer=sp, pam=pam, spacer_strand=strand,
        spacer_top_start=pstart, spacer_top_end=pend,
        nick_between_top=('%d/%d' % (nick_l, nick_r)),
        edit_type=typ, edit_top_from=tfrom, edit_top_to=tto, edit_top_span=span,
        edit_published_quotation=('%s>%s on the %s strand'
                                  % (efrom or '-', eto or '-', '-' if minus else '+')),
        measured_efficiency=r.get('measured_efficiency', ''),
        genomic_seq_600nt=s))

D = os.environ.get('PPE_SEQ_OUT', '.')
os.makedirs(D, exist_ok=True)
open(os.path.join(D, 'Seven_targets_published_edits.txt'), 'w').write('\n'.join(out) + '\n')
open(os.path.join(D, 'Seven_targets_windows.fasta'), 'w').write('\n'.join(fasta) + '\n')
with open(os.path.join(D, 'Seven_targets_published_edits.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(csvrows[0]))
    w.writeheader(); w.writerows(csvrows)

for f in fail:
    print('  FAIL  ' + f)
print('  %s 7 targets, %d checks failed' % ('ok  ' if not fail else 'FAIL', len(fail)))
sys.exit(1 if fail else 0)
