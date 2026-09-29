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
  'stuffer:v.stuffer_bp||null' +
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

    # 9. the count Figure 5D prints is the count of deposited plasmids
    fm = json.load(open(os.path.join(ROOT, 'data', 'feature_matrix.json'), encoding='utf8'))
    row = [r for r in fm if 'vector library' in r[0]]
    ck('Figure 5D has exactly one vector-library row', len(row) == 1, len(row))
    if row:
        m = re.search(r'\((\d+)\)', row[0][1])
        ck('Figure 5D vector count == deposited plasmids',
           bool(m) and int(m.group(1)) == len(deposited),
           '%s vs %d deposited' % (row[0][1], len(deposited)))
        ck('Figure 5D does not call them all binary',
           'binary' not in row[0][0].lower(), row[0][0])

    print('\n%d deposited, %d constructed designs' % (len(deposited), len(designs)))
    print('%d checks, %d disagree' % (P + F, F))
    return 1 if F else 0


if __name__ == '__main__':
    sys.exit(main())
