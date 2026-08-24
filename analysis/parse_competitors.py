import os
"""Parse pegFinder (.txt) and PE-Designer (.xlsx) exports into one table."""
import glob, os, re, csv, json, openpyxl
import os
U=os.environ.get('PPE_UPLOADS', os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data')) + os.sep
TARGETS=['OsALS-T2','OsEPSPS-T1','OsCDC48-T2','OsCDC48-T1','OsAAT','OsACC-T1','TaGW2']
ALIAS={'OSALS':'OsALS-T2','osals':'OsALS-T2','OsEPSPS-T1':'OsEPSPS-T1','OsCDC48-T1':'OsCDC48-T1',
       'OsCDC48-T2':'OsCDC48-T2','OsAAT':'OsAAT','OsACC-T1':'OsACC-T1','TaGW2':'TaGW2'}
def which(fn):
    b=os.path.basename(fn)
    for k in ['OsCDC48-T1','OsCDC48-T2','OsEPSPS-T1','OsACC-T1','OsAAT','TaGW2']:
        if k.lower() in b.lower(): return ALIAS[k]
    if 'als' in b.lower(): return 'OsALS-T2'
    return None

out=[]
# ── pegFinder ────────────────────────────────────────────────────────────────
for fn in glob.glob(U+'*PEG FINDER*.txt')+glob.glob(U+'*peg finder*.txt'):
    t=which(fn)
    rows=list(csv.DictReader(open(fn), delimiter='\t'))
    picked=[r for r in rows if r.get("3'_extension_picked")=='1']
    pbs_pick=[r for r in rows if r.get('PBS_picked')=='1']
    rt_pick =[r for r in rows if r.get('RT_picked')=='1']
    sgs={}
    for r in rows: sgs.setdefault(r['sgRNA_seq'],r)
    best = picked[0] if picked else (pbs_pick[0] if pbs_pick else rows[0])
    out.append(dict(target=t, tool='pegFinder', n_rows=len(rows), n_spacers=len(sgs),
        spacer=best['sgRNA_seq'], orientation=best['sg_Orientation'], sg_gc=best['sg_GC%'],
        sg_rank=best['sgRNA_rank'], seed_pam_disrupt=best['sg_Seed/PAM_disrupt'],
        pbs_len=best['PBS_len'], pbs_seq=best['PBS_seq'], rt_len=best['RT_len'], rt_seq=best['RT_seq'],
        pbs_lengths_offered=sorted({int(r['PBS_len']) for r in rows}),
        rt_lengths_offered=sorted({int(r['RT_len']) for r in rows}),
        pbs_picked_len=(pbs_pick[0]['PBS_len'] if pbs_pick else ''),
        rt_picked_len=(rt_pick[0]['RT_len'] if rt_pick else ''),
        n_extension_picked=len(picked)))
# ── PE-Designer ──────────────────────────────────────────────────────────────
for fn in glob.glob(U+'*PE_Designer_result*.xlsx'):
    t=which(fn)
    ws=openpyxl.load_workbook(fn, data_only=True)['result']
    # NOTE: the header repeats "Target Sequence (5' to 3')", "Position" etc. for the
    # nicking-sgRNA block, so columns must be read positionally, not by name.
    C={'seq':0,'pos':1,'cleav':2,'dir':3,'gc':4,'editpos':5,'pamchg':6,'mm0':7,'mm1':8,'mm2':9,
       'type':10,'ext':11,'pbslen':12,'pbsgc':13,'rttlen':14,'rttgc':15,
       'nick_seq':16,'nick_pos':17,'nick_dir':19,'nick_dist':21,'pe_type':22}
    raw=[r for r in ws.iter_rows(min_row=2, values_only=True)]
    rows=[r for r in raw if r[C['seq']] not in (None,'-','')]
    peg=[r for r in rows if str(r[C['type']]).lower().startswith('peg')]
    if not peg: peg=rows
    sgs={}
    for r in peg: sgs.setdefault(r[C['seq']],r)
    first=peg[0]
    num=lambda v: int(v) if str(v).strip().replace('.0','').isdigit() else None
    pl=[num(r[C['pbslen']]) for r in peg]; pl=[x for x in pl if x]
    rl=[num(r[C['rttlen']]) for r in peg]; rl=[x for x in rl if x]
    nick=[r for r in rows if r[C['nick_seq']] not in (None,'-','')]
    out.append(dict(target=t, tool='PE-Designer', n_rows=len(peg), n_spacers=len(sgs),
        spacer=str(first[C['seq']])[:20], orientation=first[C['dir']],
        sg_gc=first[C['gc']], sg_rank='1 (listed first)',
        seed_pam_disrupt=('PAM change: '+str(first[C['pamchg']])),
        pbs_len=first[C['pbslen']], pbs_seq='', rt_len=first[C['rttlen']], rt_seq='',
        pbs_lengths_offered=sorted(set(pl)), rt_lengths_offered=sorted(set(rl)),
        pbs_picked_len='', rt_picked_len='', n_extension_picked=0,
        extension=first[C['ext']],
        offtarget_mm0=first[C['mm0']], offtarget_mm1=first[C['mm1']], offtarget_mm2=first[C['mm2']],
        n_nick_sgrna=len(nick), all_spacers=[str(k)[:20] for k in sgs]))
# REFUSE TO WRITE AN EMPTY RESULT. The raw pegFinder .txt and PE-Designer .xlsx exports are
# not redistributed with this deposit, so this glob finds nothing when run from an unpacked
# copy. Previously it then wrote "[]" straight over data/competitors.json, destroying the 14
# deposited competitor records — and headtohead.js and rank_analysis.js, which read that file,
# silently produced degraded numbers afterwards. Running the scripts in alphabetical order was
# enough to trigger it.
if not out:
    raise SystemExit(
        '  no competitor exports found in %s\n'
        '  Expected *PEG FINDER*.txt and *PE_Designer_result*.xlsx, which are not part of\n'
        '  this deposit. data/competitors.json already holds the parsed result and has been\n'
        '  left untouched. Set PPE_UPLOADS to the folder holding the raw exports to re-parse.'
        % os.path.abspath(U))

json.dump(out, open(os.path.join(os.path.dirname(__file__),'..','data','competitors.json'),'w'), indent=1, default=str)
print(f'{len(out)} tool-target records\n')
print(f"{'target':<12}{'tool':<14}{'spacer':<22}{'n cand':<8}{'PBS len':<9}{'RT len':<8}{'PBS lengths offered'}")
for o in sorted(out,key=lambda x:(x['target'],x['tool'])):
    pl=o['pbs_lengths_offered']
    print(f"{o['target']:<12}{o['tool']:<14}{o['spacer']:<22}{o['n_spacers']:<8}{str(o['pbs_len']):<9}{str(o['rt_len']):<8}{min(pl)}-{max(pl)}")
