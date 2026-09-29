#!/usr/bin/env python3
"""
reference_format.py — the one description of what a reference entry in this submission looks
like, shared by the patcher that writes them and the checker that reads them.

THE HOUSE RULE, taken from the manuscript itself rather than from a style guide.

    Twenty-seven of the manuscript's twenty-eight entries follow one rule: every author is
    named when a paper has ten or fewer, and the first ten are named followed by "et al."
    when it has more. That is Cell Press style, which is what Plant Communications uses.
    Journal names are abbreviated in the Cell Press form — Nat. Biotechnol., Genome Biol.,
    Plant Commun., Mol. Plant, Proc. Natl. Acad. Sci. USA.

    The twenty-eighth, Zhao et al. (2025), names all eighteen of its authors. That is the
    outlier, not the rule.

WHY THE SUPPLEMENTARY IS BROUGHT TO THE MANUSCRIPT AND NOT THE OTHER WAY ROUND.

    The authors asked for one format across both files, and did not say which. Two things
    decide it.

    First, the supplementary's scheme is not merely a different style, it is wrong. Where the
    manuscript writes "…, Sahin, M., et al. (2021)", the supplementary writes
    "…, Sahin, M., and Osborn, M.J. (2021)" — the eleventh author's name in place of "et al.",
    joined with "and", which tells the reader the list is complete and that Osborn is the
    last author. Chen et al. (2021) has fourteen authors and its last author is Liu. Every
    DOI in both documents was resolved against Crossref on 29 September 2026 and five
    supplementary entries fail this way:

        Chen et al. 2021    prints 11 of 14 authors, names Osborn last; published last is Liu
        Hsu et al. 2013     prints 11 of 14 authors, names Cradick last; published last is Zhang
        Li et al. 2023      prints 11 of 12 authors, names Qin last; published last is Wei
        Lin et al. 2020     prints 11 of 12 authors, names Liu last; published last is Gao
        Ma et al. 2015      prints 11 of 20 authors, names Xie last; published last is Liu

    All twenty-eight manuscript entries pass the same test. Converting the manuscript to the
    supplementary's scheme would have meant inventing eighteen author names or reproducing
    five misattributions.

    Second, the supplementary's full journal titles carry three transcription faults —
    "Plant Commununications", "Proceedings of the National Academy of sciences USA", and a
    stray full stop in "Nature Biotechnology." — and one title fault, Dang et al.'s
    "Optimizing sgRNA structure improve", which drops the word "to". The published title is
    "Optimizing sgRNA structure to improve CRISPR-Cas9 knockout efficiency".

WHERE THE TEXT COMES FROM.

    Twelve of the supplementary's fifteen references are also in the manuscript. For those the
    patcher does not rewrite anything: it copies the manuscript's entry across, matched by DOI.
    One document is the source and the two cannot drift apart afterwards.

    Three are in the supplementary only — Dang et al. 2015, Ma et al. 2015 and Tang et al.
    2020 — and are written out here. Authors, title, journal, volume and pages for those three
    were taken from the Crossref record for the DOI the supplementary already prints, not
    reconstructed from the supplementary's own text.
"""

# ── the three references the manuscript does not carry ──────────────────────
# Each is keyed by the DOI the supplementary already prints, so a mistyped DOI cannot be
# papered over by a match on surname and year.

SUPPLEMENT_ONLY = {
    # 8 authors — fewer than ten, so every author is named.
    '10.1186/s13059-015-0846-3':
        'Dang, Y., Jia, G., Choi, J., Ma, H., Anaya, E., Ye, C., Shankar, P., and Wu, H. '
        '(2015). Optimizing sgRNA structure to improve CRISPR-Cas9 knockout efficiency. '
        'Genome Biol. 16:280. https://doi.org/10.1186/s13059-015-0846-3.',

    # 20 authors — the first ten, then et al.
    '10.1016/j.molp.2015.04.007':
        'Ma, X., Zhang, Q., Zhu, Q., Liu, W., Chen, Y., Qiu, R., Wang, B., Yang, Z., Li, H., '
        'Lin, Y., et al. (2015). A robust CRISPR/Cas9 system for convenient, high-efficiency '
        'multiplex genome editing in monocot and dicot plants. Mol. Plant 8:1274–1284. '
        'https://doi.org/10.1016/j.molp.2015.04.007.',

    # 13 authors — the first ten, then et al.
    '10.1016/j.molp.2020.03.010':
        'Tang, X., Sretenovic, S., Ren, Q., Jia, X., Li, M., Fan, T., Yin, D., Xiang, S., '
        'Guo, Y., Liu, L., et al. (2020). Plant prime editors enable precise gene editing in '
        'rice cells. Mol. Plant 13:667–670. https://doi.org/10.1016/j.molp.2020.03.010.',
}

