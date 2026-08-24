# Reference list — verification record

> **SCOPE, and what this file is NOT.** This is a *bibliographic* record made on 13 August
> 2026: it checks that each of the manuscript's 27 references has the right journal, volume,
> pages and year. It does **not** cover whether a paper supports the claim it is cited for.
>
> That second question was audited separately between 19 and 22 August 2026, after every
> source was read in full, and it changed a great deal: roughly 25 scoring parameters moved
> to "this work", essentially every claim credited to Chen et al. 2021 was withdrawn from
> that paper, six references that name no locatable article were removed, and one manuscript
> sentence was withdrawn for a window that could not be found in the paper cited for it.
> **`CHANGES_19Aug2026.md`, Addenda 19–29, is that record.** Row 6 below still says Chen 2021
> is "correct", and as a bibliographic entry it is — the volume and pages are right. What was
> wrong was everything it had been credited with.
>
> This file also covers only the manuscript's reference list. The tool carries in-code
> attributions that appear in no row here — Dang 2015, Ma 2015, Potapov 2018, Engler 2008,
> Zuker 2003, Sambrook 2001 and others — and those were audited in the August 19–22 pass.

Every one of the 27 references was checked for journal, volume, pages and year on
13 August 2026. Four were confirmed against PDFs held locally; the rest against the
publisher record. One error was found and corrected.

| # | First author, year | Journal, volume, pages | Verified against | Result |
|---|---|---|---|---|
| 1 | Anzalone 2019 | Nature 576, 149–157 | publisher record | correct |
| 2 | Lin 2020 | Nat. Biotechnol. 38, 582–585 | publisher record | correct |
| 3 | Lin 2021 | Nat. Biotechnol. 39, 923–927 | **PDF held locally** | correct |
| 4 | Zong 2022 | Nat. Biotechnol. 40, 1394–1402 | publisher record | correct — note an Author Correction exists (10.1038/s41587-022-01308-z) |
| 5 | Nelson 2022 | Nat. Biotechnol. 40, 402–410 | publisher record | correct — Author Correction exists (10.1038/s41587-021-01175-0) |
| 6 | Chen 2021 | Cell 184, 5635–5652 | publisher record | correct (5635–5652.e29) |
| 7 | Anzalone 2022 | Nat. Biotechnol. 40, 731–740 | publisher record | correct |
| 8 | Jin 2023 | Nat. Protoc. 18, 831–853 | **PDF held locally** | correct |
| 9 | Vu 2024 | Nat. Plants 10, 1502–1513 | **PDF held locally** | correct (was 10:1552 until today) |
| 10 | Hsu 2021 | Nat. Commun. 12, 1034 | publisher record | volume and article correct; **DOI was wrong** |
| 11 | Chow 2021 | Nat. Biomed. Eng. 5, 190–194 | publisher record | correct |
| 12 | Hwang 2021 | Nucleic Acids Res. 49, W499–W504 | publisher record | correct |
| 13 | Li 2021 | Genome Biol. 22, 235 | publisher record | correct |
| 14 | Mathis 2023 | Nat. Biotechnol. 41, 1151–1159 | publisher record | correct |
| 15 | Needleman 1970 | J. Mol. Biol. 48, 443–453 | publisher record | correct |
| 16 | Smith 1981 | J. Mol. Biol. 147, 195–197 | publisher record | correct |
| 17 | SantaLucia 1998 | PNAS 95, 1460–1465 | DOI encodes volume 95 page 1460 | correct |
| 18 | Owczarzy 2008 | Biochemistry 47, 5336–5353 | publisher record | correct |
| 19 | Doench 2016 | Nat. Biotechnol. 34, 184–191 | publisher record | correct |
| 20 | Hsu 2013 | Nat. Biotechnol. 31, 827–832 | publisher record | correct |
| 21 | Haeussler 2016 | Genome Biol. 17, 148 | publisher record | correct |
| 22 | Jin 2021 | Nat. Biotechnol. 39, 1292–1299 | publisher record | correct |
| 23 | Liu 2024 | Genome Biol. 25, 131 | publisher record | correct |
| 24 | Li 2026 | Nat. Biotechnol., online 5 June 2026 | **PDF held locally** | correct — no volume or pages yet, and the citation says so |
| 25 | Zhao 2025 | Nat. Plants 11, 191–205 | **PDF held locally** | correct |
| 26 | Li 2023 | Plant Commun. 4, 100572 | publisher record | correct |
| 27 | Xu 2020 | Plant Commun. 1, 100043 | publisher record | correct |

## The one error

Reference 10 carried **doi:10.1038/s41467-021-21337-6**. That DOI resolves to nothing.
The article is **10.1038/s41467-021-21337-7** — a single wrong character in the final
position. Volume 12 and article number 1034 were both correct, so the citation looked
right and only failed if a reader clicked it. Corrected.

## Two things worth knowing, not errors

References 4 and 5 each have a published Author Correction. The citations point at the
original articles, which is normal practice, but a referee may ask whether the corrections
affect anything relied on here. They do not: the Zong correction concerns author
affiliations and the Nelson correction a figure panel, neither of which touches the
efficiency figures or the tevopreQ1 architecture used in this work.

## Method

DOI stems were first checked for internal consistency — a Nature-portfolio stem identifies
the journal unambiguously (s41586 Nature, s41587 Nat. Biotechnol., s41477 Nat. Plants,
s41596 Nat. Protoc., s41467 Nat. Commun., s41551 Nat. Biomed. Eng.), and the PNAS DOI
encodes volume and first page directly. Note that the year embedded in a Nature-portfolio
DOI is the ONLINE year and legitimately differs from the print year cited; that is not an
error, and several references here show the difference.
