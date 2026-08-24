#!/usr/bin/env python3
"""
Plant Prime Editor — benchmark analysis

    python3 analyse_benchmark.py benchmark_scored.csv

Reads the output of score_batch.js and prints every number the Results section
needs, then writes Figure4_benchmark.svg. Sentences are printed pre-written so
they can be pasted straight into the manuscript.

Requires: pandas, scipy, matplotlib   (pip install pandas scipy matplotlib)
"""
import sys, warnings
import numpy as np, pandas as pd
from scipy import stats
import matplotlib; matplotlib.use('Agg')
matplotlib.rcParams.update({'svg.fonttype':'none','font.family':'Arial, Helvetica, sans-serif',
    'font.size':8,'axes.labelsize':8.5,'axes.titlesize':9.5,'xtick.labelsize':8,'ytick.labelsize':8,
    'legend.fontsize':8,'axes.linewidth':.8,'axes.spines.top':False,'axes.spines.right':False})
import matplotlib.pyplot as plt
import os as _os
_HERE = _os.path.dirname(_os.path.abspath(__file__))
_DATA = _os.path.join(_HERE, '..', 'data')
# Written beside the data rather than into the working directory: running this
# from the repository root used to drop a second, diverging copy of the figure
# at the top level while the canonical one sat in data/.
_OUT_SVG = _os.path.join(_DATA, 'Figure4_benchmark.svg')

warnings.filterwarnings('ignore')

BLUE,VERM,GREEN,ORANGE,PINK,SKY,GREY = '#0072B2','#D55E00','#009E73','#E69F00','#CC79A7','#56B4E9','#555555'
SRC = sys.argv[1] if len(sys.argv) > 1 else _os.path.join(_DATA, 'benchmark_scored.csv')
df  = pd.read_csv(SRC)

def rule(t=''):
    print('\n' + '─'*78); print(t); print('─'*78)

# ── 1. cohort ──────────────────────────────────────────────────────────────
rule('1.  BENCHMARK COHORT')
total = len(df)
df['status'] = df['status'].fillna('')
ok = df[df.status.str.startswith('OK')].copy()
dropped = df[~df.status.str.startswith('OK')]
for c in ['composite_score','measured_efficiency','published_rank_percentile',
          'pbs_tm','pbs_rt_dG','nick_edit_dist','ir_score','plantpegdesigner_score']:
    if c in ok.columns: ok[c] = pd.to_numeric(ok[c], errors='coerce')
ok = ok.dropna(subset=['composite_score','measured_efficiency'])

print(f'  rows in file              {total}')
print(f'  scored successfully       {len(ok)}')
# Two different exclusions, reported separately because they used to be conflated:
# `dropped` is rows whose status is not OK; the far larger cut is rows that parsed
# fine but carry no measured efficiency, which is most of the benchmark.
print(f'  status not OK             {len(dropped)}')
print(f'  no measured efficiency    {total-len(ok)-len(dropped)}')
print(f'  excluded in total         {total-len(ok)}')
if len(dropped):
    print('\n  status-not-OK reasons:')
    for r,n in dropped.status.value_counts().items(): print(f'    {n:>3}  {r}')
if len(ok) < 20:
    print('\n  ⚠ fewer than 20 usable rows. Aim for 40–80 before you report a correlation;')
    print('    below ~20 the confidence interval will be too wide to claim anything.')
for col,label in [('species','species'),('pe_system','PE system'),('study','study')]:
    if col in ok.columns:
        print(f'\n  by {label}:')
        for k,n in ok[col].value_counts().items(): print(f'    {n:>3}  {k}')

