#!/usr/bin/env python3
"""
The rows of Supplementary Table S8 — the column key to data/benchmark_scored.csv.

Every meaning here was read out of the code that WRITES the column, not inferred from its
name: analysis/score_batch_v2.js for the 39 columns the scorer adds, analysis/merge_benchmark.py
for _source_pass and the three columns only the tomato pass carried, and the two scored CSVs for
the input columns. Every count was computed from the file itself and is re-computed by
analysis/check_supplementary_rest.py, which fails if the table and the file disagree in either
direction — a name here that the file does not have, or a column in the file this table is
silent on.

WHY THIS TABLE WAS REBUILT (27 September 2026). It described 19 of the file's 60 columns. That
is a milder form of the fault corrected in it two days earlier, when it named nine columns the
file does not contain: a reader meeting a key and finding it opens a third of the doors is in
much the same position as one finding it opens none. The columns it was silent on included
genomic_seq, published_spacer, edit_pos, nick_pos, raw_score, status, every individual score
term, and edit_from_top / edit_to_top — the pair whose loss, when analysis/merge_benchmark.py is
run without the scoring stage that follows it, stops analysis/case_studies.js dead.

ONE CLAIM IN THE OLD TABLE WAS WRONG, not merely absent. It said published_pbs_len and
published_rt_len "carry the lengths the original authors used, which are what the recovery
analysis compares against". Nothing in the deposit compares them with pbs_len_used or
rt_len_used. Their actual role is larger and is now stated: the scorer evaluates each row AT
those lengths, so every pbs_ and rt_ column describes the authors' own design rather than the
tool's preferred one. The recovery analysis, analysis/recovery_permutation.py, works on
published_rank and published_rank_percentile.

Each entry is (columns, meaning); a (group, None) entry is a bold section heading.
"""

GROUP = object()

