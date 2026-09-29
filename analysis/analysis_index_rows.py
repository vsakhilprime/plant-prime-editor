#!/usr/bin/env python3
"""
The rows of Supplementary Table S13, in one place.

Table S13 indexes every analysis the Results report against the file it reads, the command that
regenerates it, what that command produces, and the figure or table the result appears in. The
rows live here rather than inside the patcher because two things consume them: the patcher that
writes them into Supplementary_Data.docx and the workbook, and nothing else. The CHECKER does
not import this file — analysis/check_supplementary_s13.py reads the table back out of the
document and validates every path, script and reference against the deposit itself, because a
checker that reads the same list the patcher wrote can only confirm that a copy was made.

Every command in this list was run from the root of an unpacked deposit on 27 September 2026 and
exited 0. Two were not runnable before that date and were corrected first:

  * analysis/rank_analysis.js threw ENOENT on its first iteration — see
    patch_rank_analysis_seqfile.py.
  * analysis/merge_benchmark.py is a pipeline STAGE, not a command: running it alone rewrites
    data/benchmark_scored.csv from the merge sources and drops every column the scorer adds,
    including edit_from_top and edit_to_top, after which analysis/case_studies.js throws and
    tests/audit_mnp.js fails. Its row names both stages, and the note under the table says what
    happens if only the first is run. This was found the hard way, by running it.

Field meanings:

  group    a bold section row; the remaining fields are then empty
  result   the analysis, as the Results report it
  inputs   the deposited data it reads; '' when it reads only the tool
  command  the command, exactly as it is typed from the deposit root
  output   the file it writes, or the line it prints when it stores nothing
  where    the figure, table or Results section the result appears in
"""

