#!/usr/bin/env python3
"""
Check the deposit as a thing a stranger downloads, not as a set of analyses.

Every other checker here asks whether a number is right. This one asks whether the archive is
what it says it is: whether the README describes the files that are present, whether a command
it advertises can run at all, and whether anything is in the box that should not be published.
It was written on 28 September 2026 after a pre-deposit read found six faults of that kind, all
invisible to the other checkers because none of them looks at the archive as a whole:

  * README.md said, in bold, that the figures were "deliberately not redistributed here" and
    that the assembled deck "is not shipped either", while eight per-figure .pptx files sat in
    the root and the deck sat in docs/
  * six checkers the README and Supplementary Table S13 advertise as runnable read the
    submitted Word and Excel documents, which the deposit does not contain — five raised a
    traceback and one printed "FAIL  3 disagree", a missing file reported as a wrong deposit
  * those six defaulted to an absolute path inside one author's home directory
  * __pycache__ directories with compiled .pyc files were staged for publication
  * analysis/rank_analysis.js could not run at all, and its output was shipped
  * the Figure S4 contents line in the workbook still said "out-of-sample", the wording the
    Word copy had been corrected away from because the legend disclaims it

    python3 analysis/check_deposit_integrity.py

Exit status 1 if anything disagrees. It needs nothing beyond the deposit.
"""
import ast
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OK, BAD = [], []


def ck(what, ok, got=''):
    (OK if ok else BAD).append((what, got))


README = open(os.path.join(ROOT, 'README.md'), encoding='utf8').read()

# ── 1. every file the README names exists ───────────────────────────────────
named = set()
for m in re.finditer(r'`((?:analysis|tests|data|docs|DataS1)/[A-Za-z0-9_./*-]+|'
                     r'[A-Za-z0-9_.-]+\.(?:py|js|md|html|json|csv|cff|pptx|xlsx|svg))`', README):
    tok = m.group(1)
    if '*' in tok or tok.endswith('/'):
        continue
    named.add(tok)
# A bare filename used to be exempt, because the test required a '/' in the token. Fourteen
# files were deleted on 30 September and the README went on describing every one of them,
# with this check passing. A name in a code span is now resolved against the archive
# wherever it lives.
def _exists(tok):
    if os.path.exists(os.path.join(ROOT, tok)):
        return True
    if '/' in tok:
        return False
    return any(os.path.exists(os.path.join(ROOT, d, tok))
               for d in ('analysis', 'analysis/lib', 'tests', 'tests/lib', 'data', 'docs'))


# A name the README introduces as something a script WRITES is an output, and an output that
# is not shipped is absent by design rather than missing. The exemption is narrow: the word
# has to appear on the same line as the name, so it cannot quietly cover a real omission.
def _is_declared_output(tok):
    for line in README.split('\n'):
        if '`' + tok + '`' in line:
            low = line.lower()
            if 'writes' in low or 'generated' in low or 'produces' in low:
                return True
    return False


absent = sorted(t for t in named if not _exists(t) and not _is_declared_output(t))
ck('every file the README names in a code span exists', not absent,
   '%d names' % len(named) if not absent else 'absent: ' + ', '.join(absent[:8]))

# ── 2. nothing that must not be published ───────────────────────────────────
junk, empty, big = [], [], []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d != '.git']
    for d in dn:
        if d in ('__pycache__', '.ipynb_checkpoints', '.pytest_cache', 'node_modules'):
            junk.append(os.path.relpath(os.path.join(dp, d), ROOT))
    for f in fn:
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, ROOT)
        if f.endswith(('.pyc', '.pyo', '.bak', '.orig', '~')) or f == '.DS_Store':
            junk.append(rel)
        try:
            sz = os.path.getsize(p)
        except OSError:
            continue
        if sz == 0:
            empty.append(rel)
        if sz > 25 * 1024 * 1024:
            big.append('%s (%.1f MB)' % (rel, sz / 1048576))
