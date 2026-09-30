#!/usr/bin/env python3
"""
check_vector_claims.py

The vector catalogue makes claims a reader will act on with money: an Addgene
number they will order from, a promoter and a selection marker they will plan a
transformation around. Until the 25 September 2026 audit nothing compared those
claims with anything, and four entries that are not deposited plasmids at all
were counted in the paper's vector total.

This does not re-check the literature — that needs the web. It enforces the
structural invariants that let a reader tell a deposited plasmid from a design,
and that the paper's count matches the catalogue.

Run:  python3 analysis/check_vector_claims.py
"""
import io
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
HTML = os.path.join(ROOT, 'plant_prime_editor_v1.0.html')

JS = r"""
const {q} = require(PROBE);
console.log(q('JSON.stringify(VECTORS.map(function(v){return {' +
  'id:v.id,name:v.name,addgene:v.addgene,deposited:v.deposited,' +
  'construction_note:v.construction_note||null,paper:v.paper,doi:v.doi||null,' +
  'enzyme:v.enzyme,recog:v.enzyme_recog,off:v.enzyme_cut_offset,' +
  'oh5:v.overhang_5,oh3:v.overhang_3,sel:v.selection,peg:v.pegRNA_promoter,' +
  'acceptor_verified:!!v.acceptor_verified,acceptor_source:v.acceptor_source||null,' +
  'stuffer:v.stuffer_bp||null,plant:v.plant||null' +
  '};}))'));
"""


def load_vectors():
    script = os.path.join(HERE, '_tmp_vecdump.js')
    src = JS.replace('PROBE', json.dumps(os.path.join(ROOT, 'tests', 'probe.js')))
    with io.open(script, 'w', encoding='utf8') as fh:
        fh.write(src)
    env = dict(os.environ, PPE_HTML=HTML)
    try:
        out = subprocess.check_output(['node', script], cwd=ROOT, env=env,
                                      stderr=subprocess.DEVNULL).decode('utf8')
    finally:
        os.remove(script)
    return json.loads(out.strip().splitlines()[-1])


# NEB recognition sequences and cut offsets. The offset is the number of bases
# between the recognition site and the 4 nt overhang, and it is the number of N
# the tool must put in a primer.
ENZ = {'BsaI':  ('GGTCTC', 1),
       'BsmBI': ('CGTCTC', 1),
       'Esp3I': ('CGTCTC', 1),
       'BbsI':  ('GAAGAC', 2)}

P = F = 0


def ck(name, cond, detail=''):
    global P, F
    if cond:
        P += 1
    else:
        F += 1
    print(('  ok   ' if cond else '* FAIL') + ' ' + name.ljust(58) + str(detail))


def main():
    V = load_vectors()
    print('%d vector records\n' % len(V))

    deposited = [v for v in V if v['addgene'] and v.get('deposited') is not False]
    designs = [v for v in V if v.get('deposited') is False]

    # 1. every record is on one side of the line, explicitly
    for v in V:
        has_ag = bool(v['addgene'])
        flagged = v.get('deposited') is False
        ck('%s states whether it is deposited' % v['id'], has_ag != flagged,
           'addgene=%s deposited=%s' % (v['addgene'], v.get('deposited')))

    # 2. a design must say how to build it
    for v in designs:
        ck('%s carries a construction note' % v['id'],
           bool(v.get('construction_note')), '')

    # 3. no design may advertise an Addgene number as its own
    for v in designs:
        ck('%s claims no Addgene number' % v['id'], not v['addgene'], v['addgene'])

    # 4. enzyme geometry matches NEB, and the spacer length follows from it
    for v in V:
        e = v['enzyme']
        if e not in ENZ:
            ck('%s uses a known enzyme' % v['id'], False, e)
            continue
        recog, off = ENZ[e]
        ck('%s %s recognition site' % (v['id'], e), v['recog'] == recog, v['recog'])
        ck('%s %s cut offset' % (v['id'], e), v['off'] == off,
           '%s (NEB: %d)' % (v['off'], off))

    # 5. overhangs are 4 nt of ACGT
    for v in V:
        for k in ('oh5', 'oh3'):
            s = v[k] or ''
            ck('%s %s is a 4 nt overhang' % (v['id'], k),
               len(s) == 4 and re.fullmatch(r'[ACGT]{4}', s) is not None, s)

    # 6. a record that says its overhangs were read off a deposited sequence must
    #    name the sequence it read
    for v in V:
        if v['acceptor_verified']:
            ck('%s names the sequence its overhangs came from' % v['id'],
               bool(v['acceptor_source']), v['acceptor_source'])

    # 7. a stated stuffer length must agree with the site positions it was read from
    for v in V:
        src = v['acceptor_source'] or ''
        m = re.search(r'(\d+)\s*bp stuffer', src)
        if m and v['stuffer']:
            ck('%s stuffer length agrees with acceptor_source' % v['id'],
               int(m.group(1)) == v['stuffer'],
               'record %s vs source %s' % (v['stuffer'], m.group(1)))

    # 8. every record cites a paper
    for v in V:
        ck('%s cites a paper' % v['id'], bool(v['paper']), '')

    # 9. the count Figure 7 prints, and what its label is allowed to claim alongside it
    #
    # UNTIL 30 SEPTEMBER 2026 these required the printed count to equal the DEPOSITED plasmids
    # (11) and forbade the word "binary" in the label. That was right for the matrix as it then
    # read -- "Plant vector library (deposited, orderable plasmids)" -- because the 25 September
    # literature audit had found four constructed designs counted as deposited vectors, and
    # printing 15 beside that label would have advertised four plasmids nobody can order.
    #
    # The submitted Figure 7 states the whole profiled library instead: "Plant binary vector
    # library suitable for both monocot and dicot pegRNA designs", 15. It makes no claim about
    # orderability, so the count it must match is 15, not 11.
    #
    # The guard survives as the SECOND check, which is the one that mattered: the label may not
    # say deposited or orderable while the cell prints the full 15. The third check is new, for
    # the claim the new label does make -- a library spanning monocots and dicots.
    fm = json.load(open(os.path.join(ROOT, 'data', 'feature_matrix.json'), encoding='utf8'))
    row = [r for r in fm if 'vector library' in r[0].lower()]
    ck('Figure 7 has exactly one vector-library row', len(row) == 1, len(row))
    if row:
        label, cell = row[0][0], row[0][1]
        m = re.search(r'(\d+)', cell)
        ck('Figure 7 vector count == vectors profiled',
           bool(m) and int(m.group(1)) == len(V),
           '%s vs %d profiled (%d deposited + %d you build)'
           % (cell, len(V), len(deposited), len(designs)))
        claims = [w for w in ('deposited', 'orderable') if w in label.lower()]
        ck('Figure 7 does not call all %d of them deposited or orderable' % len(V),
           not claims, ', '.join(claims) if claims else 'makes no orderability claim')
        if 'monocot' in label.lower() and 'dicot' in label.lower():
            mono = [v for v in V if v.get('plant') == 'monocot']
            di = [v for v in V if v.get('plant') == 'dicot']
            ck('Figure 7 says monocot and dicot, and the library covers both',
               bool(mono) and bool(di), '%d monocot, %d dicot' % (len(mono), len(di)))

    print('\n%d deposited, %d constructed designs' % (len(deposited), len(designs)))
    print('%d checks, %d disagree' % (P + F, F))
    return 1 if F else 0


if __name__ == '__main__':
    sys.exit(main())
