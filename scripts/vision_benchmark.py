#!/usr/bin/env python3
"""Local wine-card vision benchmark. No app traffic, database writes, or key logging."""
from __future__ import annotations

import argparse
import base64
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
import hashlib
import html
import io
import json
import math
import os
from pathlib import Path
import random
import re
import shutil
import statistics
import subprocess
import sys
import time
import unicodedata

from PIL import Image, ImageOps
import jsonschema
import requests
from scipy.optimize import linear_sum_assignment

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ('wine_name', 'producer', 'vintage', 'varietal', 'region', 'price_glass', 'price_bottle')
SCHEMA = {'type': 'object', 'properties': {'wines': {'type': 'array', 'items': {
    'type': 'object', 'properties': {f: {'type': ['string', 'null']} for f in FIELDS},
    'required': list(FIELDS), 'additionalProperties': False}}},
    'required': ['wines'], 'additionalProperties': False}
KEY_NAMES = {'openai': ('OPENAI_API_KEY',), 'google': ('GEMINI_API_KEY', 'GOOGLE_API_KEY'),
             'anthropic': ('ANTHROPIC_API_KEY',)}


def read_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(path)


def digest(value):
    data = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
    return hashlib.sha256(data).hexdigest()


def load_keys(paths):
    """Read only recognized assignments, without executing shell files or persisting secrets."""
    allowed = {n for names in KEY_NAMES.values() for n in names}
    env = {}
    for path in paths:
        for line in Path(path).expanduser().read_text().splitlines():
            match = re.match(r'^\s*(?:export\s+)?(\w+)\s*=\s*(.*?)\s*$', line)
            if not match or match[1] not in allowed:
                continue
            raw = match[2]
            if raw.startswith(('"', "'")):
                quote = raw[0]
                value = raw[1:raw.find(quote, 1)] if quote in raw[1:] else ''
            else:
                value = raw.split(' #', 1)[0].strip()
            if value and not value.startswith('${'):
                env[match[1]] = value
    env.update({k: os.environ[k] for k in allowed if os.environ.get(k)})
    return {p: next((env[n] for n in names if env.get(n)), None) for p, names in KEY_NAMES.items()}


def normalize(value, field='wine_name'):
    if value is None:
        return None
    value = unicodedata.normalize('NFKC', str(value)).casefold().strip()
    if field.startswith('price_'):
        cleaned = re.sub(r'[$€£\s]', '', value).replace(',', '')
        try:
            return str(Decimal(cleaned).normalize())
        except InvalidOperation:
            return value
    # Preserve accents and identity digits; tolerate punctuation/typographic differences.
    value = value.translate(str.maketrans({'’': "'", '‘': "'", '–': '-', '—': '-'}))
    if field == 'varietal':
        # Percentages are outside this grape-name schema; do not penalize their inclusion.
        value = re.sub(r'\d+(?:\.\d+)?\s*%', '', value)
        value = re.sub(r'\band\b', ' ', value)
    value = value.replace('.', '')  # DOC/D.O.C., NV/N.V.
    value = re.sub(r'[^\w\s]', ' ', value)
    return ' '.join(value.split())


def alternatives(expected):
    return expected if isinstance(expected, list) else [expected]


def correct(actual, expected, field):
    return any(normalize(actual, field) == normalize(v, field) for v in alternatives(expected))


def name_similarity(actual, expected):
    a = normalize(actual) or ''
    if not a:
        return 0.0
    return max((SequenceMatcher(None, a, normalize(v) or '').ratio()
                for v in alternatives(expected)), default=0.0)