ck('no caches, compiled or editor-backup files are staged', not junk,
   'clean' if not junk else ', '.join(junk[:6]))
ck('no zero-byte files', not empty, 'none' if not empty else ', '.join(empty[:6]))
ck('no file over 25 MB', not big, 'largest under 25 MB' if not big else ', '.join(big))

# ── 3. no path inside anyone's home directory in a script that must run ─────
# THIS CHECK USED TO PASS VACUOUSLY, and was caught only on 29 September 2026 by running the
# archive on someone else's computer, where analysis/check_gene_index.py died with
#
#     FileNotFoundError: <a directory that existed only on the machine it was written on>
#
# a path inside the home directory of the machine the analyses were written on, carried as an
# argparse default. That is precisely what this section exists to catch, and it reported
# "23 scripts checked, 0 disagree".
#
# The old rule skipped a match when the text before it ended in a single quote, meant to
# excuse a path inside a docstring. What it actually excused was every path written as a
# string literal — the line reads  ap.add_argument('--xlsx', default='  and ends in a quote —
# so the check passed on every case that mattered and failed on none.
#
# Python is now parsed rather than pattern-matched: ast finds every string literal, docstrings
# are identified by position and excused, and anything else carrying a home path is reported.
# JavaScript still goes line by line, but only a line that is genuinely a comment is skipped.
RUNNABLE = [f for f in os.listdir(HERE)
            if (f.startswith(('check_', 'build_', 'score_', 'fit_', 'loto_', 'merge_',
                              'recovery_', 'window_', 'architecture_', 'weight_', 'case_',
                              'homology_', 'headtohead', 'rank_', 'make_', 'analyse_',
                              'verify_', 'gene_', 'emit_', 'compute_'))
                and f.endswith(('.py', '.js')))]
HOME_PATH = re.compile(r'/(?:home|Users)/[A-Za-z0-9_.-]+/[A-Za-z0-9_./-]*')


def docstring_nodes(tree):
    """Every string Constant that is a docstring, by identity."""
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = getattr(node, 'body', None)
            if (body and isinstance(body[0], ast.Expr)
                    and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                out.add(id(body[0].value))
    return out


homes, unparsed = [], []
for f in sorted(RUNNABLE):
    path = os.path.join(HERE, f)
    txt = open(path, encoding='utf8', errors='ignore').read()
    if f.endswith('.py'):
        try:
            tree = ast.parse(txt)
        except SyntaxError:
            unparsed.append(f)
            continue
        docs = docstring_nodes(tree)
        for node in ast.walk(tree):
            if (isinstance(node, ast.Constant) and isinstance(node.value, str)
                    and id(node) not in docs):
                m = HOME_PATH.search(node.value)
                if m:
                    homes.append('%s line %s: %s' % (f, node.lineno, m.group(0)[:48]))
    else:
        for i, line in enumerate(txt.split('\n'), 1):
            stripped = line.lstrip()
            if stripped.startswith(('//', '*', '/*')):
                continue
            m = HOME_PATH.search(line)
            if m:
                homes.append('%s line %d: %s' % (f, i, m.group(0)[:48]))

ck('every runnable analysis parses, so this check can see inside it', not unparsed,
   '%d scripts' % len(RUNNABLE) if not unparsed else 'unparsed: ' + ', '.join(unparsed))
ck('no runnable analysis depends on a path inside a home directory', not homes,
   '%d scripts checked' % len(RUNNABLE) if not homes else '; '.join(sorted(set(homes))[:5]))

# ── 4. every Python and JavaScript file parses ──────────────────────────────
bad_py, bad_js = [], []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in ('.git', 'node_modules', '__pycache__')]
    for f in fn:
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, ROOT)
        if f.endswith('.py'):
            try:
                ast.parse(open(p, encoding='utf8', errors='ignore').read())
            except SyntaxError as e:
                bad_py.append('%s line %s' % (rel, e.lineno))
        elif f.endswith('.js') and '/lib/' not in rel:
            r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
            if r.returncode != 0:
                bad_js.append(rel)
