#!/usr/bin/env python3
"""
build_editable_figures.py — draw Figures 5 and S4 as native PowerPoint shapes.

These panels shipped as placed images, so nothing in them could be recoloured, retyped or
resized by a journal's production team. Every mark here is a PowerPoint shape drawn from the
deposited data, so the figures stay editable and stay tied to the numbers.

  Figure 5A   primer-binding-site length chosen by each tool, seven targets   tool_comparison.csv
  Figure 5B   the same choices as Wallace melting temperature                 tool_comparison.csv
  Figure 5C   mean absolute pairwise difference in length, five tools         all_tools.json
  Figure 5D   capability matrix, 29 features x 7 tools                        feature_matrix.json
  Figure S4A  best measured length against the leave-one-out optimum          loto.json
  Figure S4B  out-of-sample Spearman correlation per target                   loto.json

Layout is computed rather than hand-placed: axes get a fixed plot box, ticks are derived from
the data range, and every label is positioned from the geometry it belongs to. Collisions are
checked at the end by check_figure_overlaps.py.

    python3 analysis/build_editable_figures.py [path/to/Figures.pptx]
"""
import csv, itertools, json, os, statistics, sys

from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# ── never overwrite the user's deck without being told to (added 23 Aug 2026) ──
# These scripts used to call prs.save(DECK) on the path given as argv[1], silently
# replacing a 3 MB binary the deposit does not ship and cannot restore. Confirmed
# destructive by md5 before and after a single run. The default is now to write a
# sibling file; --in-place restores the old behaviour for anyone who wants it.
def _ppe_out_path(deck_path):
    import os as _o, sys as _s
    if '--in-place' in _s.argv:
        return deck_path
    root, ext = _o.path.splitext(deck_path)
    return root + '_edited' + ext


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
def _find_deck(here):
    """Locate the figure deck, preferring a path given on the command line.

    This previously pointed only at ../../SUBMISSION_v1.0/02_figures/, which exists in the
    authors' working tree and nowhere else. Anyone running this from an unpacked deposit got
    PackageNotFoundError with no indication of what was missing. The deck now ships in
    docs/, so the deposit is self-contained; the working-tree path is still tried first so
    that rebuilding in place still updates the submission copy.
    """
    import sys
    if len(sys.argv) > 1:
        return sys.argv[1]
    for cand in (os.path.join(here, '..', '..', 'SUBMISSION_v1.0', '02_figures',
                              'Figures_PlantPrimeEditor.pptx'),
                 os.path.join(here, '..', 'docs', 'Figures_PlantPrimeEditor.pptx')):
        if os.path.exists(cand):
            return cand
    raise SystemExit('  figure deck not found. Pass its path as the first argument, or\n'
                     '  place Figures_PlantPrimeEditor.pptx in docs/.')


DECK = _find_deck(HERE)

IN = lambda v: Emu(int(v * 914400))
PT = Pt

INK    = RGBColor(0x1F, 0x29, 0x37)
MUTED  = RGBColor(0x6B, 0x72, 0x80)
RULE   = RGBColor(0x9C, 0xA3, 0xAF)
BAND   = RGBColor(0xDC, 0xFC, 0xE7)
BANDB  = RGBColor(0xB7, 0xE4, 0xC7)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)

TOOL_COLOUR = {
    'Plant Prime Editor': RGBColor(0x15, 0x80, 0x3D),
    'PlantPegDesigner':   RGBColor(0x2563, 0xEB) if False else RGBColor(0x25, 0x63, 0xEB),
    'pegFinder':          RGBColor(0xEA, 0x58, 0x0C),
    'PE-Designer':        RGBColor(0x92, 0x40, 0x0E),
    'PRIDICT':            RGBColor(0x7C, 0x3A, 0xED),
}