ROWS = [
    (GROUP, u'Identity and provenance'),

    (u'id',
     u'row identifier, unique across both scoring passes — analysis/merge_benchmark.py refuses '
     u'to write the file if two rows share one, so this traces a pegRNA through every derived '
     u'file'),
    (u'study',
     u'the source table the row was parsed from: Lin2020_S1 (84 rows), Lin2021_S1 (50) and '
     u'Vu 2024 (7)'),
    (u'species',
     u'Oryza sativa (129), Triticum aestivum (5) and Solanum lycopersicum (7). Not decoration: '
     u'the scorer sets the primer-binding-site melting-temperature band from this column, so a '
     u'wheat row is scored against the wheat band'),
    (u'locus',
     u'the label the source study gives the target. Labels are not sites — two studies number '
     u'the same protospacer differently and one label can name two protospacers; Table S12 and '
     u'analysis/target_sites.json resolve this'),
    (u'_source_pass',
     u'which scoring pass the row came from, rice_wheat (134) or tomato (7). Provenance; no '
     u'analysis reads it'),
    (u'notes',
     u'how the row’s edit was established: published table (130), own edit description '
     u'confirmed against genome (7), genome-derived, PDF parse truncated (4)'),

    (GROUP, u'The target and the edit, as published'),

    (u'genomic_seq',
     u'the genomic window around the target, plus strand, 5′→3′, plain ACGT. '
     u'Every position column below is an index into this window'),
    (u'edit_pos',
     u'1-based position of the edited base within genomic_seq'),
    (u'edit_type',
     u'SNP, INS or DEL'),
    (u'edit_from, edit_to',
     u'the edit as the source paper quotes it — which for a minus-strand protospacer is quoted '
     u'on that strand, not on genomic_seq'),
    (u'edit_strand',
     u'which strand that quotation is on, derived by matching edit_from against the window on '
     u'either strand and anchored at either end of the edit \u2014 four combinations, not the '
     u'two originally tested \u2014 rather than assumed'),
    (u'edit_from_top, edit_to_top',
     u'the same edit in top-strand coordinates, which is the engine’s convention. These '
     u'are the columns a design is built from; scoring a minus-quoted row without them installs '
     u'the complement of the intended base'),
    (u'edit_strand_note',
     u'for the 45 rows not quoted on the plus strand from their first base, the conversion in '
     u'words \u2014 44 quoted on the minus strand and one quoted in gene orientation anchored '
     u'at its last base; empty on the rest'),
    (u'edit_offset_from_nick',
     u'the offset the source table prints (+1, +2, …), carried as published. The tool’s '
     u'own measurement is nick_edit_dist, and the two are kept apart deliberately'),
    (u'pam',
     u'the protospacer-adjacent motif at the published protospacer, as read from the window'),
    (u'spacer_len',
     u'protospacer length — 20 in every row of this file'),
    (u'published_spacer',
     u'the protospacer the authors used'),
    (u'published_pbs_len, published_rt_len',
     u'the primer-binding-site and reverse-transcriptase template lengths the authors used. The '
     u'scorer EVALUATES EACH ROW AT THESE LENGTHS, so every pbs_ and rt_ column below describes '
     u'the authors’ own design rather than the one the tool would have preferred'),
    (u'measured_efficiency',
     u'published editing efficiency, per cent, as the source paper reports it. No column derived '
     u'from the tool is computed with sight of it'),
    (u'n_edits, bases_validated, edit_text',
     u'three columns only the tomato pass carried, recording how many bases its edit spans and '
     u'how many were confirmed against the genome. Filled on those 7 rows and empty on the other '
     u'134, kept rather than dropped so nothing scored is silently discarded'),

    (GROUP, u'What the tool scored for the authors’ protospacer'),

    (u'composite_score',
     u'the tool’s score for the published protospacer, computed blind to '
     u'measured_efficiency'),
    (u'raw_score',
     u'the same score before the secondary-structure adjustment'),
    (u'dist_term, gc_term, seed_term, gstart_term, polyt_term',
     u'the individual contributions to the composite, recomputed from the same rules so each is '
     u'reportable on its own. gstart_term is 0 in every scored row: the 5′ G was withdrawn as a '
     u'scoring term because Ma et al. (2015) measured no efficiency difference, and the tool '
     u'prepends the promoter’s +1 base by construction'),
    (u'gstart_base_ok',
     u'1 where the protospacer begins with G, kept so the audit trail shows which rows would '
     u'have received that withdrawn bonus'),
    (u'nick_edit_dist, spacer_gc, seed_gc',
     u'the quantities those terms are computed from: nick-to-edit distance, whole-spacer GC and '
     u'seed-region GC'),
    (u'struct_penalty, struct_risk',
     u'the secondary-structure adjustment applied to the raw score, and the label it carries'),
    (u'ir_score',
     u'the spacer intrinsic specificity score (Table S4), under the column name it shipped with. '
     u'The paper renamed the quantity; renaming the column would break anything already reading '
     u'the file'),
    (u'spacer_strand, nick_pos',
     u'which strand the protospacer lies on, and where the pegRNA nick falls in genomic_seq'),
    (u'best_available_score, best_available_spacer',
     u'the tool’s own first choice at this target, for comparison with the published one'),

    (GROUP, u'The design, built at the published lengths'),

    (u'pbs_tm_band',
     u'the melting-temperature band the row was scored against, set from species: rice (124 '
     u'rows), triticeae_maize (5) or default (7)'),
    (u'pbs_seq, pbs_len_used',
     u'the primer-binding site the tool returns at the published length, and the length it '
     u'actually used — the two differ only on rows whose status says the nearest available '
     u'length was taken'),
    (u'pbs_score, pbs_tm, pbs_gc',
     u'its score, melting temperature on the nearest-neighbour scale, and GC content'),
    (u'pbs_dG_worst',
     u'the free energy of the worst of the competing hybridisation channels the tool scores'),
    (u'pbs_rt_dG, pbs_rt_run',
     u'free energy and longest complementary run between the primer-binding site and its own '
     u'reverse-transcriptase template — the channel the per-term analysis finds strongest '
     u'against measured efficiency'),
    (u'pbs_struct_risk',
     u'the structure-risk label for that primer-binding site'),
    (u'rt_seq, rt_len_used, rt_score',
     u'the reverse-transcriptase template at the published length, the length used, and its '
     u'score'),

    (GROUP, u'Where the published design ranked, and whether the row scored'),

    (u'n_candidates',
     u'how many usable protospacers the tool offered at this target'),
    (u'published_rank, published_rank_percentile',
     u'where the published protospacer sits among them, as a position and as a percentile. '
     u'136 of the 141 rows carry a percentile; the 5 that do not are the rows that did not '
     u'score. This pair is what the design-recovery analysis works on'),
    (u'status',
     u'OK (110 rows), OK with the nearest available primer-binding-site length used (26), or '
     u'the reason the row could not be scored (5, each an edit_from that the window does not '
     u'read at the stated position in any of the four ways an edit can be quoted). Rows that did '
     u'not score are kept and excluded by status rather than deleted, so every column the '
     u'scorer writes is empty on those 5 rows'),
]

CAPTION_INTRO = (
    u'The populated dataset is deposited with the source code. This table defines all 60 '
    u'columns of data/benchmark_scored.csv, in the file’s own column order; the filtering '
    u'cascade that produced the analysed set is given in the Methods of the main text. Some of '
    u'the columns are read by no analysis in the deposit — the individual score terms, the '
    u'alternatives the tool preferred and the three columns only the tomato pass carried — '
    u'and are kept as the audit trail behind the scored ones. '
    u'analysis/check_supplementary_rest.py fails if this table names a column the file does not '
    u'have, or is silent on one it does.')

# claims in the table above that are re-computed from the file by the checker
STATED_COUNTS = [
    (u'Lin2020_S1 (84 rows)', 'study', 'Lin2020_S1', 84),
    (u'Lin2021_S1 (50)', 'study', 'Lin2021_S1', 50),
    (u'Vu 2024 (7)', 'study', 'Vu 2024', 7),
    (u'Oryza sativa (129)', 'species', 'Oryza sativa', 129),
    (u'Triticum aestivum (5)', 'species', 'Triticum aestivum', 5),
    (u'Solanum lycopersicum (7)', 'species', 'Solanum lycopersicum', 7),
    (u'rice_wheat (134)', '_source_pass', 'rice_wheat', 134),
    (u'tomato (7)', '_source_pass', 'tomato', 7),
    (u'rice (124 rows)', 'pbs_tm_band', 'rice', 124),
    (u'triticeae_maize (5)', 'pbs_tm_band', 'triticeae_maize', 5),
]