ck('every Python file parses', not bad_py, 'all parse' if not bad_py else ', '.join(bad_py[:5]))
ck('every JavaScript file parses', not bad_js, 'all parse' if not bad_js else ', '.join(bad_js[:5]))

# ── 5. every JSON file parses ───────────────────────────────────────────────
bad_json = []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in ('.git', 'node_modules')]
    for f in fn:
        if f.endswith('.json'):
            try:
                json.load(open(os.path.join(dp, f), encoding='utf8'))
            except Exception as e:
                bad_json.append('%s (%s)' % (os.path.relpath(os.path.join(dp, f), ROOT),
                                             str(e)[:40]))
ck('every JSON file parses', not bad_json, 'all parse' if not bad_json else '; '.join(bad_json[:4]))

# ── 6. the licence and the citation record ──────────────────────────────────
ck('LICENSE is present', os.path.exists(os.path.join(ROOT, 'LICENSE')))
cff_path = os.path.join(ROOT, 'CITATION.cff')
ck('CITATION.cff is present', os.path.exists(cff_path))
if os.path.exists(cff_path):
    cff = open(cff_path, encoding='utf8').read()
    for field in ('title:', 'authors:', 'version:', 'license'):
        ck('CITATION.cff states %s' % field.rstrip(':'), field in cff,
           'present' if field in cff else 'MISSING')
    doi = re.findall(r'10\.5281/zenodo\.\d+', cff)
    ck('CITATION.cff carries a Zenodo DOI', bool(doi), ', '.join(sorted(set(doi))) or 'NONE')
    in_readme = re.findall(r'10\.5281/zenodo\.\d+', README)
    ck('every DOI in CITATION.cff also appears in the README',
       not (set(doi) - set(in_readme)),
       'consistent' if not (set(doi) - set(in_readme))
       else 'only in the citation file: ' + ', '.join(sorted(set(doi) - set(in_readme))))

# ── 7. the tool itself, and the suite that exercises it ─────────────────────
tool = os.path.join(ROOT, 'plant_prime_editor_v1.0.html')
ck('the tool is present', os.path.exists(tool))
if os.path.exists(tool):
    html = open(tool, encoding='utf8', errors='ignore').read()
    ck('the tool carries a build fingerprint', 'PPE_BUILD' in html,
       'present' if 'PPE_BUILD' in html else 'MISSING')
    ck('the tool contains no stray control characters',
       not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', html),
       'clean' if not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', html)
       else 'a control byte is present — one such byte once disabled a whole check')
runner = os.path.join(ROOT, 'tests', 'run_all.js')
ck('the test runner is present', os.path.exists(runner))

# ── 8. nothing in the archive reads the submitted documents ─────────────────
# Until 30 September 2026 nine checkers read the manuscript, the supplementary tables or the
# figure legends, and a shared helper explained their absence. Those documents go to the
# journal, not into a code deposit, so the checkers that read them have gone with them and
# PPE_DOCS is no longer part of this archive. What remains re-derives the paper's numbers
# from the deposited data alone.
#
# THIS IS CHECKED RATHER THAN ASSUMED because the previous version of this section listed the
# nine by name and skipped any that were absent — so when they were deleted it went on
# reporting "9 checkers, 0 disagree" while guarding nothing at all.
doc_readers = []
for f in sorted(os.listdir(HERE)):
    if not f.endswith(('.py', '.js')):
        continue
    txt = open(os.path.join(HERE, f), encoding='utf8', errors='ignore').read()
    if 'need_documents' in txt and f != 'check_deposit_integrity.py':
        doc_readers.append(f)
ck('no script still expects the submitted documents', not doc_readers,
   '%d scripts checked' % len([f for f in os.listdir(HERE) if f.endswith(('.py', '.js'))])
   if not doc_readers else ', '.join(doc_readers))
ck('the helper that explained their absence is gone too',
   not os.path.exists(os.path.join(ROOT, 'analysis', 'lib', 'need_documents.py')),
   'removed with them')
