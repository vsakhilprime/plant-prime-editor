import json, textwrap
import os
_HERE=os.path.dirname(os.path.abspath(__file__))
# Read the deposited feature matrix, not a scratch file. This previously pointed at
# /tmp/table1.json and wrote outside the deposit, so it could not run for anyone else.
rows=json.load(open(os.path.join(_HERE,'..','data','feature_matrix.json'),encoding='utf8'))
hdr=rows[0]; body=rows[1:]
tools=hdr[1:]
W_LAB=430; COL=86; TOP=132; RH=25.5
W=W_LAB+COL*len(tools)+34; H=TOP+RH*len(body)+34
GREEN='#15803d'; GREY='#c9ced6'; INK='#1f2937'; MUTED='#6b7280'
def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Arial, Helvetica, sans-serif">']
o.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
o.append(f'<text x="16" y="30" font-size="17" font-weight="bold" fill="{INK}">D</text>')
o.append(f'<text x="36" y="30" font-size="14.5" font-weight="bold" fill="{INK}">Capability comparison across seven pegRNA design tools</text>')
# tool headers, rotated
for j,t in enumerate(tools):
    cx=W_LAB+COL*j+COL/2
    bold=' font-weight="bold"' if j==0 else ''
    o.append(f'<text transform="translate({cx},{TOP-12}) rotate(-40)" font-size="11.5"{bold} fill="{INK}">{esc(t)}</text>')
o.append(f'<line x1="16" y1="{TOP-4}" x2="{W-18}" y2="{TOP-4}" stroke="{INK}" stroke-width="1.1"/>')
for i,r in enumerate(body):
    y=TOP+RH*i; cy=y+RH/2
    if i%2==0: o.append(f'<rect x="16" y="{y}" width="{W-34}" height="{RH}" fill="#f6f7f9"/>')
    lab=r[0]
    if len(lab)>66: lab=lab[:64]+'…'
    o.append(f'<text x="22" y="{cy+4}" font-size="11.2" fill="{INK}">{esc(lab)}</text>')
    for j,v in enumerate(r[1:]):
        cx=W_LAB+COL*j+COL/2; v=v.strip()
        if v=='Yes':
            o.append(f'<circle cx="{cx}" cy="{cy}" r="6.2" fill="{GREEN}"/>')
        elif v=='No':
            o.append(f'<circle cx="{cx}" cy="{cy}" r="6.2" fill="none" stroke="{GREY}" stroke-width="1.5"/>')
        elif v.startswith('Yes'):
            extra=v[v.find('(')+1:v.find(')')] if '(' in v else ''
            o.append(f'<circle cx="{cx}" cy="{cy}" r="6.2" fill="{GREEN}"/>')
            o.append(f'<text x="{cx+10}" y="{cy+3.6}" font-size="9.4" fill="{MUTED}">{esc(extra)}</text>')
        elif v.startswith('No ('):
            o.append(f'<circle cx="{cx}" cy="{cy}" r="6.2" fill="none" stroke="{GREEN}" stroke-width="1.6" stroke-dasharray="2.6 2"/>')
        elif v in ('—',''):
            o.append(f'<text x="{cx}" y="{cy+4}" font-size="11" fill="{MUTED}" text-anchor="middle">—</text>')
        else:
            o.append(f'<text x="{cx}" y="{cy+4}" font-size="10.4" fill="{INK}" text-anchor="middle">{esc(v)}</text>')
o.append(f'<line x1="16" y1="{TOP+RH*len(body)}" x2="{W-18}" y2="{TOP+RH*len(body)}" stroke="{INK}" stroke-width="1.1"/>')
ly=TOP+RH*len(body)+22
o.append(f'<circle cx="26" cy="{ly-4}" r="6.2" fill="{GREEN}"/><text x="38" y="{ly}" font-size="11" fill="{INK}">present</text>')
o.append(f'<circle cx="112" cy="{ly-4}" r="6.2" fill="none" stroke="{GREY}" stroke-width="1.5"/><text x="124" y="{ly}" font-size="11" fill="{INK}">absent</text>')
o.append(f'<circle cx="196" cy="{ly-4}" r="6.2" fill="none" stroke="{GREEN}" stroke-width="1.6" stroke-dasharray="2.6 2"/><text x="208" y="{ly}" font-size="11" fill="{INK}">delegated to an external tool</text>')
o.append('</svg>')
# beside the data, not at the repository root: the canonical copy lives in data/
open(os.path.join(_HERE,'..','data','Figure5D_FeatureMatrix.svg'),'w',encoding='utf8').write('\n'.join(o))
print('  wrote data/Figure5D_FeatureMatrix.svg  (%dx%d, %d features x %d tools)'%(W,H,len(body),len(tools)))