def score_rows(gold, predicted):
    """One-to-one name alignment, followed by exact field scoring (never fuzzy credit)."""
    n, m = len(gold), len(predicted)
    weights = [[0.0] * (m + n) for _ in range(n + m)]
    for i, expected in enumerate(gold):
        for j, actual in enumerate(predicted):
            similarity = name_similarity(actual.get('wine_name'), expected['wine_name'])
            if similarity >= 0.55:
                # Equal names in distinct vintages/producers/grapes: small tie breakers only.
                tie = sum(0.001 for f in ('producer', 'vintage', 'varietal') if expected.get(f) is not None
                          and correct(actual.get(f), expected[f], f))
                weights[i][j] = 1 + similarity + tie
    pairs = []
    if n + m:
        rows, cols = linear_sum_assignment(weights, maximize=True)
        pairs = [(int(i), int(j)) for i, j in zip(rows, cols)
                 if i < n and j < m and weights[i][j] > 0]
    matches = dict(pairs)
    extra = [j for j in range(m) if j not in matches.values()]
    missing = [i for i in range(n) if i not in matches]
    counts = {f: {'present': 0, 'correct': 0, 'absent': 0, 'invented': 0} for f in FIELDS}
    errors = []
    exact_rows = 0
    for i, expected in enumerate(gold):
        actual = predicted[matches[i]] if i in matches else None
        row_ok = actual is not None
        for f in FIELDS:
            if f not in expected:  # Explicitly unscored / ambiguous label.
                continue
            is_absent = all(v is None for v in alternatives(expected[f]))
            counts[f]['absent' if is_absent else 'present'] += 1
            ok = actual is not None and correct(actual.get(f), expected[f], f)
            if not is_absent and ok:
                counts[f]['correct'] += 1
            if is_absent and actual is not None and actual.get(f) is not None:
                counts[f]['invented'] += 1
            if not ok:
                row_ok = False
                errors.append({'gold_row': i, 'prediction_row': matches.get(i), 'field': f,
                               'expected': expected[f], 'actual': actual.get(f) if actual else None})
        exact_rows += int(row_ok)
    present = sum(c['present'] for c in counts.values())
    hits = sum(c['correct'] for c in counts.values())
    # Extra rows contribute false positive fields; all-null outputs cannot score well.
    extra_fields = sum(v is not None for j in extra for f, v in predicted[j].items() if f in FIELDS)
    wrong_values = sum(e['actual'] is not None for e in errors) + extra_fields
    return {'gold_rows': n, 'predicted_rows': m, 'matched_rows': len(pairs),
            'missing_rows': missing, 'extra_rows': extra, 'alignment': pairs,
            'exact_rows': exact_rows, 'whole_card_exact': exact_rows == n and not extra,
            'present_fields': present, 'correct_fields': hits, 'wrong_values': wrong_values,
            'invented_absent_fields': sum(c['invented'] for c in counts.values()),
            'row_precision': len(pairs) / m if m else float(n == 0),
            'row_recall': len(pairs) / n if n else 1.0,
            'field_recall': hits / present if present else None,
            'field_precision': hits / (hits + wrong_values) if hits + wrong_values else None,
            'fields': counts, 'errors': errors}


def prepare_image(path, edge):
    if path.suffix.lower() in ('.heic', '.heif'):
        from pillow_heif import register_heif_opener
        register_heif_opener()
    with Image.open(path) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        original_size = im.size
        im.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        stream = io.BytesIO()
        im.save(stream, format='JPEG', quality=80, optimize=True)
        data = stream.getvalue()  # Re-encoding drops GPS/EXIF.
        return data, {'original_size': original_size, 'sent_size': im.size,
                      'jpeg_quality': 80, 'bytes': len(data), 'sha256': digest(data)}


def build_request(model, prompt, b64, output_limit):
    provider = model['provider']
    if provider == 'openai':
        return 'https://api.openai.com/v1/responses', {
            'model': model['id'], 'store': False, 'max_output_tokens': output_limit,
            'reasoning': {'effort': model['thinking']},
            'input': [{'role': 'user', 'content': [
                {'type': 'input_text', 'text': prompt},
                {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,' + b64,
                 'detail': model.get('detail', 'high')}]}],
            'text': {'format': {'type': 'json_schema', 'name': 'wine_scan',
                                'strict': True, 'schema': SCHEMA}}}
    if provider == 'google':
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model['id']}:generateContent", {
            'contents': [{'role': 'user', 'parts': [{'text': prompt},
                {'inlineData': {'mimeType': 'image/jpeg', 'data': b64}}]}],
            'generationConfig': {'maxOutputTokens': output_limit,
                'thinkingConfig': {'thinkingLevel': model['thinking']},
                'mediaResolution': model.get('media_resolution', 'MEDIA_RESOLUTION_HIGH'),
                'responseMimeType': 'application/json', 'responseJsonSchema': SCHEMA}}
    if provider == 'anthropic':
        return 'https://api.anthropic.com/v1/messages', {
            'model': model['id'], 'max_tokens': output_limit,
            'thinking': {'type': model['thinking']},
            'messages': [{'role': 'user', 'content': [
                {'type': 'text', 'text': prompt},
                {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b64}}]}],
            'output_config': {'format': {'type': 'json_schema', 'schema': SCHEMA}}}
    raise ValueError('Unknown provider')