ck('the README no longer sends a reader to PPE_DOCS', 'PPE_DOCS' not in README,
   'not mentioned' if 'PPE_DOCS' not in README else 'still documented')

# ── 9. no figure deck ships at all ──────────────────────────────────────────
# The invariant changed on 29 September 2026. The deposit used to carry the two finalised
# decks, and this section checked that they were present and that no builder deck sat beside
# them. The authors now supply the figures to the journal directly, so the rule is simpler and
# stronger: NO .pptx anywhere in the archive. That subsumes the old builder-deck check, and it
# has to look at the whole tree rather than the root, because analysis/Figure4_ABC_editable.pptx
# survived an earlier sweep that only looked at the root, and every figure builder writes a
# fresh deck beside itself each time it runs.
figs = sorted(os.path.relpath(os.path.join(dp, f), ROOT)
              for dp, dn, fn in os.walk(ROOT) for f in fn
              if f.endswith('.pptx') and '__pycache__' not in dp)
ck('no figure deck ships in the archive', not figs,
   'none, as the README says' if not figs else 'present: ' + ', '.join(figs))

# The README must say so, and say it in the words this check can find. A claim nothing
# verifies is how the previous version came to state, in bold, that the figures were not
# redistributed while eight of them sat in the root.
claims_absent = bool(re.search(r'\*\*The published figures are not redistributed here\.\*\*',
                               README))
ck('the README states that the figures are not redistributed', claims_absent,
   'stated' if claims_absent else 'the README does not make the claim this check looks for')

# Every script that reads a deck must survive not being given one, or a reviewer running the
# suite against this archive meets a traceback for a file the archive is not meant to hold.
DECK_READERS = ['check_figure2_panelD.py', 'check_figure_overlaps.py',
                'build_editable_figures.py', 'build_figure7_blocks.py',
                'build_figure6_editable.py', 'place_figureS3_slide.py']
present = [f for f in DECK_READERS if os.path.exists(os.path.join(HERE, f))]
rough = []
for f in present:
    r = subprocess.run([sys.executable, os.path.join(HERE, f)],
                       capture_output=True, text=True, cwd=ROOT, timeout=120)
    if r.returncode != 0:
        rough.append('%s exits %d' % (f, r.returncode))
ck('every script that reads a figure deck exits cleanly without one', not rough,
   '%d scripts' % len(present) if not rough else '; '.join(rough))

# ── the build stamp the archive states about itself ─────────────────────────
# Added 30 September 2026. README.md line 9 said `96e270bb`; the tool computed 98b8c5c6 and had
# since 27 September. A reader comparing the front page with the program's own footer found two
# different builds in one archive, and the fingerprint exists precisely so a result can be
# pinned to a build. Nothing checked it, because nothing ran the tool and asked.
#
# Only the CURRENT claim is checked. 96e270bb still appears in README.md and in
# build_equivalence.js as the endpoint of the August citation audit, which is what it was, and
# analysis/figure2_panels.json carries it because that file IS the 96e270bb data.
m = re.search(r'design-parameter fingerprint `([0-9a-f]{8})`', README)
r = subprocess.run(
    ['node', '-e',
     'const vm=require("vm");'
     'const {ctx}=require(process.env.PPE_ROOT+"/tests/lib/load_tool.js");'
     'console.log("@@FP@@"+vm.runInContext("PPE_BUILD.fingerprint",ctx));'],
    capture_output=True, text=True, cwd=ROOT, timeout=180,
    env=dict(os.environ, PPE_ROOT=ROOT,
             PPE_HTML=os.path.join(ROOT, 'plant_prime_editor_v1.0.html')))
live = ''.join(ln[6:].strip() for ln in r.stdout.split('\n') if ln.startswith('@@FP@@'))
ck('the README states the fingerprint the tool computes',
   bool(m) and bool(live) and m.group(1) == live,
   ('README %s == tool %s' % (m.group(1), live)) if (m and live and m.group(1) == live)
   else ('README %s, tool %s' % (m.group(1) if m else '<not stated>', live or '<could not read>')))

