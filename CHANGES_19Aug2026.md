# Corrections applied — 19 August 2026

Every change below was made by surgical edit and then verified by re-running the code.
Nothing was regenerated from a build script, so all formatting, styles and figure geometry
are preserved.

**Verification after all edits:**

```
node tests/run_all.js                          24 passed, 0 failed
python3 analysis/verify_manuscript_numbers.py  59 checks, 0 disagree
node analysis/case_studies.js                  8/11 controlled + 33/33 spread = 41 of 44
```

---

## `plant_prime_editor_v1.0_FINAL.html`

Base: `repo/plant_prime_editor_v1.0.html` (the newer of the two builds in the project), **not**
the FINAL_v16 copy that was uploaded. That alone removes the placeholder NCBI contact
`plantpe@example.com` (5 call sites) and restores the `live since 2026-03-26` field.

**Build stamp is now `v1.0 (build 2026-08-19, live since 2026-03-26, parameters 730b2105)`**
— the fingerprint moved from `a75e20c3` because the ordered output changed. See the last item.

### 1. Pol III +1 base now appears on both strands of every annealing pair — 12 edits

The top oligo carried the promoter's initiating base via `_ppePrefix2()`; the bottom strand was
built from `m3_rc(nick.spacer)`, the spacer *without* it. Whenever the base was prepended the
duplex was one nucleotide short. Fixed in all four builders plus their display and derived
fields (`anneal`, `tm`, `gc`, GC%, Tm and the rendered sequences).

```
before   top TGGCGATATCTCGCTCTCACATTCC (25 nt)   bot AAACGGAATGTGAGAGCGAGATAT  (24 nt)
after    top TGGCGATATCTCGCTCTCACATTCC (25 nt)   bot AAACGGAATGTGAGAGCGAGATATC (25 nt)
```

One of the four sites (`nTop`/`nBottom`) omitted the base from *both* strands; it now carries it
on both. Residual constructions using the unprefixed spacer: **0**. Verified across **60 vector × spacer
combinations**: top and bottom oligo lengths agree in every one.

A **fifth site** was found on the re-check — the fallback in the Module-3 card builder,
`botSeq = nkBotObj ? nkBotObj.seq : (MC_OH3 + m3_rc(nkSp))`. When the emitted `P_Nick_Top`
existed (carrying the +1 base) but `P_Nick_Bot` did not, the fallback rebuilt the bottom strand
from the raw spacer and reintroduced the same one-base asymmetry. It now derives from `topSeq`,
so both strands always describe the same molecule.

One nick-oligo pair is deliberately left alone: the *preliminary* preview labelled
"ACCG/AAAC overhangs — will be refined per vector in Step 2". Both its strands use the raw
spacer, so it is self-consistent, and the +1 base genuinely cannot be known before a vector —
and therefore a cassette-2 promoter — has been chosen.

### 2. Vector-recommendation dead code removed — 17 unreachable comparisons

`smartRecommend()` tested five vector ids that are not in `VECTORS`. Every branch was
unreachable, so *Triticum* and *Hordeum* produced byte-identical rankings to supplying no
organism at all.

| id tested | occurrences | resolution |
|---|---|---|
| `ePE2` | 5 | → `ePE2-rice` (the real id) |
| `pHEE-PE3E` | 5 | → `pCE3-BsmBI-dicot` (the dual-cassette dicot vector that replaced it) |
| `pPPE-dicot` | 4 | arms removed — `pEPPE3-dual-dicot` already scores that slot |
| `pIPKb-PE2` | 2 | see below |
| `pYPQ-PE2-rice` | 1 | removed |

The wheat/barley block is **rewritten to key on the declared Pol III promoter rather than on an
id**, so it cannot rot again when the library changes:

```js
if (/TaU6|TaU3/i.test(_pr))            sc += 60;   // correct for Triticeae — none at present
else if (/tRNA|CmYLCV|35S/i.test(_pr)) sc += 10;   // promoter-agnostic, least affected
else if (/OsU6|OsU3/i.test(_pr))       sc -= 20;   // rice Pol III — poor in wheat
else if (/AtU6/i.test(_pr))            sc -= 40;   // dicot Pol III — wrong clade
```

Verified: wheat now ranks differently from both rice and "no organism", and for PE2max it
promotes the promoter-agnostic tRNA-Gly construct (`pH35C-epegRNA-ePPEplus`). Remaining dead
comparisons: **0**.

### 3. Triticeae advisory added to the vector panel

Because no vector in the library carries TaU6/TaU3, ranking alone cannot give a correct answer.
A red panel note now appears whenever the organism is wheat or barley and no TaU6/TaU3 vector
exists, stating that the ordering is least-wrong rather than validated, and pointing at the
Pol III cassette swap or a promoter-agnostic construct. It is computed from the library, so it
disappears by itself if a Triticeae vector is ever added.

### 4. Nick-distance band is architecture-aware in all three places

Two sites still applied the PE3/PE5 40–90 nt rule to PE3b and PE5b, which sit adjacent to the
edit by construction. (The parenthetical "edited strand" in the original entry was wrong and is
corrected in the 12 September 2026 entry below: PE3b nicks the *non-edited* strand, as PE3 does.) Both now branch on the architecture (1–30 nt for the
conditional modes). The summary tile was also mislabelled "Nick-to-nick dist." on a PE3 panel —
now "Nick-to-edit dist."

### 5. MLH1dn banner states the library limitation

The banner told the user their vector must co-express MLH1dn without saying that none of the 15
does. It now says so explicitly, adds OsMLH1dn and PE5b, and cites Liu et al. 2024 for the rice
knockdown — matching what Supplementary Table S2 already stated.

### 6. Landing page: eleven architectures, and the PE4/PE5 biology corrected

The hero listed eight, omitting PE5b. It now names all eleven. The `PE4 / PE5` card is now
`PE4 / PE5 / PE5b` and — separately — its description still carried the **pre-12-August wrong
biology**, "PE3/PE3b + dominant-negative MLH1". Corrected to PE2/PE3/PE3b + MLH1dn respectively,
with the note that PE4 therefore takes the single-pegRNA layout and needs no nicking sgRNA.

The re-check found a **second copy of the same wrong biology** in the Module-2 architecture
diagram card, which the first pass missed: same "PE3/PE3b + dominant-negative MLH1" text, plus a
"Nick sgRNA" row drawn for all three of PE4/PE5/PE5b. Header, diagram row and description are all
corrected, and the nick row is now annotated "PE5 / PE5b only — PE4 has no nicking sgRNA".
A sweep confirms **zero** remaining occurrences of `PE4 = PE3`, `PE5 = PE3b`,
`PE3/PE3b + dominant-negative MLH1`, `PE3/PE3b/PE4/PE5`, "ten architectures" or "10 PE
architectures" anywhere in the file.

### 7. Outbound links

- `www.plantgenomeediting.net.` → stray trailing dot removed (flagged 9 August, never fixed)
- `http://` → `https://` for crispor.tefor.net (×2), crispr.hzau.edu.cn (×2), rest.ensembl.org,
  www.rgenome.net, www.plantgenomeediting.net. **Zero** non-`w3.org` `http://` links remain, so
  no mixed-content warnings on an HTTPS page.
- Stale internal comment `15 vectors total — 8 dicot, 7 monocot` → `6 dicot, 9 monocot`.

### 8. Build fingerprint now covers the oligo builder

The hash covered the scoring functions but not the code that emits the ordered
oligonucleotides — so fix 1 changed what a user orders while leaving the fingerprint identical,
which is the one thing that hash exists to prevent. `runPrimerDesign` and `_ppePrefix2` are now
hashed. The fingerprint correctly moved `a75e20c3` → `730b2105`, and is deterministic across processes (verified 5×).

---

## `Manuscript_PlantPrimeEditor.docx`

1. **Copyright number restored** — `a copyright registration application has been filed
   (SW-14297/2026-CO, 30 March 2026)`.
2. **GitHub URL restored** — `[github link]` was a live hyperlink whose relationship target was
   the malformed `https://[github`. The hyperlink element and its `rId5` relationship are deleted
   and the paragraph now carries `https://github.com/vsakhilprime/plant-prime-editor` as plain
   body text. Hyperlink elements remaining: **0**.

Unchanged and re-confirmed: 6,987 words, 6 figures + 1 table, "Forty-one of the 44 passed",
top 7.7% / 55.6% / 92.3rd percentile, ORCIDs, **7** `[[ ]]` placeholders (phone, DOI, mirror URL,
month year, acknowledgements, funding, CRediT).

## `Supplementary_Data.docx`

1. **Table S5 footnote restored**, in its original position immediately before the Table S6
   heading: *"All lengths in nucleotides. Every tool received the same sequence and the same edit.
   PlantPegDesigner values were transcribed from its result tables; it has no export function."*
2. `ePE2-rice` → `ePE2` in 18 places, so Table S7 matches Table S2 and no internal registry id
   appears in a submitted table.

The six notes-to-author you removed stay removed. Placeholders: **0**.

## `Figures_PlantPrimeEditor.pptx` (and a regenerated `.pdf`)

1. **Figure 4 fit centre and R²**: `29.4 °C (R² 0.46)` → `29.6 °C (R² 0.45)`, matching the
   manuscript, the legends and the value locked in `verify_manuscript_numbers.py`.
2. **Figure 4 subtitle**: `73 primer-binding-site variants at 13 rice target sites` → `73 of the
   74 … at 13 of the 14 …`, with the one-sentence explanation the Figure Legends file already
   uses.
3. **twinPE spacing**, three places: `34–50 nt` → `30–50 bp` optimal, and `31–60 nt acceptable` →
   `30–80 bp accepted`, noting that 31–60 nt is the human-cell window. Now consistent with the
   Results paragraph citing Li et al. 2026. `34–50` occurrences remaining: **0**.

## `Supplementary_Tables_v1.0.xlsx`

`ePE2-rice` → `ePE2` in 18 cells across Table S7. All 15 sheets otherwise untouched.

## `tests_run_all.js` and `tests_README.md`

`test_pol3_start_base.js` and `test_csv_export_scope.js` were present in `tests/` but absent from
`SUITE`, so they never ran — including the regression guarding the fix in item 1. Both are now
wired in; the suite reports **24 passed, 0 failed**. `tests/README.md` documented 9 tests and
"9 passed"; it now documents all 24 and explains why a file in `tests/` that is not in `SUITE`
is silently skipped.

Copy these two to `repo/tests/run_all.js` and `repo/tests/README.md`.

---

## Independent re-check, 19 August (after the first delivery)

The whole set was re-verified adversarially. Three things came out of it:

1. **The workbook was rebuilt at XML level.** The first version was saved through `openpyxl`,
   which rewrote all 24 parts and dropped `xl/sharedStrings.xml` and most of `docProps/app.xml`.
   The delivered file now differs from the original in **exactly one part** —
   `xl/sharedStrings.xml`, one string — with all 24 parts, 15 sheets, 269 rows and every style
   preserved. (The original has no charts, images, pivot tables or conditional formatting, so
   nothing of that kind was at risk either way.)
2. **A fifth Pol III bottom-oligo site** was found and fixed (see item 1 above).
3. **A second copy of the wrong PE4/PE5 biology** was found and fixed (see item 6 above).

Checks run on the final files:

| check | result |
|---|---|
| zip integrity, all five OOXML files | OK |
| every XML part parses | OK |
| part sets vs the originals | identical; only the intended parts differ |
| dangling relationship references | none |
| Word / PowerPoint / Excel open the files | OK (python-docx, python-pptx, openpyxl) |
| manuscript + supplementary rendered to PDF and read | edits render correctly, no stray styling |
| deck PDF re-rendered from the delivered `.pptx` | text identical page-for-page |
| declaration-before-use (TDZ) for every new variable | OK |
| variable scope for every edit, by brace-matched enclosing function | OK |
| `smartRecommend` over 110 architecture × plant × organism combinations | 110/110 valid |
| oligo pairs over 60 vector × spacer combinations | 60/60 lengths agree |
| fingerprint determinism | identical across 5 separate processes |
| final consolidated cross-check | 39/39 |

---

## Two things left for you — deliberately not changed

**1. The `a75e20c3` references in the documents.** *(Partly superseded — see the second pass below: the Table S7 note was regenerated and re-stamped on 21 August; only the Figure S3 legend still says `a75e20c3`, and it still should until the panels are re-captured.)*

**1. The `a75e20c3` references in the documents.** Supplementary Table S7's note and the Figure S3
legend state the build that produced them. That is still literally true — those artefacts were
generated on `a75e20c3`. Now that the tool is `0942d433`, re-run `analysis/case_studies.js` and
re-take the four Figure S3 screenshots on the deployed build, then update both references. I did
not edit them, because changing a provenance string without regenerating the artefact is exactly
the kind of unverified edit that caused several of these problems. Re-running case_studies.js on
the corrected build gives the same 41 of 44, so only the fingerprint string will change.

