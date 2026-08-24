# Third-party notices

Plant Prime Editor is distributed as a single HTML file under the terms in `LICENSE`.
That licence covers the Plant Prime Editor source and data only. The components listed below
are the property of their respective owners and remain governed by their own licences.

## Loaded at runtime

| Component | Source | Licence | Used for |
|---|---|---|---|
| Pyodide 0.25.1 | `cdn.jsdelivr.net/pyodide/v0.25.1/full/` | Mozilla Public License 2.0 | Optional in-browser Python for the analysis panel |
| Google Fonts (DM Sans, DM Mono, JetBrains Mono, Cormorant Garamond, Fraunces) | `fonts.googleapis.com` | SIL Open Font License 1.1 | Interface typography |

**What this means for you.** Both are fetched from third-party domains at page load, as are
the ICAR and IARI logos and the author photograph, which come from
`multieditptgd.daasbioinfromaticsteam.in`. A request to an outside domain at page load is a
record that someone visited — it carries no sequence and no design, but it is a record. If
that matters to you, or if you need a copy that will still work when a CDN does not,
`docs/OFFLINE.md` gives the commands to vendor all three locally. Nothing about a design
changes either way: no design parameter, scoring rule, vector record or primer calculation
depends on a network call.

## Contacted only on explicit user action

| Service | Endpoint | Notes |
|---|---|---|
| NCBI E-utilities | `eutils.ncbi.nlm.nih.gov` | Sequence retrieval by accession. Only the accession is transmitted, and only when the user requests a fetch. No user sequence is ever sent |
| CRISPOR | `crispor.tefor.net` | Outbound hyperlink only for genome-wide off-target analysis. No automatic transfer |
| Ensembl REST | `rest.ensembl.org` | Sequence retrieval by identifier, only when the user requests a fetch. No user sequence is ever sent |
| Phytozome | `phytozome-next.jgi.doe.gov` | Sequence retrieval by identifier, only when the user requests a fetch. No user sequence is ever sent |

## Institutional marks

The ICAR and ICAR-IARI names, emblems and logos are the property of the Indian Council of
Agricultural Research. Their appearance in the interface reflects the institutional origin of
the work and conveys no licence to use those marks.

## Published data reused

Benchmark and calibration data in `data/` are derived from the publications cited in the
manuscript and in `data/targets_verified.csv`. Sequence coordinates were re-derived from
public reference genomes. Each record carries its source citation; reuse should credit the
original study in addition to this software.
