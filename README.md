# Plant Prime Editor v1.0

A browser-based platform that carries a plant prime editing design from allele comparison
through pegRNA construction to a cloning-ready primer set. All computation runs client-side;
no sequence leaves the browser.

**Live server:** https://akprimeedit.com — no login, registration or email address
**Source:** https://github.com/vsakhilprime/plant-prime-editor
**Build:** 2026-08-19 · public at akprimeedit.com since 2026-03-26 · design-parameter fingerprint `96e270bb`
**Archive:** [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22076360.svg)](https://doi.org/10.5281/zenodo.22076360)

---

## The application

Open `plant_prime_editor_v1.0.html` in any modern browser. Nothing to install, no server, and
no network connection needed once the file has loaded.

The footer shows the build stamp. Quote it when reporting a result: the fingerprint is a hash
over the design parameters, scoring weights and vector records, so it changes whenever any of
them changes. Two builds with the same fingerprint will rank designs identically.

- **Module 1** aligns a coding sequence against a reference allele, enumerates installable
  edits in codon context, and maps them onto genomic coordinates.
- **Module 2** designs pegRNAs for eleven architectures — PE2, PE2max, PE3, PE3b, PE4, PE5,
  PE5b, twinPE, ePPE, PPE, ePPE3 — using a nearest-neighbour thermodynamic model calibrated
  to published plant data.
- **Module 3** selects among 15 profiled plant binary vectors, screens the assembled insert
  for restriction-site conflicts, and emits an overlap-extension primer set with per-primer
  quality control and an executable bench protocol.

---

## What else is in this deposit

Everything needed to reproduce the numbers in the paper.

### `data/` — 30 files plus `sequences_plain/`

`benchmark_scored.csv` is the analysed set: 141 published pegRNAs at 26 target sites in rice,
wheat and tomato, scored by the tool's own engine. `scored_rice_wheat.csv` and
`scored_tomato.csv` are the two passes that merge into it. `all_tools.json` holds the
head-to-head designs from the competing tools, with a `_provenance` block recording versions
and the access date. Also here: the Addgene vector catalogue, the Tm re-analysis tables, and
the case-study inputs. `sequences_plain/` holds the seven worked-example sequences as plain
text, ready to paste into the tool.

Twelve files are here because a specific claim in the paper rests on them. Two of them —
`pridict_vs_measured.json` and `targets_verified.csv` — are read by
`analysis/verify_manuscript_numbers.py` and are checked automatically every time it runs.
The other ten are evidence you can inspect. `tool_comparison.csv` and `all_tools.json` are
read by `analysis/build_editable_figures.py`, which needs the figure deck this deposit does
not ship, so nothing here checks them:

| file | what it supports |
|---|---|
| `tool_comparison.csv` | the seven-target head-to-head, Table 1 |
| `all_tools.json` | the same comparison with a `_provenance` block giving tool versions and access date |
| `pridict_vs_measured.json` | the 23 matched pegRNAs behind Figure 6 — PRIDICT2.0 scores and measured rice efficiency; the same table as Supplementary Table S10 — **checked** |
| `li2026_pbs_designs.json` | the 516-design corroboration of the primer-binding-site window |
| `li2023_pbs_final.json`, `lin2020_wheat_pbs.json` | published primer-binding-site series used as independent support |
| `xu2020_designs.json`, `xu2020_scored.json`, `xu2020_stats.json` | the Xu 2020 out-of-sample check |
| `addgene_plant_pe_catalogue.json` | the Addgene records behind the vector table |
| `loto.json` | the leave-one-target-out result: the withheld-target argmax test and the per-target ranking correlations. **Recorded data, not regenerated here** — no script in this deposit writes it, and `verify_manuscript_numbers.py` reads it for five of its 68 checks. If it is absent those five are skipped and the check-count assertion fails rather than passing quietly |
| `CaseStudy_Targets.csv` | the seven case-study loci with published spacer, PAM and edit |
| `targets_verified.csv` | the 176-row parse behind the benchmark cascade: every pegRNA pooled from Lin 2020, Lin 2021 and Vu 2024, with the located spacer, the PAM check, the reconstructed primer-binding site and a per-row status — **checked**. **Two coordinate frames in one row:** `spacer_pos` and `nick_pos` are gene-frame, 1-based into the full gene model (up to ~12.3 kb); `genomic_seq` is a 600 nt window centred on the target and `edit_pos` is 1-based into *that window*. So `nick_pos` exceeds `len(genomic_seq)` on most rows, which is expected rather than corruption. Nothing in the deposit reads the two gene-frame columns; they are carried for provenance. |

### `analysis/` — 30 scripts

Each produces one result in the paper:

| script | what it establishes |
|---|---|
| `fit_tm_optimum.py` | the melting-temperature optimum on both scales, and Figure 4 |
| `score_batch_v2.js` | scores a benchmark CSV through the tool's own engine |
| `merge_benchmark.py` | merges the two scoring passes into `benchmark_scored.csv` |
| `recovery_permutation.py` | the design-recovery statistic and its permutation null |
| `case_studies.js` | eleven architectures run end to end — Supplementary Table S11 |
| `build_figure2_panels.js` | both Figure 2 panels, derived from the tool rather than transcribed |
| `build_equivalence.js` | diffs the whole design surface between two builds — proves a fingerprint move changed no computed value |
| `score_vs_efficiency.py` | composite score against measured efficiency |
| `window_sensitivity.py` | how the 8–11 nt window behaves at other boundaries |
| `verify_manuscript_numbers.py` | **re-derives every quantitative claim in the paper** |

`verify_manuscript_numbers.py` is the one to run first. It regenerates 68 numbers from the
deposited data and compares each against what the manuscript states. It should print
`68 checks, 0 disagree`.

### `tests/` — 40 files

The shipped suite: 20 `test_*.js` regression tests and 6 `audit_*.js` sweeps, all 26 wired into the runner. Every row requires its script to report `0 failed`, to terminate cleanly, and to have actually checked something — a crash after the success line, a non-zero exit, a timeout, and a `0 passed, 0 failed` tally were each verified to report PASS until 23 August 2026. It loads the
HTML headlessly and exercises the real scoring engine, so the tests run against the file
users receive rather than a reimplementation. Includes regression tests for the Pol III +1
base, the primer round trip, the acceptor overhangs, the colony-PCR anchors and the Gibson
arms.

Every script finds the tool by itself; no arguments and no particular working directory are
needed. To point the suite at a different build, set `PPE_HTML` or pass a path.

```bash
node tests/run_all.js                          # the suite — 26 passed, 0 failed
node tests/test_pol3_start_base.js             # a single test
for t in tests/test_*.js tests/audit_*.js; do node "$t"; done   # each on its own
PPE_HTML=/path/to/other.html node tests/run_all.js              # a different build
```

---

### `docs/` — 1 file

`OFFLINE.md` documents what the tool reaches for over the network and how it behaves when
each is unavailable; nothing there is needed to produce a design.

**The published figures themselves are deliberately not redistributed here.** They are in the
paper, and a deposit's job is the code and data that generate them rather than a second copy
of the output. What that code writes stays with the data it came from:
`fit_tm_optimum.py` writes `data/Figure_TmRecalibration.svg` (Figure 4),
`analyse_benchmark.py` writes `data/Figure4_benchmark.svg`, and
`make_figure5d_feature_matrix.py` writes `data/Figure5D_FeatureMatrix.svg` from
`data/feature_matrix.json`. The five scripts that read the PowerPoint deck take its path as
their first argument; the deck is a 3 MB binary and is not shipped either.

### `CHANGES_19Aug2026.md` — the correction record

Twenty-eight dated addenda covering every correction made to the tool and the paper between
19 and 22 August 2026, including all six fingerprint moves and what each one changed. The
source comments in `plant_prime_editor_v1.0.html` point here. Read it if you want to know why
a parameter is attributed the way it is; most of that file is a citation audit in which every
source was read and several long-standing attributions turned out to be wrong.

### `DataS1/` — 4 files

Supplementary Data S1: the four export formats, produced by running the shipped exporters
against the worked example rather than written by hand. Regenerate with
`node analysis/make_data_s1.js`, which fails rather than writes if the geometry no longer
matches the published example (PBS 10 nt, RT template 17 nt, 11 nt homology).

**Scripts that need something beyond the deposit.** Everything else runs from an unpacked
copy with no arguments and no particular working directory. Each of these prints what it
wants and exits without writing anything:

| script | needs |
|---|---|
| `build_editable_figures.py`, `build_figure5D_blocks.py`, `build_figure6_editable.py`, `check_figure_overlaps.py`, `place_figureS3_slide.py` | the figure deck as their first argument: `python3 analysis/check_figure_overlaps.py path/to/Figures_PlantPrimeEditor.pptx`. Each says so and exits cleanly if it is not given one. |
| `assemble_figureS3.py`, `place_figureS3_slide.py` | `FigureS3_capture_kit/` and its `HOW_TO_CAPTURE.md` — screenshots of the live interface, not part of this deposit |
| `parse_competitors.py` | raw exports from the competing tools (`*PEG FINDER*.txt`, `*PE_Designer_result*.xlsx`), not part of this deposit; `data/all_tools.json` is its output and is shipped |
| `build_figure_legends.js` | the npm package `docx` (`npm install docx`), plus three paths: `legends.json`, `filemap.json` and the output `.docx` |
| `score_batch_v2.js` | a benchmark CSV as its first argument |

## Reproducing the paper

```bash
python3 analysis/verify_manuscript_numbers.py     # 68 checks, 0 disagree
node    analysis/case_studies.js                  # 11 of 11 controlled, 33 of 33 spread
node    analysis/build_figure2_panels.js          # Figure 2A and 2B, re-derived
node    analysis/build_equivalence.js old.html    # two builds, field by field
cd data && python3 ../analysis/fit_tm_optimum.py  # Figure 4, optimum 29.6 °C Wallace
```

Python 3 with NumPy, SciPy and pandas; Node.js for the JavaScript harnesses. Verified on
Node 22 and Python 3.11 from an unpacked copy of this deposit with nothing else present.

`case_studies.js` reports **11 of 11** at the controlled locus and **33 of 33** across the
species spread. Until 21 August 2026 the controlled panel reported 8 of 11: twinPE, PPE and
ePPE3 failed there because the paired-pegRNA search filtered `findSpacers`' twenty-candidate
return down to the opposite strand, and at that locus the top twenty held no minus-strand
candidate at all. A strand-specific search returns twenty, three of them usable — 10–100 nt
from the nick, correct side. `tests/test_twin_strand_search.js` measures both numbers at run
time and prints them.
A clean sweep is not a sign the checks cannot fail: the script ends with negative controls that
plant a cloning site, reverse a primer and mis-name an edit field, and it reports **4 of 4
applicable controls caught**, with the fifth stated as not falsifiable by construction.

`build_figure2_panels.js` is new on 22 August 2026 and exists because Figure 2 was the one
display item with no generator. Panel A survived the audit unchanged, but panel B still carried
`−4.8 kcal mol⁻¹` for the PBS↔scaffold-3′ channel from build `a75e20c3`; the current build gives
`−7.0`, and the PBS↔RT row broke a column early. The panel also presented PBS↔RT as a fourth
*scored* channel weighted 1.5×, which the PBS heatmap stopped doing at the 13 August fix
(`FIX HEATMAP-DISAGREES-WITH-TABLE`). The heatmap scores three channels — spacer 5′ ×1.2,
scaffold 3′ ×1.0, self-fold ×0.8 — and reports PBS↔RT in the tooltip without scoring it, because
`genPBS` runs before any RT template exists. That interaction is scored from the other side, in
`genRT`, where RT↔PBS carries the 1.5× weight. The same wrong claim was in the tool's own
interface twice, in the Methods, in both copies of the Figure 2 legend and in the Supplementary
weight table; all are corrected.

`build_equivalence.js` is new on the same day, for a different reason. Reading Anzalone et al.
2019, Chen et al. 2021, Lin et al. 2021 and Nelson et al. 2022 against the code showed that a
number of scoring parameters were credited to papers that do not contain them — most of all
Chen et al. 2021, which has no GC guidance, no length guidance, no multi-edit span rule, no
secondary-structure content and no plant data. Correcting the ones inside `findSpacers`,
`genPBS` and `genRT` moved the fingerprint from **`572c4104` to `96e270bb`**, because the hash
covers those functions' source text, comments included.

Nothing the tool computes changed. That is not an assertion here: `build_equivalence.js` loads
both builds side by side, runs every benchmark locus through the spacer, primer-binding-site,
reverse-transcriptase and nicking designers, sweeps all eleven architectures across four
species groups and three cloning priorities, and diffs the results field by field, holding
advisory text apart from computed values. It reports **100,547 computed fields compared across
411 cases, 0 differing**, and 155 cases differing on advisory text alone — which is exactly the
citation correction.

That field count rose from 75,783 on 23 August 2026, and the reason matters. The harness was
classifying `structDetails` as advisory text. It is not text: it is what the structure engine
returns per interaction channel — a base-pair run length, a free energy in kcal/mol, the
scoring weight and the severity band — with only its `label` being prose. Because the walk
skipped an advisory key at any depth, 24,764 computed values were leaving the comparison.
Changing the severity band inside `m2_structRisk` from −5 to −0.5 kcal/mol then altered 194
of the 411 cases and was reported as *identical*, and the fingerprint did not move either,
because the hash did not cover that function. Both were fixed together: the classifier now
works per leaf, and the hash covers `m2_structRisk`, the free-energy functions, the
nearest-neighbour parameter tables and `genNickSgRNA`. The same mutation is now caught
twice — 194 computed differences, and a fingerprint move. Run it yourself against any earlier build:

```bash
node analysis/build_equivalence.js /path/to/older_build.html
```

Supplementary Figure S3 keeps its `572c4104` stamp throughout, because its four panels are
screenshots taken from the live server on that build and re-labelling them would be false. The
legend now names the deposited build alongside it and points at the evidence above.

---

## Licence

© 2026 the authors and ICAR–Indian Agricultural Research Institute (ICAR-IARI), New Delhi.
All rights reserved. Free for academic teaching and non-commercial research; commercial use
requires a written licence from ICAR-IARI.

**This is not an open-source licence.** See `LICENSE` for the full terms, and
`THIRD_PARTY_NOTICES.md` for the components bundled into the HTML file and their
own licences.

---

## Citing

See `CITATION.cff`. Please cite both the software and the paper.

The archived deposit carries a concept DOI, **10.5281/zenodo.22076360**, which always resolves
to the most recent version. Cite that one unless you need to pin the exact build you used, in
which case cite the version DOI printed on the Zenodo record for that release —
10.5281/zenodo.22076361 for v1.0. Quote the fingerprint alongside it: two builds with the same
fingerprint rank designs identically, and that is the claim a reader needs to reproduce a
result.
