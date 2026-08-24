#!/usr/bin/env python3
"""
Plant Prime Editor -- read Golden Gate overhangs off the deposited plasmid sequences.

The four bases flanking a Type IIS site decide whether a cloning primer ligates. They
cannot be assumed from a paper's Methods, because papers describe the chemistry rather
than the sequence. This reads them off the deposited sequence itself.

Method: locate the sgRNA scaffold. A Golden Gate acceptor for a guide cassette is a pair
of sites of one enzyme that excise a stuffer; the downstream overhang IS the first four
bases of the scaffold, because the spacer is joined directly to it.

    python3 analysis/vector_overhangs.py

Writes analysis/vector_overhangs.json.  Standard library only.
"""
import json, re, sys, os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','data','vector_sequences.json')
SCAFFOLD='GTTTTAGAGCTAGAAATAGCAAG'
ENZYMES={'BsaI':('GGTCTC',1,4),'BsmBI':('CGTCTC',1,4),'BbsI':('GAAGAC',2,4)}
rc=lambda s: s[::-1].translate(str.maketrans('ACGT','TGCA'))

def sites(seq,enzyme):
    rec,sp,ov=ENZYMES[enzyme]; found=[]
    for m in re.finditer('(?='+rec+')',seq):
        p=m.start(); o=seq[p+6+sp:p+6+sp+ov]
        if len(o)==ov: found.append({'pos':p,'strand':'+','overhang':o})
    for m in re.finditer('(?='+rc(rec)+')',seq):
        p=m.start(); s=p-sp-ov
        if s>=0: found.append({'pos':p,'strand':'-','overhang':seq[s:s+ov]})
    return sorted(found,key=lambda d:d['pos'])

def analyse(name,seq):
    out={'plasmid':name,'length':len(seq),'site_counts':{},'guide_cassette':None,'notes':[]}
    for e in ENZYMES: out['site_counts'][e]=len(sites(seq,e))
    scaf=[m.start() for m in re.finditer(SCAFFOLD,seq)]+[m.start() for m in re.finditer(rc(SCAFFOLD),seq)]
    if not scaf:
        out['notes'].append('No sgRNA scaffold found: editor-only plasmid, or a scaffold variant. '
                            'Guide overhangs cannot be read from it.')
        return out
    sp=scaf[0]; out['scaffold_pos']=sp
    down=None
    for e in ENZYMES:
        for s in sites(seq,e):
            if s['strand']=='+' and 0<sp-s['pos']<20 and seq.startswith(s['overhang'],sp):
                down=dict(s,enzyme=e)
    if not down:
        out['notes'].append('No Type IIS site immediately upstream of the scaffold; this plasmid is '
                            'probably linearised by a single cut and joined by homologous recombination.')
        return out
    up=None
    for s in sites(seq,down['enzyme']):
        if s['strand']=='-' and s['pos']<down['pos'] and (up is None or s['pos']>up['pos']): up=s
    if not up:
        out['notes'].append('Downstream site found but no upstream partner of the same enzyme.')
        return out
    out['guide_cassette']={'enzyme':down['enzyme'],'overhang_5':up['overhang'],'overhang_3':down['overhang'],
        'bottom_oligo_overhang':rc(down['overhang']),'stuffer_bp':down['pos']-up['pos'],
        'upstream_site':up['pos'],'downstream_site':down['pos'],
        'insert_must_carry':"5'-%s-[spacer]-%s-3'"%(up['overhang'],down['overhang']),
        'annealed_oligos':"top 5'-%s-[spacer]-3'  bottom 5'-%s-[reverse complement]-3'"%(up['overhang'],rc(down['overhang']))}
    return out

def main():
    seqs=json.load(open(SRC))
    res=[analyse(n,s.upper()) for n,s in seqs.items()]
    json.dump(res,open(os.path.join(HERE,'vector_overhangs.json'),'w'),indent=2)
    print('\nGOLDEN GATE OVERHANGS READ FROM THE DEPOSITED SEQUENCES\n')
    print('%-34s %-7s %-9s %-9s %s'%('plasmid','enzyme',"5' ovhg","3' ovhg",'stuffer'))
    print('-'*80)
    for r in res:
        gc=r['guide_cassette']; nm=r['plasmid'][:33]
        if gc: print('%-34s %-7s %-9s %-9s %d bp'%(nm,gc['enzyme'],gc['overhang_5'],gc['overhang_3'],gc['stuffer_bp']))
        else:  print('%-34s %s'%(nm,(r['notes'][0][:42] if r['notes'] else 'not resolved')))
    print('\nwrote analysis/vector_overhangs.json')

if __name__=='__main__': main()
