# Test suite

```
node tests/run_all.js
```

That is the whole thing. No dependencies beyond Node, no network, no build step. The suite
loads the released `plant_prime_editor_v1.0.html` headlessly and exercises its scoring
engine directly — the tests run against the file that is served, not a copy of the logic.

Expected output:

```
31 passed, 0 failed
```

To test a different build: `node tests/run_all.js path/to/other.html`, or set `PPE_HTML`.

Every row in the runner requires its script to report `0 failed`, **and** to terminate
cleanly, **and** to have actually checked something. Those last two were added on 23 August
2026 after a crash appended to a passing test, a `process.exit(3)`, and a run that printed
`0 passed, 0 failed` were each verified to report PASS. A script that reports a
failure fails the suite — `audit_pe3.js` was matched by a looser pattern until 22 August
2026, and the suite reported 25 of 25 over a failing check for as long as that lasted.

---

## What each test checks

| Test | Checks | Passing means |
|---|---|---|
| `audit_syntax.js` | every `<script>` block parses | the released file is not silently broken |
| `audit_bio.js` | 36 assertions on the sgRNA scaffold, tevopreQ1 motif, poly-T terminator, nearest-neighbour and Wallace melting temperatures, the codon table including all three stops, reverse complement, and PAM matching with full IUPAC degeneracy | the biological constants are the published ones |
| `audit_geom3.js` | rebuilds the primer-binding site for every published pegRNA in `data/targets_verified.csv` from genomic sequence alone | **144 of 146 published primer-binding sites reproduce exactly**, 97/98 on the plus strand and 47/48 on the minus. The two exceptions are documented PDF-parsing truncations in the source tables, not tool errors |
| `audit_rt.js` | reverse-complements each generated reverse-transcriptase template back onto the genome and checks the resulting flap | **42 of 42** — the flap differs from wild type at exactly one position, that position is the one requested, and the base is the one requested, on both strands at six nick-to-edit distances |
| `audit_indel2.js` | insertions and deletions on both strands | the flap equals the wild-type window with the edit applied, exactly |
| `audit_tooltable.js` | the head-to-head comparison exists twice on disk — `data/tool_comparison.csv` and `data/all_tools.json` — and every field they share must agree, every row must appear in both, and every tool must carry a recorded version. It found seven PRIDICT designs present in the JSON and in Supplementary Table S9 but absent from the CSV |
| `audit_routes.js` | the six assembly routes and the vector overhangs, against Supplementary Table S7: which primers each route actually emits (the enzyme-swap routes drop P1 and add their own pair; one-step Gibson emits the P_OS trio; gBlock emits the synthesised insert and three Gibson primers), and that the guide overhangs are per-vector rather than per-enzyme — four distinct pairs across the 12 BsaI vectors, and no vector with the CGTG overhang the table used to claim |
| `audit_fuzz.js` | randomised end-to-end check: 300 random sequences with a random edit of a random class on a random strand, plus 300 more for PE3b. Asserts that the engine never throws, that every RT template read back onto the top strand is found in the *edited* genome, that every primer-binding site is the reverse complement of the bases immediately 5′ of the nick read from the *reference*, and that every PE3b candidate obeys its own rule. Seeded, so a failure is reproducible |
| `audit_mnp.js` | multi-base substitutions | a same-length ref→alt of any length is applied as a replacement, not spliced in as an insertion: the template keeps the window's length, exactly the requested bases change, and a substitution the window would clip is warned about. Insertions and deletions still change length as they should |
| `audit_pe3.js` | PE3 and PE3b nick sgRNA rules | both systems nick the non-edited strand; a PE3b spacer is read from the edited sequence, carries the edit inside its protospacer and leaves its PAM intact; a seed-region edit outranks a PAM-distal one; an indel is refused rather than guessed; and when nothing is returned the test establishes independently that nothing qualifies |
| `audit_pair.js` | the primer-binding site and RT template judged together | a clean pair is silent; a low-band pair raises one warning naming the energy and says whether any other candidate escapes it; degenerate input does not throw; selection is unchanged |
| `test_organism_detection.js` | species detection from 13 real FASTA and GenBank header formats | monocots and dicots are called correctly, and a header with no species returns "unknown" rather than guessing |
| `test_same_codon_variants.js` | two nucleotide changes inside one codon, against the tool's own `getCodonContext` | codon framing is right, and two variants in one codon agree on one reference codon and one amino-acid position. **Rewritten 23 Aug 2026** — the previous version never loaded the tool at all: it re-implemented the logic locally and asserted nothing, and ran to completion against a non-existent file |
| `test_acceptor_overhangs.js` | re-derives every acceptor's Golden Gate overhangs from `data/vector_sequences.json` by simulating the digestion | the overhangs in the tool have not drifted from the sequence they were read off |
| `test_vector_records.js` | internal consistency of all 15 vector records | enzyme, overhangs, promoter, cassette count and species scope agree with one another |
| `test_colony_anchors.js` | colony-PCR anchors against the deposited plasmid sequences | each anchor occurs exactly once in the real plasmid |
| `test_alignment_panel.js` | Module 1 alignment panel and the species-group note | rows align column-for-column and the evidence tier is stated |
| `test_strategy_cards.js` | cloning strategy cards | each card reads the selected vector's enzyme and overhangs, not hardcoded literals |
| `test_layout_containers.js` | interface containers | every panel holds what it was built for |
| `test_table_columns.js` | every rendered table | body cell count matches the header column count |
| `test_pbs_panels_agree.js` | the PBS heatmap against the PBS table | both report the same melting temperatures and free energies |
| `test_design_rules.js` | the published design windows | the literature rules are the ones actually applied |
| `test_gibson_arms.js` | homology arms against the linearised vector | arms match the deposited backbone, or are withheld where no sequence exists |
| `test_re_conflict.js` | the restriction-conflict screen | an internal site for the cloning enzyme is caught on both strands |
| `test_primer_roundtrip.js` | the emitted primers | they rebuild a product that the vector's own enzyme excises with the declared overhangs |
| `test_build_and_exports.js` | the build stamp and the off-target hand-off | the fingerprint is computed and the CRISPOR/CRISPR-P hand-off produces valid FASTA |
| `test_pol3_start_base.js` | the Pol III +1 base | U6 cassettes take G and U3 cassettes take A, and **the annealing pair agrees on both strands** — the top and bottom oligos describe the same molecule |
| `test_twin_strand_search.js` | the paired-pegRNA opposite-strand search (twinPE, PPE, ePPE3) | a strand-specific search returns candidates where filtering the default top-twenty returns none, and omitting the option leaves the default return unchanged. Both counts are measured at run time and printed, so the description cannot drift from them |
| `test_gblock_and_scorers.js` | the gBlock's restriction sites against each vector's own enzyme, plus `m2_structRisk` and `computeSpacerSpecificity` | added 23 Aug 2026 after mutation testing showed all three could be broken with the whole suite staying green. The gBlock case is not hypothetical: the flank builder branched only on BbsI and hardcoded BsaI, so every BsmBI and Esp3I vector shipped a synthetic fragment its own protocol could not cut |
| `test_csv_export_scope.js` | the Module 1 CSV export | 1-based CDS position, codon position, reference codon and protein impact are all resolved |
| `test_exports.js` | the four export builders | valid JSON carrying the build stamp, a sectioned CSV with candidate rows, balanced HTML with the pegRNA embedded, and a well-formed SVG. **Now asserts** — until 23 Aug 2026 it printed `*** THREW` and continued, so all three builders could break with the suite green |