# ── primitives ──────────────────────────────────────────────────────────────
def text(slide, x, y, w, h, s, size=10, bold=False, colour=INK,
         align=PP_ALIGN.LEFT, italic=False, anchor=MSO_ANCHOR.TOP, rot=None):
    tb = slide.shapes.add_textbox(IN(x), IN(y), IN(w), IN(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]; p.alignment = align
    r = p.add_run(); r.text = s
    r.font.size = PT(size); r.font.bold = bold; r.font.italic = italic
    r.font.name = 'Arial'; r.font.color.rgb = colour
    if rot is not None:
        tb.rotation = rot
    return tb


def rect(slide, x, y, w, h, fill=None, line=None, lw=0.75):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, IN(x), IN(y), IN(w), IN(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line; sh.line.width = PT(lw)
    sh.shadow.inherit = False
    return sh


def dot(slide, cx, cy, d, fill=None, line=None, lw=1.0):
    sh = slide.shapes.add_shape(MSO_SHAPE.OVAL, IN(cx - d / 2), IN(cy - d / 2), IN(d), IN(d))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line; sh.line.width = PT(lw)
    sh.shadow.inherit = False
    return sh


def line(slide, x1, y1, x2, y2, colour=RULE, lw=0.75, dash=False):
    from pptx.enum.shapes import MSO_CONNECTOR
    cn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, IN(x1), IN(y1), IN(x2), IN(y2))
    cn.line.color.rgb = colour; cn.line.width = PT(lw)
    if dash:
        from pptx.enum.dml import MSO_LINE_DASH_STYLE
        cn.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    return cn


def blank_slide(prs, like=0):
    s = prs.slides.add_slide(prs.slides[like].slide_layout)
    for sh in list(s.shapes):
        sh._element.getparent().remove(sh._element)
    return s


def reorder(prs, order, dropped=()):
    """Rewrite the slide order in one pass and release the slides left out.

    Interleaving add_slide with remove/insert on _sldIdLst corrupted the package: one slide
    part ended up referenced twice and another was lost. Collecting the sldId elements first,
    clearing the list, then appending exactly the wanted ones in order avoids mutating the
    list while it is still being appended to.
    """
    RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    lst = prs.slides._sldIdLst
    ids = list(lst)
    for e in ids:
        lst.remove(e)
    for i in order:
        lst.append(ids[i])
    for i in dropped:
        prs.part.drop_rel(ids[i].get(RID))


# ── data ────────────────────────────────────────────────────────────────────
def load():
    rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'tool_comparison.csv'))))
    targets = []
    for r in rows:
        if r['target'] not in targets:
            targets.append(r['target'])
    idx = {(r['target'], r['tool']): r for r in rows}
    at = json.load(open(os.path.join(ROOT, 'data', 'all_tools.json')))
    loto = json.load(open(os.path.join(ROOT, 'data', 'loto.json')))
    feats = json.load(open(os.path.join(ROOT, 'data', 'feature_matrix.json')))
    return targets, idx, at, loto, feats


# ── panels ──────────────────────────────────────────────────────────────────
def dotplot(slide, x0, y0, w, h, targets, series, ylo, yhi, ystep, ylab,
            band=None, hline=None, letter='A', title=''):
    """Shared layout for Figure 5A and 5B: one column per target, one dot per tool."""
    PADL, PADB, PADT = 0.58, 0.62, 0.30
    px, py = x0 + PADL, y0 + PADT
    pw, ph = w - PADL - 0.06, h - PADT - PADB
    yv = lambda v: py + ph - (v - ylo) / (yhi - ylo) * ph

    text(slide, x0, y0 - 0.30, 0.22, 0.22, letter, size=13, bold=True)
    if title:
        text(slide, x0 + 0.22, y0 - 0.30, w - 0.22, 0.22, title, size=10.5, bold=True)

    if band:
        lo, hi = band
        rect(slide, px, yv(hi), pw, yv(lo) - yv(hi), fill=BAND, line=None)
    if hline is not None:
        line(slide, px, yv(hline), px + pw, yv(hline), colour=BANDB, lw=1.1, dash=True)

    v = ylo
    while v <= yhi + 1e-9:
        line(slide, px, yv(v), px + pw, yv(v), colour=RGBColor(0xE5, 0xE7, 0xEB), lw=0.5)
        text(slide, px - 0.50, yv(v) - 0.075, 0.44, 0.16, str(int(v)),
             size=8, colour=MUTED, align=PP_ALIGN.RIGHT)
        v += ystep
    line(slide, px, py, px, py + ph, colour=INK, lw=0.9)
    line(slide, px, py + ph, px + pw, py + ph, colour=INK, lw=0.9)
    vlabel(slide, x0 + 0.10, py + ph / 2, ph, ylab)

    n = len(targets)
    colw = pw / n
    names = list(series)
    spread = min(0.052, colw / (len(names) + 2))
    for i, t in enumerate(targets):
        cx = px + colw * (i + 0.5)
        if i:
            line(slide, px + colw * i, py, px + colw * i, py + ph,
                 colour=RGBColor(0xF3, 0xF4, 0xF6), lw=0.5)
        for k, nm in enumerate(names):
            val = series[nm][i]
            if val is None:
                continue
            ox = (k - (len(names) - 1) / 2) * spread
            dot(slide, cx + ox, yv(val), 0.085, fill=TOOL_COLOUR[nm], line=WHITE, lw=0.6)
        text(slide, cx - colw / 2, py + ph + 0.06, colw, 0.42, t,
             size=7.2, colour=INK, align=PP_ALIGN.CENTER)
    return px, py, pw, ph


