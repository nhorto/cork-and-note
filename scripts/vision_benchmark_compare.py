#!/usr/bin/env python3
"""Combine offline vision benchmark reports, preserving experiment/source boundaries."""
import argparse
from collections import defaultdict
import json
import os
from pathlib import Path
import statistics


def compare(run_paths, destination):
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    groups, records, provenance = defaultdict(list), [], []
    for run in sorted({Path(p).resolve() for p in run_paths}):
        report = json.loads((run / 'scores.json').read_text())
        manifest = json.loads((run / 'manifest.json').read_text())
        cases = {c['id']: c for c in manifest['dataset']['cases']}
        experiment = run.name.split('-', 1)[0]
        provenance.append({'run': run.name, 'signature': manifest['signature'],
                           **{k: report[k] for k in ('scorer_sha256', 'scoring_dataset_sha256', 'gold_revision')}})
        for r in report['records']:
            case = cases[r['case_id']]
            record = dict(r, experiment=experiment, run=run.name,
                          source_type=case.get('source_type'), split=case.get('split'))
            record['review_path'] = os.path.relpath(run / 'review.html', destination)
            image = run / 'images' / f"{r['case_id']}-{r['edge']}.jpg"
            if image.exists():
                record['image_path'] = os.path.relpath(image, destination)
            records.append(record)
            groups[(experiment, record['source_type'], record['split'], r['edge'], r['model'])].append(record)
    summaries = []
    for (experiment, source, split, edge, model), rows in sorted(groups.items()):
        attempted = [r for r in rows if r.get('attempted')]
        scored = [r for r in attempted if 'score' in r]
        def total(key):
            return sum(r['score'][key] for r in scored)
        known = [r['estimated_usd'] for r in attempted if r.get('estimated_usd') is not None]
        uncached = [r['uncached_usd'] for r in attempted if r.get('uncached_usd') is not None]
        summaries.append(dict(experiment=experiment, source_type=source, split=split, edge=edge, model=model,
            attempts=len(attempted), images=len({r['case_id'] for r in attempted}), scored=len(scored),
            successful=sum(r['status'] == 'ok' for r in attempted),
            field_recall=total('correct_fields') / total('present_fields') if total('present_fields') else None,
            exact_cards=total('whole_card_exact'), missing=sum(len(r['score']['missing_rows']) for r in scored),
            extra=sum(len(r['score']['extra_rows']) for r in scored), invented=total('invented_absent_fields'),
            usd=sum(known), unknown_costs=len(attempted) - len(known),
            usd_per_1000=statistics.mean(known) * 1000 if known else None,
            uncached_per_1000=statistics.mean(uncached) * 1000 if uncached else None,
            median_s=statistics.median(r['latency_s'] for r in attempted) if attempted else None))
    result = {'provenance': provenance, 'summaries': summaries, 'records': records}
    (destination / 'comparison.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    lines = ['# Wine vision comparison', '',
        'Experiments and source types stay separate. Field recall measures correct labeled visible fields; '
        'it is not the percentage of correct scans. Exact cards also reject extra rows and invented absent fields.', '']
    table_groups = defaultdict(list)
    for s in summaries:
        table_groups[(s['experiment'], s['source_type'], s['split'], s['edge'])].append(s)
    for group, rows in table_groups.items():
        lines += ['## ' + ' / '.join(map(str, group)), '',
            '| Model | Field recall | Exact cards | Missing / extra | Invented absent | $ / 1,000 | Uncached $ / 1,000 | Median s |',
            '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
        for s in sorted(rows, key=lambda s: -(s['field_recall'] or 0)):
            pct = f"{s['field_recall']:.1%}" if s['field_recall'] is not None else '—'
            cost = f"{s['usd_per_1000']:.2f}" if s['usd_per_1000'] is not None else '—'
            uncached = f"{s['uncached_per_1000']:.2f}" if s['uncached_per_1000'] is not None else '—'
            latency = f"{s['median_s']:.1f}" if s['median_s'] is not None else '—'
            lines.append(f"| {s['model']} | {pct} | {s['exact_cards']}/{s['scored']} | {s['missing']}/{s['extra']} | "
                         f"{s['invented']} | {cost} | {uncached} | {latency} |")
        lines.append('')
    (destination / 'comparison.md').write_text('\n'.join(lines))
    # Inline data safely; no external scripts, API calls, or image uploads in this dashboard.
    payload = json.dumps(result, ensure_ascii=False).replace('<', '\\u003c')
    page = '''<!doctype html><meta charset="utf-8"><title>Wine vision benchmark</title>
<style>body{font:15px system-ui;margin:32px auto;max-width:1250px;padding:0 20px;color:#17251d}
select{padding:8px;margin:6px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
td,th{text-align:left;padding:9px;border-bottom:1px solid #ddd}th{background:#edf3ee}
details{border:1px solid #ddd;margin:8px 0;padding:12px}summary{cursor:pointer}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:16px}
img{max-width:100%;max-height:650px}small{color:#526358}</style>
<h1>Wine vision benchmark</h1><p>Filter measured results, then inspect individual predictions and scoring differences.</p>
<p>Field recall is the percentage of labeled visible fields extracted correctly. Exact cards also require no missing or extra wines
and no invented values in fields labeled absent. Eight phone photos are a pilot; resized/repeated scans are not independent samples.
Public controls are two clean pages from one winery. Labels were transcribed by the assistant and await user review.</p>
<label>Experiment <select id="experiment"></select></label><label>Model <select id="model"></select></label>
<label>Image edge <select id="edge"></select></label><p id="count"></p><div id="table"></div><h2>Individual scans</h2><div id="scans"></div>
<script>const data=PAYLOAD;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const key of ['experiment','model','edge']){const el=document.getElementById(key);el.innerHTML='<option value="">All</option>'+[...new Set(data.summaries.map(s=>s[key]))].sort().map(v=>`<option>${esc(v)}</option>`).join('');el.onchange=render;}
function render(){const match=r=>['experiment','model','edge'].every(k=>!document.getElementById(k).value||String(r[k])===document.getElementById(k).value);
const rows=data.summaries.filter(match),records=data.records.filter(match);
document.getElementById('count').textContent=`${records.filter(r=>r.attempted).length} attempts · $${rows.reduce((a,s)=>a+s.usd,0).toFixed(4)} estimated from token usage · ${rows.reduce((a,s)=>a+s.unknown_costs,0)} unknown costs`;
const heads=['Experiment / source','Model','Pixels','Field recall','Exact cards','Missing / extra','Invented absent','$ / 1,000','Uncached $ / 1,000','Median seconds'];
document.getElementById('table').innerHTML='<table><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr>'+rows.map(s=>'<tr>'+[s.experiment+' / '+s.source_type,s.model,s.edge,s.field_recall==null?'—':(s.field_recall*100).toFixed(1)+'%',s.exact_cards+'/'+s.scored,s.missing+' / '+s.extra,s.invented,s.usd_per_1000?.toFixed(2)??'—',s.uncached_per_1000?.toFixed(2)??'—',s.median_s?.toFixed(1)??'—'].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</table>';
document.getElementById('scans').innerHTML=records.map(r=>`<details><summary>${esc(r.experiment)} · ${esc(r.case_id)} · ${esc(r.model)} · ${r.edge}px · ${esc(r.status)} · ${r.score?.whole_card_exact?'exact':'review'}</summary>${r.image_path?`<img loading="lazy" src="${esc(r.image_path)}" alt="Image sent to model">`:''}<p><a href="${esc(r.review_path)}">Run audit</a></p><pre>${esc(JSON.stringify({prediction:r.prediction,score:r.score,usage:r.usage,estimated_usd:r.estimated_usd},null,2))}</pre></details>`).join('');}render();</script>'''
    (destination / 'index.html').write_text(page.replace('PAYLOAD', payload))
    print(f"Comparison: {destination / 'index.html'} ({len(records)} records)")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('runs', nargs='+', help='Run folders containing scores.json and manifest.json.')
    parser.add_argument('--output', default='.vision-bench/comparison')
    args = parser.parse_args()
    compare(args.runs, args.output)