def unpack_response(provider, raw):
    if provider == 'openai':
        text = ''.join(c.get('text', '') for o in raw.get('output', [])
                       for c in o.get('content', []) if c.get('type') == 'output_text')
        u = raw.get('usage') or {}
        usage = {'input': u.get('input_tokens'), 'output': u.get('output_tokens'),
                 'cached_input': (u.get('input_tokens_details') or {}).get('cached_tokens', 0),
                 'reasoning': (u.get('output_tokens_details') or {}).get('reasoning_tokens', 0)}
        completed = raw.get('status') == 'completed'
        stop = raw.get('incomplete_details') or raw.get('status')
    elif provider == 'google':
        candidate = (raw.get('candidates') or [{}])[0]
        text = ''.join(p.get('text', '') for p in candidate.get('content', {}).get('parts', [])
                       if not p.get('thought'))
        u = raw.get('usageMetadata') or {}
        thoughts = u.get('thoughtsTokenCount', 0)
        output = u.get('candidatesTokenCount')
        usage = {'input': u.get('promptTokenCount'),
                 'output': output + thoughts if output is not None else None,
                 'cached_input': u.get('cachedContentTokenCount', 0), 'reasoning': thoughts}
        stop = candidate.get('finishReason')
        completed = stop == 'STOP'
    else:
        text = ''.join(c.get('text', '') for c in raw.get('content', []) if c.get('type') == 'text')
        u = raw.get('usage') or {}
        cached, created = u.get('cache_read_input_tokens', 0), u.get('cache_creation_input_tokens', 0)
        inp = u.get('input_tokens')
        usage = {'input': inp + cached + created if inp is not None else None,
                 'output': u.get('output_tokens'), 'cached_input': cached,
                 'cache_creation': created, 'reasoning': None}
        stop = raw.get('stop_reason')
        completed = stop == 'end_turn'
    return text, usage, completed, stop


def costs(model, usage):
    if usage.get('input') is None or usage.get('output') is None:
        return {'estimated_usd': None, 'uncached_usd': None}
    uncached = (usage['input'] * model['input'] + usage['output'] * model['output']) / 1e6
    cached = usage.get('cached_input', 0)
    created = usage.get('cache_creation', 0)
    charged = (uncached - cached * (model['input'] - model['cached_input']) / 1e6
               + created * model['input'] * 0.25 / 1e6)
    return {'estimated_usd': charged, 'uncached_usd': uncached}


def call_model(model, key, prompt, image_data, output_limit, timeout):
    url, payload = build_request(model, prompt, base64.b64encode(image_data).decode(), output_limit)
    provider = model['provider']
    headers = {'Content-Type': 'application/json'}
    if provider == 'openai':
        headers['Authorization'] = 'Bearer ' + key
    elif provider == 'google':
        headers['x-goog-api-key'] = key
    else:
        headers.update({'x-api-key': key, 'anthropic-version': '2023-06-01'})
    start = time.monotonic()
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=(15, timeout))
    except requests.RequestException as exc:
        # Do not serialize request/exception objects: they may contain credentials/images.
        return {'status': 'transport_error', 'error_type': type(exc).__name__,
                'latency_s': time.monotonic() - start, 'estimated_usd': None}
    result = {'latency_s': time.monotonic() - start, 'http_status': response.status_code,
              'request_id': response.headers.get('request-id', response.headers.get('x-request-id'))}
    if not response.ok:
        try:
            error = response.json().get('error', {})
            message = str(error.get('message', ''))
            result['error'] = message.replace(key, '[REDACTED]')[:700]
            result['error_type'] = error.get('type', error.get('status'))
        except ValueError:
            result['error_type'] = 'non_json_error'
        return dict(result, status='api_error', estimated_usd=None)
    try:
        raw = response.json()
    except ValueError:
        return dict(result, status='invalid_response', estimated_usd=None)
    text, usage, completed, stop = unpack_response(provider, raw)
    result.update({'text': text, 'usage': usage, 'stop': stop,
                   'returned_model': raw.get('model', raw.get('modelVersion')),
                   'provider_usage': raw.get('usage', raw.get('usageMetadata')),
                   **costs(model, usage)})
    try:
        parsed = json.loads(text)
        jsonschema.validate(parsed, SCHEMA)
        result['prediction'] = parsed['wines']
        result['schema_valid'] = True
    except (ValueError, jsonschema.ValidationError):
        result['schema_valid'] = False
    result['status'] = ('ok' if result['schema_valid'] else 'invalid_json') if completed else 'incomplete'
    return result