def vlabel(slide, cx, cy, length, s, size=8.5):
    """Vertical axis label centred on (cx, cy).

    PowerPoint rotates a shape about its own centre, so a rotated box placed by its top-left
    lands somewhere else entirely — which is why the first draft printed the axis titles on
    top of the tick numbers. Position by centre and the rotation is harmless.
    """
    H = 0.22
    tb = slide.shapes.add_textbox(IN(cx - length / 2), IN(cy - H / 2), IN(length), IN(H))
    tf = tb.text_frame
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = s
    r.font.size = PT(size); r.font.name = 'Arial'; r.font.color.rgb = INK
    tb.rotation = 270
    return tb


def bargroup(slide, x0, y0, w, h, targets, series, ylo, yhi, ystep, ylab,
             band=None, hline=None, letter='A', title='', valfmt='%d'):
    """Grouped bars: one cluster per target, one bar per tool.

    Bars are drawn from ylo. For primer-binding-site length that is zero, which is honest —
    length is a ratio scale and 8 nt really is two thirds of 12 nt. For melting temperature
    it is not: °C is an interval scale, so a bar from zero implies a ratio that does not
    exist. Callers that pass a non-zero ylo get a break marker on the axis and the baseline
    printed, so the truncation is declared rather than hidden.
    """
    PADL, PADB, PADT = 0.60, 0.62, 0.30
    px, py = x0 + PADL, y0 + PADT
    pw, ph = w - PADL - 0.06, h - PADT - PADB
    yv = lambda v: py + ph - (v - ylo) / (yhi - ylo) * ph

    text(slide, x0, y0 - 0.30, 0.22, 0.22, letter, size=13, bold=True)
    if title:
        text(slide, x0 + 0.22, y0 - 0.30, w - 0.22, 0.22, title, size=10.5, bold=True)

    if band:
        lo, hi = band
        rect(slide, px, yv(min(hi, yhi)), pw, yv(max(lo, ylo)) - yv(min(hi, yhi)),
             fill=BAND, line=None)

    v = ylo
    while v <= yhi + 1e-9:
        line(slide, px, yv(v), px + pw, yv(v), colour=RGBColor(0xE5, 0xE7, 0xEB), lw=0.5)
        text(slide, px - 0.52, yv(v) - 0.075, 0.46, 0.16, str(int(v)),
             size=8, colour=MUTED, align=PP_ALIGN.RIGHT)
        v += ystep
    if hline is not None:
        line(slide, px, yv(hline), px + pw, yv(hline), colour=RGBColor(0x6B, 0x72, 0x80),
             lw=1.1, dash=True)
    line(slide, px, py, px, py + ph, colour=INK, lw=0.9)
    line(slide, px, py + ph, px + pw, py + ph, colour=INK, lw=0.9)
    vlabel(slide, x0 + 0.10, py + ph / 2, ph, ylab)

    if ylo != 0:
        # declare the truncated baseline instead of letting the bars imply a ratio
        for dy in (0.0, 0.045):
            line(slide, px - 0.075, py + ph + 0.02 + dy, px + 0.075, py + ph - 0.03 + dy,
                 colour=INK, lw=1.0)
        text(slide, x0, py + ph + 0.20, PADL + 0.30, 0.16, 'axis starts at %d' % ylo,
             size=6.6, italic=True, colour=MUTED)

    names = list(series)
    n, m = len(targets), len(names)
    colw = pw / n
    bw = colw * 0.74 / m
    for i, t in enumerate(targets):
        gx = px + colw * i + colw * 0.13
        for k, nm in enumerate(names):
            val = series[nm][i]
            if val is None:
                continue
            bx = gx + k * bw
            rect(slide, bx, yv(val), bw * 0.88, yv(ylo) - yv(val),
                 fill=TOOL_COLOUR[nm], line=None)
            text(slide, bx - 0.055, yv(val) - 0.155, bw * 0.88 + 0.11, 0.15,
                 valfmt % val, size=5.9, colour=INK, align=PP_ALIGN.CENTER)
        text(slide, px + colw * i, py + ph + 0.06, colw, 0.42, t,
             size=7.2, colour=INK, align=PP_ALIGN.CENTER)
    return px, py, pw, ph