## Why the geometry tests matter most

A sign error in the primer-binding site or the reverse-transcriptase template produces a pegRNA
that looks entirely reasonable and does nothing at the bench. `audit_geom3.js` and `audit_rt.js`
exist to make that class of error impossible to ship unnoticed. Both were written after
real bugs were found, and both would have caught them:

- an off-by-one on the minus strand — caught by rebuilding published sequences rather than
  reasoning about the arithmetic
- reverse-transcriptase templates that encoded no edit at all — caught by reverse-complementing
  the flap back onto the genome instead of trusting the reported length

`audit_geom3.js` is validated against an external gold standard as well: the tool reproduces the
Anzalone et al. 2019 HEK3 primer-binding site `CGTGCTCAGTCTG` exactly, and reproduces it again
when the same site is presented on the opposite strand.

`test_pol3_start_base.js` is the third of that kind. It was written after the Pol III +1 base was
found prepended to the top oligo of an annealing pair but not to its bottom partner, which left
the ordered duplex one base short. It is now wired into the runner rather than sitting beside it.

## Data

| File | Source |
|---|---|
| `data/targets_verified.csv` | 176 published pegRNAs from Lin et al. 2020, Lin et al. 2021 and Vu et al. 2024, each located in genomic sequence and checked for spacer uniqueness, PAM, primer-binding-site reconstruction and edit position |
| `data/tm_table.csv` | 74 primer-binding-site variants at 14 rice targets with measured editing efficiency |
| `data/sequences_plain/` | seven verified genomic windows, one line each |
| `data/edits.json` | the edit at each of those windows, with the position independently confirmed |

## Adding a test

Write a script that exits with output the runner can match, then add one row to `SUITE` in
`run_all.js`: the filename, a one-line description, and a regular expression that must match
the output. A test file that is present in `tests/` but absent from `SUITE` is never run —
two were in that state until 19 August 2026. Tests are plain Node scripts and can be run
individually:

```
node tests/audit_geom3.js
```