def validate_dataset(data, base):
    ids = set()
    for case in data['cases']:
        if case['id'] in ids or not re.fullmatch(r'[a-zA-Z0-9_-]+', case['id']):
            raise ValueError('Case IDs must be unique and contain only letters, numbers, - or _.')
        ids.add(case['id'])
        if not (base / case['image']).is_file():
            raise ValueError(f"Missing image for {case['id']}")
        if case.get('source_sha256') and digest((base / case['image']).read_bytes()) != case['source_sha256']:
            raise ValueError(f"Source image changed for {case['id']}; import it as a new case.")
        if case.get('gold') is not None:
            if not case.get('gold_reviewed'):
                raise ValueError(f"Mark gold_reviewed only after reviewing labels: {case['id']}")
            for row in case['gold']:
                if not row.get('wine_name') or set(row) - set(FIELDS):
                    raise ValueError(f"Invalid gold fields for {case['id']}")
                for value in row.values():
                    if not all(v is None or isinstance(v, str) for v in alternatives(value)):
                        raise ValueError('Gold values must be strings, null, or a list of accepted alternatives.')


def command_import(args):
    target = Path(args.dataset).resolve()
    data = read_json(target) if target.exists() else {'version': 1, 'cases': []}
    known = {c.get('source_sha256') for c in data['cases']}
    for filename in args.images:
        source = Path(filename).expanduser().resolve()
        sha = digest(source.read_bytes())
        if sha in known:
            continue
        case_id = 'photo-' + sha[:12]
        image = Path('images') / (case_id + source.suffix.lower())
        destination = target.parent / image
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        data['cases'].append({'id': case_id, 'image': str(image), 'source_filename': source.name,
                              'source_sha256': sha, 'source_type': 'user_photo', 'split': 'pilot',
                              'gold_reviewed': False, 'gold': None})
        known.add(sha)
        print(f'Imported {source.name} as {case_id}; awaiting manual labels.')
    write_json(target, data)


def command_public(args):
    """Download version-checked public PDFs and render images; never submit PDF text to models."""
    if not shutil.which('pdftoppm'):
        raise ValueError('Install Poppler (pdftoppm) to prepare the public controls.')
    config = read_json(ROOT / 'benchmarks/vision/public-cases.json')
    target = Path(args.dataset).resolve()
    folder = target.parent / 'public'
    folder.mkdir(parents=True, exist_ok=True)
    cases = []
    for source in config['cases']:
        pdf = folder / (source['id'] + '.pdf')
        if not pdf.exists():
            response = requests.get(source['pdf_url'], timeout=(10, 30))
            response.raise_for_status()
            pdf.write_bytes(response.content)
        if digest(pdf.read_bytes()) != source['pdf_sha256']:
            raise ValueError(f"Public PDF changed: {source['id']}. Review the new page and labels first.")
        image = folder / (source['id'] + '.jpg')
        subprocess.run(['pdftoppm', '-f', str(source['page']), '-singlefile', '-scale-to', '2400',
                        '-jpeg', str(pdf), str(image.with_suffix(''))], check=True)
        cases.append({'id': source['id'], 'image': str(image.relative_to(target.parent)),
            'source_sha256': digest(image.read_bytes()), 'source_type': 'public_pdf_render',
            'source_url': source['pdf_url'], 'split': 'control', 'gold_reviewed': True,
            'gold_reviewer': 'assistant visual transcription; user review pending', 'gold': source['gold']})
    write_json(target, {'version': 1, 'gold_revision': 1, 'cases': cases})
    print('Public control dataset: ' + str(target))


