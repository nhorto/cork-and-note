import importlib.util
import argparse
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bench', Path(__file__).parents[1] / 'vision_benchmark.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class ScoringTests(unittest.TestCase):
    def test_missing_rows_and_nulls_do_not_get_free_accuracy(self):
        gold = [{'wine_name': 'Merlot', 'vintage': '2022', 'producer': None}]
        result = b.score_rows(gold, [{'wine_name': 'Merlot', 'vintage': None, 'producer': None}])
        self.assertEqual(result['field_recall'], .5)
        self.assertFalse(result['whole_card_exact'])
        self.assertEqual(b.score_rows(gold, [])['field_recall'], 0)

    def test_duplicate_prediction_cannot_match_twice(self):
        gold = [{'wine_name': 'Merlot'}, {'wine_name': 'Sauvignon Blanc'}]
        result = b.score_rows(gold, [{'wine_name': 'Merlot'}, {'wine_name': 'Merlot'}])
        self.assertEqual(result['matched_rows'], 1)
        self.assertEqual(len(result['extra_rows']), 1)
        self.assertEqual(len(result['missing_rows']), 1)

    def test_reordering_and_repeated_names(self):
        gold = [{'wine_name': 'Reserve', 'vintage': '2021'}, {'wine_name': 'Reserve', 'vintage': '2022'}]
        self.assertTrue(b.score_rows(gold, gold[::-1])['whole_card_exact'])

    def test_hallucinated_absent_fields_are_separate(self):
        result = b.score_rows([{'wine_name': 'Merlot', 'vintage': None}],
                              [{'wine_name': 'Merlot', 'vintage': '2024'}])
        self.assertEqual(result['invented_absent_fields'], 1)
        self.assertEqual(result['field_precision'], .5)
        self.assertFalse(result['whole_card_exact'])

    def test_typo_alignment_does_not_earn_exact_credit(self):
        result = b.score_rows([{'wine_name': 'Chardonnay'}], [{'wine_name': 'Chardomay'}])
        self.assertEqual(result['matched_rows'], 1)
        self.assertEqual(result['correct_fields'], 0)

    def test_aliases_price_format_and_unscored_fields(self):
        result = b.score_rows([{'wine_name': ['Lux Pinot Noir', "Cooper's Hawk Lux Pinot Noir"],
                               'price_bottle': '39.99'}],
                              [{'wine_name': 'Lux Pinot Noir', 'price_bottle': '$39.990', 'region': 'California'}])
        self.assertTrue(result['whole_card_exact'])

    def test_empty_gold_with_extra_wine_is_failure(self):
        self.assertFalse(b.score_rows([], [{'wine_name': 'Invented'}])['whole_card_exact'])

    def test_google_thoughts_are_billed_as_output(self):
        raw = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': '{}'}]}}],
               'usageMetadata': {'promptTokenCount': 200, 'candidatesTokenCount': 100, 'thoughtsTokenCount': 300}}
        text, usage, complete, stop = b.unpack_response('google', raw)
        self.assertEqual(usage['output'], 400)
        self.assertTrue(complete)

    def test_incomplete_openai_result_is_not_success(self):
        raw = {'status': 'incomplete', 'incomplete_details': {'reason': 'max_output_tokens'}, 'usage': {}, 'output': []}
        self.assertFalse(b.unpack_response('openai', raw)[2])
        self.assertIsNone(b.costs({'input': 1, 'output': 5}, {'input': None, 'output': None})['estimated_usd'])

    def test_cache_cost_is_not_double_counted(self):
        model = {'input': 1, 'cached_input': .1, 'output': 5}
        cost = b.costs(model, {'input': 2000, 'cached_input': 1000, 'output': 100})
        self.assertAlmostEqual(cost['estimated_usd'], .0016)

    def test_gold_and_credentials_never_in_payload(self):
        models = b.read_json(b.ROOT / 'benchmarks/vision/models.json')['models']
        for model in models:
            url, payload = b.build_request(model, 'Read this image.', 'IMAGE_BYTES', 8192)
            self.assertNotIn('gold', json.dumps(payload))
            self.assertNotIn('key=', url)
            self.assertNotIn('api_key', json.dumps(payload))

    def test_environment_file_is_not_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'keys.env'
            p.write_text('OPENAI_API_KEY="test-value" # comment\nIGNORED=secret\n')
            with patch.dict(b.os.environ, {}, clear=True):
                self.assertEqual(b.load_keys([p])['openai'], 'test-value')

    def test_gold_revision_preserves_snapshot_and_raw_prediction(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            old = {'id': 'photo-test', 'source_sha256': 'same', 'gold_reviewed': True,
                   'gold': [{'wine_name': 'Merlot', 'price_bottle': '46'}]}
            b.write_json(folder / 'manifest.json', {'dataset': {'cases': [old]}})
            result = {'case_id': 'photo-test', 'model': 'test', 'edge': 1568,
                      'attempted': True, 'status': 'ok', 'estimated_usd': .001, 'latency_s': 1,
                      'prediction': [{'wine_name': 'Merlot', 'price_bottle': '40'}]}
            b.write_json(folder / 'result-test.json', result)
            original = (folder / 'manifest.json').read_bytes()
            b.write_json(folder / 'revised.json', {'gold_revision': 2, 'cases': [dict(old,
                         gold=[{'wine_name': 'Merlot', 'price_bottle': '40'}])]})
            b.command_report(argparse.Namespace(output=directory, gold_dataset=str(folder / 'revised.json')))
            scored = b.read_json(folder / 'scores.json')
            self.assertTrue(scored['records'][0]['score']['whole_card_exact'])
            self.assertEqual(scored['gold_revision'], 2)
            self.assertEqual((folder / 'manifest.json').read_bytes(), original)
            self.assertEqual(b.read_json(folder / 'result-test.json'), result)

    def test_gold_revision_rejects_different_image(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            b.write_json(folder / 'manifest.json', {'dataset': {'cases': [
                {'id': 'photo-test', 'source_sha256': 'original'}]}})
            b.write_json(folder / 'revised.json', {'cases': [
                {'id': 'photo-test', 'source_sha256': 'different', 'gold': []}]})
            with self.assertRaisesRegex(ValueError, 'same source images'):
                b.command_report(argparse.Namespace(output=directory, gold_dataset=str(folder / 'revised.json')))


if __name__ == '__main__':
    unittest.main()