# ── 2. primary correlation ─────────────────────────────────────────────────
rule('2.  PRIMARY RESULT — composite score vs published editing efficiency')
x, y = ok.composite_score.values, ok.measured_efficiency.values
rho, p = stats.spearmanr(x, y)
r_p, p_p = stats.pearsonr(x, y)
n = len(x)
# Fisher z 95% CI on Spearman
z = np.arctanh(rho); se = 1/np.sqrt(n-3); lo, hi = np.tanh(z-1.96*se), np.tanh(z+1.96*se)
print(f'  n = {n}')
print(f'  Spearman rho = {rho:.3f}   95% CI [{lo:.3f}, {hi:.3f}]   P = {p:.3g}')
print(f'  Pearson  r   = {r_p:.3f}                              P = {p_p:.3g}')
# This script used to print an 'Abstract sentence' here and end by telling the reader
# to paste it into the manuscript. It was removed on 23 August 2026 because the
# sentence contradicted the paper: this cohort is whatever rows of benchmark_scored.csv
# carry a measured efficiency, which is five tomato pegRNAs from one study, while the
# manuscript's between-site result is n = 15 over the Lin 2020 join. Two different
# analyses were being offered under the same words.
print(f'\n  This cohort is the {n} row(s) of benchmark_scored.csv that carry a measured')
print(f'  efficiency. It is NOT the between-site analysis reported in the paper — that is')
print(f'  analysis/score_vs_efficiency.py, n = 15 over data/benchmark_lin2020_joined.csv.')
print(f'  Every number the manuscript states is checked by analysis/verify_manuscript_numbers.py.')
if p > 0.05:
    print(f'\n  Not significant at n = {n}, which is what a cohort this small supports.')

# ── 3. quartile enrichment ─────────────────────────────────────────────────
rule('3.  QUARTILE ENRICHMENT')
try:
    q = pd.qcut(ok.composite_score, 4, labels=['Q1','Q2','Q3','Q4'], duplicates='drop')
    for k in q.cat.categories:
        v = ok.measured_efficiency[q==k]
        print(f'  {k}  n={len(v):>3}  median {v.median():6.2f}%   IQR {v.quantile(.25):.2f}–{v.quantile(.75):.2f}')
    a, b = ok.measured_efficiency[q==q.cat.categories[-1]], ok.measured_efficiency[q==q.cat.categories[0]]
    U, pu = stats.mannwhitneyu(a, b, alternative='greater')
    print(f'\n  top vs bottom quartile: U = {U:.0f}, P = {pu:.3g}')
    print(f'  fold difference in medians: {a.median()/b.median():.2f}x' if b.median() else '')
except Exception as e:
    print('  could not compute quartiles:', e)

# ── 4. per-term contributions ──────────────────────────────────────────────
rule('4.  WHICH TERMS CARRY THE SIGNAL')
terms = [('composite score','composite_score',1),('nick–edit distance','nick_edit_dist',-1),
         ('PBS Tm deviation from 30 °C','pbs_tm','tm'),('PBS↔RT template ΔG','pbs_rt_dG',1),
         ('spacer GC','spacer_gc',1),('intrinsic risk score','ir_score',1)]
rows=[]
for label,col,sign in terms:
    if col not in ok.columns: continue
    v = pd.to_numeric(ok[col], errors='coerce')
    if v.notna().sum() < 8: continue
    vv = -(v-30).abs() if sign=='tm' else (v*sign)
    m = vv.notna() & ok.measured_efficiency.notna()
    r_,p_ = stats.spearmanr(vv[m], ok.measured_efficiency[m])
    rows.append((label,r_,p_,m.sum())); print(f'  {label:<30} rho = {r_:+.3f}   P = {p_:.3g}   n = {m.sum()}')
print('\n  Report this table. It shows the score is not a black box, and it tells you')
print('  which weights to revisit in version 2 if one term carries everything.')

# ── 5. recovery of the authors' own designs ────────────────────────────────
rule("5.  RECOVERY OF THE DESIGNS THE ORIGINAL AUTHORS USED")
if 'published_rank_percentile' in ok.columns:
    pr = pd.to_numeric(ok.published_rank_percentile, errors='coerce').dropna()
    if len(pr):
        print(f'  n = {len(pr)}')
        print(f'  median rank percentile {pr.median():.1f}   mean {pr.mean():.1f}')
        for t in (90,75,50):
            print(f'  in the top {100-t:>2}% of candidates: {(pr>=t).mean()*100:5.1f}% of designs')
        # No pre-written sentence here either: this recovery statistic is computed over
        # whatever subset reached this point, which is not the cohort the manuscript
        # reports. verify_manuscript_numbers.py owns the published figure and checks it
        # against the full 135-row set.
        print(f'\n  Computed over {len(pr)} row(s) reaching this point. The published recovery')
        print(f'  statistic is over all 135 scored rows and is checked by')
        print(f'  analysis/verify_manuscript_numbers.py.')

