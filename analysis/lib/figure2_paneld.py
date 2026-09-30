"""
One reader for panel D of the finalised Figure 2, used by the checker that verifies it and by
the patchers that change it.

It exists because the reading is the hard part and getting it wrong is silent. Two traps:

  * Three leftover cells sit at the very back of the z-order, off the column lattice, hidden
    behind the opaque cells drawn over them. They are invisible in the rendered figure. A first
    pass that collected them put two values in one cell and reported TaUbi10-T2/SNS as a design
    that moves with the weight, which it does not. Cells are therefore taken only where they
    sit on the lattice, and where two land in one place the LAST DRAWN wins — that is the one
    the reader sees.

  * The rotated labels under the grid anchor to the LEFT of their column and do not share the
    column's x. They are paired to columns by rank, never by position. Pairing them by position
    is what put every label one column out when the 32nd column was inserted.

Panel E's component labels ("10 nt", "8nt", "37 nt") sit at y = 6.15 in, just below the grid,
and end in "nt" like every cell. The row window stops at 6.0 in to keep them out.

If a patcher ever changes the lattice again, this is the one place the geometry is written down.
"""

# The lattice the panel is drawn on, in inches. X0 and PITCH0 are the deck's own geometry; the
# pitch narrowed by 31/32 when the 32nd column was inserted, which kept the right edge fixed.
X0 = 7.6672
PITCH0 = 0.17294
NCOL = 32
PITCH = PITCH0 * (NCOL - 1) / NCOL

ROW_Y = [4.518, 4.715, 4.913, 5.111, 5.309, 5.507, 5.705]

X_MIN, X_MAX = 7.5, 13.05
Y_MIN, Y_MAX = 4.4, 6.0
ON_ROW = ON_COL = 0.03          # inches a shape may sit off its row or its column

# Nothing should sit off the lattice. Three leftover cells did until 29 September 2026, hidden
# behind the opaque cells drawn over them, contradicting the grid and costing a first pass at
# the checker a false finding. They were deleted after a render at 300 dpi proved the
# figure pixel-identical with and without them. Anything off the
# lattice now is new and unexplained.
KNOWN_LEFTOVERS = 0

GROUP = 6                       # MSO_SHAPE_TYPE.GROUP

# The panel writes the edit type in the reader's abbreviations, the sweep in the caller's.
EDIT_CODE = {'SNP': 'SNS', 'MNP': 'MNS', 'INS': 'IN', 'DEL': 'DEL'}


def inch(emu):
    return emu / 914400.0


def leaves(shapes):
    """Every non-group shape, in drawing order — later means drawn on top."""
    for sh in shapes:
        if sh.shape_type == GROUP:
            for x in leaves(sh.shapes):
                yield x
        else:
            yield sh


def read_grid(slide):
    """{(row, column): shape} for the 7 x 32 grid, plus the number of shapes off the lattice.

    The shape returned is the text shape, so a caller can read its text or rewrite it in place
    and keep the font it already has.
    """
    cells, offlattice = {}, 0
    for sh in leaves(slide.shapes):
        if sh.left is None or not sh.width or not sh.has_text_frame:
            continue
        if not sh.text_frame.text.strip().endswith('nt'):
            continue
        x, y = inch(sh.left), inch(sh.top)
        if not (X_MIN <= x <= X_MAX and Y_MIN <= y <= Y_MAX):
            continue
        r = min(range(len(ROW_Y)), key=lambda k: abs(ROW_Y[k] - y))
        c = round((x - X0) / PITCH)
        if (abs(ROW_Y[r] - y) > ON_ROW or not (0 <= c < NCOL)
                or abs(x - (X0 + c * PITCH)) > ON_COL):
            offlattice += 1
            continue
        cells[(r, c)] = sh                       # last drawn wins
    return cells, offlattice


def read_labels(slide):
    """The rotated column labels, left to right — index 0 is column 0."""
    labs = [sh for sh in leaves(slide.shapes)
            if getattr(sh, 'rotation', 0) and abs(sh.rotation) > 10
            and sh.left is not None and inch(sh.left) >= 7.0
            and sh.has_text_frame and sh.text_frame.text.strip()]
    return sorted(labs, key=lambda sh: sh.left)


def sweep_columns(per_locus):
    """The column name the panel uses for each entry of the sweep, in the sweep's order.

    The sweep disambiguates two same-named loci by study — "OsALS-T2 (Lin 2021)" — and the
    panel does not, and does not need to, since the column's position carries that.
    """
    return ['%s/%s' % (q['locus'].split(' (')[0], EDIT_CODE[q['edit_type']]) for q in per_locus]


def set_cell_text(shape, text):
    """Rewrite a cell in place, keeping the run it already has so the font survives."""
    para = shape.text_frame.paragraphs[0]
    if not para.runs:
        shape.text_frame.text = text
        return
    para.runs[0].text = text
    for r in list(para.runs)[1:]:
        r.text = ''
