# Running Plant Prime Editor without a network

The tool is a single HTML file and every design calculation runs locally. Four things
reach the network, none of which is required for a design to be produced:

| Resource | Purpose | Behaviour when unavailable |
|---|---|---|
| Google Fonts (`fonts.googleapis.com` for the stylesheet, `fonts.gstatic.com` for the font files) | Typography | Falls back to the system font stack. Layout and metrics are preserved; only the typeface changes. |
| Pyodide (jsDelivr CDN) | Optional Python/Biopython engine for sequence handling | Falls back automatically to the built-in JavaScript engine, with a notice in the interface. Design output is unchanged. |
| NCBI E-utilities, Ensembl REST (`rest.ensembl.org` and `rest.ensemblgenomes.org`) | Fetching a locus by accession, only when the user asks for it | The fetch fails with a message. Pasting a sequence works normally. Phytozome is **not** in this list: the tool builds a portal URL for the user to open, and makes no request itself. |
| ICAR and IARI logos, author photograph (`multieditptgd.daasbioinfromaticsteam.in`) | Interface imagery, fetched at page load | The images do not render. Nothing else changes. Seven references in the HTML; self-host them for an air-gapped or archival copy, as `THIRD_PARTY_NOTICES.md` explains. |

**No design parameter, scoring rule, vector record or primer calculation depends on a
network call.** Every fetch in the file sits inside accession retrieval; the scaffold, the
melting-temperature tables, the vector records and every primer calculation are inline
literals. **One caveat, stated because it is an assumption rather than a proof:** the
optional Python engine and the built-in JavaScript engine implement the same banded
Needleman–Wunsch with the same parameters (match +2, mismatch −1, gap-open −2, gap-extend
−0.5), and the source comments record a comparison at four loci. Nothing in `tests/`
compares the two engines, because Pyodide does not load headlessly. Treat "identical
output" as a four-locus spot check.

The verification suite in `tests/` runs entirely offline and covers the
design engine, the vector records, the restriction screen, the primer round trip, the
homology arms and the colony anchors.

## Self-hosting the CDN resources and the institutional images

If you need a fully self-contained deployment — an air-gapped machine, an institutional
server with no outbound access, or a long-term archival copy — vendor the two CDN
resources, and the institutional images alongside them:

```bash
# 1. Fonts: download the five families and replace all THREE font tags with a local
#    stylesheet — the two <link rel=stylesheet> and the <preconnect>, which otherwise
#    still attempts an outbound connection on an air-gapped machine. Use a local
#    stylesheet. google-webfonts-helper produces the files and the CSS.
#      https://gwfh.mranftl.com/fonts
#    Families used: DM Sans, DM Mono, JetBrains Mono, Cormorant Garamond, Fraunces

# 2. Pyodide 0.25.1 (about 10 MB unpacked)
curl -L -O https://github.com/pyodide/pyodide/releases/download/0.25.1/pyodide-0.25.1.tar.bz2
tar xf pyodide-0.25.1.tar.bz2          # gives pyodide/
# then point BOTH references at it — there are two, and changing only the
# indexURL still pulls pyodide.js off the CDN:
#   script.src = './pyodide/pyodide.js'          (the loader tag)
#   loadPyodide({ indexURL: './pyodide/' })      (the runtime option)
#   grep -n 'cdn.jsdelivr.net/pyodide' plant_prime_editor_v1.0.html
```

```bash
# 3. Institutional images: save the ICAR and IARI logos and the author photograph, then
#    repoint the seven references at local copies.
#      grep -n 'multieditptgd.daasbioinfromaticsteam.in' plant_prime_editor_v1.0.html
```

Pyodide is deliberately **not** bundled into the HTML. The file is ~2 MB; embedding a
10 MB WebAssembly runtime to gain an optional convenience engine, when the JavaScript
fallback produces identical design output, would be a poor trade.

## Reproducibility

Every export carries a build stamp:

```
Plant Prime Editor v1.0 (build 2026-08-19, live since 2026-03-26, parameters 98b8c5c6)
```

The last field is a fingerprint over the parameters that actually determine a design. It
covers more than this file used to say, and the difference matters, so here is the whole
list: the scaffold, the tevopreQ1 motif, the poly-T terminator, the primer-binding-site
melting-temperature bands, the exclude-first-C rule, every vector's enzyme, overhangs,
homology arms and colony anchors — **and the source text of every function that scores or
builds a design**: `findSpacers`, `genPBS`, `genRT`, `genNickSgRNA`,
`computeSpacerSpecificity`, `smartRecommend`, `runPrimerDesign`, `_ppePrefix2`, the
structure engine (`m2_structRisk` and the free-energy functions it calls) and the
nearest-neighbour parameter tables.

Until 23 August 2026 this paragraph listed only the first group, and the hash itself did
not cover the structure engine. A reader would reasonably have concluded that changing a
scoring weight leaves the fingerprint intact. It does not, and it must not: that is the
one thing the hash exists to detect. Two designs carrying the same fingerprint were produced
under identical rules. A version number cannot tell you that; this can. Quote it when
reporting a design.