# ── the one manuscript entry that breaks the manuscript's own rule ──────────
# Eighteen authors written out in full. Truncated to ten and et al., like the other twelve
# entries with more than ten authors. Authors six and ten really are both Wang, W.
# (Wenping and Wenxi); the repetition is in the published record, not a slip here.

MANUSCRIPT_FIX = {
    '10.1038/s41477-024-01898-3':
        'Zhao, Y., Huang, Z., Zhou, X., Teng, W., Liu, Z., Wang, W., Tang, S., Liu, Y., '
        'Liu, J., Wang, W., et al. (2025). Precise deletion, replacement and inversion of '
        'large DNA fragments in plants using dual prime editing. Nat. Plants 11:191–205. '
        'https://doi.org/10.1038/s41477-024-01898-3.',
}

# ── the published author count behind every DOI either document cites ───────
# Resolved from Crossref on 29 September 2026 and frozen here, so the checker can decide
# whether an entry may name all its authors or must stop at ten without needing a network.
# (doi): (number of authors, surname of the last author)

PUBLISHED = {
    '10.1016/0022-2836(70)90057-4': (2, 'Wunsch'),
    '10.1016/0022-2836(81)90087-5': (2, 'Waterman'),
    '10.1016/j.cell.2021.09.018': (14, 'Liu'),
    '10.1016/j.molp.2015.04.007': (20, 'Liu'),
    '10.1016/j.molp.2020.03.010': (13, 'Zhang'),
    '10.1016/j.xplc.2020.100043': (6, 'Wei'),
    '10.1016/j.xplc.2023.100572': (12, 'Wei'),
    '10.1021/bi702363u': (5, 'Walder'),
    '10.1038/nbt.2647': (14, 'Zhang'),
    '10.1038/nbt.3437': (13, 'Root'),
    '10.1038/s41467-021-21337-7': (11, 'Pinello'),
    '10.1038/s41477-024-01786-w': (6, 'Kim'),
    '10.1038/s41477-024-01898-3': (18, 'Zong'),
    '10.1038/s41551-020-00622-8': (4, 'Chen'),
    '10.1038/s41586-019-1711-4': (11, 'Liu'),
    '10.1038/s41587-020-0455-x': (12, 'Gao'),
    '10.1038/s41587-021-00868-w': (11, 'Gao'),
    '10.1038/s41587-021-00891-x': (9, 'Gao'),
    '10.1038/s41587-021-01039-7': (11, 'Liu'),
    '10.1038/s41587-021-01133-w': (9, 'Liu'),
    '10.1038/s41587-022-01254-w': (11, 'Gao'),
    '10.1038/s41587-024-02268-2': (15, 'Schwank'),
    '10.1038/s41587-026-03174-5': (10, 'Gao'),
    '10.1038/s41596-022-00773-9': (4, 'Gao'),
    '10.1073/pnas.95.4.1460': (1, 'SantaLucia'),
    '10.1093/nar/gkab319': (7, 'Bae'),
    '10.1186/s13059-015-0846-3': (8, 'Wu'),
    '10.1186/s13059-016-1012-2': (12, 'Concordet'),
    '10.1186/s13059-021-02458-0': (4, 'Cheng'),
    '10.1186/s13059-023-02990-1': (8, 'Zong'),
    '10.1186/s13059-024-03282-y': (9, 'Wei'),
}

# The cap the rule applies. Ten is not arbitrary: it is what twenty-seven of the manuscript's
# twenty-eight entries do, and what Cell Press asks for.
ET_AL_AFTER = 10

# Full journal titles that must not appear, with the abbreviation the manuscript uses. The
# two misspellings are listed because they are what the supplementary actually contains.
FULL_TITLES = {
    'Nature Biotechnology': 'Nat. Biotechnol.',
    'Nature Plants': 'Nat. Plants',
    'Genome Biology': 'Genome Biol.',
    'Molecular Plant': 'Mol. Plant',
    'Plant Communications': 'Plant Commun.',
    'Plant Commununications': 'Plant Commun.',
    'Proceedings of the National Academy of sciences USA': 'Proc. Natl. Acad. Sci. USA',
    'Proceedings of the National Academy of Sciences USA': 'Proc. Natl. Acad. Sci. USA',
}