def legend_row(slide, x, y, names, size=8.4, gap=0.10):
    """Left-to-right key. Returns the x it finished at so callers can avoid collisions."""
    cx = x
    for nm in names:
        dot(slide, cx + 0.05, y + 0.075, 0.085, fill=TOOL_COLOUR[nm], line=WHITE, lw=0.6)
        wpt = 0.062 * len(nm) + 0.16
        text(slide, cx + 0.12, y, wpt, 0.17, nm, size=size, colour=INK)
        cx += 0.12 + wpt + gap
    return cx


def panel_C(slide, x0, y0, w, h, at, tools):
    """Pairwise mean absolute difference in PBS length, drawn as a lower-triangle matrix."""
    targets = [k for k in at if k != '_provenance']
    get = lambda t, tool: (at[t].get(tool) or {}).get('pbs')
    M = {}
    for a, b in itertools.combinations(tools, 2):
        d = [abs(get(t, a) - get(t, b)) for t in targets
             if get(t, a) is not None and get(t, b) is not None]
        if d:
            M[(a, b)] = M[(b, a)] = statistics.mean(d)

    text(slide, x0, y0 - 0.30, 0.22, 0.22, 'C', size=13, bold=True)
    text(slide, x0 + 0.22, y0 - 0.30, w - 0.22, 0.22,
         'Mean absolute difference in primer-binding-site length between tools, nt',
         size=10.5, bold=True)

    short = {'Plant Prime Editor': 'Plant Prime Editor', 'PlantPegDesigner': 'PlantPegDesigner',
             'pegFinder': 'pegFinder', 'PE-Designer': 'PE-Designer', 'PRIDICT': 'PRIDICT'}
    n = len(tools)
    LAB = 1.30
    cell = min((w - LAB - 0.10) / n, (h - 1.30) / n)
    # type scales with the cell: at 0.70 in a 12 pt value is comfortable, at 0.40 it is not
    vsz = max(8.0, min(13.5, cell * 17.0))
    lsz = max(6.8, min(9.2, cell * 11.5))
    gx, gy = x0 + LAB, y0 + 1.24

    for j, b in enumerate(tools):
        # angled so a long name cannot collide with its neighbour
        vlabel(slide, gx + j * cell + cell / 2, gy - 0.60, 1.44, short[b], size=lsz)
    for i, a in enumerate(tools):
        text(slide, x0, gy + i * cell + cell / 2 - 0.10, LAB - 0.12, 0.22,
             short[a], size=lsz, colour=INK, align=PP_ALIGN.RIGHT)
        for j, b in enumerate(tools):
            cx, cy = gx + j * cell, gy + i * cell
            if i == j:
                rect(slide, cx, cy, cell, cell, fill=RGBColor(0xF9, 0xFA, 0xFB),
                     line=RGBColor(0xE5, 0xE7, 0xEB), lw=0.5)
                continue
            v = M[(a, b)]
            f = min(1.0, v / 4.0)
            shade = RGBColor(int(0xFF - 0x60 * f), int(0xFF - 0x2A * f), int(0xFF - 0x66 * f))
            plant = {a, b} == {'Plant Prime Editor', 'PlantPegDesigner'}
            rect(slide, cx, cy, cell, cell,
                 fill=BAND if plant else shade,
                 line=TOOL_COLOUR['Plant Prime Editor'] if plant else RGBColor(0xE5, 0xE7, 0xEB),
                 lw=1.4 if plant else 0.5)
            text(slide, cx, cy + cell / 2 - vsz / 140.0, cell, vsz / 55.0, '%.2f' % v,
                 size=vsz, bold=plant, colour=INK, align=PP_ALIGN.CENTER)

    ny = gy + n * cell + 0.16
    dot(slide, x0 + 0.055, ny + 0.085, 0.11, fill=BAND,
        line=TOOL_COLOUR['Plant Prime Editor'], lw=1.4)
    text(slide, x0 + 0.17, ny, w - 0.22, 0.50,
         'the two plant-calibrated tools agree to within 1 nt; every other pairing differs by '
         '%.1f–%.1f nt' % (min(v for k, v in M.items() if set(k) != {'Plant Prime Editor', 'PlantPegDesigner'}),
                           max(M.values())),
         size=8.0, colour=MUTED)