def command_run(args):
    dataset = Path(args.dataset).resolve()
    data = read_json(dataset)
    validate_dataset(data, dataset.parent)
    catalog = read_json(args.models)
    models = catalog['models']
    if args.only:
        selected = set(args.only.split(','))
        unknown = selected - {m['id'] for m in models}
        if unknown:
            raise ValueError('Unknown model IDs: ' + ', '.join(sorted(unknown)))
        models = [m for m in models if m['id'] in selected]
    for model in models:
        if model.get('pricing_expires') and date.today().isoformat() > model['pricing_expires']:
            raise ValueError(f"Refresh expired prices for {model['id']}")
    keys = load_keys(args.env_file)
    prompt = Path(args.prompt).read_text()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    # Snapshot gold locally for scoring, but it is NEVER included in model requests.
    snapshot = {'dataset': data, 'models': models, 'prompt': prompt, 'schema': SCHEMA,
                'edges': args.edges, 'repeats': args.repeats, 'output_limit': args.output_limit,
                'seed': args.seed, 'pricing_checked': catalog['pricing_checked'],
                'script_sha256': digest(Path(__file__).read_bytes())}
    signature = digest(snapshot)
    manifest = output / 'manifest.json'
    if manifest.exists():
        if read_json(manifest)['signature'] != signature:
            raise ValueError('Run configuration changed; use a new output directory.')
    else:
        write_json(manifest, {'signature': signature, 'started_at': datetime.now(timezone.utc).isoformat(),
                              **snapshot})
    jobs = [(c, m, edge, repeat) for c in data['cases'] for m in models
            for edge in args.edges for repeat in range(args.repeats)]
    random.Random(args.seed).shuffle(jobs)
    spent, done = 0.0, 0
    for old in output.glob('result-*.json'):
        record = read_json(old)
        spent += record.get('estimated_usd') or 0
        done += int(record.get('attempted', False))
    print(f'{len(jobs)} planned cells; {done} prior attempts; recorded cost ${spent:.4f}.', flush=True)
    print('Keys: ' + ', '.join(f'{p}={"available" if keys[p] else "missing"}' for p in keys), flush=True)
    for case, model, edge, repeat in jobs:
        name = f"result-{case['id']}-{model['id']}-{edge}-{repeat}.json"
        path = output / name
        if path.exists():
            continue  # Failures are preserved too; intentional retries use a fresh run.
        if done >= args.max_requests or spent >= args.max_cost:
            print('Stopped at local request/cost cap.', flush=True)
            break
        record = {'case_id': case['id'], 'model': model['id'], 'provider': model['provider'],
                  'edge': edge, 'repeat': repeat, 'timestamp': datetime.now(timezone.utc).isoformat()}
        if not keys.get(model['provider']):
            record.update(status='missing_key', attempted=False, estimated_usd=None)
        else:
            image_data, image_meta = prepare_image(dataset.parent / case['image'], edge)
            sent_file = output / 'images' / f"{case['id']}-{edge}.jpg"
            sent_file.parent.mkdir(exist_ok=True)
            if not sent_file.exists():
                sent_file.write_bytes(image_data)
            record.update(image=image_meta, attempted=True)
            record.update(call_model(model, keys[model['provider']], prompt, image_data,
                                     args.output_limit, args.timeout))
            done += 1
        write_json(path, record)
        spent += record.get('estimated_usd') or 0
        print(f"{case['id']} | {model['id']} | {edge}px | {record['status']} | "
              f"{record.get('latency_s', 0):.1f}s | recorded total ${spent:.4f}", flush=True)
    command_report(argparse.Namespace(output=str(output)))


def percentile(values, p):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(p * len(ordered)) - 1)]


