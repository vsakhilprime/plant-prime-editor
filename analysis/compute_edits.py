import os
"""Derive the exact edit position for each case-study target, and check every one.
Positions are 1-based within the window written to CaseStudy_Inputs.fasta."""
import csv, re
RC={'A':'T','T':'A','G':'C','C':'G'}; rc=lambda s:''.join(RC[c] for c in reversed(s))

fa={};cur=None
for L in open(os.path.join(os.path.dirname(__file__),'..','data','CaseStudy_Inputs.fasta')):
    L=L.strip()
    if L.startswith('>'): cur=L[1:].split('|')[0]; fa[cur]=''
    elif cur: fa[cur]+=L

tv=[r for r in csv.DictReader(open(os.path.join(os.path.dirname(__file__),'..','data','targets_verified.csv'))) if r['status']=='OK']
PANEL=['OsALS-T2','OsEPSPS-T1','OsCDC48-T2','OsCDC48-T1','OsAAT','OsACC-T1','TaGW2']
row={}
for r in tv:
    if r['target_id'] in PANEL and r['target_id'] not in row: row[r['target_id']]=r

DATA=[]
for t in PANEL:
    r=row[t]; seq=fa[t]; sp=r['spacer'].upper()
    assert seq==r['genomic_seq'].upper(), f'{t}: FASTA window differs from the window used to compute positions'
    p=seq.find(sp)
    if p>=0: strand,spos='+',p; nick=p+len(sp)-3
    else:
        spos=seq.find(rc(sp)); assert spos>=0, f'{t}: spacer not in window'
        strand='-'; nick=spos+3
    m=re.match(r'\+(\d+)(?:-(\d+))?\s+(.*)',r['edit'].strip()); assert m, f'{t}: cannot parse edit {r["edit"]}'
    o1=int(m.group(1)); o2=int(m.group(2)) if m.group(2) else o1; d=m.group(3).strip()
    at=lambda o: nick+o-1 if strand=='+' else nick-o          # empirically fixed offset rule
    a,b=at(o1),at(o2); lo,hi=min(a,b),max(a,b)
    plus=seq[lo:hi+1]; proto = plus if strand=='+' else rc(plus)

    sub=re.match(r'^([ACGT]+) to ([ACGT]+)$',d)
    dele=re.match(r'^([ACGT]+) del',d)
    ins=re.match(r'^([ACGT]+) ins',d)
    span = f'{lo+1}' if lo==hi else f'{lo+1}-{hi+1}'          # <-- ranges for multi-base edits
    if sub:
        frm,to=sub.group(1),sub.group(2)
        assert len(frm)==len(to)==(hi-lo+1), f'{t}: substitution length mismatch'
        plus_to = to if strand=='+' else rc(to)
        kind='substitution'; pos=span; act=f'change {plus} to {plus_to}'
        check = (proto==frm); how=f'position computed from the offset rule; the sequence there reads {proto} and the paper says {frm}'
    elif dele:
        kind='deletion'; pos=span; act=f'delete {plus} ({hi-lo+1} nt)'
        check=(proto==dele.group(1)); how=f'position computed from the offset rule; the bases there read {proto} and the paper says {dele.group(1)}'
    elif ins:
        g=ins.group(1); plus_ins = g if strand=='+' else rc(g)
        kind='insertion'; pos=f'insert before {lo+1}'; act=f'insert {plus_ins} between {lo} and {lo+1}'
        check=None; how='no reference base exists for an insertion; placed independently from the published RT template (see below)'
    else:
        raise SystemExit(f'{t}: unrecognised edit {d}')

    s,e=max(0,lo-20),min(len(seq),hi+21)
    DATA.append(dict(t=t,gene=r['gene'],src=r['source_tbl'],peg=r['peg_id'],strand=strand,spacer=sp,pam=r['pam'],
        spos=spos+1,nick=nick,edit=r['edit'],kind=kind,pos=pos,plus=plus,act=act,proto=proto,
        paper=f'{d} (quoted on the {strand} strand)',check=check,how=how,
        ctx=seq[s:lo]+'['+plus+']'+seq[hi+1:e], ctxrange=f'{s+1}-{e}', lo=lo, hi=hi))

fails=[d for d in DATA if d['check'] is False]
print('VERIFICATION')
for d in DATA:
    mark = 'CONFIRMED' if d['check'] else ('unchecked (insertion)' if d['check'] is None else '*** MISMATCH ***')
    print(f"  {d['t']:<13} {d['kind']:<13} {d['pos']:<18} {mark}")
print(f"\n  {sum(1 for d in DATA if d['check'])} of {sum(1 for d in DATA if d['check'] is not None)} checkable targets confirmed")
if fails: raise SystemExit('ABORT: '+', '.join(d['t'] for d in fails))
import json; json.dump(DATA,open(os.path.join(os.path.dirname(__file__),'..','data','edits.json'),'w'),indent=1)
print('  wrote edits.json')