def panel_D(slide, x0, y0, w, h, feats):
    """Capability matrix, grouped into themes with a per-tool tally."""
    hdr, body = feats[0], feats[1:]
    tools = hdr[1:]
    GROUPS = [('Entry point and annotation', 0, 4), ('Architecture coverage', 4, 10),
              ('Thermodynamics and promoter rules', 10, 13), ('Vector and cloning output', 13, 21),
              ('Prediction and off-target', 21, 23), ('Reproducibility and privacy', 23, 29)]

    text(slide, x0, y0 - 0.34, 0.24, 0.26, 'D', size=13, bold=True)
    text(slide, x0 + 0.24, y0 - 0.34, w - 0.24, 0.26,
         'Capability comparison across seven pegRNA design tools, 29 features',
         size=11.5, bold=True)

    LAB, COLW, RH = 3.62, 0.86, 0.1445
    gx = x0 + LAB
    rows_total = len(body) + len(GROUPS)
    gy = y0 + 0.60

    for j, t in enumerate(tools):
        cx = gx + j * COLW
        own = (j == 0)
        if own:
            rect(slide, cx, gy - 0.06, COLW, rows_total * RH + 0.12,
                 fill=RGBColor(0xF0, 0xFD, 0xF4), line=None)
        short_t = {'Plant Prime Editor': 'Plant Prime\nEditor'}.get(t, t)
        # keep each header strictly inside its own column: at 7.2 pt the longest name is
        # about 0.83 in, so a box wider than COLW lets neighbours touch
        text(slide, cx + 0.015, y0 + 0.02, COLW - 0.03, 0.46, short_t,
             size=7.0, bold=own, colour=TOOL_COLOUR['Plant Prime Editor'] if own else INK,
             align=PP_ALIGN.CENTER)
    line(slide, x0, gy - 0.08, gx + len(tools) * COLW, gy - 0.08, colour=INK, lw=1.0)

    y = gy
    for gname, a, b in GROUPS:
        text(slide, x0 + 0.04, y + 0.012, LAB - 0.10, 0.17, gname.upper(),
             size=6.6, bold=True, colour=TOOL_COLOUR['PRIDICT'])
        y += RH
        for r in body[a:b]:
            lab = r[0]
            if len(lab) > 58:
                lab = lab[:56] + '…'
            text(slide, x0 + 0.14, y + 0.014, LAB - 0.22, 0.17, lab, size=7.1, colour=INK)
            for j, v in enumerate(r[1:]):
                cx = gx + j * COLW + COLW / 2
                cy = y + RH / 2
                v = (v or '').strip()
                if v == 'Yes':
                    dot(slide, cx, cy, 0.098, fill=TOOL_COLOUR['Plant Prime Editor'], line=None)
                elif v == 'No':
                    dot(slide, cx, cy, 0.098, fill=None, line=RGBColor(0xD1, 0xD5, 0xDB), lw=1.1)
                elif v.startswith('Yes'):
                    dot(slide, cx - 0.055, cy, 0.098, fill=TOOL_COLOUR['Plant Prime Editor'], line=None)
                    extra = v[v.find('(') + 1:v.find(')')] if '(' in v else ''
                    text(slide, cx + 0.01, y + 0.020, 0.34, 0.16, extra, size=6.4, colour=MUTED)
                elif v.startswith('No ('):
                    dot(slide, cx, cy, 0.098, fill=None,
                        line=TOOL_COLOUR['Plant Prime Editor'], lw=1.2)
                elif v in ('—', ''):
                    text(slide, cx - 0.16, y + 0.015, 0.32, 0.16, '—', size=7.4,
                         colour=MUTED, align=PP_ALIGN.CENTER)
                else:
                    text(slide, cx - 0.22, y + 0.015, 0.44, 0.16, v, size=6.9,
                         colour=INK, align=PP_ALIGN.CENTER)
            y += RH
    line(slide, x0, y + 0.02, gx + len(tools) * COLW, y + 0.02, colour=INK, lw=1.0)

    tally = [sum(1 for r in body if str(r[1 + j]).strip().startswith('Yes')) for j in range(len(tools))]
    text(slide, x0 + 0.14, y + 0.09, LAB - 0.22, 0.20, 'Features present, of 29',
         size=7.4, bold=True, colour=INK)
    for j, c in enumerate(tally):
        cx = gx + j * COLW
        text(slide, cx, y + 0.09, COLW, 0.20, str(c), size=9.4, bold=(j == 0),
             colour=TOOL_COLOUR['Plant Prime Editor'] if j == 0 else INK, align=PP_ALIGN.CENTER)

    ly = y + 0.36
    dot(slide, x0 + 0.19, ly + 0.07, 0.098, fill=TOOL_COLOUR['Plant Prime Editor'], line=None)
    text(slide, x0 + 0.27, ly, 0.62, 0.18, 'present', size=7.6, colour=INK)
    dot(slide, x0 + 1.02, ly + 0.07, 0.098, fill=None, line=RGBColor(0xD1, 0xD5, 0xDB), lw=1.1)
    text(slide, x0 + 1.10, ly, 0.62, 0.18, 'absent', size=7.6, colour=INK)
    dot(slide, x0 + 1.80, ly + 0.07, 0.098, fill=None,
        line=TOOL_COLOUR['Plant Prime Editor'], lw=1.2)
    text(slide, x0 + 1.88, ly, 2.6, 0.18, 'delegated to an external tool', size=7.6, colour=INK)
    text(slide, x0 + 4.60, ly, w - 4.7, 0.18,
         'Feature set assessed 14 August 2026 on the versions in Table 1.',
         size=7.4, italic=True, colour=MUTED)