ROWS = [
    dict(group=u'The platform, as Modules 1–3 describe it'),
    dict(result=u'The shipped regression suite: 21 regression tests and 11 audit sweeps, run '
                u'against the single file users receive rather than a reimplementation',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node tests/run_all.js',
         output=u'prints 32 passed, 0 failed',
         where=u'Figure 1'),
    dict(result=u'Module 1: all 64 codons against an independently written standard genetic '
                u'code, the conservative grouping against BLOSUM62’s own positive pairs, 240 '
                u'applied edits round-tripped, every frameshift named',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_module1_calls.js',
         output=u'prints 15 passed, 0 failed',
         where=u'Results, Module 1'),
    dict(result=u'Module 2: 464 designs across both strands and all four edit classes, compared '
                u'against an independent reference implementation of the edited template and '
                u'its homology',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_module2_design.js',
         output=u'prints 17 passed, 0 failed',
         where=u'Results, Module 2; Tables S1–S3'),
    dict(result=u'Module 3: whether each primer’s 3′ terminus occurs in the template it has to '
                u'prime, for every vector and both second-cassette paths',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_module3_primers.js',
         output=u'prints 29 passed, 0 failed',
         where=u'Results, Module 3; Table S7'),
    dict(result=u'The spacer intrinsic specificity score moves with every term the '
                u'documentation says it moves with, and its five labels partition the range it '
                u'can reach',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_specificity_score.js',
         output=u'prints 26 passed, 0 failed',
         where=u'Table S4'),
    dict(result=u'The tevopreQ1 linker screen returns more than one linker across 300 designs '
                u'and rejects what pegLIT’s published filters reject',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_linker_selection.js',
         output=u'prints 13 passed, 0 failed',
         where=u'Table S5'),
    dict(result=u'The vector catalogue: which records are deposited plasmids and which are '
                u'designs you build yourself, and every enzyme’s recognition site and cut '
                u'offset against NEB',
         inputs=u'data/addgene_plant_pe_catalogue.json, data/vector_sequences.json',
         command=u'python3 analysis/check_vector_claims.py',
         output=u'prints 107 checks, 0 disagree',
         where=u'Table S6; Figure 5D'),
    dict(result=u'Every cloning-strategy card draws the PCR product the primers it emitted can '
                u'actually make',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_card_matches_primers.js',
         output=u'prints 30 passed, 0 failed',
         where=u'Figure 3'),
    dict(result=u'One pegRNA, one transcript length: the assembly panel, the paired panel, the '
                u'four exports and the FASTA records compared against one another',
         inputs=u'plant_prime_editor_v1.0.html',
         command=u'node analysis/check_export_transcript_length.js',
         output=u'prints 21 passed, 0 failed',
         where=u'Figure 2F; Data S1'),

    dict(group=u'The primer-binding-site melting-temperature recalibration'),
    dict(result=u'The optimum and the acceptable band on both thermodynamic scales, from the 73 '
                u'analysed primer-binding-site variants',
         inputs=u'data/tm_table.csv, data/tm_table_normalised.csv',
         command=u'python3 analysis/fit_tm_optimum.py',
         output=u'analysis/fig4data.json; data/Figure_TmRecalibration.svg',
         where=u'Figure 4'),
    dict(result=u'How the 8–11 nt window behaves at other boundaries — recall against '
                u'enrichment over a uniform draw',
         inputs=u'data/tm_table.csv',
         command=u'python3 analysis/window_sensitivity.py',
         output=u'analysis/window_sensitivity.json',
         where=u'Results, melting-temperature section'),
    dict(result=u'Leave-one-target-out: the optimum and the window refitted from the other '
                u'twelve targets and applied to the one withheld',
         inputs=u'data/tm_table.csv',
         command=u'python3 analysis/loto_lengths.py',
         output=u'data/loto.json',
         where=u'Figure S4, whose builder re-derives the same result independently'),
    dict(result=u'Proximity to the melting-temperature band for the design’s own species '
                u'against measured efficiency, and proximity to 30 °C read on the '
                u'nearest-neighbour scale against the same measurements',
         inputs=u'data/benchmark_scored.csv, data/benchmark_lin2020_joined.csv',
         command=u'python3 analysis/check_benchmark_correlations.py \u2020',
         output=u'prints both coefficients and 0 check(s) disagree',
         where=u'Results, melting-temperature section'),

    dict(group=u'The benchmark of published editing outcomes'),
    dict(result=u'The scored benchmark itself: the pegRNAs pooled from three studies, located '
                u'in genomic sequence and scored by the tool’s own engine',
         inputs=u'data/targets_verified.csv, data/scored_rice_wheat.csv, '
                u'data/scored_tomato.csv',
         command=u'python3 analysis/merge_benchmark.py then '
                 u'node analysis/score_batch_v2.js data/benchmark_scored.csv '
                 u'(two stages — see the note below)',
         output=u'data/benchmark_scored.csv, 60 columns',
         where=u'Results, benchmarking; Table S8 is this file’s column key'),
    dict(result=u'Every edit in the benchmark is an edit a source paper reports, not one '
                u'constructed for the analysis',
         inputs=u'data/benchmark_scored.csv, data/targets_verified.csv',
         command=u'python3 analysis/check_edits_are_published.py \u2020',
         output=u'prints 0 disagree',
         where=u'Methods'),
    dict(result=u'Composite design score against measured editing efficiency across target '
                u'sites',
         inputs=u'data/benchmark_lin2020_joined.csv',
         command=u'python3 analysis/score_vs_efficiency.py',
         output=u'prints the coefficient and its interval',
         where=u'Results, benchmarking'),
    dict(result=u'Where the design the original authors used ranks among the alternatives the '
                u'tool offers at the same locus, against a permutation null',
         inputs=u'data/benchmark_scored.csv',
         command=u'python3 analysis/recovery_permutation.py',
         output=u'analysis/recovery_permutation.json',
         where=u'Results, benchmarking'),
    dict(result=u'Eleven architectures run end to end on the worked example’s spacer and again '
                u'on the published spacer at a locus in rice, wheat and tomato, with four '
                u'negative controls',
         inputs=u'data/benchmark_scored.csv, analysis/worked_example.json',
         command=u'node analysis/case_studies.js',
         output=u'analysis/case_studies.json',
         where=u'Table S11'),
    dict(result=u'Every architecture at every benchmark locus, and which combinations the '
                u'platform declines rather than fails',
         inputs=u'data/benchmark_scored.csv',
         command=u'node analysis/architecture_sweep.js',
         output=u'analysis/architecture_sweep.json',
         where=u'Results, benchmarking'),

    dict(group=u'The comparison with existing pegRNA design tools'),
    dict(result=u'The design each public tool returned for the same seven sequences and the '
                u'same seven edits: spacer, primer-binding-site length and melting temperature '
                u'on both scales',
         inputs=u'data/edits.json, data/competitors.json, data/sequences_plain/',
         command=u'node analysis/headtohead.js',
         output=u'data/headtohead.json; data/tool_comparison.csv',
         where=u'Table 1; Figure 5A–C; Table S9'),
    dict(result=u'Where the published, experimentally validated spacer sits in each tool’s own '
                u'candidate list, and how many candidates each tool offers',
         inputs=u'data/edits.json, data/competitors.json',
         command=u'node analysis/rank_analysis.js; then '
                 u'python3 analysis/check_spacer_recovery.py \u2020',
         output=u'data/rank_analysis.json; prints 0 disagree',
         where=u'Results, head-to-head; the “published spacer recovered” row of Table 1'),
    dict(result=u'The capability comparison, 29 features across seven tools, drawn from the '
                u'deposited matrix rather than transcribed',
         inputs=u'data/feature_matrix.json',
         command=u'python3 analysis/make_figure5d_feature_matrix.py',
         output=u'data/Figure5D_FeatureMatrix.svg',
         where=u'Figure 5D'),
    dict(result=u'PRIDICT2.0 predictions against measured rice efficiency, normalised within '
                u'each target to its own best pegRNA; the pooled raw coefficient is computed '
                u'and printed alongside it',
         inputs=u'data/pridict_vs_measured.json',
         command=u'node analysis/build_figure6_editable.js',
         output=u'prints both coefficients; writes Figure6_AB_editable.pptx',
         where=u'Figure 6; Table S10'),

    dict(group=u'Falsifiability, the worked example, and the paper as a whole'),
    dict(result=u'The 5 nt homology rule, forced to fail: the template length is driven down '
                u'until the rule breaks, and where the platform flags it is recorded',
         inputs=u'data/benchmark_scored.csv',
         command=u'node analysis/homology_falsifiability.js',
         output=u'analysis/homology_falsifiability.json',
         where=u'Results, added value'),
    dict(result=u'Whether the heaviest weight in the composite is load-bearing: the tool is '
                u'rebuilt at seven values of it and the selections that move are counted',
         inputs=u'data/benchmark_scored.csv',
         command=u'node analysis/weight_sensitivity.js',
         output=u'analysis/weight_sensitivity.json',
         where=u'Results, added value; Figure 2D'),
    dict(result=u'The worked example’s four export formats, written by the shipped exporters '
                u'rather than by hand, and refused if the geometry no longer matches',
         inputs=u'analysis/worked_example.json',
         command=u'node analysis/make_data_s1.js',
         output=u'DataS1/, four files',
         where=u'Data S1'),
    dict(result=u'Independent corroboration: a 516-design series, the Xu 2020 set, the wheat '
                u'and maize series, and the tomato paired-pegRNA result',
         inputs=u'data/li2026_pbs_designs.json, data/li2023_pbs_final.json, '
                u'data/lin2020_wheat_pbs.json, data/xu2020_designs.json, '
                u'data/xu2020_scored.json, data/xu2020_stats.json, '
                u'data/vu2024_paired_pegRNA.json',
         command=u'python3 analysis/verify_manuscript_numbers.py',
         output=u'prints 96 checks, 0 disagree',
         where=u'Results, paired-pegRNA support; Supplementary'),
    dict(result=u'Every quantitative claim in the paper, re-derived from the deposited data and '
                u'compared against what the text states',
         inputs=u'every file named above',
         command=u'python3 analysis/verify_manuscript_numbers.py',
         output=u'prints 96 checks, 0 disagree',
         where=u'the whole paper'),
    dict(result=u'The supplementary tables: the Word copy against the Excel copy, and both '
                u'against the engine and the data files they describe',
         inputs=u'Supplementary_Data.docx, Supplementary_Tables_v1.0.xlsx',
         command=u'python3 analysis/check_supplementary_tables.py \u2020; '
                 u'python3 analysis/check_supplementary_rest.py \u2020',
         output=u'prints all checks pass; 19 ok, 0 FAILED',
         where=u'Tables S1–S13'),
]