# Every export the tool writes carries the stamp, and docs/OFFLINE.md quotes one as an example.
# It quoted the 96e270bb stamp for five weeks. A quoted example that no run can reproduce is a
# worked example that lies.
OFFLINE = open(os.path.join(ROOT, 'docs', 'OFFLINE.md'), encoding='utf8').read()
stamps = set(re.findall(r'parameters ([0-9a-f]{8})\)', OFFLINE))
ck('every build stamp quoted in docs/OFFLINE.md is the current one',
   bool(live) and stamps == {live},
   'quotes %s' % (', '.join(sorted(stamps)) or 'none') if stamps != {live} else live)

# ── the numbers the README quotes about the analyses ────────────────────────
# Added 30 September 2026. README.md advertised `fit_tm_optimum.py  # Figure 4, optimum
# 29.6 °C Wallace`. That was the value until 29 September, when single-measurement targets
# stopped entering the within-target normalisation and the cohort went from 73 points to 72;
# the fit moved to 29.3 and verify_manuscript_numbers.py was updated, but the README was not.
# The manuscript and the submitted figure both say 29.3, so the README was the only place in
# the archive still quoting a number the archive cannot reproduce.
#
# Checked against analysis/fig4data.json rather than by re-running the fit: the JSON is what
# the fit writes and is deterministic, and running fit_tm_optimum.py here would rewrite
# data/Figure_TmRecalibration.svg as a side effect — a checker must not dirty what it checks.
try:
    _f4 = json.load(open(os.path.join(HERE, 'fig4data.json')))
    _mu = round(float(_f4['A']['mu']), 1)
    _m = re.search(r'optimum ([\d.]+) ?°C Wallace', README)
    ck('the README quotes the Wallace optimum the fit produces',
       bool(_m) and float(_m.group(1)) == _mu,
       ('README %s == fig4data %s' % (_m.group(1), _mu)) if (_m and float(_m.group(1)) == _mu)
       else ('README %s, fig4data %s' % (_m.group(1) if _m else '<not quoted>', _mu)))
except Exception as _e:
    ck('the README quotes the Wallace optimum the fit produces', False, 'could not check: %s' % _e)

# ── nothing points at a script the archive does not contain ─────────────────
# Added the same day. Fourteen scripts were removed on 30 September and six references to five
# of them stayed behind, in a JSON comment, two .js comments, a .py docstring and the tool's own
# HTML twice. analysis/rebuild_all_figures.py printed one of them as a step to run. The README
# check above could not see any of these: it reads code spans in README.md alone.
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.ipynb_checkpoints', '.pytest_cache'}
TEXT_EXT = {'.py', '.js', '.md', '.json', '.html', '.txt', '.csv', '.cff', '.yml', '.yaml'}
SCRIPT_REF = re.compile(r'\b((?:analysis|tests)/(?:lib/)?[A-Za-z0-9_-]+\.(?:py|js))\b')
dead = {}
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        if os.path.splitext(fn)[1].lower() not in TEXT_EXT:
            continue
        fp = os.path.join(dirpath, fn)
        try:
            body = open(fp, encoding='utf8', errors='replace').read()
        except OSError:
            continue
        for ref in set(SCRIPT_REF.findall(body)):
            if not os.path.exists(os.path.join(ROOT, ref)):
                dead.setdefault(ref, set()).add(os.path.relpath(fp, ROOT))
ck('no file in the archive names a script the archive does not contain', not dead,
   'checked every text file' if not dead else
   '; '.join('%s (in %s)' % (k, ', '.join(sorted(v))) for k, v in sorted(dead.items())))


# ── report ──────────────────────────────────────────────────────────────────
for w, g in OK:
    print('  ok    %-66s %s' % (w[:66], g))
for w, g in BAD:
    print('  FAIL  %-66s %s' % (w[:66], g))
print('\n  %d ok, %d FAILED' % (len(OK), len(BAD)))
sys.exit(1 if BAD else 0)
