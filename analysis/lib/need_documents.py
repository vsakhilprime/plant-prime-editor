"""
One place to say "this check needs the submitted documents, which the deposit does not hold".

Six checkers read Manuscript_PlantPrimeEditor.docx, Supplementary_Data.docx, Figure_Legends.docx
or Supplementary_Tables_v1.0.xlsx. Those are the files submitted to the journal; the code deposit
holds the software, the data and the analyses, not the manuscript. Run from an unpacked deposit
the six therefore had nothing to read, and they said so in four different ways:

    check_site_counts_in_text.py   a clear message, but exit status 1
    check_edits_are_published.py   "FAIL  3 disagree" — a missing file reported as a wrong deposit
    the other four                 a Python traceback

The first is nearly right, the second is the dangerous one — a reviewer reads a failure and
concludes the deposit disagrees with itself — and a traceback reads as a broken script. All six
now print the same sentence and exit 0, which is what the README already promises for the
scripts that need the figure deck: "Each says so and exits cleanly if it is not given one."

Exit 0 is deliberate. Nothing was checked, so nothing failed; a non-zero status in a suite run
would mark the deposit bad for a file the deposit was never meant to carry.
"""
import os
import sys

DOCUMENTS = ('Manuscript_PlantPrimeEditor.docx', 'Supplementary_Data.docx',
             'Figure_Legends.docx', 'Supplementary_Tables_v1.0.xlsx')


def require(paths, script, flag='--dir'):
    """Exit cleanly, with an explanation, if any of `paths` is absent."""
    # A None entry means the caller has its own default search for that file and will report
    # it itself; only a path that was named and is absent counts as missing.
    missing = [p for p in paths if p and not os.path.exists(p)]
    if not missing:
        return
    names = ', '.join(sorted({os.path.basename(p) for p in missing}))
    one = len(missing) == 1
    print('  this check reads the submitted document%s %s,' % ('' if one else 's', names))
    print('  which %s not part of the code deposit — it holds the software, the data and the'
          % ('is' if one else 'are'))
    print('  analyses. Point it at the folder holding them and it will run:')
    print('      python3 analysis/%s %s path/to/documents' % (script, flag))
    print('  nothing checked.')
    sys.exit(0)