# ── 6. head-to-head with PlantPegDesigner ──────────────────────────────────
rule('6.  HEAD-TO-HEAD WITH PlantPegDesigner')
if 'plantpegdesigner_score' in ok.columns and ok.plantpegdesigner_score.notna().sum() >= 8:
    m = ok.plantpegdesigner_score.notna()
    r1,_ = stats.spearmanr(ok.composite_score[m], ok.measured_efficiency[m])
    r2,p2 = stats.spearmanr(ok.plantpegdesigner_score[m], ok.measured_efficiency[m])
    print(f'  n = {m.sum()} loci scored by both tools')
    print(f'  Plant Prime Editor  rho = {r1:+.3f}')
    print(f'  PlantPegDesigner    rho = {r2:+.3f}   P = {p2:.3g}')
    # Steiger test for dependent correlations sharing one variable
    r12,_ = stats.spearmanr(ok.composite_score[m], ok.plantpegdesigner_score[m])
    nn = m.sum()
    if abs(r1)<1 and abs(r2)<1:
        zf = lambda r: np.arctanh(r)
        rm2 = (r1**2+r2**2)/2
        f = (1-r12)/(2*(1-rm2)); f = min(f,1.0)
        h = (1-f*rm2)/(1-rm2)
        zdiff = (zf(r1)-zf(r2))*np.sqrt((nn-3)/(2*(1-r12)*h))
        pz = 2*(1-stats.norm.cdf(abs(zdiff)))
        print(f'  difference (Steiger z) = {zdiff:+.2f}, P = {pz:.3g}')
        if pz > .05:
            print('\n  → Statistically indistinguishable. Say so plainly. Your claim is coverage of')
            print('    the design-to-construct path, not better sequence-level prediction — parity')
            print('    on that axis supports the claim rather than weakening it.')
        elif r1 > r2:
            print('\n  → Plant Prime Editor is significantly better on this cohort. Report the effect')
            print('    size, and be explicit that the cohort is retrospective.')
        else:
            print('\n  → PlantPegDesigner is significantly better on this cohort. Report it. Then make')
            print('    the coverage argument, which is unaffected — an honest loss on one axis buys')
            print('    credibility for everything else.')
else:
    print('  No plantpegdesigner_score column with enough values.')
    print('  Add one: run each target through http://www.plantgenomeediting.net/ and record its score.')
    print('  Without it a reviewer will ask why the obvious comparison is missing.')

# ── 7. figure ──────────────────────────────────────────────────────────────
rule('7.  FIGURE')
fig = plt.figure(figsize=(7.0,5.4))
gs = fig.add_gridspec(2,3,hspace=.42,wspace=.36,left=.075,right=.985,top=.93,bottom=.09)

ax = fig.add_subplot(gs[0,0])
if 'species' in ok.columns:
    mk = {s:m for s,m in zip(ok.species.unique(),['o','s','^','D','v','P','X'])}
    for s,g in ok.groupby('species'):
        ax.scatter(g.composite_score,g.measured_efficiency,s=17,alpha=.8,marker=mk[s],
                   label=s,edgecolor='white',linewidth=.4)
    ax.legend(frameon=False,loc='lower right',handletextpad=.2,borderpad=.1)
else:
    ax.scatter(x,y,s=17,alpha=.8,color=BLUE,edgecolor='white',linewidth=.4)
b_,a_ = np.polyfit(x,y,1); xs=np.linspace(x.min(),x.max(),50)
ax.plot(xs,a_+b_*xs,color=GREY,lw=1.1,ls='--')
ax.set_xlabel('Plant Prime Editor composite score'); ax.set_ylabel('Published editing efficiency (%)')
ax.set_title('A   Score vs measured efficiency',loc='left',fontweight='bold')
ax.text(.04,.95,f'Spearman ρ = {rho:.2f}\nP = {p:.1e}\nn = {n}',transform=ax.transAxes,va='top',fontsize=7.8)