**2. The email addresses.** The build carries `akhilprime756@gmail.com` as the NCBI E-utilities
contact (a real, working address — better than the `plantpe@example.com` placeholder, which
violates NCBI's usage policy) and the manuscript's corresponding address is `nemaiari@gmail.com`.
Both should become `@iari.res.in` addresses before the Zenodo DOI is minted, since a Zenodo record
is permanent. I cannot invent institutional addresses, so I left both as they are.

**Also still open, unchanged:** there is no TaU6/TaU3 vector in the library. Fix 2 and fix 3 make
the tool honest about that; they do not solve it. Either add a Triticeae vector or narrow the
paper's species claim — that is a scientific decision, not an edit.

---

# Second pass — deposit build, 21 August 2026

The corrections above were re-verified from scratch, the GitHub/Zenodo deposit was assembled,
and the deposit was then reproduced from a clean unpack. Six further defects surfaced and were
fixed. **The design-parameter fingerprint moved from `730b2105` to `0942d433`** — one of the six
fixes changed what the hash covers, so the stamp had to move with it. Every document, README and
generated artefact now carries `0942d433`.

## What was wrong, and what was done

**1. The vector ranker sat outside the build fingerprint.** The stamp's whole promise, stated in
the README, is that *two builds with the same fingerprint rank designs identically*. The hash
covered the pegRNA scorers and the oligonucleotide builders but not `smartRecommend`, which is
what ranks the acceptor vectors. Repairing a dead vector id in that function changed which vector
is offered first for PE2 in rice **while leaving the fingerprint unchanged** — two builds
recommending different vectors under one name, the exact failure the hash exists to prevent.
`smartRecommend` is now inside it. This is what moved the fingerprint to `0942d433`; nothing about
a design changed, only what the stamp is willing to certify.

**2. `analysis/place_figureS3_slide.py` could not run at all.** The caption was assembled at import
time from `_build_fingerprint()`, a function defined *below* it, so the module raised `NameError`
on every invocation. The caption is now built at call time. Two further faults were behind that
one: the helper looked for the HTML one directory too high, and — once found — searched for a
literal that does not exist, because the fingerprint is an FNV-1a hash the page computes over its
own source at load. It now loads the tool through the shipped test harness and reads
`PPE_BUILD.fingerprint`, falling back to the build date if Node is absent.

**3. The ePE2 vector record contradicted the deposit's own evidence.** Five fields carried a
blanket "availability under review" — leaving, in one field, the sentence *"Confirmed available at
availability under review"*, and in another an empty accession bracket: *"confirmed Addgene
availability ()"*. `data/addgene_plant_pe_catalogue.json`, shipped in this deposit, records the
opposite under `corrections_established`: *"The vector deposited from Li J et al. 2023 Plant Commun
is ePE2, Addgene #202029, deposited by Pengcheng Wei."* The accession is restored in all five
places. **The unverified-overhang caveat is untouched and still stands** — `cloning_verified:
false` and the note to confirm the overhangs on Addgene before ordering are a separate matter from
whether the plasmid exists.

**4. `docs/` shipped stale duplicates of the figures.** The README states that the published
figures are deliberately not redistributed, and that the 3 MB deck is not shipped. Both were in
`docs/` anyway — and both were **older builds**: the deck differed from the corrected deck
delivered to you, and two of the five SVGs differed from what the analysis scripts now generate
into `data/`. A deposit holding two different versions of Figure 4 is worse than one holding none.
The six files were removed from the deposit and are delivered to you separately in
`figures_from_old_docs_folder/` — nothing is lost, and the deposit now matches its README.
This took the deposit from 8.7 MB to 3.9 MB.

**5. The test harness could not load one script block.** `IntersectionObserver` was missing from
the sandbox, so the home-page scroll-reveal block threw at load and the harness reported *"1
block(s) threw at load"* on every run. The block is cosmetic and no test depended on it, but a
reviewer running the suite would have had to satisfy themselves of that. Shims for
`IntersectionObserver`, `ResizeObserver`, `matchMedia` and `getComputedStyle` were added; the
harness now reports **all blocks executed without throwing**.

**6. README counts and leftovers.** `analysis/` holds 28 scripts, not 27. `analysis/__pycache__`
had been committed; it is removed and `.gitignore` now covers `__pycache__/`, `*.pyc` and
`.ipynb_checkpoints/`.

## Re-stamped from `730b2105` to `0942d433`

`README.md` · `docs/OFFLINE.md` · the Supplementary Table S7 note · all four `DataS1/` exports
(regenerated, geometry re-asserted: PBS 10 nt, RT 17 nt, 11 nt homology, 19 primers) ·
`analysis/case_studies.json` (regenerated, still 41 of 44).

The Supplementary Table S7 note was changed from `a75e20c3` to `0942d433` because that artefact
**was regenerated** on the corrected build and still gives 41 of 44. The Figure S3 legend still
says `a75e20c3` — see below.

## Clean-unpack reproduction

The deposit was packed, unpacked into an empty directory, and run exactly as the README instructs,
with nothing else present:

```
python3 analysis/verify_manuscript_numbers.py     59 checks, 0 disagree
node    analysis/case_studies.js                  8/11 controlled + 33/33 spread = 41 of 44
node    tests/run_all.js                          24 passed, 0 failed
cd data && python3 ../analysis/fit_tm_optimum.py  optimum 29.6 °C Wallace, 95% CI [28.0, 32.1]
```

`analysis/case_studies.json` regenerated from the clean copy is byte-identical to the deposited
one apart from its `generated` timestamp. The fingerprint is identical across separate processes.

## Still for you — unchanged, and why

**A. Figure S3 has to be re-captured.** This is the one item that blocks submission and that I
cannot do. Repairing the dead vector id restored the rice bonuses that had never been reachable,
and the ranking for **PE2 in rice under the balanced priority** is now:

```
   ePE2-rice   ·   pYPQ166-OsPE2   ·   pEPPE-mono        (was: pYPQ166-OsPE2 first)
```

The Figure S3 legend, in both `Figure_Legends.docx` and `Supplementary_Data.docx`, says panel C
shows *"pYPQ166-OsPE2 returned as the top match"*. That is true of the screenshot and false of the
shipped build. Re-take the four panels on the deployed build, then change **two** things in both
files: `pYPQ166-OsPE2 returned as the top match` → `ePE2 returned as the top match`, and
`build a75e20c3` → `build 0942d433`. I did not edit the legend, because a legend that disagrees
with the image beside it is worse than one that disagrees with the build.

Under the other priorities `pYPQ166-OsPE2` is still first for `simple` and `pEPPE-mono` for
`maximum`, so if you prefer to keep the existing screenshot, capturing panel C with the priority
set to *simple* reproduces it — but then the legend must say so.

**Supplementary Table S7 is not affected.** Its vectors come from a fixed map in
`analysis/case_studies.js` (`MONO.PE2 = 'pYPQ166-OsPE2'`), not from the recommender, and it
regenerates unchanged.

**B. The two Gmail addresses.** Unchanged, for the reason given above: `akhilprime756@gmail.com`
as the NCBI E-utilities contact and `nemaiari@gmail.com` as the corresponding address. A Zenodo
DOI is permanent — settle these before minting it, not after.

**C. No TaU6/TaU3 vector in the library.** Unchanged. A scientific decision, not an edit.

**D. The NAR submission window.** `00_READ_ME_FIRST.md` says the Web Server issue accepts
year-round; three other planning documents say 10 November – 20 December. Check the journal's
current instructions and make the four documents agree.

---

## Addendum, 21 August 2026 — two more resolved

**`[[month year]]` in the manuscript is filled.** The Limitations paragraph read *"vector coverage
reflects published plant prime editing constructs as of `[[month year]]`"*. The deposit records the
answer itself: `data/addgene_plant_pe_catalogue.json` carries *"retrieved 13 August 2026"*. Filled
as **August 2026**, and the red placeholder formatting removed. Three placeholders remain in the
manuscript — `[[phone]]`, `[[mirror URL]]` and `[[DOI]]` — and the first two need you.

**Item D above — the NAR timeline — is settled, and in your favour.** The journal changed its
process: proposals are now accepted **year-round**, with no submission window and no acceptance
deadline. `NAR_submission/00_READ_ME_FIRST.md` was right; five other documents state a withdrawn
10 November – 20 December window and should be corrected. Two consequences beyond the date:

- **Non-commercial licences are now explicitly permitted** by the Web Server Issue. The ICAR-IARI
  licence is not an obstacle, and the caution I had put in the push guide is withdrawn.
- *"Proposals that are longer than one page will not be considered."* `NAR_01_one_page_proposal.md`
  runs to roughly 840 words of body text and still contains an unfilled
  `[[ Chrome 1xx, Firefox 1xx … ]]` placeholder for the browsers and operating systems you tested on.

Details and sources are in `PUSH_TO_GITHUB_AND_ZENODO.md`.

---

## Addendum 2, 21 August 2026 — target journal changed to Plant Communications

**Supplementary Table S5, the browser/runtime matrix: dropped, and nothing had to be removed.**
It was never in the documents. `TABLE_S5_worksheet.md` was a blank worksheet asking for browser
versions, per-module pass/fail and cold-start times; it was never filled in and never inserted.
Verified before concluding that: the supplementary contents list runs S1–S7 with no gap (S5 is
already *Primer-binding-site length returned by each tool*), the manuscript makes no
browser-compatibility claim, there is not one cross-reference to a browser or runtime table in
the manuscript, the supplementary or the legends, and nothing in `analysis/` or `tests/` reads it.
No renumbering, no count change, no check moved. The worksheet is now obsolete.

**The journal change touches almost nothing in the science.** The manuscript, the supplementary
and the figure legends contain **zero** references to NAR — checked all three. The deposit had
exactly two statements that leaned on NAR policy, and both have been rewritten to stand on their
own reasoning:

- the tool's comment explaining the removal of the visitor counter, which now rests on the tool's
  own privacy claim rather than on a journal rule;
- the `THIRD_PARTY_NOTICES.md` note on self-hosting Pyodide and the fonts, which now gives the two
  reasons that hold regardless of publisher — an outside request at page load is itself a record
  of the visit, and a CDN you do not control cannot honour the five-year commitment.

Both were right decisions and neither changed; only the justification moved. Both edits are prose
outside the hashed functions, so **the fingerprint is unchanged at `0942d433`** — re-verified from
a clean unpack of the rebuilt archive: 24 passed 0 failed, 59 checks 0 disagree.

**The licence question re-opens.** This is the one place the journal change costs you something.
NAR's 2026 editorial explicitly permitted non-commercial restrictions, which settled it. Plant
Communications is a different publisher, and I could not read their guide for authors — cell.com
returns 403 and ScienceDirect blocks automated fetching. The three things to check against the
live guidelines are listed in `PUSH_TO_GITHUB_AND_ZENODO.md`.

**Obsolete NAR material.** Plant Communications has no one-page proposal stage, so these do not
convert: `NAR_01_one_page_proposal.md`, `NAR_02_manuscript.md`,
`NAR_submission/00_READ_ME_FIRST.md`, `03_cover_letter_and_checklist.md`,
`ZENODO_DEPOSIT_STEPS.md`, and the timeline sections of `FINAL_v16/NEXT.md` and `DO_THIS_NOW.md`.
Replacements are pending the guide for authors.

---

## Addendum 3, 21 August 2026 — reformatted for Plant Communications

Audited against the two guideline pages supplied (*Online submission of manuscripts*, *Article
organization and text specifications*) and applied to `Manuscript_PlantPrimeEditor.docx`. Full
detail, including what is deliberately left undone and why, is in
`PlantCommunications_Submission_Checklist.md`.

**Ten structural fixes.** The section order was wrong in two places at once: **Methods sat before
Results**, and the end matter ran Acknowledgements → Funding → Conflict of interest → Author
contributions. The journal specifies introduction, results, discussion, methods, funding, author
contributions, acknowledgments, declaration of interests, references, figure legends, figures and
tables, supplemental information — and that is now the order, verified in the rendered PDF.
"Materials and Methods" became **Methods**. The Cell-Press-STAR-Methods block (*Resource
availability / Lead contact / Materials availability / Data and code availability*), which Plant
Communications does not use, was rebuilt as **Materials availability** and **Data availability** at
the end of the Methods where the guidelines put it, with the lead-contact sentence folded into the
materials statement so nothing was lost, and an explicit no-restrictions sentence added because the
journal requires one. **Conflict of interest / "None declared."** became **Declaration of interests
/ "The authors declare no competing interests."**, the exact wording the guidelines give. The
**running title was 55 characters against a 50-character limit** and is now 47. There were **seven
keywords against a limit of six**; "CRISPR" was dropped as the most redundant against *prime
editing* and *plant genome editing*. Body text was **double-spaced where 1.5 is specified** — 87
paragraphs reset. Continuous line numbering was already present, but **there were no page numbers at
all**; a footer was added.

**One inconsistency that had nothing to do with the journal.** The Figure S3 legend contradicted
itself across two files: the manuscript said the panels carry "callouts", `Figure_Legends.docx` said
"no callouts or overlays have been added", and the two described different panel contents. Nine of
the ten legends matched exactly, so S3 had been revised in the legends file and never carried back.
The manuscript now holds the legends-file text verbatim.

**Checked and already compliant.** Title 140 characters against three lines × 50, and it names the
subject group as required. Abstract exactly 250 words, the stated maximum, single paragraph, no
references cited. Introduction carries no subheadings. There is no Conclusions section — the
guidelines say one is generally not permitted. No priority claims: every sentence containing *first*,
*novel*, *unprecedented* or *only tool* was read, and all seven hits are ordinary usage. Table 1 is a
real Word table, not tabs or a pasted Excel object, and so are the 13 supplementary tables.

**A correction to what I told you earlier.** I reported three unfilled `[[ ]]` placeholders in the
manuscript. There are **six** — Funding, Author contributions and Acknowledgements each hold a long
instructional note that my first sweep truncated past. Funding matters most: the journal lists funder
information among the elements required for evaluation, so it cannot be left blank even if there was
no specific grant.

**Two things deliberately not done.** The reference style must become *Molecular Plant* author–date;
yours is numbered, 87 in-text markers against 27 entries. Initial submission has no strict formatting
requirement, so this is better done once, deliberately, rather than now — say the word and I will
convert and verify every citation resolves. And the supplementary carries **Table S1a–S1e**, which
the *Tables* rule forbids ("number tables as Table 1, Table 2 … rather than Table 1a, Table 1b");
complying cascades a renumber across five documents and the deposit, and the rule sits in the section
governing manuscript tables while supplementary tables fall under a separate Cell Press page I have
not seen. Check that page before I touch it.

**New documents.** `Cover_Letter_PlantCommunications.md` — written to the journal's brief, which asks
for state-of-the-art context and significance, and noting that two of the profiled vectors come from
papers this journal published (Xu et al. 2020, Li et al. 2023). `PlantCommunications_Submission_Checklist.md`
— the full audit, the submission mechanics, and everything still outstanding.

**Still needed from you:** the *Article types* page, because the main text is 6,987 words and the
guidelines say the count should suit the chosen type; and the *Licenses* and *Publication fee* pages.
One encouraging signal on the licence question — the Methods guidance requires materials be available
"for non-commercial research purposes", the same standard the ICAR-IARI licence meets.

---

## Addendum 4, 21 August 2026 — full Plant Communications conformity

The two items held back in Addendum 3 are done, and everything is re-verified.

### References converted to Molecular Plant author–date style

**58 in-text markers** rewritten. The care went into the ten **narrative** citations, where the
author's name is already in the sentence — "in plants Li et al. (24) varied the primer-binding
site" must become *Li et al. (2026)*, not *Li et al. (Li et al., 2026)*. Those ten were detected by
matching the preceding text against the reference's own first author, so no name is doubled. The
other 48 became full parentheticals, multi-reference markers separated by semicolons:
`(2, 3, 9)` → `(Lin et al., 2020; Lin et al., 2021; Vu et al., 2024)`.

Before touching anything I read the context of all 57 main-text markers to be sure none was a
numeric value in parentheses rather than a citation. None was. I also confirmed that every marker
sat inside a single text run, so no citation could be half-replaced across a formatting boundary.

**27 reference entries** re-alphabetised, un-numbered and restyled: bold author list with an Oxford
comma before the final name, `(year).`, title, *italic journal*, `volume:pages`, and the DOI as a
full `https://doi.org/…` link. PMIDs dropped — not part of this style. The one advance-online
reference carries "Published online 5 June 2026." in place of volume and pages, which is what the
guidelines prescribe for a pre-issue article.

**Verified:** 27 references, 27 distinct citation keys, **zero cited-but-unlisted, zero
listed-but-uncited, zero leftover numeric markers**, and no author-and-year collisions, so no a/b
suffixes were needed. One rendering fault caught on review and fixed: stripping the trailing
punctuation from each author list had also removed the period after the final initial, leaving
"and Liu, D.R (2022)" in 15 entries.

Two related fixes. `Figure_Legends.docx` held the only citation outside the manuscript body —
"digitised from ref. (3)", which reads badly in author–date form. It is now "digitised from Lin et
al. (2021)" in both files. The supplementary's `(6)` and `(9)` were checked and left alone: they
count dicot and monocot vectors, they are not citations.

### Supplementary tables renumbered

> "Number tables as Table 1, Table 2, Table 3, etc., rather than as Table 1a, Table 1b, Table 1c."

**S1a–S1e became S1–S5, and S2–S7 became S6–S11.** The parent heading *"Table S1. Complete scoring
weight specification"* existed only to group the five lettered tables and was not itself a table, so
it became the unnumbered section heading **"Scoring weight specification"** rather than colliding
with the new S1.

Applied everywhere the numbering appears and checked afterwards: the supplementary's contents list
and all twelve table headings; four cross-references in the manuscript; the workbook's fifteen sheet
names and its Contents sheet; and four files in the deposit. **Two mentions of "Table S4" and
"Table S5" in the tool's source were deliberately left untouched** — they cite *Doench et al.
2016's* supplementary tables, not this paper's, and a blind replace would have corrupted a citation
to someone else's work. That is why the renumber was done with placeholders keyed on
"Supplementary Table S…" rather than a plain string swap.

**Anything this changelog called Table S7 before today is now Table S11**; earlier entries are left
as written rather than rewritten, because they record what was true when they were made.

### Re-verified after everything

All four documents are well-formed OOXML with their part counts intact (manuscript 13, supplementary
12, legends 12, workbook 24). The manuscript renders to 30 pages with continuous line numbers and
page numbers. From a clean unpack of the rebuilt archive: **24 passed, 0 failed · 59 checks, 0
disagree · 8/11 controlled + 33/33 spread = 41 of 44.**

### Still outstanding, unchanged

The six manuscript placeholders (`[[phone]]`, `[[mirror URL]]`, `[[DOI]]`, Funding, Author
contributions, Acknowledgements); the Figure S3 re-capture; the two Gmail addresses; the missing
TaU6/TaU3 vector; and the two guideline pages I still cannot read — *Article types* (your main text
is 6,987 words and the count must suit the chosen type) and *Licenses* / *Publication fee*.

---

## Addendum 5, 21 August 2026 — deep re-check

A full adversarial pass over every file. Seven further defects, none caught by the earlier passes.

**1. Two dangling cross-references.** The manuscript cited **Supplementary Note 1** and
**Supplementary Note 2**. Neither exists — nothing in the supplementary is a Note, and the only
"Supplementary Note" anywhere in the project belongs to *Li et al. 2026*, quoted in an old audit
file. Both pointers removed. Note 2 promised "full detail of the test suite and the filtering
cascade", and that cascade is already stated three sentences earlier in the same Methods paragraph,
so nothing was lost.

**2. A gap that note was hiding.** The cascade — *"Of 176 pegRNAs parsed …, 162 passed these checks;
154 carried a published primer-binding-site sequence, of which 148 reconstructions matched exactly"*
— **is not reproducible from the deposit.** The deposited data begins at the scored stage of 141, so
176, 162, 154, 148 and the test suite's 146 are the only quantitative claims in the paper that
`verify_manuscript_numbers.py` does not cover. Reported, not patched: deposit the parsing step, or
be ready to supply it on request.

**3. Table 1 had no footnote and undefined abbreviations.** "nt" and "Tm" appeared only in cells, and
nothing said what `10 nt / 28 °C` means. A footnote now defines both, states the cell format, and
explains why PRIDICT2.0 cannot be scored on the Wallace-window row and PlantPegDesigner not on the
recovery row.

**4. The stated word count was wrong.** The title page claimed 6,987; after the restructure and the
author–date conversion the main text is **7,043**, and the stated exclusion list did not match what
is measurable. Both corrected.

**5. The figure deck carried two stale items.** Slide 8 cited "Supplementary Table S6", now **S10**.
Slide 14 still listed "the browser/runtime matrix in Supplementary Table S5" as outstanding — the
item you dropped. Both fixed, both PDFs re-rendered.

**6. The deck contained a slide that must not be submitted.** Slide 14 is authoring instructions, not
a figure. A second file, **`Figures_PlantPrimeEditor_SUBMISSION.pptx`** (13 slides, with its PDF), has
it removed. Submit that; keep the 14-slide version for editing.

**7. The workbook had three stale strings — one of them mangled by my own renumbering.** The Contents
sheet still read *"(S1a spacer, S1b PBS, S1c RT template, S1d intrinsic risk, S1e linker)"*, because
the renumber keyed on `Table S1a` and these were bare `S1a`. Worse, the README sheet read
**"Table S1-e"**: it had been "Table S1a-e", and replacing `Table S1a` → `Table S1` left the fragment
behind. That is precisely the failure mode a blind string replace produces, and precisely why the
same operation on the documents was done with placeholders — I protected the documents and not the
workbook. Fixed, along with the Contents label, now "Tables S1–S5".

**8. Five table titles disagreed between the supplementary and the workbook** (S1 "Spacer composite
score" vs "Spacer scoring terms", and similarly S2–S5). Pre-existing. The workbook now takes the
supplementary's wording; all eleven match.

Also corrected: the push guide's file count (126 files / 3.9 MB → **124 / 3.8 MB**, after the
`__pycache__` removal), and an unsupported priority claim I had written into the cover letter —
"Xu et al. on **the first** plant prime-editing systems" became "on the development of plant
prime-editing systems", since that paper does not claim precedence and neither should the letter.

**Deliberately not changed.** The deck labels Figure 2's panels "build a75e20c3". A function-level
inventory shows the only tool code edited across this entire project is `_ppePrefix2`,
`runPrimerDesign`, `smartRecommend` and the `fingerprint` function itself — `findSpacers`, `genPBS`,
`genRT` and `computeSpacerSpecificity`, which produce those panels, are untouched, so the panel data
is still valid. I did not relabel them to `0942d433` anyway: changing a provenance string without
regenerating the artefact is the exact practice this changelog criticised earlier, and I am not going
to do it here. It also sharpens the Figure S3 case — panel C shows vector selection, which
`smartRecommend` produces, and `smartRecommend` **did** change. Figure S3 genuinely must be
re-captured; Figure 2 need not be.

**Verified after everything.** Every manuscript paragraph diffed against a pre-restructure snapshot:
nothing lost, every difference intended. Zero double spaces, spaces before punctuation or duplicated
punctuation. Six documents structurally valid, part counts intact. 27 references, 27 citations, none
unresolved, none uncited. Every figure and table cross-reference resolves; no numeric markers remain.
Manuscript 30 pages, supplementary 17, legends 4. From a clean unpack of the rebuilt archive:
**24 passed 0 failed · 59 checks 0 disagree · 41 of 44 · fingerprint `0942d433`.**

---

## Addendum 6, 21 August 2026 — correcting Addendum 5, and three wrong numbers

**I was wrong in Addendum 5.** I reported that the benchmark parse cascade was not reproducible
because the deposit began at the scored stage of 141. It does not. **`data/targets_verified.csv` is
in the deposit and holds exactly the 176 parsed rows** the Methods describe, with the located spacer,
the PAM check, the reconstructed primer-binding site and a per-row status. What was true is narrower
and worse: **no script had ever read it**, so no check covered it, and three numbers derived from it
were wrong.

| claim | manuscript said | the parse gives |
|---|---|---|
| carried a primer-binding-site sequence | 154 | **148** |
| reconstructions matching the published sequence exactly | 148 | **144** |
| Lin et al. 2020 contribution | 87 pegRNAs, 17 target sites | **86 pegRNAs, 16 target sites** |

The pair had been shifted one step: 148 is the count *carrying* a sequence, not the count *matching*.
154 is not derivable under any definition I could construct — not non-empty sequences (161), not
published-table rows (157), not rows where a check was attempted (151). The four non-matching rows
are ones whose published table entry was truncated in the PDF and were reconstructed from the genome;
the Methods now say so, and now also state that the 162 span 33 target sites. The Lin 2020 correction
is independently corroborated by the project's own benchmark kit, which records "86 pegRNAs newly
parsed from Lin 2020".

**Closed properly rather than patched.** Nine checks were added to
`analysis/verify_manuscript_numbers.py` covering the whole cascade — 176 parsed, 162 passing, 148
carrying a sequence, 144 matching, 33 target sites, and the per-study pegRNA and target counts for
both Lin papers. **68 checks, 0 disagree**, up from 59. Those numbers can no longer drift.

Two README corrections fell out of it: the verified-number count is now 68, and the sentence
introducing the evidence files claimed "nothing in `analysis/` reads them" — already untrue of
`pridict_vs_measured.json`, `tool_comparison.csv` and `all_tools.json` before `targets_verified.csv`
joined them. Four of the twelve are machine-checked and are now marked so. The cover letter's "59
checks" is now 68.

The supplementary's own account was already right — "the full filtering cascade are stated in the
Methods", 176 assembled, 135 at 26 sites — and needed no change.

---

## Addendum 7, 21 August 2026 — final sweep of every part of every file

A last pass looking not at document text but at the **other parts inside each OOXML container**,
which the earlier sweeps had only ever read through the main document part. Three stale items were
still there.

**The workbook's part-title metadata still listed the old sheet names.** `docProps/app.xml` carried
`Table S1a … Table S1e, Table S2 … Table S7` — the pre-renumbering list — because the renumbering had
touched `workbook.xml` and `sharedStrings.xml` and nothing else. Excel shows these in document
properties, so the file said one thing in its tabs and another in its properties. Renumbered to
S1–S11.

**The workbook's README sheet still promised "59 checks, 0 disagree".** Now 68, matching the extended
verifier.

**The submission deck's metadata still declared 14 slides.** Removing the instructions slide had
updated `presentation.xml` and the relationships but not `docProps/app.xml`, which still said
`<Slides>14</Slides>` and listed fourteen titles. Corrected to 13, with the heading-pair count and
the title vector resized to match. `<Words>` and `<Paragraphs>` are left as they were — PowerPoint
recomputes those on first save and I cannot compute them faithfully.

**Verified across every part of every container**, not just the document text: all six files
structurally valid with part counts intact, and no occurrence anywhere of `Table S1a`, `59 checks`,
`22 passed`, `730b2105`, `c15f7a95`, `6,987`, `154 carried`, `Materials and Methods`,
`Conflict of interest` or `Supplementary Note`.

---

## Addendum 8, 21 August 2026 — the TaU6/TaU3 gap

The gap itself is unchanged: **none of the 15 profiled vectors carries a TaU6 or TaU3 Pol III
promoter.** What was wrong was the framing. The tool told a wheat user that every option was wrong
and left them there; the manuscript did not mention the gap at all in its Limitations. Both now name
a real route.

**There is a Triticeae-promoter prime editing system, and it is deposited.** Ni P, Zhao Y, Zhou X,
Liu Z, Huang Z, Ni Z, Sun Q and Zong Y (2023, *Genome Biol* 24:156) state it directly — *"For the
Pol III promoter-processing system, the wheat U3 (TaU3) and U6 (TaU6) promoters were used to drive
expression of each pegRNA or epegRNA"* — in the ePPEplus multiplex editor. Six plasmids from that
paper are at Addgene, **#205241–#205246**, marked *available to academics and non-profits*, which is
the relevant category here.

Three changes:

- **The tool's wheat advisory** now names the paper, the architecture and the accession range, and
  says plainly that this library cannot design its cloning but that it is the construct to reach for.
  The advisory lives in `renderVectors` and is outside the hashed scoring path, so **the fingerprint
  is unchanged at `0942d433`** — verified.
- **The manuscript Limitations** gain the gap explicitly, phrased so the reader is told where the
  deficiency lies: *"The gap is in this library, not in the field."* **Ni et al. 2023 is added to the
  reference list** — 28 references now, alphabetically between Nelson and Owczarzy; every citation
  still resolves and none is uncited.
- **The supplementary vector-table legend** gains a fourth caveat alongside the existing three on
  cloning chemistry, homology arms and MMR suppression.

**One citation I would not add.** The original advisory cites "Ma X et al. 2015 Mol Plant 8:1274" for
Triticeae Pol III promoter specificity. I could corroborate the title, journal, volume and first page
by search, but not the full author list — cell.com returns 403 and PubMed served a CAPTCHA. Rather
than pad a reference entry with guessed authors I rephrased the Limitations sentence to rest on Ni
et al. 2023, which demonstrates TaU3/TaU6 use in wheat directly. The short inline pointer inside the
tool, which the authors wrote and which is corroborated as far as it is stated, is left alone.

**What I did not do, and why.** I did not add the Ni vectors to the library. Doing that properly needs
the cloning enzyme, the cassette overhangs and the Gibson homology arms read off the deposited maps;
the Addgene record gives the method as Gibson and does not publish the flanking sequences. Inventing
them would be the same class of error as the unverified overhangs this project has spent its time
removing. Profiling the series is named in the Limitations as the first intended extension.

Word count moved to **7,190** with the new Limitations text. Re-verified from a clean unpack:
24 passed 0 failed · 68 checks 0 disagree · fingerprint `0942d433`.

---

## Addendum 9, 21 August 2026 — correcting Addendum 8

**Addendum 8 over-connected two facts, and I have corrected all three places it reached.** I wrote
that Ni et al. 2023 "drive wheat pegRNAs and epegRNAs from TaU3 and TaU6 … and six of those plasmids
are deposited (Addgene #205241–#205246)". Both halves are true; putting them in one sentence implies
the deposited plasmids carry TaU3/TaU6. **They do not.** Checking all six Addgene records:

| # | plasmid | backbone | what it actually carries |
|---|---|---|---|
| 205241 | ePPEplus | pJIT163 | editor only — nCas9-NC-MLV |
| 205242 | CMPE-ePPEplus | pJIT163 | editor + Csy4 |
| 205243 | ePPE-V223A | pJIT163 | editor |
| 205244 | ePPEmax* | pJIT163 | editor |
| 205245 | pUC57-CmYLCV | pUC57 | the epegRNA acceptor — **CmYLCV** promoter, Csy4 sites |
| 205246 | pB-CMPE-ePPEplus | pHUE411 | binary editor + Csy4, Kan |

**No U3 or U6 Pol III promoter appears on any of the six.** The TaU3/TaU6 work in that paper is its
Pol III *comparison arm*; what the authors deposited is the CmYLCV/Csy4 multiplex route, which
sidesteps the Triticeae promoter problem rather than solving it — the same promoter-agnostic escape
the tool's advisory already recommended before any of this.

The Limitations, the supplementary vector-table legend and the wheat advisory now say that
accurately, and give two distinct routes: **avoid the Pol III question** (Ni et al.'s Csy4 system,
deposited) or **swap the cassette** (a TaU6 Golden Gate module, Addgene #165599, from the John Innes
wheat group). Ni et al. 2023 remains reference 28 — 28 references, 28 citations, none unresolved,
none uncited. Fingerprint still `0942d433`; 24 passed, 0 failed. Word count 7,252.

This is the same error class the project has been clearing throughout — two true statements placed
so that a false one is inferred — and it is worth recording that I made it rather than quietly
fixing it.

---

## Addendum 10, 21 August 2026 — trimmed to the 7,000-word limit

The *Article types* page settled two open questions and created one problem.

**Article type: Resource article** — "significant technical advances… a proof-of-principle
demonstration" — with the same limits as a research article.

**Word limit 7,000**, counted as *abstract + introduction + results + discussion + methods*, excluding
title page, references, figure legends and tables. On that definition the manuscript stood at
**7,502**. It is now **6,992**, with 8 words of margin. Four cuts, no finding removed:

- **Use case moved to the supplementary** (−398 net). It walked one worked example from coding
  sequence to ordered oligonucleotide — and Data S1 already holds that run's four export formats while
  Figure S3 shows the interface at each stage. It now sits in the supplementary as *"Worked example:
  from allele to ordered oligonucleotides"* with its own contents row, and a 46-word pointer remains in
  the Results.
- **The Triticeae paragraph tightened**, 158 → 90 words (−68). Both routes and both accession ranges
  survive; the prose around them does not.
- **The availability duplication removed** (−30). *Availability, privacy and maintenance* and *Data
  availability* both said the tool is free, needs no login and computes locally — a redundancy created
  by the section reorder to the journal's required sequence.
- **Materials availability tightened**, 62 → 46 words (−16), keeping the no-restrictions sentence the
  guidelines require.

The title page now states the count on the journal's own basis rather than a private one.

**Display items: 6 figures + 1 table = 7, at the limit of 7.** Nothing further can be added to the
main text.

**Formatting checked against the page:** Times New Roman, 12 pt, 1.5 spacing, continuous line numbers
with page numbers — all already in place.

**The margin is 8 words.** Any addition to the abstract, introduction, results, discussion or methods
now has to be paid for. The six placeholders are safe: Funding, Author contributions, Acknowledgements
and the Declarations all fall outside the counted sections.

Re-verified: 28 references, 28 citations, none unresolved, none uncited; section order unchanged;
manuscript 29 pages, supplementary 17.

---

## Addendum 11, 21 August 2026 — functional test of all eleven architectures, and two real bugs

You asked whether the tool actually works across every prime-editing system. It did not, and the
reason had been hiding behind a validation harness that was covering for it.

### Bug 1 — the paired-pegRNA search was starved by a candidate cap

`findSpacers` ranks every protospacer on **both** strands and returns the top twenty. The
paired-pegRNA search for twinPE, PPE and ePPE3 then took that return value and **filtered it down to
the opposite strand**. Wherever the twenty best candidates all happened to lie on the pegRNA's own
strand, the opposite-strand search saw an empty list and the architecture was reported as
undesignable at that locus.

At OsALS-T2 that is exactly what happened. All twenty were plus-strand. I searched the same window
independently and found **nine minus-strand protospacers**, six of them inside the 10–100 nt window
with the correct geometry — sitting there unseen. `findSpacers` now takes an optional `{strand}` and
filters **before** the cap; omitting it leaves every existing call byte-identical, which is why the
68 manuscript checks still agree. `tests/test_twin_strand_search.js` pins both halves.

**This was not a harness artefact — it is the same code path the interface uses.** Any user asking
for twinPE, PPE or ePPE3 at such a locus was told no design existed.

### Bug 2 — PE3, PE3b, PE5 and PE5b had never been validated on a real nicking sgRNA

`analysis/case_studies.js` called `findNickSgRNAs(g, nick, strand, arch)`. **No function of that name
exists in the tool**, under that signature or any other. The call threw on every invocation, the
throw was swallowed by a bare `catch`, and the fallback handed the design a 20 nt slice taken at a
fixed offset — no PAM, no strand rule, no nick-distance rule. Four architectures were passing on a
spacer the harness invented. This is precisely the defect FIX B16 removed from the twinPE path in
August; it survived on the nicking path.

The real designer is `genNickSgRNA(genomicSeq, pegNickPos, pegStrand, allEdits, pamPattern,
spacerLen, peType)`, and it works: **25 of 25 benchmark loci for all four architectures.** PE5 and
PE5b map onto PE3 and PE3b nick geometry. The fallback is gone — if no nicking sgRNA can be found the
case study now fails and says so.

### What the tool actually does, measured

Every architecture at every benchmark locus, driven through the real engine functions:

| | |
|---|---|
| **275** architecture × locus combinations | 11 architectures × 25 loci |
| **266** return a complete design | |
| **9** do not | twinPE, PPE and ePPE3 at OsGAPDH-T1, OsDEP1 and OsGAPDH |

Those nine are genuine. At each of those loci only one or two opposite-strand candidates survive the
geometry filter, and none can template the edit within the reverse-transcriptase range — checked
candidate by candidate. The tool declines rather than emitting a second pegRNA that cannot work,
which is the correct behaviour.

`case_studies.js` now reports **44 of 44**, up from 41. That is not a sign the checks stopped being
able to fail: the negative controls still report **4 of 4 applicable controls caught**, with the
fifth stated as not falsifiable by construction.

### Consequences

**The fingerprint moved `0942d433` → `572c4104`**, because `findSpacers` is inside the hash and its
source changed. Re-stamped: `README.md`, `docs/OFFLINE.md`, `tests/README.md`, the four `DataS1/`
exports, the Supplementary Table S11 note, and both guides.

**The suite is 25 tests, up from 24.**

**Table S11 now reads 44 Pass, 0 Fail**, in both the supplementary and the workbook, with twinPE's
primer count corrected 20 → 23.

**The explanation printed in both documents was wrong and is replaced.** They said the three failures
were loci "where no protospacer-adjacent motif exists on the opposite strand within the window a
second pegRNA requires". Motifs did exist; the tool could not see them. Both now state the measured
result — 44 of 44, and 266 of 275 across the full sweep — and give the real reason for the nine that
fail.

Main text is **6,983 words** after the rewording, still inside the 7,000 limit.

Re-verified from a clean unpack: **25 passed 0 failed · 68 checks 0 disagree · 11 of 11 controlled ·
33 of 33 spread · 4 of 4 negative controls caught · fingerprint `572c4104`.**

---

## Addendum 12, 22 August 2026 — Figure S3 rebuilt from the re-captured panels

All four panels arrived, and I reproduced the run headlessly before touching anything. The capture is
internally consistent and the tool behaved correctly; what needed changing was the legend, which
described a different design.

**Reproduced from the deposited 600 nt window, and every value matched the screenshots:** spacer
`ATTTGGGTATGGTGGTGCAA` at nick **g.297**, PAM **TGG**, PBS **10 nt**, RT **20 nt**, transcript
**132 nt** (20 spacer + 76 scaffold + 20 RT + 10 PBS + 6 poly-T), and **19 primers** whose names match
panel D row for row, down to `P_gBlock_Gibson_Rev` in the row the screenshot cuts off.

**The vector ranking was also reproduced.** Panel C shows pEPPE as the top recommendation. Running
`smartRecommend` for PE2 in rice: *balanced* → ePE2-rice, *simple* → pYPQ166-OsPE2, *maximum* →
**pEPPE-mono**. So the capture was taken under the efficiency-first priority, and the badge is
correct. **Please confirm that is the priority you had selected** — I inferred it from the ranking
rather than seeing the control in the screenshots, and the legend now states it.

**The legend claimed a run this is not.** It said the panels ran "the worked example used throughout
this paper", with a 129 nt transcript, a 17 nt template, spacer GGGTATGGTGGTGCAATGGG and
pYPQ166-OsPE2 as the top match. That describes the design exported as Supplementary Data S1, not
this one. Rather than force a re-capture, the legend now says plainly what the panels show: the same
locus and the same edit at position 306, run on the spacer the tool ranks first, and it names the
difference from Data S1 explicitly so the two cannot be mistaken for one another. **All three copies
of the legend — manuscript, `Figure_Legends.docx` and the supplementary — are byte-identical.**

**The composite was rebuilt** from the four panels at 2 × 2, 3872 × 1862 px, 328 × 158 mm at 300 dpi,
and written as `FigureS3_interface_walkthrough.png` and `.tif`. Both decks carry the new image, the
slide caption is rewritten to match, and both PDFs are re-rendered. The `a75e20c3` string is gone from
Figure S3 everywhere.

**Table S6's provenance note** said "build a75e20c3". I checked all fifteen vectors' tabulated fields
against the current `VECTORS` records — every Addgene accession still appears — so the note now reads
"regenerated 14 Aug 2026 and re-checked against build 572c4104", which is what actually happened.

**One build string is deliberately left as it is.** Slide 2 labels Figure 2's panels "build a75e20c3".
Those panels were produced on that build and the label is true. `findSpacers` has changed since, but
the change is additive — the default return is byte-identical, which `tests/test_twin_strand_search.js`
pins — so the panels remain reproducible. Relabelling a figure with a build it was not generated on is
the practice this changelog has criticised throughout, and I am not doing it here.

Word count unchanged at **6,983** — figure legends fall outside the counted sections.

---

# Addendum 13 — Figure 2, and a scoring claim that was wrong in six places (22 August 2026)

Addendum 12 ended by leaving Figure 2's `a75e20c3` labels alone, on the reasoning that the panels
were produced on that build and remained reproducible because `findSpacers` had only changed
additively. **That reasoning was wrong, and I checked it only when asked.** It covered panel A,
which does depend on `findSpacers` and does still reproduce exactly. It did not cover panel B,
which depends on `m2_maxDuplexAndDG`, `_M2_SCAF_3` and `m2_selfFoldDG`, none of which I had
tested. Re-deriving the panel on `572c4104` found two stale rows and one claim that was wrong
about the software itself.

## What was wrong

**1. The PBS↔scaffold-3′ row.** The panel printed `−4.8 kcal mol⁻¹` flat across 8–22 nt and the
caption's headline sentence quoted that as the worst channel. The current build gives **`−7.0`**,
flat, for the panel's own locus and spacer. Checked against both the 27 nt `_M2_SCAF_3` constant
and its last 15 nt — `−7.0` either way, so it is not a windowing difference. `−4.8` does not
reproduce from any code path in the shipped build.

**2. The PBS↔RT row broke a column early.** The panel stepped `−1.5 → −3.4` at 18 nt; the
derived row steps at **19 nt**. Ten cells of `−1.5` where there are eleven.

**3. PBS↔RT was presented as a fourth *scored* channel at ×1.5.** It is not, and has not been
since the 13 August `FIX HEATMAP-DISAGREES-WITH-TABLE` change. The heatmap scores **three**
channels, at exactly the partners and weights `genPBS` uses — spacer 5′ ×1.2, scaffold 3′ ×1.0,
self-fold ×0.8 — and reports PBS↔RT in each cell's tooltip without folding it into the colour,
because `genPBS` is called before any reverse-transcriptase template exists and is not passed one.
The 1.5× weight is real; it lives in `genRT`, as `RT⇔PBS (3′ hairpin)`, on the RT-template score.

That third one is the serious one, because it was not confined to the figure. **It was in six
places, two of them in the shipped tool**, where a referee opening the software beside the Methods
would have found the description contradicting the code:

| where | what it said | now |
|---|---|---|
| tool, landing-page feature card | "The PBS ΔG heatmap … scores four interaction channels … PBS↔RT template (weighted 1.5×)" | three channels named with their weights; PBS↔RT described as reported, with the 1.5× located in the RT ranking |
| tool, heatmap footer | "ΔG = worst of PBS↔RT (×1.5×, Chen 2021 …), PBS↔Spacer, PBS↔Scaffold 3′, PBS self-fold" | same correction, and the stray doubled `×…×` typo is gone |
| manuscript, Methods | "The PBS landscape evaluates four channels … The PBS-to-RT channel is weighted 1.5-fold" | three scored channels with weights; PBS↔RT reported, 1.5× attributed to the RT-template ranking |
| manuscript, Figure 2 legend | same claim | corrected |
| `Figure_Legends.docx` | same claim | corrected, and kept identical to the manuscript copy |
| Supplementary Table S2 (docx **and** workbook) | RT row "weighted 1.5×"; the other three rows "—" | RT row "reported, not scored" with the reason; the other three carry ×1.2, ×1.0, ×0.8 |

**4. Panel A's legend said "Values shown are illustrative."** They are not — they are real output
at rice OsDEP1, which the deck's own panel-A caption already said. The legend now says so and
names the build.

## What was *not* wrong

Panel A reproduces **exactly** on `572c4104`: S10 nick 5 nt (80 − 15 = 65), S11 nick 2 nt
(65 − 15 = 50), S8 nick 24 nt (22), S7 nick 41 nt (1), S12 nick 8 nt (1 with a 5-point penalty).
All five rows, all terms, all nick distances.

Panel B's other two rows also reproduce: PBS↔spacer 5′ (`−3.3` ×4, `−1.5`, `−0.9` ×3, `0.0`, then
dashes from 17 nt where the spacer 5′ window is exhausted) and self-fold, which is non-negative at
every length and so displays as `0.0`.

And **the cell fills are not a risk encoding.** I nearly "corrected" them: at `−4.8` every cell sits
in the panel's green band and at `−7.0` every cell sits in amber, so the colours looked wrong. They
are a left-to-right positional ramp — the scaffold row is constant yet its fills vary smoothly —
so they carry no ΔG claim and are left untouched. Recording that here because guessing at
undocumented colour semantics would have been a fabrication dressed as a fix.

## The gap behind all of it

Figure 2 was the one display item in the paper with **no generator in the deposit**. Figure S3 could
be reproduced headlessly, Figures 4, 5 and S4 have scripts, Table S11 has `case_studies.js` — Figure 2
had nothing, so nobody, including me, could tell which of its cells had drifted.

`analysis/build_figure2_panels.js` closes that. It derives both panels from the tool's own functions
loaded headlessly out of the HTML, prints them, and writes `analysis/figure2_panels.json` with
`--json`. Every replacement value in the decks came from it rather than from transcription. It is
listed in `README.md` alongside the other reproduction scripts and in the "Reproducing the paper"
block.

## Layout

The corrected panel B caption runs three lines where the old one ran two. Rather than cut content to
fit the old layout, the whole of panel B below the caption — column headers, the four channel rows,
the axis label and the plant-optimal note, 142 shapes — was shifted down 230,000 EMU (0.25 in). The
lowest element now sits at 6,100,448 of 6,858,000, so nothing runs off the slide. Panel A's caption
was tightened back to two lines. Verified by re-rendering slide 2 and looking at it.

## Word count

The main text was at the ceiling — 7,000 counted across abstract, introduction, results, discussion
and methods, with the margin measured in single figures. The Methods correction is longer than what
it replaces, so it is paid for **inside the same paragraph**:

- the 19 linker sequences, listed in full in the Methods, become a cross-reference — they already
  appear in full in Supplementary Table S5, so nothing is lost (**−14 words**);
- the magnesium sentence is tightened without dropping a clause of its argument.

**Net change: 0 words.** The patch script asserts it rather than trusting the arithmetic, and refuses
to write the file if the count grows. Figure legends sit outside the counted sections, so the legend
rewrite is free.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
`4 of 4` applicable negative controls caught · both PDFs re-rendered at 14 and 13 pages · deposit
rebuilt to 137 files and re-verified from a clean unpack.

**The fingerprint is unchanged at `572c4104`.** Both tool edits are display prose outside the hashed
scorer source, which was confirmed by re-reading `PPE_BUILD.fingerprint` from the harness after the
edit rather than assumed. No re-stamping was needed anywhere.

**Two `a75e20c3` strings survived the first sweep** and were caught on a second pass — the internal
provenance slide 14 of the working deck still said Figure 2 was output from that build and still
listed Figure S3 as outstanding, and the submission checklist still carried the completed Figure S3
re-capture as an open item. Both are corrected, and the checklist now records what remains yours to
confirm.

`a75e20c3` now appears in exactly four places, all of them deliberately historical: this changelog,
the `README.md` paragraph explaining the correction, the header comment of
`analysis/build_figure2_panels.js`, and a comment in `analysis/place_figureS3_slide.py` describing
the hardcoding it removed. **No figure, caption, legend, table or interface string claims that build
any more.**

---

# Addendum 14 — Figure S3 panel C: priority confirmed, and the gap it exposed (22 August 2026)

The corresponding author confirms that the Figure S3 walkthrough was captured under
**efficiency-first priority**. Addendum 12 had inferred that from the ranking rather than reading it
off a control in the screenshots, and flagged it for confirmation. It is now confirmed, and the
inference was correct: `smartRecommend('PE2','monocot','rice','maximum')` returns `pEPPE-mono` first,
displayed as *pEPPE (Monocot/Rice)*, which is what panel C shows.

**But confirming it exposed something that needed fixing anyway.** The tool's default is
`efficiencyPriority = 'balanced'`, and at this locus the three priorities do not agree:

| priority | top three |
|---|---|
| balanced *(the default)* | `ePE2-rice`, `pEPPE-mono`, `pH-ePPE` |
| simple | `pYPQ166-OsPE2`, `pEPPE-mono`, `nCas9-PPE` |
| maximum *(efficiency-first — used for the capture)* | `pEPPE-mono`, `pH-ePPE`, `pYPQ166-OsPE2` |

So a referee reproducing the walkthrough on defaults gets `ePE2` where panel C shows `pEPPE`, and
has no way of knowing why. The Figure S3 legend already named the priority; the deck's slide 12
caption did not name it at all. Both now do, and both also say what the default returns:

- **slide 12 caption**, in both decks — "pEPPE returned as the top match for PE2 in rice under the
  efficiency-first priority; the default balanced priority ranks ePE2 first."
- **all three legend copies** — "…under the efficiency-first priority, which was the setting used for
  this capture; the default balanced priority ranks ePE2 first at this locus…"

The three legend copies were re-hashed after the edit and remain byte-identical to one another.
Main-text word count unchanged at **6,999** — figure legends fall outside the counted sections.
Both PDFs re-rendered at 14 and 13 pages. The deposit is untouched by this addendum, so the zip,
the fingerprint `572c4104` and all test counts stand as verified in Addendum 13.

---

# Addendum 15 — deep re-verification: seven more faults, one of them mine (22 August 2026)

A full re-check of the tool against its own prose, and of the Word supplementary against the
workbook. Two independent audits were started; both were cut off by a service limit, but each had
already surfaced a lead, and following those leads found seven faults. Five were pre-existing, one
was introduced by an earlier addendum in this changelog, and one was introduced during this pass and
caught before delivery.

## 1. Supplementary Table S1 did not describe the scoring function

The spacer score was re-derived by hand for twelve candidates and checked against the tool's own
output — **12 of 12 agreed exactly**, so the band list below is the code, not an interpretation:

| what the code does | what Table S1 said |
|---|---|
| wrong side of the nick → **−80** | **no row at all** |
| 3–15 nt → +50 | +50 ✓ |
| **1–2 nt** or 16–25 nt → +35 | condition written "16–25 nt" |
| 26–34 nt → +15 | +15 ✓ |
| **35–50 nt → 0** | **no row at all** |
| **> 50 nt → −30** | "> 34 nt → −30" |
| GC 45–60 → +20 · 40–65 → +14 | both ✓ |
| **GC 30–75 → +7 · otherwise → +2** | **no rows at all** |
| seed 35–60 → +10 | ✓ |
| **seed ≤ 75 → +5 · > 75 → +1** | **no rows at all** |
| total clamped to **1–99** | **not stated** |

This is not a tidiness point. **Figure 2A decomposes exactly these terms and displays −80, +7, +5,
+2 and 0** — five values the table said do not exist — and two of its five rows total 1 only because
of the clamp. A referee checking the figure against the table would have found numbers with no
defined origin. Table S1 goes from 12 rows to 19, in the Word file and the workbook.

The same wrong band list was **inside the tool**, in the documentation panel: "3–15 nt: optimal
(50 pts) · 16–25 nt: good (35 pts) · 26–34 nt: marginal (15 pts) · >34 nt: poor (−30 pts)". Corrected
to the full list, with the clamp and the wrong-side term named.

## 2. Two documents disagreed about who to credit, twice

| row | Word file | workbook | the code | resolved to |
|---|---|---|---|---|
| Table S1 spacer GC bands | Anzalone 2019 | Chen 2021 | `// GC score: 40-60% (Chen 2021)` | **Chen 2021** |
| Table S2 PBS GC bands | Anzalone 2019 | Chen 2021 | same comment in `genPBS` | **Chen 2021** |

The workbook was right both times.

## 3. The ≤ 34 nt multi-edit span was credited to three different papers

The Word file said Anzalone 2019, the workbook said Chen 2021, and the tool said both in different
places. `genRT`'s own header settles it:

```
// Chen et al. 2021 (Cell 184:5635): Multi-edit RT templates; edit span <= 25 nt.
// Anzalone et al. 2022 (Nat Biotech 40:1332): PEmax multi-edit, span <= 34 nt from nick.
```

So the 34 nt figure is **Anzalone 2022** and the 25 nt figure is Chen 2021 — and the tool's two
user-facing warnings, its documentation panel and its hard error all attributed 34 nt to Anzalone
2019. Four corrections in the tool, one in each document.

A duplicated citation was also fixed: Table S2's "8–17 nt" row read "Anzalone et al. 2019; Anzalone
et al. 2019; this work".

## 4. The workbook's Table S2 was three rows behind — including a headline claim

It carried a single melting-temperature row, "14–20 °C, plant-optimal". The Word file carries three:
rice and other monocots at 14–20 °C NN (≈30 °C Wallace); **wheat, barley and maize at 26–34 °C
(≈38 °C Wallace)**; and every other species at the rice default, marked *EXTRAPOLATED, not
validated*. It was also missing the Species-group row entirely — the required Module 1 choice that
selects between those bands. The two-band structure is one of the paper's central claims and it was
absent from the machine-readable supplement.

## 5. A data error in Table S11

For **twinPE at OsALS-T2** the workbook said **20** primers and the Word file said **23**.
`analysis/case_studies.js`, which generates that table, reports **23**. The workbook was wrong.

## 6. My own error, from Addendum 13

When correcting the PBS↔RT weighting in the workbook I edited a shared string on the assumption it
was Table S2's RT row. It was **Table S1's free-energy structure penalty row** — so a PBS↔RT
explanation was appended to the *spacer* structure term, in the wrong table. Caught by the parity
check below, and removed.

## 7. An error introduced during this pass, caught before delivery

The first attempt at rebuilding Table S1 used the regex `<w:t[^>]*>` to find text runs. That also
matches `<w:tbl>`, `<w:tblPrEx>`, `<w:tc>` and `<w:tcPr>`, so several replacements began at a
structural tag and swallowed everything up to the next `</w:t>`, leaving `document.xml` malformed.
The table was restored from the pristine uploaded copy — content-identical to the pre-patch state,
verified cell by cell — and rebuilt with a regex requiring whitespace or `>` after `w:t`. Every
subsequent write is now parsed with lxml before being committed to the file.

## What was built to stop this recurring

- **`check_table_parity.py`** compares all eleven supplementary tables between the Word file and the
  workbook, row by row, and reports anything present in one and not the other. It is what found
  faults 4, 5 and 6. It now reports **0 tables with drift**; Tables S1, S2, S3 and S7 in the workbook
  are rebuilt from the Word tables so they cannot silently diverge again.
- **`audit_documents.py`** checks word count, placeholders, citation/reference closure, table and
  figure cross-references (expanding ranges such as "Tables S1–S5"), byte-identity of every legend
  copy, and a list of superseded strings. It reports **no problems**.

## One thing the fingerprint taught us

Correcting a wrong comment *inside* `findSpacers` moved the fingerprint from `572c4104` to
`a0980cb1`, because `PPE_BUILD` hashes `findSpacers.toString()` and that includes internal comments.
Not one computed value changed. That move was reverted, because **Supplementary Figure S3's panels
are screenshots taken from the live server at `572c4104` and cannot be re-captured to match** — a
re-stamped legend would have been false. The correction now sits in a block immediately *above* the
function, which is outside `toString()`, together with a note explaining why it lives there. Every
other edit in this pass was checked against the fingerprint after the fact rather than assumed safe.

## Still unresolved, and yours

**Table S3, "Acceptable length 10–30 nt".** The Word file credits "Anzalone et al. 2019 — recommends
starting at 10–16 nt, tested to 34 nt"; the workbook credited Chen et al. 2021, which has no basis
anywhere in the code. The Word file's version is kept because it is the specific one, but the claim
about what Anzalone 2019 recommends could not be verified from here — the publisher blocks automated
access. **Please check that sentence against the paper.**

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
`4 of 4` applicable negative controls caught · Figure 2 regenerates unchanged · document audit clean ·
table parity clean · all six Office files open without repair · deposit rebuilt to 137 files and
re-verified from a clean unpack · main text **6,999 / 7,000** · fingerprint **`572c4104`**.

---

# Addendum 16 — the two papers, and what reading them overturned (22 August 2026)

The author supplied Anzalone et al. 2019 (*Nature* 576:149) and Chen et al. 2021 (*Cell* 184:5635)
to settle one sentence in Supplementary Table S3. Reading them settled that sentence and overturned
a good deal else — **including two changes I made the day before, in the wrong direction, on the
strength of a code comment I could not then verify against the source.**

## The sentence that was asked about — confirmed

Table S3 credited Anzalone et al. 2019 with recommending RT templates "starting at 10–16 nt, tested
to 34 nt". **Both halves are correct**, and the row now quotes the paper rather than paraphrasing it:

> "we recommend starting with about 10–16 nt and testing shorter and longer RT templates during
> pegRNA optimization"

with the supporting range made explicit — RT templates evaluated systematically at 10–20 nt across
five target sites and up to 31 nt at three (Extended Data Fig. 5a–c), and a 34 nt template
demonstrated at HEK3. The workbook's rival attribution to Chen et al. 2021 was wrong and is gone.

## What Chen et al. 2021 does not contain

The paper was read in full and searched exhaustively. It contains **no GC-content guidance, no
primer-binding-site length or melting-temperature recommendation, no reverse-transcriptase template
length guidance, no multi-edit span recommendation, and no mention of pegRNA hairpins, secondary
structure, 3′-extension degradation or failure modes.** It is a Repair-seq study of mismatch repair;
its contribution is MLH1dn, PE4 and PE5. Its only "25 nt" figure describes deletions that remove
sequence 25 nt outside the programmed nicks — a byproduct measurement, not a design rule. **It also
contains no plant data at all** — the cell lines are HEK293T, K562, HeLa, HAP1, iPSCs and T cells.

Its measured effect is 7.7-fold over PE2 and 2.0-fold over PE3 on average, with edit/indel ratios
improved 3.4-fold, in MMR-proficient human cells.

## What that overturns

| claim | had been credited to | actually |
|---|---|---|
| PBS GC band 40–60% | Chen 2021 *(my change, 21 Aug)* | **Anzalone 2019** — "especially if the priming region deviates from about 40–60% G/C content" |
| spacer GC bands 45–60 / 40–65 / 30–75 | Chen 2021 *(my change, 21 Aug)* | **this work** — Anzalone's 40–60% is the priming region, not the spacer |
| RT span ≤ 34 nt | Anzalone 2022 *(my change, 21 Aug)* | **Anzalone 2019 Fig. 4b** — a 34 nt template installed edits at +12 to +33 |
| multi-edit span ≤ 25 nt | Chen 2021 | **this work** — a conservative advisory margin, not a published value |
| PBS length 8–17 nt acceptable | Anzalone 2019 · Chen 2021 | **Anzalone 2019** alone — the range it tested |
| RT length 10–30 nt acceptable | Chen 2021 | **Anzalone 2019** |
| "dominant reported pegRNA failure mode" (the ×1.5 RT↔PBS weight) | Chen 2021 | **this work** — the weighting is retained, the citation removed |
| "~2–5× gain in plants" | Chen 2021 | **source not established** — Chen 2021 has no plant experiments |
| "3–10× in human cells" | Chen 2021 | **7.7-fold over PE2, 2.0-fold over PE3** (the paper's own numbers) |
| ΔG risk thresholds "calibrated from Chen 2021 Fig 4" | Chen 2021 | **this work** |

Corrected in the manuscript, both Figure 2 legend copies, Supplementary Tables S1, S2 and S3, the
workbook, both figure decks and thirteen user-visible strings in the tool. The Chen et al. 2021
reference stays in the manuscript, cited correctly, for MLH1dn suppression of mismatch repair.

Also verified against Anzalone 2019 and left standing: PBS 8–17 nt tested; "we recommend starting
with a PBS length of about 13 nt"; "we recommend designing pegRNAs so that the first base of the 3′
extension is not C" (the tool's −12 first-C penalty); PE3 nicks "about 50 bp" from the pegRNA nick,
40–90 bp generally beneficial.

## Six warnings that could not be fixed — an author decision

Every wrong attribution outside `findSpacers`, `genPBS` and `genRT` has been corrected. These six are
**inside** those functions, which `PPE_BUILD.fingerprint` hashes, and all six are text a user sees:

```
findSpacers   'GC <n>% outside optimal 40-65% (Chen 2021)'                       ×2
genPBS        '> 17 nt — risk of pegRNA secondary structure (Chen 2021)'
genPBS        'GC > 65% — risk of PBS secondary structure (Chen 2021)'
genRT         'GC > 65% - risk of RT template secondary structure (Chen 2021)'
genRT         'Edit span <n> nt > 25 nt - may reduce multi-edit efficiency (Chen 2021)'
```

Correcting them moves the fingerprint off `572c4104`, and **Supplementary Figure S3's four panels are
screenshots captured from the live server at `572c4104`**. Re-stamping the legend without
re-capturing would be false. So this is a real choice:

- **A — leave them.** Ship on `572c4104`. Six warning strings carry a citation the paper does not
  support. Recorded in the code, in this changelog, and nowhere a referee is told otherwise.
- **B — fix them.** Accept a new fingerprint, re-stamp every artefact that carries `572c4104`, and
  re-capture the four Figure S3 panels on the new build.

Nothing is decided here. The inventory sits in a block above `findSpacers` so whoever picks it up has
the list.

## A method note, because I got this wrong twice

On 21 August I resolved two attribution disagreements by taking the tool's own code comment as
authority over the documents. The comment was wrong in both cases, and I propagated it into the
manuscript and the workbook. **A code comment is not a source.** The rule that should have applied,
and now does: where a citation is in question and the paper cannot be read, the disagreement is
reported, not resolved.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
Figure 2 regenerates unchanged · document audit clean · table parity clean across all eleven tables ·
both PDFs re-rendered at 14 and 13 pages · deposit rebuilt and re-verified from a clean unpack ·
main text **6,996 / 7,000** · fingerprint **`572c4104`**, checked after every individual edit — one
edit that moved it was found by bisection and reverted.

---

# Addendum 17 — Lin 2021 and Nelson 2022: the paper's premise, verified (22 August 2026)

Two more papers supplied: Lin et al. 2021 (*Nat Biotechnol* 39:923) and Nelson et al. 2022
(*Nat Biotechnol* 40:402). Unlike the last round, these mostly **confirm** what the manuscript says —
including the single assumption the whole platform rests on.

## The premise of the paper is correct, and now checkable

Everything in this work follows from one claim: that the 30 °C primer-binding-site optimum in
universal use for plants is a **Wallace-rule** figure, so a tool computing nearest-neighbour melting
temperatures must not apply it directly. The manuscript asserts this and says it is "as stated in the
Methods of that study". It is. Lin et al. 2021, *Calculation of PBS Tm*, verbatim:

> "The algorithm for computing the PBS Tm of pegRNAs was referred to the Oligo Analysis Tool … when
> PBS length ≤ 15 nt. **The formula used is Tm = 4N_G:C + 2N_A:T**, where N_G:C and N_A:T are the
> numbers of G:C and A:T base pairs in the PBS sequence."

That is the Wallace rule exactly. **The premise is verified against the primary source rather than
assumed**, and it was previously taken on trust. Nothing in the manuscript changes.

Also confirmed in Lin et al. 2021, all matching what the paper says: "designing prime binding sites
with a melting temperature of 30 °C leads to optimal performance in rice"; "we recommend using a
30 °C PBS Tm with PPE"; efficiencies "generally were maximal at PBS Tm 30 °C, followed by PBS Tm
32 °C and 28 °C, and decreased on either side"; PBS lengths from 6 to 17 nt tested; the dual-pegRNA
strategy boosting efficiency "from 2.9-fold to 17.4-fold", which is the source of the manuscript's
"up to 17-fold" in rice.

One caveat worth knowing: the Wallace formula is stated for **PBS ≤ 15 nt**. Above that length the
paper does not say what was used.

## Nelson et al. 2022 — the citations were already right

- "the tevopreQ1 pseudoknot that protects the pegRNA 3′ extension from degradation" — matches:
  "degradation of the 3′ region of the pegRNA that contains the reverse transcriptase template and
  the primer binding site can poison the activity of prime editing systems".
- "the linker is chosen from 19 candidates by free-energy minimisation (Nelson et al., 2022)" —
  matches the principle behind pegLIT, which selects linkers predicted not to base-pair with the
  spacer or the PBS.

**But it does not support the RT↔PBS weighting either.** Nelson's failure mode is exonucleolytic
*degradation* of the 3′ extension, not *intramolecular hybridisation* between the RT template and
the primer-binding site. So the ×1.5 weight stays attributed to this work, as Addendum 16 left it;
Nelson is not a substitute citation for it.

## Two corrections

1. **The linker length.** The tool said "Length is biased toward the Nelson-recommended 7–9 nt
   range." There is no such recommendation. Nelson used an **8 nt** linker throughout — "we,
   therefore, opted to include an 8-nt linker, unless otherwise noted" — selected with pegLIT to
   avoid base pairing with the spacer or the PBS. The note now says that, and states the tool's
   actual pool: 6–10 nt (1×6, 1×7, 2×8, 6×9, 9×10), chosen on free energy. Corrected.

2. **"validated across 15 sites"** — `genPBS` credits Lin's Tm optimum to 15 targets. The Tm analysis
   spans **18** (Fig. 1c); 15 is the target count for the dual-pegRNA comparison, a different
   experiment. This one is **inside a hashed function**, so it joins the open list above rather than
   being fixed — seven items now, not six.

## Not verifiable from what was supplied

- **Li H et al. 2026**, the source of the 26–34 °C wheat/barley/maize band. Worth a look for an
  unrelated reason: Lin 2021 reports "26–34 °C in OsEPSPS-T1" — the same numbers, for a *rice*
  target. Almost certainly coincidence, but the two should not be confused, and only you can check.
- **Anzalone et al. 2022**, **Zong et al. 2022**, **Lin et al. 2020**, **Vu et al. 2024**,
  **Liu et al. 2024**, **Li et al. 2023**, **Dang 2015**, **Hsu 2013**, **Ma 2015**, **Doench 2016**.
- The **"~2–5× in plants"** figure for PE4/PE5, now marked "source not established" throughout.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
document audit clean · table parity clean · deposit rebuilt to 137 files and re-verified from a clean
unpack · main text **6,996 / 7,000** · fingerprint **`572c4104`**.

---

# Addendum 18 — all of them corrected; fingerprint 572c4104 → 3909f4db (22 August 2026)

The author chose option B from Addendum 16: fix the misattributions inside the hashed scorers and
accept the new fingerprint. Done — and with the one thing that choice demanded, which is evidence
that the move was cosmetic.

## What changed in the code

**30 replacements inside `findSpacers`, `genPBS` and `genRT`**, plus one critical-risk warning
found on the sweep afterwards. Every one is either a comment or the text of a warning message. No
threshold, weight, band boundary, sort key or returned field was touched. Six of them are text the
user reads:

| where | was | now |
|---|---|---|
| findSpacers ×2 | `GC n% outside optimal 40-65% (Chen 2021)` | `(this work)` |
| genPBS | `> 17 nt — risk of pegRNA secondary structure (Chen 2021)` | `(this work)` |
| genPBS | `GC > 65% — risk of PBS secondary structure (Chen 2021)` | `(this work)` |
| genRT | `GC > 65% - risk of RT template secondary structure (Chen 2021)` | `(this work)` |
| genRT | `Edit span n nt > 25 nt — may reduce multi-edit efficiency (Chen 2021)` | `(this work)` |
| genRT | `The RT⇔PBS 3′ hairpin is the #1 pegRNA failure mode (Chen 2021)` | `the interaction this tool weights most heavily (×1.5, this work)` |

The comments were corrected on the same evidence: the 40–60% G/C figure moved to Anzalone 2019
where it belongs, the RT length bands to Anzalone 2019, the 25 nt span to this work, the Lin 2021
Tm analysis from "15 sites" to **18 targets** (Fig. 1c). **No unexplained `Chen 2021` reference
remains in any of the three scorers.**

## The evidence the move required

A fingerprint that hashes comments moves for changes that alter nothing. That is a weakness of the
stamp, not of the build, but it puts the burden of proof on whoever moves it — so
**`analysis/build_equivalence.js`** is new. It loads two builds side by side and runs the whole
design surface on both: every benchmark locus through `findSpacers` (default and both strand
filters), `genPBS`, `genRT` and `genNickSgRNA` for PE3 and PE3b, then all eleven architectures
across four species groups and three cloning priorities through `smartRecommend`, plus the hashed
constants. It diffs the results field by field, holding advisory text apart from computed values.

```
old build : build_572c4104.html   fingerprint 572c4104
new build : plant_prime_editor_v1.0.html   fingerprint 3909f4db
cases     : 411

computed fields compared : 76066
cases differing on a computed value : 0
advisory fields compared : 21429
cases differing on advisory text only : 131

RESULT: the two builds compute identical results. Only advisory text differs.
```

Every one of the 131 is the citation correction. The script ships in the deposit and runs against
any earlier build: `node analysis/build_equivalence.js /path/to/older_build.html`.

## Re-stamped

`README.md`, `docs/OFFLINE.md`, all four `DataS1/` exports, `analysis/case_studies.json`,
`analysis/figure2_panels.json`, the Figure 2 captions in both decks, the Figure 2A legend in the
manuscript and `Figure_Legends.docx`, the Table S11 provenance note, the Table S6 note in the
workbook, slide 14's internal note, `PUSH_TO_GITHUB_AND_ZENODO.md` and the submission checklist.
The derived artefacts were **regenerated**, not relabelled — `case_studies.js`,
`build_figure2_panels.js` and `make_data_s1.js` were all re-run, and Figure 2 came back identical.

## Not re-stamped, deliberately

**Supplementary Figure S3 keeps `572c4104` in all three legend copies and in the slide 12 caption.**
Its four panels are screenshots taken from the live server on that build. Relabelling a photograph
with a build it was not taken on is false, and I cannot re-capture them. Each of those places now
carries one added sentence instead:

> The four panels were captured at build 572c4104; the deposited build is 3909f4db, which differs
> only in advisory text — analysis/build_equivalence.js compares 76,066 computed fields across 411
> cases on the two builds and finds none that differ.

All three legend copies remain byte-identical (`9f30c1f937`).

**If you would rather the paper carried one fingerprint throughout**, deploy `3909f4db` to
akprimeedit.com, re-capture the four panels, and send them; the legend then loses that sentence and
the stamp becomes uniform. That is the only remaining route to a single number, and it is optional —
the current state is accurate as it stands.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
`4 of 4` applicable negative controls caught · build equivalence **0 computed differences** ·
document audit clean · table parity clean across all eleven tables · both PDFs re-rendered at 14 and
13 pages · deposit rebuilt to **138 files** and re-verified from a clean unpack · main text
**6,996 / 7,000** · fingerprint **`3909f4db`**.

---

# Addendum 19 — the last five papers: three corrections, and one headline claim rescued (22 August 2026)

Li et al. 2026 (*Nat Biotechnol*, twin prime editing in monocots), Lin et al. 2020 (*Nat Biotechnol*
38:582), Zong et al. 2022 (*Nat Biotechnol* 40:1394), Liu et al. 2024 (*Genome Biol* 25:131) and the
supplementary of Li et al. 2023 (*Plant Commun*). Every remaining unverified attribution is now
either confirmed or corrected.

## A scare that resolved

The 26–34 °C wheat/barley/maize band is credited to Li et al. 2026, and searching that paper's text
found **no melting-temperature analysis, no "516", no "437", no 38 °C**. For a while it looked as
though a headline claim rested on a paper that does not make it.

It does not. The manuscript's Methods already say the designs "were parsed from their
**Supplementary Table 8**" — a file that was not supplied, which is exactly why the counts are
absent from the article text. Re-deriving them from the deposited parse settles it:

| | manuscript | recomputed from `data/li2026_pbs_designs.json` |
|---|---|---|
| designs parsed | 516 | **516** |
| rice designs | 437 | **437** |
| rice median PBS length | 9 nt | **9 nt** |
| rice median Wallace Tm | exactly 30.0 °C | **30 °C** |
| rice median on the NN scale | 18.3 °C | **18.3 °C** |
| wheat + maize designs | 79 | **33 + 46 = 79** |
| wheat median Wallace | 38 °C | **38 °C** (range 38–40) |

Every figure reproduces. And Li et al. 2026 *does* verbatim support the tool's other claim on it —
pegRNA pairs "30–50 bp apart, achieving peak efficiencies at four of the six loci", with the
30–50 bp group "preferred over the 51–80-bp group". The nick-to-nick rule is sound.

**Lin et al. 2020** likewise: six wheat targets in the benchmark, PBS 11–13 nt, median Wallace
exactly 38 °C. Exact match, and an independent corroboration of the 38 °C figure six years earlier.

## Correction 1 — the manuscript's "entirely outside" was ambiguous

> "…Li et al. (2026) design to 38 °C rather than 30 °C **on the Wallace scale** and their 79 designs
> fall entirely outside the band derived here"

On the nearest-neighbour scale the band is derived on, that is exactly right: **0 of 79** fall inside
14–20 °C. But the sentence has just named the Wallace scale, and on the Wallace expression of the
band **10 of the 79 — all maize — do fall inside 26–34 °C**. A referee recomputing on the scale the
sentence names would find the claim false. It now reads "outside the **nearest-neighbour** band
derived here". Two words, and the claim can no longer be read against the wrong scale.

## Correction 2 — Zong 2022's 5.8-fold is over PPE, not ePE2

> "the two modifications synergistically enhanced the efficiency … by on average **5.8-fold compared
> with the original PPE** in cell culture"

Two vector records said "over ePE2" and "over PE2". **Zong et al. 2022 does not mention ePE2 at
all** — zero occurrences. Four records corrected to name the original PPE and the setting.

## Correction 3 — the plant MMR figure finally has a source, and it is smaller

The tool told plant users MLH1dn co-expression buys "~2–5× in plants". Addendum 16 could only mark
it *source not established*, because Chen 2021 has no plant data. **Liu et al. 2024** is the source,
and the number is lower:

> "direct RNAi knockdown of OsMLH1 in an ePE5c system increases the efficiency … by **1.30- to
> 2.11-fold**"

averaging 1.51-fold over ePE3 across six rice targets. Nine places in the tool overstated the
benefit by roughly two-fold; all now carry the measured range and the citation. Liu et al. 2024 was
already in the manuscript's reference list, cited correctly for the OsMLH1 knockdown.

## Checked, no contradiction found

**Li et al. 2023** — 24 epegRNAs in the deposited parse, PBS median 9 nt, Wallace 26–32 °C,
consistent with a 30 °C target. The manuscript's narrower claim ("8–11 nt at all ten conventional
sites") concerns a ten-design subset that the deposited file does not label, so it could not be
re-derived here; nothing contradicts it. **Zong et al. 2022**'s RNase H removal plus viral
nucleocapsid chaperone matches the manuscript's description of it.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
build equivalence against `572c4104` still **0 computed differences** · document audit clean · table
parity clean · deposit rebuilt to 138 files and re-verified from a clean unpack · main text
**6,997 / 7,000** · fingerprint **`3909f4db`** (unchanged — every edit here is display prose outside
the hashed scorers).

---

# Addendum 20 — the last four papers; every citation now checked (22 August 2026)

Vu et al. 2024 (*Nat Plants*), Hsu et al. 2013 (*Nat Biotechnol* 31:827), Doench et al. 2016
(*Nat Biotechnol* 34:184) and Anzalone et al. 2022 (*Nat Biotechnol* 40:731). **No citation anywhere
in this project is now attributed to a paper that has not been read.**

## Anzalone 2022 settles a claim I changed twice

`genRT` credited the ≤ 34 nt multi-edit span to "Anzalone et al. 2022 (Nat Biotech 40:1332): PEmax
multi-edit". On 21 August I trusted that comment and pushed it into the documents; on 22 August I
overruled it in favour of Anzalone 2019 Fig. 4b. The paper now confirms the second call and shows
the original comment was wrong three ways over: **Anzalone et al. 2022 does not mention PEmax at
all** (zero occurrences), makes no multi-edit span claim — its only "34-nt" is the length of
*complementary flaps* in twinPE — and is at 40:731, not 40:1332. Corrected in the code.

The same header also cited "Lin et al. 2020 (Nature Plants 6:888)". Lin et al. 2020 is
*Nat Biotechnol* 38:582, and it does support the claim made — "PPEs can also create multiple base
substitutions", 1.5% at OsCDC48-T1. Only the reference was wrong. Corrected.

Both lines sit inside `genRT`, so the fingerprint moved again: **`3909f4db` → `c4329cff`**. Everything
carrying the old value was re-stamped and every derived artefact regenerated. `build_equivalence.js`
was run against both predecessors:

| against | computed fields | differing | advisory differing |
|---|---|---|---|
| `572c4104` | 76,066 | **0** | 131 |
| `3909f4db` | 76,066 | **0** | **0** |

Zero advisory differences against `3909f4db` is the expected result: those last two edits are pure
comments, invisible even in warning text.

## Hsu 2013 defines the seed region — it does not give GC bands

Table S1 credited the seed-GC bands (35–60% → +10, ≤ 75% → +5, > 75% → +1) to Hsu et al. 2013. The
paper **contains no GC-content analysis at all**. What it establishes is the seed itself: "perfect
base-pairing within **10–12 bp directly 5′ of the PAM** (PAM-proximal) determines Cas9 specificity".
That is exactly the window the tool scores — `spacer.slice(8)`, positions 9–20 of a 20 nt spacer — so
Hsu is the right citation for *where* to look and the wrong one for *what counts as good*. All three
rows now say so, and the manuscript's "seed-region composition (Hsu et al., 2013)" became
"seed-region composition in the PAM-proximal window of Hsu et al. (2013)".

That cost six words against a one-word margin, so it was paid for in the same paragraph — two
sentences tightened, no content lost. **6,999 / 7,000.**

## Verified, no change needed

- **Doench et al. 2016** — the cutting-frequency-determination matrix for off-target scoring is
  exactly this paper. The manuscript's attribution is correct as written.
- **Vu et al. 2024** — "Paired pegRNAs assured the highest PE efficiency in tomato", and the paper
  independently frames primer-binding-site design as sitting "within an optimal melting temperature
  range". Both match what the manuscript says of it.
- **Lin et al. 2020** — six wheat targets, PBS 11–13 nt, median Wallace exactly 38 °C. Exact.

## Where this leaves the citation audit

Read and checked in full: Anzalone 2019, Anzalone 2022, Chen 2021, Doench 2016, Hsu 2013, Li 2023
(supplementary), Li 2026, Lin 2020, Lin 2021, Liu 2024, Nelson 2022, Vu 2024, Zong 2022.

Not supplied, and each still carrying one parameter: **Ma et al. 2015** (the Pol III +1 base, scored
zero by design, so nothing rests on it), **Dang et al. 2015** (the poly-T terminator penalty),
**SantaLucia 1998** and **Owczarzy et al. 2008** (the thermodynamic parameter sets, which are
standard), **Haeussler et al. 2016** (CRISPOR, a pointer not a parameter) and **Jin et al. 2021**
(cited for context). None is load-bearing for a headline claim.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
equivalence **0 computed differences** against both predecessors · document audit clean · table
parity clean · both PDFs re-rendered at 14 and 13 pages · deposit rebuilt to 138 files and
re-verified from a clean unpack · main text **6,999 / 7,000** · fingerprint **`c4329cff`**.

---

# Addendum 21 — Li 2026's supplementary: the parse verified against source, and a claim strengthened (22 August 2026)

The author supplied Li et al. 2026's Supplementary Information (MOESM1) and Supplementary Tables
(MOESM3). These are the files Addendum 19 could only work around, and they settle two things.

## The 516-design parse is byte-exact against the original

Supplementary Table 8 was re-parsed here from the original workbook, independently of the deposited
file — sheet "8", 516 data rows, reverse-transcriptase template in capitals and primer-binding site
in lower case, exactly as the manuscript's Methods describe:

```
rows in sheet 8 (after 2 header rows) : 516
parsed cleanly                        : 516
rows that did not parse               : 0

against data/li2026_pbs_designs.json
  rows compared       : 516
  identical in order  : 516
  multisets equal     : True
```

Every derived figure reproduces from that independent parse: 437 rice designs, median
primer-binding site **9 nt**, median Wallace **30.0 °C**, median nearest-neighbour **18.3 °C**;
33 wheat plus 46 maize = **79**; wheat median Wallace **38.0 °C**; **0 of 79** inside the 14–20 °C
nearest-neighbour band, and 10 inside its 26–34 °C Wallace equivalent — which is precisely the
ambiguity Addendum 19 removed by naming the scale.

## The wheat and maize band is stated by Li et al., not inferred

Addendum 19 could not find any melting-temperature guidance in Li 2026's article text, and the
manuscript hedged accordingly: the 38 °C figure "is reported as internal testing rather than as a
dataset, so it can be **neither verified nor re-derived**". Both halves of that hedge are now
obsolete. Supplementary section 4.4, *PBS selection*, verbatim:

> "Optimal PBS melting temperatures (Tm) are species-specific, and we recommend users set desired
> Tm of rice targets at **30 °C** based on prior work, and those in **wheat and maize at 38 °C**
> based on **internal testing**."

So the two-band species structure the platform implements is **Li et al.'s own recommendation**, the
"internal testing" attribution is their word for it, and the figure *is* re-derivable — from their
own deposited designs, whose wheat set centres on exactly 38 °C. The manuscript sentence is rewritten
to say all three, and Table S2 now quotes the source directly.

## One overreach corrected

Li et al. recommend 38 °C for **wheat and maize**. The species group is labelled "wheat, barley and
maize" throughout, and **barley is not in their recommendation**. Grouping it with wheat on Triticeae
grounds is defensible, but it is this work's inference, not a cited result. The manuscript now reads
"For wheat and maize, Li et al. (2026) recommend 38 °C … Barley is grouped with them on Triticeae
grounds, not on data", and Table S2 says the same. Paid for within the paragraph: **6,998 / 7,000**.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · `controlled : 11 of 11` · `spread : 33 of 33` ·
equivalence 0 computed differences · document audit clean · table parity clean · both PDFs
re-rendered · deposit rebuilt to 138 files and re-verified from a clean unpack · main text
**6,998 / 7,000** · fingerprint **`c4329cff`** (unchanged — nothing here touched the tool).

---

# Addendum 22 — the supplementary had no reference list (22 August 2026)

The author noticed that Ma et al. 2015 and Dang et al. 2015 are absent from the manuscript's
reference list. They are, and they should be: **neither is cited in the main text.** Both are cited
in Supplementary Table S1 — and **the supplementary had no References section at all**, so those two
citations resolved nowhere and the other sixteen resolved only if the reader went to the manuscript.
The document audit had never caught it, because it only checked the manuscript against itself.

## Fixed

The supplementary now carries a **References** section: 18 entries, of which **16 are copied
verbatim from the manuscript's reference list** — the paragraph XML is reused, not retyped, so the
two lists cannot drift apart.

The remaining two are placeholders, in the same style as the six already in the manuscript:

- **Dang, Y., et al. (2015).** No bibliographic detail for it exists anywhere in the manuscript, the
  supplementary or the deposit. Cited for the poly-T tract as the Pol III pause signal.
- **Ma, X., et al. (2015).** Cited for the Pol III +1 initiation base and the 84.3% vs 86.9%
  comparison. A code comment in the tool gives "Mol Plant 8:1274" — **passed on as something to
  check, not as a citation.** Four attributions taken from code comments in this project have
  already turned out to be wrong, and I am not going to make that five.

`audit_documents.py` gained a seventh check: every author-year key cited in the supplementary must
resolve against the supplementary's own reference list. It now reports **17 cited, 18 listed, every
one resolves**.

## The four supplied references, all exact

- **SantaLucia (1998)** — "A unified view of polymer, dumbbell, and oligonucleotide nearest-neighbor
  (NN) thermodynamics", with the "unified NN parameters … in Table 1" from 108 oligonucleotide
  duplexes. Matches the Methods exactly.
- **Owczarzy et al. (2008)** — carries the correction verbatim as equation (8):
  `Tm(Mg2+) = Tm(1 M Na+) + 16.6 log(4√[Mg2+] + [Mon+])`, attributed there to Schildkraut and
  Lifson. The manuscript's phrasing — "the Schildkraut form 16.6·log₁₀[Na⁺] **given by** Owczarzy et
  al. (2008)" — is precisely right about who originated it and who supplies it, and the paper's
  abstract confirms the magnesium term the Methods deliberately omit.
- **Haeussler et al. (2016)** — CRISPOR. Correct.
- **Jin et al. (2021)** — "Genome-wide specificity of prime editors in plants": 12 pegRNAs at 179
  predicted off-target sites, 0.00–0.23%, whole-genome sequencing of 29 PE-treated rice plants.
  Exactly what the manuscript cites it for.

## Where the citation audit now stands

**Read and verified:** Anzalone 2019, Anzalone 2022, Chen 2021, Doench 2016, Haeussler 2016,
Hsu 2013, Jin 2021, Li 2023, Li 2026 (article, Supplementary Information and Supplementary Tables),
Lin 2020, Lin 2021, Liu 2024, Nelson 2022, Owczarzy 2008, SantaLucia 1998, Vu 2024, Zong 2022 —
**17 of the 19 sources this project relies on.**

**Outstanding: two, both supplementary-only, both now flagged in the document itself** — Ma 2015 and
Dang 2015.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · document audit clean on all seven checks · table
parity clean · main text **6,998 / 7,000** · fingerprint **`c4329cff`** (untouched).

---

# Addendum 23 — both missing references located and verified (22 August 2026)

Rather than hand the author a code comment to go shopping with, both were traced to their
publishers. Both are now full entries in the supplementary reference list, and the claims they
support are confirmed verbatim.

**Ma, X., Zhang, Q., Zhu, Q., Liu, W., Chen, Y., Qiu, R., Wang, B., Yang, Z., Li, H., Lin, Y., et
al. (2015).** A robust CRISPR/Cas9 system for convenient, high-efficiency multiplex genome editing
in monocot and dicot plants. *Molecular Plant* **8**:1274–1284.
https://doi.org/10.1016/j.molp.2015.04.007

The paper specifies targets as `5′-GN(19)NGG` for U6 promoters and `5′-AN(19)NGG` for U3 — the
U6 → G, U3 → A rule the platform enforces — and compares regular starts against irregular ones
("those having a T or C as the starting nucleotide"), measuring **84.3% versus 86.9%**. Those are
the exact numbers Supplementary Table S1 quotes, and they are why the Pol III +1 term is scored
zero rather than rewarded. **The code comment that read "Mol Plant 8:1274" was right** — the one
comment in this project I refused to trust turns out correct, and is now confirmed instead of
assumed.

**Dang, Y., Jia, G., Choi, J., Ma, H., Anaya, E., Ye, C., Shankar, P., and Wu, H. (2015).**
Optimizing sgRNA structure to improve CRISPR-Cas9 knockout efficiency. *Genome Biology* **16**:280.
https://doi.org/10.1186/s13059-015-0846-3

Verbatim: "a continuous sequence of thymines, which is the pause signal for RNA polymerase III …
could potentially reduce transcription efficiency", and "mutating the continuous sequence of Ts
significantly increased sgRNA production … due to the disrupted pause signal." That is exactly the
Table S1 poly-T row, confirmed.

## One thing deliberately not concluded

The publisher page's summary said Dang 2015 discusses neither spacer↔scaffold complementarity nor
GC content — two things the **tool** cites it for. But the paper is titled "Optimizing sgRNA
*structure*", so a narrow summary of a landing page is weak evidence against it, and this session
has already been burned four times by second-hand assertions. **Not acted on.** The two uses are
tool-only; nothing in the submitted documents rests on either. Flagged in the checklist to settle
from the PDF.

## Placeholders now

Manuscript **6** — phone, mirror URL, DOI, funding, CRediT, acknowledgements. Supplementary **0**.

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · document audit clean on all seven checks · table
parity clean · main text **6,998 / 7,000** · fingerprint **`c4329cff`**.

---

# Addendum 24 — Dang 2015 settled, and the tool's reference panel rebuilt (22 August 2026)

Addendum 23 left one question open on evidence too weak to act on: whether Dang 2015 supports the
spacer↔scaffold and GC-content claims the tool made in its name. Settled by two independent
fetches of the full text at different hosts.

**It does not.** Dang 2015's result is that *extending the scaffold's own duplex by ~5 bp*, combined
with mutating the poly-T at position 4, raises knockout efficiency. The duplex it extends is
internal to the scaffold. The paper never analyses base-pairing between the spacer and the
scaffold, and contains no GC-content analysis at all. Hsu 2013 likewise defines the seed as the
10–12 bp 5′ of the PAM and gives no GC band.

Eight user-visible strings were corrected accordingly. The spacer↔scaffold structure check, and
every GC band in the tool, are now marked **this work**. Dang 2015 keeps the one claim it earns:
the poly-T Pol III pause signal.

**The tool's own Key References panel was rebuilt, 16 entries → 23.** Four entries were wrong:

| was | is |
| --- | --- |
| "Genome Biol (2024) 25 — Conditional OsMLH1 knockdown" — *no author names at all* | Liu X et al. (2024) *Genome Biol* **25**:131 |
| "Tang X et al. (2024) *Nat Plants* — dual prime editing" — no volume, no pages, not in the manuscript | Zhao Y et al. (2025) *Nat Plants* **11**:191–205 |
| "Li J et al. (2023) *Nature Plants* **8**:999" — *twice*; that volume is 2022, and the claims belong elsewhere | Ma 2015 (Pol III +1 base) and Dang 2015 (poly-T); the 14–20 nt plant RT band is this work |
| "Chen PJ et al. (2021) — GC 40-60%, PBS 9-13 nt, RT 10-25 nt" | Chen 2021 carries MLH1dn, PE4 and PE5, and states none of those bands |

Seven verified references were added: Hsu 2013, Ma 2015, Dang 2015, Owczarzy 2008, Li 2026,
Ni 2023, Xu 2020.

---

# Addendum 25 — the citation audit finished inside the scorers (22 August 2026)

Everything above corrected what was reachable without touching the hashed functions, or moved the
fingerprint once with the author's agreement. This pass finished the job. **55 edits, 57
replacements.**

## Chen 2021 — 25 sites

Chen et al. 2021 (*Cell* **184**:5635) supports MLH1dn, MMR suppression, PE4 / PE5 / PE5b, PEmax
and the 7.7-fold / 2.0-fold human-cell averages. It supports no GC band, no PBS or RT length, no
edit-span limit, no free-energy threshold, no "#1 pegRNA failure mode", and no Tm convention. All
25 remaining attributions of those things were moved to *this work*, to Anzalone 2019 where the
number is genuinely his, or dropped. **Eight mentions remain, all of them MLH1dn, PE4/PE5, PEmax
or the fold-changes.**

Two of the corrected sites were not attribution errors but arithmetic ones:

* The ΔG risk thresholds were said to be "calibrated from Chen 2021 Fig 4 experimental data".
  Chen 2021 reports no free-energy data. They are this work.
* The composite verdict weights (40% spacer, 35% PBS, 25% RT) were credited to a "Chen 2021
  sensitivity ordering" that does not exist in the paper.

## Li 2023 — 21 sites

Li J et al. 2023 (*Plant Commun* **4**:100572) supports the ePE2 vectors, BsaI Golden Gate and rice
callus transformation. It is not the source of the Pol III +1 base (Ma 2015), the poly-T terminator
(Dang 2015), the 14–20 nt plant RT band, the 60 nt cap or the twinPE flap bands (Supplementary
Table S3 records all three as this work) — and it is *Plant Commun*, not *Nature Plants*, which the
tool said in two places. **Four mentions remain, all of them vectors, cloning or transformation.**

## Two warnings that quoted a threshold the code does not test

Not citation errors — factual ones, and user-visible:

* `computeSpacerSpecificity` flags a spacer GC outside **35–70%** while telling the user the band
  is 45–60%. 45–60% is the full-credit band, a different thing. Both are now stated.
* The same function flags a seed GC outside **35–65%** while saying 40–60%. Worse, seed GC is
  *reported and never scored* — the 15% "seed" term in that score is the distribution of CFD
  mismatch weights, not GC. The message now says so, and **Supplementary Table S4's seed-GC row
  was corrected in both the document and the workbook** to match (it had said "40–60% optimal ·
  mismatch tolerance · Hsu et al. 2013"; all three cells were wrong).

## A stale "OPEN" note

The block above `findSpacers` still announced six warnings as unfixed and the decision as
untaken. It had been taken. Replaced with what actually happened, including the two nicking-sgRNA
warnings the original list had missed.

---

# Addendum 26 — the phantom references (22 August 2026)

The tool's file header has said since 9 August that three references could not be verified and were
withdrawn. **All three were still being printed to users**, hundreds of kilobytes further down. A
withdrawal notice at the top of a file is worth nothing if the file goes on citing the reference.

| withdrawn on 9 Aug | still in use on 22 Aug | now |
| --- | --- | --- |
| "Li H et al. 2022 *Nature Plants* **8**:999" | nick-sgRNA engine literature block, credited with "plant rules: G-start, no TTTT" | Ma 2015 and Dang 2015 |
| "Xu R et al. 2023 *Nat Plants*" | the PE4 selection alert, user-visible | Liu X et al. 2024 *Genome Biol* **25**:131 |
| "Lin S et al. 2020 *Nat Plants*" | the multi-edit footer, user-visible, wrong initial *and* wrong journal | Lin Q et al. 2020 *Nat Biotechnol* **38**:582 |

Four more that no header note covered:

* **"Anzalone AV et al. 2021"**, used nine times for twin prime editing, one of them user-visible.
  The twinPE paper is Anzalone et al. **2022**, *Nat Biotechnol* **40**:731 — which is how the
  manuscript, the supplementary and the rest of the tool all cite it.
* **"Li J et al. 2023 *Nat Plants*"** in a vector panel — wrong journal again.
* **"Hegde M et al. 2022 *Nat Methods*"** — no volume, no pages, in no reference list in the
  deposit. Removed; nothing depended on it.
* **"Liu lab 2022 / NAR 2025"**, cited for the PBS↔spacer complementarity check in a comment and in
  a user-visible documentation panel. "Liu lab 2022" names no paper; "NAR 2025" names a journal and
  a year. The geometry is Anzalone 2019 Fig. 1c, already cited in the same sentence; the check and
  its thresholds are this work.

Also corrected: **"Kim HK et al. 2020 *Nat Biotechnol* **39**:198"** pairs a 2020 year with a 2021
volume. Now 2021.

---

# Addendum 27 — one manuscript claim withdrawn (22 August 2026)

> *"That window was set at 31–60 nt in human cells (Anzalone et al., 2022)"*

Anzalone et al. 2022 was read in full during this audit. **No 31–60 nt nick-to-nick window was
found in it** — not in the figures, not in the tables, not in the methods. The claim appeared once
in the manuscript and five times in the tool, always with that citation.

It is withdrawn rather than reattributed. Nothing rests on it: the window the platform enforces is
30–80 bp accepted and 30–50 bp optimal, both from Li et al. 2026, who varied the paired-nick
distance from 2 to 190 bp across six rice genes. The sentence's argument survives its removal
intact, and a citation a referee cannot find costs more than the clause is worth. Reattributing it
would have meant guessing at a source — the exact failure this audit has spent its time undoing.

**If the author has the page or figure, it can be restored in one edit with that pointer.**

Main text is now **6,982 / 7,000** — 18 words of headroom rather than 2.

---

# Addendum 28 — two numbers that were wrong in every legend (22 August 2026)

* Every legend reporting the equivalence evidence said **"76,066 computed fields"**. The harness
  reports **75,783**. The 76,066 figure came from a run made before `warns` was reclassified as
  advisory, which moved 283 fields out of the computed count. Corrected in the manuscript, the
  supplementary, the legends, both decks and the workbook — the number a reader can now reproduce
  by running the script is the number printed.
* Slide 14's speaker note said **"Figure S3 was re-captured on the current build on 22 August
  2026."** It was not. Figure S3's four panels are the original screenshots from the live server at
  build `572c4104`, which is what the figure's own legend says in three separate documents. The
  note contradicted the legend and has been replaced.

## Fingerprint lineage

`572c4104` → `3909f4db` → `c4329cff` → `2c0e07c8` → `ecc037b8` → `599b7773` → **`4c5446f2`**

Every move is a citation or a warning string. `analysis/build_equivalence.js` runs the entire design
surface — every benchmark locus, both strands, eleven architectures, four species, three priorities
— on the `572c4104` release build and on this one:

```
computed fields compared            : 75783
cases differing on a computed value : 0
advisory fields compared            : 21685
cases differing on advisory text only : 155
RESULT: the two builds compute identical results. Only advisory text differs.
```

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` · document audit clean on all seven checks · table
parity clean on all eleven tables · clean-room unpack of the archive reproduces the working copy
byte-for-byte and passes every check · main text **6,982 / 7,000** · fingerprint **`599b7773`**.

## Placeholders now

Manuscript **6** — phone, mirror URL, DOI, funding, CRediT, acknowledgements. Supplementary **0**.
Figure legends **0**.

---

# Addendum 29 — an independent audit of the deposit, and the one it caught (22 August 2026)

Before publishing, the deposit was audited end to end by a reader with no stake in it: every
factual claim in `README.md`, every path named in every documentation file, every script run,
every documented command executed.

## The one that mattered

**The test suite was reporting a pass over a failing test.**

`tests/audit_pe3.js` prints `6 passed, 1 failed` and exits 0. Every row in `tests/run_all.js`
matches `/^\d+ passed, 0 failed/m` — except `audit_pe3`, whose matcher was the bare `/passed,/`,
which matches failing output just as happily. So `node tests/run_all.js` printed **25 passed,
0 failed** while a shipped test was failing, and `README.md` and `tests/README.md` both
advertised that number.

The runner's matcher was the real defect and is fixed here: it is tightened to the same
`0 failed` rule as every other row. Verified by deliberately breaking the test: the suite now
reports `24 passed, 1 failed`.

The failing assertion itself was rewritten on the reasoning that PE3b "puts its nicking sgRNA on
the *edited* strand and requires the edit to destroy that sgRNA's PAM", from which it followed
that a plus-strand pegRNA at this locus has no partner and **zero is the right answer**.

> **Superseded, 12 September 2026.** That rule is inverted, and so was the conclusion drawn from
> it. PE3b nicks the *non-edited* strand, exactly as PE3 does; what changes is that its spacer is
> read from the edited allele, so the guide cannot bind until the edit exists. The plus-strand
> pegRNA case does have a partner — the corrected engine returns one — and the "zero" here was an
> artefact of the wrong rule, not a property of the architecture. See the 12 September entry.

`audit_pe3.js` reported **7 passed, 0 failed** on the rule as it then stood.

## Numbers that disagreed with each other

| claim | was | is |
| --- | --- | --- |
| equivalence, advisory-only cases | 131 in `README.md`, 155 in the tool | **155** — what the harness prints |
| `build_equivalence.js` header | "moved the fingerprint from 572c4104 to 3909f4db" | the full seven-step lineage |
| minus-strand protospacers missed at OsALS-T2 | six in `README.md`, six in the test's comment, nine in the tool | **three**, measured: the strand-specific call returns 20, three of them 10–80 nt from the nick on the correct side, and the default top-20 holds **none** |
| `case_studies.js` output | "44 of 44 designs pass" | **11 of 11** controlled, **33 of 33** spread — the number 44 never appears in its output |
| `analysis/` | 28 scripts | **30** |
| `tests/` | 38 files | **39** |
| `CaseStudy_Targets.csv` | "the eight case-study loci" | **seven** |

## Claims that were more generous than the code

* `tool_comparison.csv` and `all_tools.json` were listed as "checked automatically". They are
  read only by `build_editable_figures.py`, which needs a figure deck this deposit does not
  ship. **Two** files are checked, not four.
* "Everything else runs from an unpacked copy with no arguments" — `parse_competitors.py` needs
  competitor exports and `build_figure_legends.js` needs three paths; **five** scripts need the
  deck, not four. All are now listed with what they want.
* `build_figure_legends.js` died on a raw `ERR_INVALID_ARG_TYPE` stack when run with no
  arguments — immediately below its own comment about having guarded against exactly that on
  the `docx` import. It now prints usage and exits 1.
* Two usage strings named files that do not exist (`score_batch.js`, `build_legends.js`).

## Documentation that did not match the file it documents

* `docs/OFFLINE.md` said "three things reach the network" and listed three. There is a fourth:
  the ICAR and IARI logos and an author photograph are fetched at page load from
  `multieditptgd.daasbioinfromaticsteam.in`, seven references in the HTML. It is now in the
  table, with the commands to vendor it.
* The same file said "download the four families" and listed five, and said the Pyodide URL
  occurs "exactly once" when it occurs twice — following the instruction as written still
  pulled `pyodide.js` off the CDN. Both references are now given.
* `THIRD_PARTY_NOTICES.md` opened with "**Action required before deployment.**" — a note to the
  authors, shipped in a public notices file. The substance stays; the framing is now a
  disclosure to the reader.
* It gave CRISPOR as `crispor.gi.ucsc.edu`; every link the interface builds points at
  `crispor.tefor.net`. One stale metadata record in the tool is corrected to match. Ensembl REST
  and Phytozome were missing from the table although `OFFLINE.md` lists them.
* `tests/README.md` documented 24 of 25 entries; `test_twin_strand_search.js` had no row.

## Two things removed

* **Two third-party lab e-mail addresses** were being redistributed inside vector notes. They
  came from public Addgene records, but a permanent Zenodo record is not the place to propagate
  other groups' contact addresses. The notes now name the laboratory, the institution and the
  paper, which is what a reader actually needs.
* The tool's source pointed at `CHANGES_19Aug2026.md` for the record of the fingerprint moves,
  and that file was not in the deposit. **It is now** — a build whose fingerprint moved seven
  times should ship the record of why.

## Clean

No `__pycache__`, `.pyc`, `.DS_Store`, `*.tmp`, `*.log`, editor backups, `node_modules` or
zero-byte files. No TODO, FIXME, TBD, PLACEHOLDER, `example.com` or `localhost`. No profanity,
no "BROKEN" markers, no commented-out debug output. Every path named in `README.md`,
`docs/OFFLINE.md`, `CITATION.cff`, `.zenodo.json`, `THIRD_PARTY_NOTICES.md` and
`tests/README.md` resolves. Build date `2026-08-19` and live-since `2026-03-26` agree across
every file that states them. `LICENSE`, `.zenodo.json` and `CITATION.cff` are consistent with
one another.

## Fingerprint lineage

`572c4104` → `3909f4db` → `c4329cff` → `2c0e07c8` → `ecc037b8` → `599b7773` → **`4c5446f2`**

The last move is the twinPE comment inside `findSpacers` that quoted the unreproducible "nine".

## Verified after

`25 passed, 0 failed` — and now genuinely so · `68 checks, 0 disagree` · document audit clean on
all seven checks · table parity clean on all eleven tables · clean-room unpack reproduces the
working copy byte-for-byte · main text **6,982 / 7,000** · fingerprint **`4c5446f2`** ·
`75,783 computed fields across 411 cases, 0 differing` against the `572c4104` release build.

---

# Addendum 30 — the two guards that were not guarding (23 August 2026)

`data/`, `analysis/`, `tests/`, `docs/` and `DataS1/` were each audited in depth by readers
with no stake in the deposit. The most serious finding is one defect wearing two faces, and
the deposit's central reproducibility claim rested on it.

## The mutation that nothing caught

Change one line in the tool's structure engine — the severity band inside `m2_structRisk`,
from −5 to −0.5 kcal mol⁻¹. That alters how 194 of 411 design cases are classified. Before
23 August, here is what the deposit's two guards said about it:

```
old build : eq_orig.html   fingerprint 4c5446f2
new build : mutated.html   fingerprint 4c5446f2          ← did not move
cases differing on a computed value : 0                  ← reported identical
RESULT: the two builds compute identical results. Only advisory text differs.
```

**Both guards missed it, for two independent reasons that happened to cover for each other.**

### 1. The equivalence harness was classifying computed values as prose

`build_equivalence.js` held `structDetails` in its `ADVISORY` set. That field is not text. It
is what `m2_structRisk` returns per interaction channel:

```js
{label, run, dG, sev, weight}
```

`run` is a base-pair run length, `dG` a free energy in kcal mol⁻¹, `weight` the scoring weight
itself, `sev` the severity band. Only `label` is prose. Because the walk skipped an advisory
key **at any depth**, that entire subtree left the computed comparison — **24,764 values**.

Fixed by classifying per leaf rather than per subtree. One nuance found while fixing it:
`otDetails` looks like the same shape and is not — `computeSpacerSpecificity` builds it with
`details.push(\`…\`)`, so it is an array of plain sentences. Descending into that would have
been the same mistake in the other direction, comparing prose as a computed value. It stays
advisory; `structDetails` alone descends.

**The computed field count therefore rises from 75,783 to 100,547.** Same run, same 411 cases
— 24,764 more values compared. Still **0 differing**, and now that means what it says.

### 2. The fingerprint did not cover the structure engine

`PPE_BUILD.fingerprint` hashed `findSpacers`, `genPBS`, `genRT`, `computeSpacerSpecificity`,
`runPrimerDesign`, `_ppePrefix2` and `smartRecommend` — but not `m2_structRisk`, not the
free-energy functions it calls, not the nearest-neighbour parameter tables, and not
`genNickSgRNA`. The structure engine sets `structRisk`, `structPenalty` and `dGworst`, every
one of which feeds a candidate's score; `genNickSgRNA` designs an oligonucleotide a user
orders.

The file's own comment had already named this failure mode, twice: *"Two builds differing only
in a spacer weight therefore carried the same fingerprint while ranking designs differently —
the exact condition it exists to detect."*

All of them are now hashed. Fingerprint `4c5446f2` → **`46a53cfb`**.

### Verified by re-running the mutation

| mutation | fingerprint | computed differences |
| --- | --- | --- |
| severity band −5 → −0.5 | moves | **194** |
| weighted-run threshold 2 → 3 | moves | **82** |

Both were invisible to both guards before. Both are caught by both now.

---

## The published statistic that did not reproduce

`data/benchmark_lin2020_joined.csv` had no generator and had drifted from the canonical
scored benchmark:

| column | disagreement |
| --- | --- |
| `composite_score` | **all 44 rows** — exactly +8 on the 42 whose spacer starts with G, +0 on the two that do not. It predated the removal of the 5′-G bonus, which `benchmark_scored.csv` records as `gstart_term = 0` on every row. |
| `pbs_tm` | 22 rows, one by 38 °C — the Tm scale was recalibrated in between |
| `published_rank_percentile` | 4 rows, including **TaGASR7-peg01 66.7 vs 33.3** — the row `verify_manuscript_numbers.py` locks as the lowest percentile observed |
| `pbs_rt_dG` | 3 rows |

The between-site result in the Results is computed from this file, so it was computed from
superseded scores. `analysis/rebuild_lin2020_join.py` is new: it rebuilds the tool-derived
columns from `benchmark_scored.csv` while preserving the digitised efficiency column, which
exists nowhere else, and refuses to write if any id is missing or any efficiency would be lost.

**The manuscript sentence changes from ρ = −0.24, CI −0.67 to 0.31, P = 0.38 to
ρ = −0.32, CI −0.71 to 0.23, P = 0.25.** It is a null either way, and the paper reports it as
one — but the number a reader reproduces now matches the number the paper states.

---

## A published figure panel carrying invented numbers

Figure 4 panel F plotted four wall-clock times under "Runtime, standard laptop" and stamped
itself with the literal text **"replace with your timings"**, because `analyse_benchmark.py`
set them as `times=[30.0,0.4,2.1,0.6]  # ← replace with your own measurements`. The panel is
removed rather than guessed at. Panels A–E are all computed from deposited data.

`analyse_benchmark.py` also printed a pre-written *"Abstract sentence"* and *"Results
sentence"* and ended **"Paste the pre-written sentences above into the manuscript."** Those
sentences contradicted the paper: the script's cohort is the five rows of
`benchmark_scored.csv` that carry an efficiency, so it offered "Across 5 pegRNAs … ρ = −0.03
… P = 0.97" against the manuscript's n = 15, and "top 8% … for 60% of loci" against 56%. The
sentences are gone; the script now names its cohort and points at the two scripts that own
those numbers.

---

## The verification harness could not fail

`verify_manuscript_numbers.py` printed "68 checks, 0 disagree" and **always exited 0**. Worse,
nothing asserted there were 68 checks:

| perturbation | it printed |
| --- | --- |
| remove `data/pridict_vs_measured.json` | `49 checks, 0 disagree` |
| remove `data/targets_verified.csv` | `59 checks, 0 disagree` |
| rename a heading inside `fit_tm_optimum.py` | `66 checks, 0 disagree`, silently |

`EXPECTED_CHECKS = 68` is now declared and enforced, the two Figure 4 checks record a miss as
a disagreement instead of vanishing, `loto.json` is guarded like its siblings, and the script
exits 1 on any disagreement or a short count.

It earned its keep immediately: a header comment added to `targets_verified.csv` during this
same session broke `csv.DictReader`, and the new assertion caught it at `59 of 68` rather than
letting a clean "0 disagree" through. The note moved to the README instead.

---

## Everything else

**Data.** Seven rows of `benchmark_scored.csv` carried the literal string `NGG` in the `pam`
column — an IUPAC pattern, not a PAM, invented at merge because `targets_verified.csv` leaves
it blank for the Vu 2024 rows. The real three bases are determined (every spacer is located in
its own `genomic_seq` on the recorded strand) and are now read off the genome; the merge script
can no longer reintroduce the placeholder. `feature_matrix.json` and Figure 5D still described
the free-energy landscape as **4 channels**; it has been 3 since the 13 August fix and every
other place was corrected on 22 August. The Addgene catalogue said "33 entries browsed" over
35 records. `CaseStudy_Targets.csv` disagreed with the benchmark on two pegRNA counts.
`vector_sequences.json` had two keys spelled differently from the catalogue (a stray space, and
U+00D7 for ASCII `x`). `targets_verified.csv` mixes gene-frame and window-frame coordinates in
one row without saying so — nothing reads those columns, and the README now states the frames.

**Analysis.** `case_studies.js` counted a *positive* control among its negative ones and
printed it under the word "caught" — restated as "3 of 3 negative controls caught; 1 of 1
positive control passes; 1 not falsifiable by construction" — and had an unconditional
`pass()` after concatenating four strings, now a real check that the pegRNA carries its four
parts in order at the summed length. `build_figure2_panels.js` opened "Nothing is
reimplemented"; panel B is (demonstrated: changing the tool's scaffold-3′ weight from 1.0 to
2.5 left panel B byte-identical and still labelled ×1.0), and the header now says which panel
carries the guarantee. `fit_tm_optimum.py` printed a "NEW RECOMMENDED WINDOW" of 2–21 °C
against the 14–20 °C the tool ships — the deposit's own script telling a reader the tool is
wrong; it now prints the fit, prints what ships, and explains the narrowing. Four scripts saved
over the user's figure deck in place with no backup (confirmed destructive by md5); they now
write alongside it unless `--in-place` is given. `extract_engine.js` printed a false
`MISSING` banner on every run. `recovery_permutation.js` delivered a correct supersession note
by throwing nine lines of Node internals. `verify_citations.md` claimed "every one of the 27
references was checked" without saying it is a *bibliographic* record from 13 August that does
not reflect the attribution audit of 19–22 August; its scope is now stated at the top.

## Fingerprint lineage

`572c4104` → `3909f4db` → `c4329cff` → `2c0e07c8` → `ecc037b8` → `599b7773` → `4c5446f2` →
**`46a53cfb`**

## Verified after

`25 passed, 0 failed` · `68 checks, 0 disagree` **and exits 1 when it should** · document audit
clean on all seven checks · table parity clean on all eleven tables · clean-room unpack
reproduces the working copy byte-for-byte · main text **6,982 / 7,000** ·
**100,547 computed fields across 411 cases, 0 differing** against the `572c4104` release build.

---

# Addendum 31 — the two directories the last pass could not finish (23 August 2026)

`tests/` and `docs/`+`DataS1/` were audited after the earlier attempts were cut short. Both
found blockers. One of them would have cost money at the bench.

## The gBlock carried the wrong restriction sites

The worked example's vector is **BsmBI** (`CGTCTC`). S1a's primers P1 and P3 carry `CGTCTC`.
S1d's Golden Gate mix at Step 3 lists BsmBI. And the gBlock in **S1b was flanked by
`GGTCTC` / `GAGACC` — BsaI.** BsmBI will not cut it. S1d line 51 told the user the opposite:
*"Includes BsmBI flanking sites."*

Someone would have ordered a 159 nt synthetic fragment, paid for it, set up the ligation
exactly as the protocol says, and got nothing.

**Root cause.** The gBlock flank builder is a hand-rolled two-branch ternary that
special-cases BbsI and hardcodes BsaI for everything else:

```js
const reFwd = v.enzyme === 'BbsI' ? 'CACCGAAGACNN'+v.overhang_5
                                  : 'CACCGGTCTCN' +v.overhang_5;
```

It never consults `v.enzyme_recog`, and it never calls `m3_typeIIsTail` — the helper three
hundred lines above that already resolves BsaI, BsmBI, Esp3I and BbsI correctly, and that
P1/P3 do use. **Every BsmBI and Esp3I vector in the catalogue got BsaI sites.** Both are now
routed through the same enzyme table. BbsI's 3′ string is preserved byte-for-byte — it
carries a FIX M3-H note explaining its geometry, and I did not re-derive a published Type IIS
layout I cannot check against the protocol.

**Why nothing caught it: the gBlock had no test.** `tests/test_gblock_and_scorers.js` is new
and does. Verified by re-introducing the defect — it fails and names both affected vectors:

```
* FAIL * 5′ Type IIS tail carries the vector's own site and overhang
         WRONG: pYPQ166-OsPE2 (BsmBI), pCE3-BsmBI-dicot (BsmBI)
```

## The colony-PCR band was impossible

S1d printed three mutually exclusive numbers for one primer pair: `~203 bp` at Step 4,
`941 bp empty / 1070 bp filled` in the P5/P6 notes, and `empty_amplicon_bp: 340` in the
vector record. **203 bp is smaller than the empty-vector product** — a user screening
colonies against it scores every correct clone as negative.

The tool already knew how to do this. FIX EXPECTED-BAND (13 Aug 2026) replaced exactly this
kind of guess with `colony_empty_bp + insert` at one call site and said so. Three others kept
their magic numbers: the `+80` above, and two copies of `insertLen + 380 / 380`. All three now
read the vector's own recorded anchor distance, and say plainly that it is an estimate where
no deposited sequence exists. S1d now reads:

```
Colony PCR: P5_Verify_Fwd + P6_Verify_Rev
Expected: Correct clone: ~1070 bp | Empty vector: ~941 bp (a 129 bp shift, read off pYPQ141D-peg)
```

## The test suite: mutation-tested, entry by entry

Every one of the 25 entries was checked by deliberately breaking the tool in a way that entry
claims to catch. Eighteen caught every mutation aimed at them. These did not:

| | what was wrong |
| --- | --- |
| `test_same_codon_variants.js` | **Tested nothing.** It never loaded the tool — it re-implemented the codon logic locally against a codon table it built itself, and asserted nothing. `node test_same_codon_variants.js /does/not/exist.html` ran to completion and exited 0. Its runner regex, `/v1\.5 shows/`, matched a static column header printed before any computation. **Rewritten** to lift the tool's own `getCodonContext` into the sandbox and assert on it. |
| `test_pbs_panels_agree.js` | **A tautology.** `agree === checked * 0 + agree` is true for every value, so the only real condition was `agree > 0` — one agreeing candidate passed no matter how many disagreed. Two mutations survived it. Now `agree === compared`, and it reports 48 of 48. |
| `test_exports.js` | **Asserted nothing.** It printed `*** THREW` and continued, and printed `table tags balanced: false` as a statement of fact. All three export builders could break with the suite green. Now counts; verified by breaking the CSV builder. |
| the runner | **Accepted a crash and a non-zero exit.** `run_all.js` caught every failure into `out` and judged by regex alone. Appending `throw new Error(...)` to a passing test still reported PASS; so did `process.exit(3)`; so did a timeout. |
| 16 of 25 regexes | **Accepted `0 passed, 0 failed`** — a run that checked nothing — and the `/m` flag let an early passing tally mask a later failing section. Both reachable: clearing every `colony_verified` flag makes `test_colony_anchors` skip its whole loop and print exactly that. |

Rather than hand-tune sixteen regexes and hope the next one is written correctly, the runner
now applies two universal guards to every row — a zero-check guard and an any-failure guard —
plus a clean-termination requirement. A row's own regex still has to match; the guards can
only take a pass away, never grant one. Verified by injecting a crash and a `process.exit(3)`
into two passing tests: both now FAIL.

**`m2_structRisk` and `computeSpacerSpecificity` had no test at all.** Stubbing either to a
constant left all 25 entries green. Both are now covered by the new test file.

One honest correction to my own work: the rewritten codon test does **not** pin the original
v1.4 single-base-revert bug. That defect is not expressible against `getCodonContext`'s
signature — it takes the reference sequence and derives the codon by coordinate — and I
confirmed it by re-introducing the arithmetic and watching the test still pass. Its docstring
now says what it actually pins (codon framing, verified by a one-base `codonStart` shift that
makes three checks fail), rather than what would have sounded better.

**Suite: 25 entries → 26. `tests/` 39 files → 40.**

## docs/OFFLINE.md

* **The fingerprint description understated its own coverage.** It listed the scaffold, the
  motifs, the Tm bands, the exclude-first-C rule and the vector fields — but not the sixteen
  scorer, structure-engine and ranker inputs the hash also covers. A reader would have
  concluded that changing a scoring weight leaves the fingerprint intact. The full list is now
  given.
* **Three network-table errors.** It missed `fonts.gstatic.com`, which serves the actual font
  files, and `rest.ensemblgenomes.org`; and it listed **Phytozome as a network resource when
  the tool makes no request to it** — it builds a portal URL for the user to open.
* **"the two `<link>` tags"** — there are three font tags; the `preconnect` would have survived
  the self-hosting instructions and still attempted an outbound connection.
* **The Pyodide claim is a four-locus spot check, not a proof.** Both engines implement the
  same banded Needleman–Wunsch with identical parameters, and the source records a comparison
  at four loci — but nothing in `tests/` compares them, because Pyodide does not load
  headlessly. Now stated as such.
* **The interface labelled the Python engine `'Biopython · difflib SequenceMatcher'.`** It
  imports `Bio.Seq` only and runs the same banded Needleman–Wunsch; `difflib` and
  `SequenceMatcher` appear nowhere in the file. Corrected.

## DataS1 — everything else verified by hand

The overlap-extension product was reconstructed from the primer set and checked element by
element: clamp + BsmBI + N (11) → promoter overhang TGGC (4) → spacer (20) → scaffold (76) →
RT template (17) → PBS (10) → poly-T (6) → acceptor overhang GTTT (4) → N + BsmBI-RC + clamp
(11) = **159 nt**, all six required elements present and in the right orientation. Every
reverse-complement decision is correct (P2 and P3 RC'd, P4 correctly not). Every stated length
and GC recomputes exactly; every untailed primer's Tm recomputes exactly. The variant table
agrees with the genome on position, reference and alternate base, codon, amino acid, protein
position and synonymy. All four files regenerate byte-identical, and the geometry guard was
broken two ways and refused to write both times.

## A scope limitation now stated in the harness

`build_equivalence.js` exercises the **design** surface — `findSpacers`, `genPBS`, `genRT`,
`genNickSgRNA`, `smartRecommend` and the shared constants. It does not build the gBlock, the
cloning primers or the bench protocol. So a change confined to Module 3's cloning outputs
shows `0 differing` there and is still real — which is exactly what the gBlock correction did.
Its header now says so, and names the two tests that guard that side.

## Fingerprint lineage

`572c4104` → `3909f4db` → `c4329cff` → `2c0e07c8` → `ecc037b8` → `599b7773` → `4c5446f2` →
`46a53cfb` → **`96e270bb`**

## Verified after

`26 passed, 0 failed` · `68 checks, 0 disagree` and exits 1 when it should · document audit
clean on all seven checks · table parity clean on all eleven tables · **100,547 computed
fields across 411 cases, 0 differing** against the `572c4104` release build · DataS1
regenerates byte-identical · clean-room unpack reproduces the working copy byte-for-byte.

---

# Addendum 32 — the figures, checked against their own data (23 August 2026)

Every figure was rendered and read, and every number on every panel recomputed from the
deposited files. **Four errors, all of them visible on a published figure.**

## The "four channels" claim survived in seven more places

Addendum 30 corrected `feature_matrix.json` and regenerated the SVG. It did not reach the
**deck**, which draws Figure 5D as native PowerPoint shapes and is built by a script that
takes the deck as an argument. Nor did it reach six other places the 22 August sweep had
missed:

| where | what it said |
| --- | --- |
| Figure 5D, capability matrix row | "Multi-channel PBS free-energy landscape (4 channels)" |
| Figure 1 caption, slide 1 | "four-channel PBS ΔG landscape" |
| Figure S1 footer, slide 9 | "scored separately in the four-channel PBS landscape" |
| Manuscript — Figure S1 legend | same sentence |
| Manuscript — novelty paragraph | "the four-channel PBS free-energy landscape" |
| Supplementary — Figure S1 legend | same sentence |
| Figure legends — Figure S1 | same sentence |

All seven now say three scored channels, with PBS-to-RT named as reported-but-scored-from-
the-other-side. The rendered PDF is clean of the phrase.

## Figure 2A counted the benchmark wrong

The panel caption read *"structure penalties occur at 5 of the 25 benchmark loci."* The
deposit's own canonical count, locked by `verify_manuscript_numbers.py` and printed in the
README, is **26**. Recomputed directly from the tool: 26 distinct loci, structure penalties at
**5** of them. The 5 was right; the 25 was not. Corrected in both decks and in
`build_figure2_panels.js`.

## A comment inside the tool named the wrong PBS window

Figure S1 draws the plus- and minus-strand derivations, and checking it against the code
turned up a source comment that contradicts both the figure and the documentation panel:

```js
// PBS = RC(seq[nickPos..nickPos+pbsLen-1]) for + strand      <- the RT window, not the PBS
//       seq[nickPos-pbsLen+1..nickPos] for − strand           <- off by one
```

Verified against `genPBS` itself rather than by reading — the plus strand takes
`RC(seq[nickPos-pbsLen .. nickPos-1])` and the minus strand `seq[nickPos+1 .. nickPos+pbsLen]`,
exactly as Figure S1 and the doc panel say. **The code was always right** —
`audit_geom3.js` reproduces 144 of 146 published primer-binding sites from genomic sequence
alone — and only the comment was wrong. Corrected, with the verification method recorded.

## Figure 4's panel F was never in the paper

Addendum 30 removed a panel that plotted invented runtimes. Worth recording that this changed
no published figure: `Figure4_benchmark.svg` is referenced only by the README and its own
generator. **Figure 4 in the deck is the Tm recalibration figure** — panels A, B, C, from
`Figure_TmRecalibration.svg`. The two files have confusingly similar names; nothing was left
with a hole in it.

## What was verified and found correct

Recomputed from the deposited data, panel by panel:

* **Figure 2A** — all five spacers, their nick distances (5, 2, 24, 41, 8), PAMs and totals
  (65, 50, 22, 1, 1) match `figure2_panels.json` exactly.
* **Figure 2B** — the whole 4 × 15 free-energy grid, including −3.3 / −7.0 / 0.0 / −1.5 at
  lengths 8–11 and the −7.0 worst-scored channel at every length.
* **Figure 4** — the caption's "73 of the 74 variants, at 13 of the 14 rice target sites"
  is exact: 74 rows, 14 targets, and one target (OsIPA1-T1) contributing a single
  measurement, correctly omitted from within-target normalisation. Wallace optimum 29.6 °C,
  R² 0.45, matching the locked checks.
* **Figure 5 A, B, C** — all 35 primer-binding-site lengths, all 28 Wallace melting
  temperatures, and every cell of the 5 × 5 mean-absolute-difference matrix (0.86, 3.00,
  2.14, 3.71, 3.14, 1.71, 3.29, 3.00) reproduce from `all_tools.json`. The claim that the
  two plant-calibrated tools agree to within 1 nt while every other pairing differs by
  1.7–3.7 nt holds exactly.
* **Figure 5D** — 29 features, and 26 / 6 / 4 / 3 / 4 / 4 / 5 present per tool, all exact.
* **Figure 6** — ρ = −0.49 (HEK293T), −0.28 (K562), −0.68 (efficiency vs PBS length),
  +0.86 (HEK vs K562), +0.39 (PRIDICT vs length) and +0.11 on raw pooled efficiency; n = 23
  at four rice targets spanning 7–15 nt. Panel A's eight bars (12/8, 14/9, 12/8, 10/8) match
  the locked checks.
* **Figure S1** — the plus- and minus-strand formulas drawn are the ones `genPBS` executes.
* **Figure S4** — all 13 argmax rows, all 11 correlations (0.92 down to 0.20), the median
  0.74, "positive at every one of the eleven targets", and the pooled n = 67. All 13 best
  lengths do fall inside 8–11 nt, OsODEV-T1 sitting exactly on the boundary at 11.

## Verified after

`26 passed, 0 failed` · `68 checks, 0 disagree` · document audit clean on all seven checks ·
table parity clean on all eleven · **100,547 computed fields across 411 cases, 0 differing** ·
main text **6,983 / 7,000** · fingerprint **`96e270bb`** (unchanged — every edit here is
figure text, document prose or a source comment, all outside the hash).


---

# Addendum 33 — deposited, and the DOI wired in (24 August 2026)

The repository is public at `github.com/vsakhilprime/plant-prime-editor`, tagged **v1.0**, and
archived on Zenodo. This addendum records the four edits that closing the DOI required, and one
correction to something I had told the author.

## The concept DOI is 22076360, not 22076361

Zenodo reserves the concept and version DOIs as a consecutive pair and prints the **version**
one on the repository row in `zenodo.org/account/settings/github/`. I read that row and reported
`10.5281/zenodo.22076361` as the concept DOI. It is not. The record page states the concept DOI
explicitly — *"You can cite all versions by using the DOI 10.5281/zenodo.22076360"* — and that is
the one the paper cites, because it resolves to whichever version is newest at the time a reader
follows it. The version DOI is right only for pinning an exact build.

| | |
|---|---|
| Concept DOI — cited in the paper | `10.5281/zenodo.22076360` |
| Version DOI — v1.0 | `10.5281/zenodo.22076361` |
| Record | `zenodo.org/records/22076361` |
| Licence as Zenodo recorded it | Other (Non-Commercial) |

The licence line matters. `.zenodo.json` declared `other-nc`; had Zenodo rejected it the record
would have fallen back to a permissive default, and an open licence printed on the archive of a
non-commercial deposit would misstate the terms. It was checked on the published record rather
than assumed from the file.

## Version string: 1.0.0 → 1.0

The tag is `v1.0`, and so are `plant_prime_editor_v1.0.html`, `Supplementary_Tables_v1.0.xlsx`
and every mention in the manuscript. `CITATION.cff` and `.zenodo.json` were the only two files
that said `1.0.0`, so they were the ones out of step, not the tag. Both now read `1.0`.

The record Zenodo has already published still shows Version 1.0.0, because it was minted from the
archive as it stood. That is cosmetic and is left alone: editing a published record to chase a
string is a worse trade than a one-character mismatch nobody cites.

## The four edits

* `CITATION.cff` — an `identifiers:` block carrying both DOIs, concept first, replacing the
  commented-out placeholder left for exactly this moment.
* `README.md` — DOI badge under the build line, and a *Citing* paragraph saying which DOI to use
  when, with the fingerprint named as the thing to quote alongside it.
* `.zenodo.json` — version `1.0`.
* **Manuscript, Data availability** — `[[DOI]]` closed: *"…archived at Zenodo under the concept
  DOI 10.5281/zenodo.22076360 (v1.0: 10.5281/zenodo.22076361)."* Deliberately compact. The first
  draft of this sentence spelled out what a concept DOI does and cost fourteen words against a
  thirteen-word margin, which is how a 6,983-word manuscript becomes a 7,001-word one.

## Placeholders still open

Four, all needing information only the authors hold: `[[phone]]`, `[[mirror URL]]`, the funding
statement and the CRediT contributions, plus acknowledgements. None blocks the deposition; all
block submission.

## Verified after

`26 passed, 0 failed` · `68 checks, 0 disagree` · document audit clean on all seven checks ·
table parity clean on all eleven · main text **6,987 / 7,000** (margin 13) · deposit zip
**131 files** · fingerprint **`96e270bb`**, unchanged — nothing in this addendum touches a design
parameter, a scoring weight or a vector record.


---

# Addendum 34 — the landing page, audited against the code it describes (24 August 2026)

The author noticed the hero counter reading **10 PE Systems** while the tool has supported eleven
architectures since v1.0 and while the paper says eleven everywhere. That one tile was the first
number a visitor read, and it undercounted the tool. Finding it prompted a full audit of the
landing copy against the runtime — every count, list, threshold and citation checked by querying
the tool's own globals through the headless harness rather than by reading the prose.

Eleven claims were wrong. All eleven were prose. **Not one line of executable code changed, and
the fingerprint is still `96e270bb`** — which is the point of hashing the parameters rather than
the file.

## Counts

| Where | Said | Says now | Ground truth |
|---|---|---|---|
| hero stat tile | 10 PE Systems | **11** | `Object.keys(PE_SYSTEMS).length === 11` |
| hero paragraph, step card, vectors heading | 13 published + 2 in-house | **12 + 3** | 12 records carry an Addgene ID; 3 do not |
| vectors lead | 13 deposited at Addgene | **11 as prime editing constructs** | see below |
| vectors lead | overhangs read off the deposit for 13 of 15 | **10 of 15** | per-card count |
| direct-assembly guide | 10-card grid | **11-card grid** | `_DA_PE_SYSTEMS.length === 11` |

## The in-house constructs were undercounted, and two of them overclaimed

`pEPPE (Dicot)` is recorded `in_house: true, addgene: null`, and its own card carries an "in house"
badge — yet every summary counted it among the published vectors, and the closing note named only
`pCE3-BsmBI` and `pEPPE3-Dual` as in-house. All three are now named.

Worse, the cards for `pCE3-PE3 BsmBI` and `pEPPE3-Dual` both stated *"✓ overhangs read from the
deposited sequence"* while their own records say `cloning_note: 'built in-house; overhangs are
those the authors designed'` and carry no Addgene entry. A card cannot simultaneously be an
in-house construct and have its overhangs read off a deposit that does not exist. Both now say
what is true: built in house, overhangs as designed. That is not a downgrade — those four bases
are just as usable — but it is the difference between a checkable claim and an unearned one.

The Addgene count needed the manuscript's own precision. Twelve records carry an Addgene ID, but
`#71287` is the **base CRISPR backbone** of pHEE401E, not its prime editor, which `addgene_note`
has always said is not publicly deposited. The landing page now states eleven prime editing
constructs, explains the twelfth entry, and the pHEE401E card carries the caveat directly, where
someone about to order a plasmid will actually see it.

## PE5b had been dropped from three enumerations

The feature card, the Module 2 guide and the Direct Assembly guide all listed the architectures by
name and all three omitted **PE5b** — the feature card while asserting "11 systems total" two words
later. `PE_SYSTEMS` and `_DA_PE_SYSTEMS` both contain it and both render a card for it, so users
saw a system the documentation denied existed. Restored in all three.

## Two design parameters were quoted wrong

* **PE3 nick distance.** The architecture diagram and the PE3 system card said *40–80 nt optimal*.
  `genNickSgRNA` bands `dist >= 40 && dist <= 90 → 30 points` on both strands, and warns outside
  40–90 citing Anzalone 2019. Three other places in the tool already said 40–90. Corrected to
  40–90; the 30–100 acceptable band was right.
* **PBS length in the architecture diagram.** It read *PBS (13–17 nt)*, which matches nothing:
  `genPBS` scores 8–11 nt at 25 points, `PBS_ABS_MIN` is 8, the UI defaults to 8–17, and the same
  page says 8–11 in two other places. Now *8–17 nt; 8–11 optimal*.

## G-start was documented as worth points it does not carry

The scoring doc card said *"+8 pts if spacer begins with G"*. `findSpacers` and `genNickSgRNA` both
set `const gStart = 0;` before summing — with a FIX comment saying it is retained as a pass/fail
checklist item. So a G-start has been worth nothing for some time and the documentation never
followed. The card now says so, and explains what does happen: the warning fires, and the cloning
primers prepend the +1 base the promoter needs (G for U6, A for U3).

**The code was left alone deliberately.** Restoring +8 would change every composite spacer score in
the paper, move the fingerprint and invalidate the benchmark. Where documentation and code
disagreed, the documentation was wrong about what the tool does, and that is what was fixed.

## Checked and found correct

Scaffold 76 nt · tevopreQ1 37 nt · linker 9 nt and 19 candidates · polyT `TTTTTT` · ΔG channel
weights ×1.2 / ×1.0 / ×0.8 and RT↔PBS ×1.5 · heatmap 8–22 nt · critical below −12 kcal/mol ·
spacer distance, GC, seed and poly-T bands · PBS Tm bands 16 °C / 14–20 / 10–24 · Pol III +1 base ·
twinPE ≤700 bp and internick 30–80 · multi-edit 25 nt advisory and 34 nt ceiling · 6 cloning
strategies · 8 genomic databases · 15 vectors, 6 dicot / 9 monocot · all 15 cards' enzyme, promoter,
selection, overhang and Addgene fields · every author-year in the landing copy resolves to a
matching entry with the same year in the tool's own reference list.

One apparent contradiction was chased down and is not one: `genRT` holds two length-scoring bands,
20–50/14–60 and one derived from `idealLenMin`. The first sits inside the twinPE large-edit fast
path, which returns at its own `sort`; the second governs standard RT templates. They never both
run, and the doc card's "14–20 nt plant optimal" describes the second.

## Verified after

`26 passed, 0 failed` · `68 checks, 0 disagree` · fingerprint **`96e270bb`**, unchanged · `<div>`
balance unchanged from the pre-edit file (the pre-existing +2 delta comes from fragments inside
template literals, not from these edits) · all six script blocks load clean in the harness.


---

# Addendum 35 — the tool's own citation panel (24 August 2026)

The author asked what happens to the tool citation now that a DOI exists. It had not been touched,
and it was the one place a user would go to find out how to cite the software.

## What it said

> Voodikala S Akhil, Tushar K Dutta, & Chanumolu, H. G. K. (2026). *Plant Prime Editor v1.0*.
> Retrieved August 9, 2026, from pegRNA Design Platform website: https://akprimeedit.com

A website-retrieval citation. No DOI — there was none to give when it was written — a retrieval
date of **9 August 2026** that had been stale for a fortnight, an author list formatted three
different ways in one line ("Voodikala S Akhil" surname-last, "Chanumolu, H. G. K." surname-first),
and `@misc` rather than `@software` in the BibTeX. A reader following it lands on a live server
whose contents can change, with nothing to pin what they ran.

## What it says now

> Akhil, V. S., Dutta, T. K., & Chanumolu, H. G. K. (2026). *Plant Prime Editor* (Version 1.0)
> [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.22076360

Which is Zenodo's own rendering of the record, so the tool, the record, `CITATION.cff` and the
paper now all say the same thing. BibTeX became `@software` with `doi`, `version` and `publisher`
fields.

## Four strings, not two

The panel holds the APA and BibTeX blocks **twice** — once as rendered HTML, once as the `_apa`
and `_bib` JavaScript strings that the Copy button puts on the clipboard. Only the rendered pair
is visible, so an edit to the display alone would have left the button silently handing out the
old citation, which is worse than not having a button. All four were changed together, and a check
now confirms the displayed text and the copied text are character-identical in both formats.

## Two additions

* A note under the box explaining **which DOI to use**: the concept DOI for a paper, the version
  DOI to pin an exact build, and the fingerprint quoted alongside either.
* The **exported HTML report** footer, which previously read only "Generated by Plant Prime Editor
  v1.0", now carries the build fingerprint and the full citation. That file is the artefact that
  outlives the browser session and gets pasted into a thesis or a supplementary; it should be able
  to say what produced it.

## Verified after

`26 passed, 0 failed` (including *the four export builders run*, which exercises the report path) ·
displayed citation == copied citation in both formats · fingerprint **`96e270bb`**, unchanged.


---

# Addendum 36 — Anzalone et al. 2022 read, at last (3 September 2026)

The author supplied the PDF of Anzalone AV, Gao XD, Podracky CJ, Nelson AT, Koblan LW, Raguram A,
Levy JM, Mercer JAM, Liu DR (2022) *Programmable deletion, replacement, integration and inversion
of large DNA sequences with twin prime editing*, **Nat Biotechnol 40:731–740**,
doi:10.1038/s41587-021-01133-w — the article, Extended Data Figures 1–8 and the Methods.

Every claim in the package attributed to that paper was checked against it. **The withdrawal in
Addendum 27 stands, and three further attributions were wrong.**

## 1. The 31–60 nt window is genuinely not there — the withdrawal stands

Addendum 27 removed *"That window was set at 31–60 nt in human cells (Anzalone et al., 2022)"*
because it could not be found. It is now confirmed absent, by exhaustive token search rather than
by reading impression:

* `31` occurs **four** times in the whole file: an editing efficiency (*"28% or 31% attB
  insertion"*), reference number 31, and twice as `31.5 ng` of plasmid DNA in the transfection
  protocol.
* `60` occurs only as figure axis tick labels and as *"approximately 60% confluency"* in Methods.
* No `31–60` in any dash form.
* **The only numeric nt/bp range anywhere in the text is `43-44 bp`.**

The claim is not in the paper. It is not restored.

## 2. The ≥8 nt flap-overlap threshold was not Anzalone's

The 3′-flap complementarity panel read *"RC(flap1) should overlap with flap2 by ≥8 nt (Anzalone
2022)."* The paper contains no such threshold, and its designs are nowhere near it: Fig. 1c gives
3′ flaps *"with overlapping complementarity ranging from 22 bp to 38 bp"*, the *attP* series spans
21–37 bp, and the *PAH* recoding tested 22, 24, 36, 42, 47 and 59 bp overlaps. **The smallest
overlap tested anywhere in the paper is 21 bp.** The 8 comes from this tool's own
`Math.min(8, ...)` floor. The panel now says so, quotes the paper's real range, and adds what the
paper does report — that greater overlap gave slightly higher efficiency and fewer indels.

## 3. Anzalone 2022 was cited for a nick-to-nick window it does not state

Two places cited it alongside Li H et al. 2026 for *30–80 bp acceptable*. The paper states no
nick-to-nick window at all, and its own designs sit **above** that band: 90 bp replaced at *HEK3*,
and deletions of 56, 64, 77 and 90 bp between the pegRNA-induced nicks. Citing it for 30–80 bp
implied agreement that does not exist. The window is Li 2026's alone — 2 to 190 bp tested across
six rice genes — and the text now says what Anzalone's human-cell spacings actually were.

## 4. The ~700 bp ceiling is this tool's, not the paper's

Two places read *"up to ~700 bp. Anzalone 2022"*. The paper's summary sentence is *"precise
deletions of up to **780 nt** in DMD"*, and Fig. 2f reports deletion sizes of 558, 589, 627, 780
and 818 bp. Beyond that it reaches >5,000 bp integration and 40 kb inversion **only by adding a
Bxb1 recombinase step**, which this tool does not design. 700 is an engineering limit chosen here;
it is now labelled as one, with the paper's 780 nt and the recombinase caveat stated beside it.

## 5. One code comment confirmed correct

A comment at the RT-template scorer asserts that Anzalone et al. 2022 *"does not mention PEmax"*.
Confirmed: **the string PEmax occurs zero times in the paper.** The comment stays.

## 6. The manuscript said ten architectures

Unrelated to the PDF, found while checking the same paragraph: the introduction read *"A plant
researcher now chooses among at least ten architectures"* while the abstract, the results, the
discussion and the tool all say eleven. Hedged with "at least", so not false — but it was the same
undercount the author had already caught on the landing page. Now eleven.

## Verified after

`26 passed, 0 failed` · `68 checks, 0 disagree` · document audit clean · main text
**6,987 / 7,000** · fingerprint **`96e270bb`**, unchanged — every edit here is documentation prose
or a citation, none of it inside a scored parameter.

## Still unverified, and honestly so

The paper's **Supplementary Notes and Supplementary Tables 1–3 are separate files** and were not in
the PDF supplied. Nothing in this package now depends on them. The licence question against Plant
Communications policy and the two guideline pages remain open for the same reason as before —
cell.com and ScienceDirect refuse automated access.


---

# Addendum 37 — Li H et al. 2026 read (3 September 2026)

The author supplied the PDF of Li H, Chai Z, Shi X, Sun C, Zhang R, Zhang Q, Li Z, Zhang K, Lei Y,
Gao C (2026) *Multiplexed, precise genome engineering in monocots with twin prime editing systems*,
**Nat Biotechnol**, doi:10.1038/s41587-026-03174-5 — the article, Extended Data and Methods. This
is the reference that underpins more of the platform's scoring than any other, and it had never
been read here.

## The headline claim is confirmed word for word

The manuscript says:

> *"Li et al. (2026) varied the distance between paired nicks from 2 to 190 bp across six rice
> genes and found 30–50 bp best, with peak efficiency at four of the six."*

The paper says:

> *"we designed paired pegRNAs with internick distances varying from 2 to 190 bp … Across six
> endogenous rice genes, the TKO editor performed best when nick sites were spaced 30–50 bp apart,
> achieving peak efficiencies at four of the six loci."*

Exact. Extended Data Fig. 2e bins the data into five spacing groups — 2–19 (n = 3), 20–29 (n = 2),
**30–50 (n = 7)**, 51–80 (n = 10) and 81–190 (n = 15) bp — and their own design webtool "group[s]
by internick distance (with the **30–50-bp group preferred over the 51–80-bp group**)". That is
precisely the 30–50 optimal / 30–80 accepted split this platform enforces, arrived at
independently and matching.

The reference entry is also correct in every field: ten authors in order, title, journal, DOI.

## One attribution was wrong, and it is on a scoring parameter

The comment above `PBS_TM_BANDS` said Li et al. 2026 design to 30 °C for rice and 38 °C for wheat
and maize, *"stated in their **Methods** as based on internal testing"*.

**It is not in their Methods.** The article contains no melting temperature at all: the string
"melting" occurs zero times, and the only °C values in the whole file are growth-chamber settings
(28 °C for protoplasts, 30/28 °C day/night for regenerated plants). "Wallace" appears once, as the
surname of an author in reference 3.

Where it actually lives is in the article's own words: the Methods hand the PBS question to their
design webtool — *"users can customize SCC variants, **PBS models and values**"* — with *"detailed
user guidelines … in Supplementary Note 1 and the website's README file."* So the 30/38 °C rule is
a **webtool design setting, not an article result**. That is a weaker class of evidence than
"stated in their Methods" implies, and the comment now says so.

This does not change any number. The three-tier provenance labelling was already right and already
conservative: the rice band is re-derived here from 74 measurements at 14 rice targets (Lin et al.
2021), the wheat/barley/maize band is carried as another group's reported rule and explicitly *"not
re-derived here"*, and every other species inherits the rice window labelled as a default. Only the
sentence naming where their rule was published was wrong.

The tool's reference-panel entry for this paper also carried an abbreviated title and attributed
the Tm targets to the paper flatly. It now gives the full title, states the internick result as the
source of the nick-to-nick window, and says where the Tm targets come from.

## Not verifiable from this file, and left alone

The manuscript reports **516 designs parsed from their Supplementary Table 8** (437 rice, median
PBS 9 nt; wheat and maize medians 12 nt). Supplementary Tables are separate files and were not
supplied. The article does reference Supplementary Table 8 for pegRNA designs with *"varying the
lengths of PBS and homology arms"*, which is consistent, but the medians themselves remain
unchecked here and the manuscript already states plainly where they were parsed from.

The copy supplied is the accepted version, stamped *"Published online: xx xx xxxx"* (received 6
October 2025, accepted 15 April 2026). The reference entry's **"Published online 5 June 2026"**
therefore cannot be confirmed from this file. It is left as the author supplied it — worth a
30-second check against the live article page before submission.

## Noted, not acted on

The paper reports that SCC integration was most efficient when the paired RT templates' average
folding free energy fell between **−0.2 and −0.05 kcal mol⁻¹ per nucleotide** — a per-nucleotide
normalised ΔG band this platform does not use. Adopting it would change RT-template ranking, move
the fingerprint and invalidate the deposited benchmark, so it is recorded here as a candidate for a
future version rather than applied.

## Verified after

`26 passed, 0 failed` · `68 checks, 0 disagree` · fingerprint **`96e270bb`**, unchanged — both
edits are a comment and a documentation panel, neither inside a hashed parameter.


---

# Addendum 38 — five more references read (3 September 2026)

The author supplied Anzalone et al. 2019 and the four competing design tools. Every claim in the
package attributed to them was checked against the papers themselves.

| Reference | Entry | Verdict |
|---|---|---|
| Anzalone et al. 2019 | *Nature* **576**:149–157, doi:10.1038/s41586-019-1711-4 | correct |
| Chow et al. 2021 (pegFinder) | *Nat Biomed Eng* **5**:190–194, doi:10.1038/s41551-020-00622-8 | correct |
| Hsu et al. 2021 (PrimeDesign) | *Nat Commun* **12**:1034, doi:10.1038/s41467-021-21337-7 | correct |
| Hwang et al. 2021 (PE-Designer) | *Nucleic Acids Res* **49**:W499–W504, doi:10.1093/nar/gkab319 | correct |
| Li Y et al. 2021 (Easy-Prime) | *Genome Biol* **22**:235, doi:10.1186/s13059-021-02458-0 | correct |

## Anzalone 2019: every quoted design rule verified verbatim

This paper carries more of the scoring tables than any other, and every sentence attributed to it
is in it:

* **PBS length and GC.** *"We recommend starting with a PBS length of about 13 nt, and testing
  different PBS lengths during optimization, especially if the priming region deviates from about
  40–60% G/C content."* Supplementary Table S2 quotes the second clause; it is exact.
* **PBS range tested.** *"PBS sequences ranging from 8 to 17 nt"* — the 8–17 nt figure in S2.
* **RT template length.** *"we recommend starting with about 10–16 nt and testing shorter and
  longer RT templates during pegRNA optimization"* — the 10–30 nt acceptable band in S3 is built
  on this sentence and quotes it correctly.
* **PE3 nick distance.** *"nicks positioned 3′ of the edit about 40–90 bp from the pegRNA-induced
  nick generally increased editing efficiency (averaging 41%)"*. This settles the correction made
  in Addendum 34 from the other direction: `genNickSgRNA` bands **40–90**, the landing copy had
  said 40–80, and the source says 40–90. The code was right.
* **The 34 nt multi-edit ceiling.** *"Using PE3 with a 34-nt RT template, we installed point
  mutations at positions +12, +14, +17, +20, +23, +24, +26, +30, and +33 in the HEK3 locus with
  36 ± 8.7% average efficiency (Fig. 4b)."* The code comment says "a single 34 nt RT template
  installed edits at +12 to +33 from the nick", citing Fig. 4b. Exact.
* **The 3′-C penalty.** *"the use of RT templates that place a C adjacent to the 3′ hairpin of the
  sgRNA scaffold generally resulted in lower editing efficiency"* — the `firstCPen` term.
* **Editing scope.** *"Insertions (1 bp to ≥44 bp), Deletions (1 bp to ≥80 bp)"*.

## One manuscript claim was wrong, and a referee would have caught it

The Introduction read:

> *"PrimeDesign (Hsu et al., 2021), pegFinder (Chow et al., 2021), PE-Designer (Hwang et al.,
> 2021) and EasyPrime (Li et al., 2021) **target mammalian systems**"*

Two of those four say otherwise in their own papers:

* **PE-Designer** *"supports pegRNA design for **543 organisms including vertebrates, plants,
  insects, and bacteria**"*.
* **pegFinder** *"compared pegRNA designs recommended by pegFinder with experimental data using
  prime editing in human cells, murine cells and **plants**, finding that pegFinder successfully
  identified functional pegRNAs in these systems"*.

Easy-Prime is trained on HEK293T and PrimeDesign makes no organism claim, so the sentence held for
two of the four and overreached on the other two. It is the kind of error that costs a paper
credibility precisely where it is making a novelty claim, and the correction is not a retreat: what
those tools lack is not plant *genomes* but a plant-calibrated primer-binding-site rule, which is
what this paper measures and what Figure 5 shows. The sentence now says that, and names both
exceptions.

Also corrected: **Easy-Prime** is hyphenated in its own title. The reference list had it right; the
body text and the Figure 5D legend had "EasyPrime" in five places.

## Verified after

`68 checks, 0 disagree` · document audit clean on all seven · table parity clean on all eleven ·
main text **6,990 / 7,000**. No tool code was touched, so the fingerprint is unchanged at
**`96e270bb`**.
