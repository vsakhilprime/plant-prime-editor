#!/usr/bin/env python3
"""Figure 2A, redesigned as a scoring table rather than a stacked bar.

The stacked diverging bar had a defect no amount of labelling fixes: the bar
length is not the score. For S10 the bar runs from -15 to +80 while the score is
65, so the number the panel exists to explain appears nowhere in the geometry,
and the reader has to add segments across a zero line to recover it.

This version puts one term per labelled column, so no colour has to be decoded
and no arithmetic is done in the head, and gives the final score its own bar so
the ranking is still visible at a glance.
"""
import json, os, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
_d = json.load(open(os.path.join(HERE, 'figure2_panels.json')))
R = [dict(x, dist=x['nick_edit_dist'], dG=x['dG_penalty']) for x in _d['panelA']['rows']]
n = len(R)

POS, NEG, ZERO = '#1a9c6e', '#c0392b', '#9aa0a6'
def tint(v, vmax):
    if v == 0: return '#f4f5f6', ZERO
    f = min(abs(v) / vmax, 1.0)
    if v > 0: return (0.85 - 0.45*f, 0.94 - 0.20*f, 0.88 - 0.30*f), '#0b4d34'
    return (0.99 - 0.05*f, 0.90 - 0.42*f, 0.87 - 0.40*f), '#7d1f16'

TERMS = [('distScore', 'Nick-to-edit\ndistance', 80),
         ('gcScore',   'Spacer\nGC',             20),
         ('seedScore', 'Seed-region\nGC',        10),
         ('polyT',     'Poly-T\npenalty',        25),
         ('dG',        'ΔG structure\npenalty',  15)]

fig = plt.figure(figsize=(14.2, 6.4), dpi=200)
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 100); ax.set_ylim(0, 100)
ax.axis('off')

ROW_TOP, ROW_H = 61.0, 8.6
IDX = [(4.0, 'Rank'), (10.0, 'Spacer'), (16.5, 'PAM'), (24.5, 'Nick→edit'), (32.0, 'GC%')]
TX0, TW = 37.0, 8.4                      # term columns
SUMX = TX0 + len(TERMS)*TW + 3.0
BARX, BARW = SUMX + 9.5, 18.5

def rowy(i): return ROW_TOP - i*ROW_H

# headers
for x, h in IDX:
    ax.text(x, ROW_TOP + 6.4, h, ha='center', va='bottom', fontsize=9, fontweight='bold', color='#555')
ax.text(TX0 + len(TERMS)*TW/2 - TW/2, ROW_TOP + 12.0, 'Points contributed by each scoring term',
        ha='center', va='bottom', fontsize=9.6, fontweight='bold', color='#333')
ax.plot([TX0 - TW/2 + 0.4, TX0 + len(TERMS)*TW - TW/2 - 0.4],
        [ROW_TOP + 11.4]*2, color='#bbb', lw=1.0)
for k, (key, lab, _) in enumerate(TERMS):
    ax.text(TX0 + k*TW, ROW_TOP + 5.2, lab, ha='center', va='bottom', fontsize=8.6,
            color='#555', fontweight='bold', linespacing=1.35)
ax.text(SUMX, ROW_TOP + 6.4, 'Σ terms', ha='center', va='bottom', fontsize=9, fontweight='bold', color='#555')
ax.text(BARX + BARW/2, ROW_TOP + 6.4, 'Composite score  (1–99 scale)',
        ha='center', va='bottom', fontsize=9, fontweight='bold', color='#555')

