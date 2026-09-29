"""
One target site, however many studies numbered it — the Python side of
analysis/lib/target_site.js. Both read the same generated registry,
analysis/target_sites.json, so the two languages cannot drift apart.

A target SITE is a protospacer in a genomic window. A LABEL is a name a study gave it.
In this deposit they are not one-to-one in either direction:

  * four pairs of labels denote ONE protospacer, because two studies assayed the same site
    and numbered it differently:
        OsALS-T1 (Lin 2020) = OsALS-T2 (Lin 2021)
        OsEPSPS-T1          = OsEPSPS-T2
        OsAAT               = OsAAT-T1
        OsGAPDH             = OsGAPDH-T1
  * five single labels denote TWO different protospacers:
        OsCDC48-T3, OsEPSPS-T1, SlOr, SlCAB13, SlWH9

The earlier analysis/als_sites.json registered the first pair and nothing else, so counting
distinct labels counted one site twice and two sites once. The errors cancelled for the
135-row ranked cohort — 25 either way — and did not cancel upstream: the 162-passing stage
was reported as 33 sites against a true 35, and the 141-scored stage as 26 against 27.

site_of_label raises on the five ambiguous labels rather than guessing. Anything iterating
over rows should call site_of_row.
"""
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_REG_PATH = os.path.join(_HERE, '..', 'target_sites.json')
_REG = None


class AmbiguousLabel(KeyError):
    """A label that names more than one protospacer, so it cannot identify a site."""


def registry():
    """The generated site registry, loaded once."""
    global _REG
    if _REG is None:
        try:
            raw = json.load(open(_REG_PATH))
        except Exception as e:
            raise SystemExit(
                'analysis/target_sites.json is missing or unreadable (%s). '
                'Regenerate it with: python3 analysis/build_target_sites.py' % e)
        raw['_by_spacer'] = {s['spacer']: s['id'] for s in raw['sites']}
        _REG = raw
    return _REG


def site_of_spacer(spacer):
    """The site a PROTOSPACER denotes. This is the safe key."""
    return registry()['_by_spacer'].get((spacer or '').strip().upper(), (spacer or '').strip())


def site_of_label(label):
    """The site a LABEL denotes. Raises AmbiguousLabel for a label naming two protospacers."""
    reg = registry()
    k = (label or '').strip()
    if k in reg['ambiguous_labels']:
        raise AmbiguousLabel(
            '%r names %d different protospacers (%s), so a label alone cannot identify the '
            'site. Use site_of_row or site_of_spacer.'
            % (k, len(reg['ambiguous_labels'][k]), ', '.join(reg['ambiguous_labels'][k])))
    return reg['label_to_site'].get(k, k)


def site_of_row(row, spacer_keys=('published_spacer', 'spacer'),
                label_keys=('locus', 'target_id', 'target')):
    """The site a CSV row denotes, keyed on its protospacer where it carries one."""
    for k in spacer_keys:
        if row.get(k):
            return site_of_spacer(row[k])
    for k in label_keys:
        if row.get(k):
            return site_of_label(row[k])
    raise KeyError('row carries neither a protospacer nor a label: %r' % sorted(row)[:8])


def count_sites(rows, **kw):
    """How many distinct SITES a list of rows covers."""
    return len({site_of_row(r, **kw) for r in rows})


def labels_of_site(site_id):
    """Every label that denotes this site, including its representative."""
    for s in registry()['sites']:
        if s['id'] == site_id:
            return list(s['labels'])
    return [site_id]