def figS4(slide, loto):
    """A: best measured length vs leave-one-out optimum.  B: out-of-sample rho per target."""
    argmax = loto['argmax']          # [target, best_measured, loto_optimum, n_lengths]
    rank   = loto['ranking']         # [target, rho, n_lengths]
    GREEN  = TOOL_COLOUR['Plant Prime Editor']

    text(slide, 0.42, 0.30, 12.4, 0.32,
         'Figure S4   Out-of-sample validation of the 8–11 nt primer-binding-site window',
         size=17, bold=True)

    # ── A ───────────────────────────────────────────────────────────────────
    x0, y0, w, h = 0.42, 1.02, 6.30, 5.16
    text(slide, x0, y0 - 0.30, 0.22, 0.24, 'A', size=13, bold=True)
    text(slide, x0 + 0.22, y0 - 0.30, w - 0.22, 0.24,
         'Best measured length against the optimum re-derived without that target',
         size=10.5, bold=True)
    PADL, PADB = 1.44, 0.46
    px, py = x0 + PADL, y0 + 0.30
    pw, ph = w - PADL - 0.10, h - 0.30 - PADB
    lo, hi = 5, 17
    xv = lambda v: px + (v - lo) / (hi - lo) * pw
    rowh = ph / len(argmax)

    # row stripes first: drawn afterwards they painted over the window band and broke it
    # into disconnected segments, which read as if the band applied only to some targets
    for i in range(len(argmax)):
        if i % 2 == 0:
            rect(slide, px, py + rowh * i, pw, rowh, fill=RGBColor(0xFA, 0xFB, 0xFC), line=None)
    rect(slide, xv(8), py, xv(11) - xv(8), ph, fill=BAND, line=None)
    text(slide, xv(8) - 0.30, py - 0.24, xv(11) - xv(8) + 0.60, 0.20, '8–11 nt window',
         size=7.4, bold=True, colour=GREEN, align=PP_ALIGN.CENTER)
    for v in range(lo, hi + 1, 2):
        line(slide, xv(v), py, xv(v), py + ph, colour=RGBColor(0xF0, 0xF1, 0xF3), lw=0.5)
        text(slide, xv(v) - 0.16, py + ph + 0.05, 0.32, 0.18, str(v),
             size=8, colour=MUTED, align=PP_ALIGN.CENTER)
    line(slide, px, py + ph, px + pw, py + ph, colour=INK, lw=0.9)
    text(slide, px, py + ph + 0.26, pw, 0.20, 'primer-binding-site length (nt)',
         size=8.6, colour=INK, align=PP_ALIGN.CENTER)

    for i, (name, best, opt, n) in enumerate(argmax):
        cy = py + rowh * (i + 0.5)
        text(slide, x0, cy - 0.09, PADL - 0.12, 0.20, name, size=7.4,
             colour=INK, align=PP_ALIGN.RIGHT)
        line(slide, xv(min(best, opt)), cy, xv(max(best, opt)), cy,
             colour=RGBColor(0xCB, 0xD5, 0xE1), lw=1.4)
        line(slide, xv(opt), cy - 0.075, xv(opt), cy + 0.075, colour=INK, lw=1.5)
        dot(slide, xv(best), cy, 0.098, fill=GREEN, line=WHITE, lw=0.6)
        text(slide, px + pw + 0.02, cy - 0.085, 0.30, 0.18, 'n=%d' % n,
             size=6.6, colour=MUTED)

    ly = py + ph + 0.52
    dot(slide, x0 + 0.10, ly + 0.07, 0.098, fill=GREEN, line=WHITE, lw=0.6)
    text(slide, x0 + 0.20, ly, 1.95, 0.18, 'best measured length', size=7.8, colour=INK)
    line(slide, x0 + 2.24, ly + 0.005, x0 + 2.24, ly + 0.145, colour=INK, lw=1.5)
    text(slide, x0 + 2.32, ly, 2.7, 0.18, 'leave-one-out optimum', size=7.8, colour=INK)
    text(slide, x0, ly + 0.24, w, 0.36,
         'All 13 best lengths fall inside 8–11 nt; binomial P = 2 × 10⁻⁷ against lengths drawn '
         'uniformly from the 5–17 nt range tested. The withheld target contributed nothing to '
         'the value used to predict it.', size=7.6, colour=MUTED)

    # ── B ───────────────────────────────────────────────────────────────────
    x1, w1 = 7.00, 5.90
    text(slide, x1, y0 - 0.30, 0.22, 0.24, 'B', size=13, bold=True)
    text(slide, x1 + 0.22, y0 - 0.30, w1 - 0.22, 0.24,
         'Out-of-sample Spearman correlation, per target', size=10.5, bold=True)
    PADL2 = 1.44
    bx, by = x1 + PADL2, y0 + 0.12
    bw, bh = w1 - PADL2 - 0.10, h - 0.12 - PADB
    rlo, rhi = 0.0, 1.0
    rx = lambda v: bx + (v - rlo) / (rhi - rlo) * bw
    rows = sorted(rank, key=lambda r: -r[1])
    rh2 = bh / len(rows)

    for v in [0, 0.25, 0.5, 0.75, 1.0]:
        line(slide, rx(v), by, rx(v), by + bh, colour=RGBColor(0xF0, 0xF1, 0xF3), lw=0.5)
        text(slide, rx(v) - 0.22, by + bh + 0.05, 0.44, 0.18, ('%g' % v),
             size=8, colour=MUTED, align=PP_ALIGN.CENTER)
    med = statistics.median(r[1] for r in rows)
    line(slide, rx(med), by, rx(med), by + bh, colour=GREEN, lw=1.2, dash=True)
    line(slide, bx, by + bh, bx + bw, by + bh, colour=INK, lw=0.9)
    text(slide, bx, by + bh + 0.26, bw, 0.20, 'Spearman ρ (out of sample)',
         size=8.6, colour=INK, align=PP_ALIGN.CENTER)

    for i, (name, rho, n) in enumerate(rows):
        cy = by + rh2 * (i + 0.5)
        if i % 2 == 0:
            rect(slide, bx, by + rh2 * i, bw, rh2, fill=RGBColor(0xFA, 0xFB, 0xFC), line=None)
        text(slide, x1, cy - 0.09, PADL2 - 0.12, 0.20, name, size=7.4,
             colour=INK, align=PP_ALIGN.RIGHT)
        rect(slide, bx, cy - 0.062, max(0.004, rx(rho) - bx), 0.124, fill=GREEN, line=None)
        text(slide, rx(rho) + 0.05, cy - 0.085, 0.42, 0.18, '%.2f' % rho, size=6.9, colour=INK)

    ly2 = by + bh + 0.52
    line(slide, x1 + 0.10, ly2 + 0.005, x1 + 0.10, ly2 + 0.145, colour=GREEN, lw=1.2, dash=True)
    text(slide, x1 + 0.18, ly2, 2.4, 0.18, 'median ρ = %.2f' % med, size=7.8, colour=INK)
    text(slide, x1, ly2 + 0.24, w1, 0.36,
         'Positive at every one of the eleven targets with four or more lengths tested; '
         'sign test P = 5 × 10⁻⁴. OsIPA1-T1 is excluded: a single measurement gives no best '
         'length to predict.', size=7.6, colour=MUTED)