SMAX = max(r['total'] for r in R)
for i, r in enumerate(R):
    y = rowy(i)
    if i % 2 == 0:
        ax.add_patch(Rectangle((1.4, y - ROW_H/2 + 0.5), 96.0, ROW_H - 1.0,
                               facecolor='#fafafa', edgecolor='none', zorder=0))
    vals = [str(i+1), r['id'], r['pam'],
            '%d nt%s' % (r['dist'], '' if r['correctSide'] else ' *'), '%d%%' % r['gc']]
    for (x, _), v in zip(IDX, vals):
        ax.text(x, y, v, ha='center', va='center', fontsize=9.4,
                color='#111' if r['correctSide'] else '#08306b',
                fontweight='bold' if v == r['id'] else 'normal', zorder=3)
    for k, (key, _, vmax) in enumerate(TERMS):
        v = r[key]; bg, fg = tint(v, vmax)
        ax.add_patch(FancyBboxPatch((TX0 + k*TW - TW/2 + 0.55, y - ROW_H/2 + 1.05),
                                    TW - 1.1, ROW_H - 2.1,
                                    boxstyle='round,pad=0,rounding_size=0.7',
                                    facecolor=bg, edgecolor='white', lw=1.0, zorder=2))
        ax.text(TX0 + k*TW, y, ('+%d' % v) if v > 0 else ('−%d' % -v) if v < 0 else '0',
                ha='center', va='center', fontsize=10, fontweight='bold', color=fg, zorder=3)
    s = r['sum']
    ax.text(SUMX, y, ('−%d' % -s) if s < 0 else '%d' % s, ha='center', va='center',
            fontsize=10, color='#c0392b' if r['clamped'] else '#111',
            fontweight='bold' if r['clamped'] else 'normal', zorder=3)
    w = BARW * r['total'] / SMAX
    ax.add_patch(Rectangle((BARX, y - 1.9), BARW, 3.8, facecolor='#eef0f2', edgecolor='none', zorder=2))
    ax.add_patch(Rectangle((BARX, y - 1.9), max(w, 0.45), 3.8,
                           facecolor='#c0392b' if r['clamped'] else '#1f6fb4',
                           edgecolor='none', zorder=3))
    ax.text(BARX + BARW + 1.3, y, str(r['total']), ha='left', va='center',
            fontsize=11.5, fontweight='bold',
            color='#c0392b' if r['clamped'] else '#111', zorder=3)
    if r['clamped']:
        ax.text(SUMX + 3.2, y, 'floored →', ha='left', va='center', fontsize=7.8,
                color='#c0392b', style='italic', zorder=3)

ax.plot([1.4, 97.4], [ROW_TOP + 4.4]*2, color='#333', lw=1.1)
ax.plot([1.4, 97.4], [rowy(n-1) - ROW_H/2 + 0.4]*2, color='#333', lw=1.1)

# key
ky = rowy(n-1) - ROW_H/2 - 6.2
for j, (lab, c) in enumerate([('adds points', (0.55, 0.83, 0.70)),
                              ('removes points', (0.96, 0.62, 0.60)),
                              ('term not triggered', '#f4f5f6')]):
    x = 30.0 + j*16.0
    ax.add_patch(FancyBboxPatch((x, ky - 1.35), 3.0, 2.7,
                                boxstyle='round,pad=0,rounding_size=0.6',
                                facecolor=c, edgecolor='#ddd', lw=0.8))
    ax.text(x + 3.9, ky, lab, ha='left', va='center', fontsize=8.8, color='#444')
ax.text(78.0, ky, 'deeper colour = larger term', ha='left', va='center',
        fontsize=8.8, color='#777', style='italic')

ax.text(2.0, 95.5, 'A', fontsize=16, fontweight='bold', ha='left', va='top')
ax.text(5.2, 95.5, 'How the spacer composite score is built, term by term',
        fontsize=14, fontweight='bold', ha='left', va='top')
ax.text(5.2, 91.0,
 'Real output for rice OsDEP1, edit at position 305, build 96e270bb. The five candidate spacers the tool returns at this locus, ranked. Every term\n'
 'that enters the ranking is shown with its own value, so a user can see why a candidate sits where it does instead of accepting a single number.\n'
 'OsDEP1 is one of the 5 of 26 benchmark loci that trigger both the poly-T and the ΔG penalty; at most loci neither fires. The Pol III +1 base is\n'
 'checked but scores zero, because Ma et al. (2015) measured no efficiency difference between regular and irregular starts.',
 fontsize=8.9, color='#444', ha='left', va='top', linespacing=1.55)

ax.text(2.0, ky - 5.0,
 'Σ terms adds the four sequence terms; the ΔG penalty is then subtracted. The composite score is clamped to 1–99, so a spacer whose terms sum below 1 is\n'
 'reported at the floor rather than as a negative number — S7 (−18) and S12 (−56) are both floored to 1, shown in red.  * S12’s edit lies upstream of its nick.\n'
 'The reverse-transcriptase template extends downstream only, so it cannot reach that edit; the distance term becomes −80 instead of a reward, and no\n'
 'combination of the other terms can recover it. That row is in the panel to show what disqualification looks like.',
 fontsize=8.6, color='#555', ha='left', va='top', linespacing=1.55)

fig.savefig(os.path.join(HERE, '..', 'data', 'Figure2A_panel.png'), dpi=300, facecolor='white', bbox_inches='tight')
fig.savefig(os.path.join(HERE, '..', 'data', 'Figure2A_panel.pdf'), facecolor='white', bbox_inches='tight')
print('written: data/Figure2A_panel.png and .pdf')