def command_report(args):
    output = Path(args.output).resolve()
    manifest = read_json(output / 'manifest.json')
    cases = {c['id']: c for c in manifest['dataset']['cases']}
    scoring_dataset = manifest['dataset']
    if getattr(args, 'gold_dataset', None):
        scoring_dataset = read_json(args.gold_dataset)
        overrides = {c['id']: c for c in scoring_dataset['cases']}
        for case_id, case in cases.items():
            replacement = overrides.get(case_id)
            if not replacement or replacement.get('source_sha256') != case.get('source_sha256'):
                raise ValueError('Gold revisions must refer to the same source images and case IDs.')
            if replacement.get('gold') is not None and not replacement.get('gold_reviewed'):
                raise ValueError('Revised gold must be reviewed before scoring.')
            cases[case_id] = replacement
    records = [read_json(p) for p in sorted(output.glob('result-*.json'))]
    groups = defaultdict(list)
    for record in records:
        case = cases[record['case_id']]
        # Group public PDF renders separately from phone photos, and by split.
        group = (record['model'], record['edge'], case.get('source_type', 'unknown'), case.get('split', 'pilot'))
        if case.get('gold') is not None and record.get('attempted'):
            prediction = record.get('prediction', []) if record['status'] == 'ok' else []
            record['score'] = score_rows(case['gold'], prediction)
            if record['status'] != 'ok':
                record['score']['whole_card_exact'] = False
        groups[group].append(record)
    summaries = []
    for (model, edge, source_type, split), rows in sorted(groups.items()):
        attempted = [r for r in rows if r.get('attempted')]
        scored = [r for r in attempted if 'score' in r]
        scores = [r['score'] for r in scored]
        good_costs = [r['estimated_usd'] for r in attempted if r.get('estimated_usd') is not None]
        total_cost = sum(good_costs)
        def total(key):
            return sum(s[key] for s in scores)
        full = total('whole_card_exact')
        latency = [r['latency_s'] for r in attempted if r.get('latency_s') is not None]
        summaries.append({'model': model, 'edge': edge, 'source_type': source_type, 'split': split,
            'cells': len(rows), 'attempted': len(attempted), 'unique_images': len({r['case_id'] for r in rows}),
            'scored_attempts': len(scored), 'valid_completed': sum(r['status'] == 'ok' for r in attempted),
            'field_accuracy': total('correct_fields') / total('present_fields') if total('present_fields') else None,
            'core_field_accuracy': sum(s['fields'][f]['correct'] for s in scores
                for f in ('wine_name', 'vintage', 'price_glass', 'price_bottle')) /
                sum(s['fields'][f]['present'] for s in scores
                for f in ('wine_name', 'vintage', 'price_glass', 'price_bottle'))
                if sum(s['fields'][f]['present'] for s in scores
                for f in ('wine_name', 'vintage', 'price_glass', 'price_bottle')) else None,
            'row_recall': total('matched_rows') / total('gold_rows') if total('gold_rows') else None,
            'exact_row_rate': total('exact_rows') / total('gold_rows') if total('gold_rows') else None,
            'whole_card_exact_rate': full / len(scored) if scored else None,
            'missing_rows': sum(len(s['missing_rows']) for s in scores),
            'extra_rows': sum(len(s['extra_rows']) for s in scores),
            'invented_absent_fields': total('invented_absent_fields'),
            'known_cost_usd': total_cost, 'cost_unknown_attempts': len(attempted) - len(good_costs),
            'mean_cost_usd': total_cost / len(good_costs) if good_costs else None,
            'cost_per_exact_card_usd': sum(r.get('estimated_usd') or 0 for r in scored) / full
                if full and all(r.get('estimated_usd') is not None for r in scored) else None,
            'p50_s': statistics.median(latency) if latency else None, 'p95_s': percentile(latency, .95)})
    write_json(output / 'scores.json', {'scorer_sha256': digest(Path(__file__).read_bytes()),
                                       'scoring_dataset_sha256': digest(scoring_dataset),
                                       'gold_revision': scoring_dataset.get('gold_revision', 1),
                                       'summaries': summaries, 'records': records})
    def pct(v):
        return '—' if v is None else f'{v:.1%}'
    def num(v, precision=3):
        return '—' if v is None else f'{v:.{precision}f}'
    lines = ['# Wine vision benchmark results', '',
        'Pilot measurements, not a production ranking. Public PDF renders and phone photos are separate groups. '
        'All-null predictions cannot earn accuracy from absent fields. API failures count as failed labeled scans. '
        'Latency includes network and provider processing; tiny-sample p95 is descriptive only.', '',
        '| Model | Pixels | Source / split | Scored / attempted | Field recall | Exact rows | Exact cards | Missing / extra rows | Invented absent fields | Mean $ | Median s | p95 s |',
        '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for s in summaries:
        lines.append(f"| {s['model']} | {s['edge']} | {s['source_type']} / {s['split']} | "
          f"{s['scored_attempts']} / {s['attempted']} | {pct(s['field_accuracy'])} | {pct(s['exact_row_rate'])} | "
          f"{pct(s['whole_card_exact_rate'])} | {s['missing_rows']} / {s['extra_rows']} | "
          f"{s['invented_absent_fields']} | {num(s['mean_cost_usd'], 5)} | {num(s['p50_s'], 1)} | {num(s['p95_s'], 1)} |")
    lines += ['', 'Costs are calculated from returned token usage and the snapshotted rate card, not an invoice. '
              'Unknown costs are not assumed free; inspect scores.json. Repeats and resized variants are not independent photos. '
              'Gold labels were never included in provider requests.', '']
    (output / 'report.md').write_text('\n'.join(lines))
    sections = []
    for r in records:
        score = r.get('score')
        sent_file = output / 'images' / f"{r['case_id']}-{r['edge']}.jpg"
        image_html = (f'<img style="max-width:500px;max-height:700px" src="{html.escape(str(sent_file.relative_to(output)), quote=True)}" '
                      'alt="Image sent to the model">') if sent_file.exists() else ''
        sections.append('<details><summary>' + html.escape(f"{r['case_id']} · {r['model']} · {r['edge']}px · {r['status']}")
                        + '</summary>' + image_html + '<pre>' + html.escape(json.dumps({'prediction': r.get('prediction'),
                        'score': score, 'error': r.get('error')}, indent=2, ensure_ascii=False)) + '</pre></details>')
    (output / 'review.html').write_text('<!doctype html><meta charset="utf-8"><title>Wine vision review</title>'
        '<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:20px}pre{white-space:pre-wrap;'
        'background:#f5f5f5;padding:20px}summary{padding:12px;cursor:pointer}</style><h1>Wine vision review</h1>'
        '<p>Local predictions and field-level differences. No external scripts or uploads.</p>' + ''.join(sections))
    print('Report: ' + str(output / 'report.md'), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    imp = sub.add_parser('import', help='Copy explicitly chosen photos into a local dataset; gold starts unscored.')
    imp.add_argument('images', nargs='+')
    imp.add_argument('--dataset', default=str(ROOT / '.vision-bench/dataset.json'))
    imp.set_defaults(func=command_import)
    public = sub.add_parser('prepare-public', help='Fetch hash-checked public menu controls and render their pages.')
    public.add_argument('--dataset', default=str(ROOT / '.vision-bench/public-dataset.json'))
    public.set_defaults(func=command_public)
    run = sub.add_parser('run')
    run.add_argument('--dataset', default=str(ROOT / '.vision-bench/dataset.json'))
    run.add_argument('--models', default=str(ROOT / 'benchmarks/vision/models.json'))
    run.add_argument('--prompt', default=str(ROOT / 'benchmarks/vision/prompt.txt'))
    run.add_argument('--env-file', action='append', default=[])
    run.add_argument('--only', help='Comma-separated exact model IDs from the rate card.')
    run.add_argument('--edges', nargs='+', type=int, default=[1000, 1568])
    run.add_argument('--repeats', type=int, default=1)
    run.add_argument('--output-limit', type=int, default=8192)
    run.add_argument('--output', default=str(ROOT / '.vision-bench/runs/pilot'))
    run.add_argument('--max-requests', type=int, default=100)
    run.add_argument('--max-cost', type=float, default=5.0,
                     help='Stop after recorded cost reaches this; final call or unknown usage can exceed it.')
    run.add_argument('--timeout', type=float, default=90)
    run.add_argument('--seed', type=int, default=20260911)
    run.set_defaults(func=command_run)
    report = sub.add_parser('report', help='Re-score a run snapshot without any API calls.')
    report.add_argument('--output', required=True)
    report.add_argument('--gold-dataset', help='Optional audited gold revision; raw run snapshots remain unchanged.')
    report.set_defaults(func=command_report)
    args = parser.parse_args()
    if args.command == 'run' and (min(args.edges) < 400 or max(args.edges) > 4096 or args.repeats < 1
                                 or args.max_requests < 1 or args.max_cost <= 0 or args.output_limit < 256):
        parser.error('Use edges 400–4096, positive repeat/request/cost limits, and output limit >=256.')
    args.func(args)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as exc:
        print(f'Benchmark error: {exc}', file=sys.stderr)
        sys.exit(1)