HEADERS = [u'Result reported', u'Input data in the deposit', u'Command',
           u'Output of record', u'Where it appears']

CAPTION = (u'Table S13.  Where every analysis reported in the Results lives in the deposit.')

INTRO = (u'Each analysis the Results report is listed against the deposited file it reads, the '
         u'command that regenerates it, what that command writes or prints, and the figure or '
         u'table the result appears in, so that any single result can be checked without '
         u'reading the whole deposit first. File and script names are exactly as they appear in '
         u'the repository archived at the DOI given under Data availability.')

NOTE = (u'Every command above is typed from the root of an unpacked deposit; none needs an '
        u'argument or a particular working directory, and each was run in the form printed here '
        u'and exited without error. A script that writes a PowerPoint or SVG file writes it '
        u'into the directory the command is run from unless the path shown says otherwise; a '
        u'row whose output is a printed line stores nothing, and the line quoted is what the '
        u'script prints when nothing disagrees. The benchmark is the one two-stage exception. '
        u'analysis/merge_benchmark.py assembles the rows and analysis/score_batch_v2.js scores '
        u'them, and the first alone leaves data/benchmark_scored.csv without the columns the '
        u'scorer adds, after which analysis/case_studies.js stops with an error; rebuild it '
        u'with python3 analysis/merge_benchmark.py, then node analysis/score_batch_v2.js '
        u'data/benchmark_scored.csv > rescored.csv, and move rescored.csv back over '
        u'data/benchmark_scored.csv. A command marked \u2020 reads the submitted manuscript, '
        u'supplementary or tables file, which is not part of the code deposit \u2014 that holds '
        u'the software, the data and the analyses. Point it at the folder holding those files '
        u'with the PPE_DOCS environment variable, or with its own --dir or --docx option, and '
        u'it runs; without them it says so and stops rather than reporting a failure.')

CONTENTS_ITEM = u'Table S13'
CONTENTS_TEXT = (u'Where every analysis reported in the Results lives in the deposit: the data '
                 u'file, the command and the figure or table')