ax = fig.add_subplot(gs[0,1])
try:
    data=[ok.measured_efficiency[q==k].values for k in q.cat.categories]
    bp=ax.boxplot(data,patch_artist=True,widths=.6,showfliers=False,medianprops=dict(color='black',lw=1.2))
    for patch,c in zip(bp['boxes'],['#cfd8dc','#9fb3bd','#4d8fa8',BLUE]):
        patch.set_facecolor(c); patch.set_edgecolor(GREY); patch.set_linewidth(.8)
    for i,d in enumerate(data,1):
        ax.scatter(np.full(len(d),i)+np.random.uniform(-.14,.14,len(d)),d,s=7,color='black',alpha=.35,zorder=3)
    ax.set_xticklabels(list(q.cat.categories))
    ax.text(.04,.95,f'Q4 vs Q1\nMann–Whitney U\nP = {pu:.1e}',transform=ax.transAxes,va='top',fontsize=7.8)
except Exception: pass
ax.set_xlabel('Composite score quartile'); ax.set_ylabel('Published editing efficiency (%)')
ax.set_title('B   Top vs bottom quartile',loc='left',fontweight='bold')

ax = fig.add_subplot(gs[0,2])
if rows:
    labs=[r[0] for r in rows][::-1]; vals=[r[1] for r in rows][::-1]
    cols=[BLUE if l=='composite score' else SKY for l in labs]
    ax.barh(range(len(vals)),vals,color=cols,height=.6,edgecolor='white')
    ax.set_yticks(range(len(vals))); ax.set_yticklabels(labs,fontsize=7)
    for i,v in enumerate(vals):
        ax.text(v+(.015 if v>=0 else -.015),i,f'{v:.2f}',va='center',
                ha='left' if v>=0 else 'right',fontsize=7.2)
ax.axvline(0,color='black',lw=.8); ax.set_xlabel('Spearman ρ with measured efficiency')
ax.set_title('C   Which terms carry the signal',loc='left',fontweight='bold')

ax = fig.add_subplot(gs[1,0])
if 'plantpegdesigner_score' in ok.columns and ok.plantpegdesigner_score.notna().sum()>=8:
    ax.bar(['Plant Prime\nEditor','PlantPeg\nDesigner'],[r1,r2],color=[BLUE,GREY],width=.55,edgecolor='white')
    for i,v in enumerate([r1,r2]): ax.text(i,v+.02,f'{v:.2f}',ha='center',fontsize=8.2,fontweight='bold')
    ax.set_ylim(0,max(r1,r2)*1.28 if max(r1,r2)>0 else 1)
else:
    ax.text(.5,.5,'PlantPegDesigner\nscores not supplied',transform=ax.transAxes,ha='center',va='center',
            fontsize=9,color=VERM)
    ax.set_xticks([]); ax.set_yticks([])
ax.set_ylabel('Spearman ρ with measured efficiency')
ax.set_title('D   Same benchmark, both tools',loc='left',fontweight='bold')

ax = fig.add_subplot(gs[1,1])
if 'published_rank_percentile' in ok.columns:
    pr = pd.to_numeric(ok.published_rank_percentile,errors='coerce').dropna()
    if len(pr):
        ax.hist(pr,bins=np.arange(0,105,10),color=GREEN,edgecolor='white',alpha=.9)
        ax.axvline(pr.median(),color=VERM,lw=1.4,ls='--')
        ax.text(pr.median()-2,ax.get_ylim()[1]*.92,f'median {pr.median():.0f}th',color=VERM,
                ha='right',fontsize=7.8,fontweight='bold')
ax.set_xlabel('Rank percentile of the published design\namong candidates offered by the tool')
ax.set_ylabel('Number of benchmark loci')
ax.set_title('E   Recovery of designs that worked',loc='left',fontweight='bold')

# Panel F removed 23 August 2026. It plotted four wall-clock times under the title
# "Runtime, standard laptop" and stamped the panel with "replace with your timings",
# because the numbers were placeholders that had never been measured — the line that
# set them carried the comment "replace with your own measurements". A figure in a
# paper cannot assert timings nobody took. The panel is gone rather than guessed at;
# if runtimes are wanted, measure them on a named machine and add the panel back with
# the method stated.
ax = fig.add_subplot(gs[1,2])
ax.axis('off')

fig.savefig(_OUT_SVG,format='svg',bbox_inches='tight')
print('  wrote Figure4_benchmark.svg')

rule('DONE')
print('  Nothing here is a manuscript sentence. Numbers the paper states are checked by')
print('  analysis/verify_manuscript_numbers.py, which compares each against the text.\n')