def main():
    targets, idx, at, loto, feats = load()
    prs = Presentation(DECK)

    A_TOOLS = ['Plant Prime Editor', 'PlantPegDesigner', 'pegFinder', 'PE-Designer', 'PRIDICT']
    B_TOOLS = ['Plant Prime Editor', 'PlantPegDesigner', 'pegFinder', 'PE-Designer']
    get = lambda t, tool: (at[t].get(tool) or {}).get('pbs')
    lens = {tool: [get(t, tool) for t in targets] for tool in A_TOOLS}
    tms  = {tool: [(int(idx[(t, tool)]['pbs_tm_wallace_C'])
                    if (t, tool) in idx and idx[(t, tool)]['pbs_tm_wallace_C'] else None)
                   for t in targets] for tool in B_TOOLS}

    # ── slide: Figure 5, panels A–C ─────────────────────────────────────────
    s1 = blank_slide(prs)
    text(s1, 0.42, 0.30, 12.4, 0.32,
         'Figure 5   Comparison with existing pegRNA design tools on seven targets',
         size=17, bold=True)
    # A over B down the left, so both share one target axis reading order; C takes the
    # column this frees on the right, where it can be large enough to read at print size.
    bargroup(s1, 0.52, 1.02, 7.42, 2.42, targets, lens, 0, 16, 2,
             'primer-binding-site length (nt)', band=(8, 11), letter='A',
             title='Primer-binding-site length chosen by each tool')
    bargroup(s1, 0.52, 3.92, 7.42, 2.42, targets, tms, 0, 45, 5,
             'melting temperature (°C, Wallace)', band=(26, 34), hline=30, letter='B',
             title='Melting temperature of that choice')
    legend_row(s1, 1.12, 6.62, A_TOOLS)
    text(s1, 1.12, 6.86, 6.90, 0.46,
         'Shaded band in A marks the 8–11 nt plant-optimal window derived in this work; in B it '
         'marks 26–34 °C and the dashed line the 30 °C plant optimum of Lin et al. PRIDICT is '
         'absent from B because it reports no melting temperature.',
         size=7.6, colour=MUTED)
    panel_C(s1, 8.28, 1.02, 4.78, 5.90, at, A_TOOLS)

    # ── slide: Figure 5, panel D ────────────────────────────────────────────
    s2 = blank_slide(prs)
    text(s2, 0.42, 0.30, 12.4, 0.32,
         'Figure 5   Comparison with existing pegRNA design tools (panel D)',
         size=17, bold=True)
    panel_D(s2, 0.52, 1.06, 12.3, 5.9, feats)

    # ── slide: Figure S4 ────────────────────────────────────────────────────
    s3 = blank_slide(prs)
    figS4(s3, loto)

    # Final slide order, written once. The three new shape slides are appended by
    # add_slide, so they are the last three; the placed-image versions they replace
    # (Figure 5 A-C, Figure 5 D, Figure S4) are simply left out of the order.
    #
    #   0-3 Figures 1-3   4 Figure 4   5,6 old Fig 5 images   7 Figure 6
    #   8 S1   9,10 S2   11 S3   12 old S4 image   13 how-to   14,15,16 new
    ORDER = [0, 1, 2, 3, 4, 14, 15, 7, 8, 9, 10, 11, 16, 13]
    DROPPED = [5, 6, 12]
    reorder(prs, ORDER, DROPPED)
    _out = _ppe_out_path(DECK)
    prs.save(_out)
    print('  wrote ' + _out + ('  (--in-place given)' if _out == DECK else '  (original left untouched; pass --in-place to overwrite)'))
    print('  wrote three native-shape slides into %s' % os.path.basename(DECK))
    print('  Figure 5 A–C : %d shapes' % len(s1.shapes))
    print('  Figure 5 D   : %d shapes' % len(s2.shapes))
    print('  Figure S4    : %d shapes' % len(s3.shapes))


if __name__ == '__main__':
    main()
