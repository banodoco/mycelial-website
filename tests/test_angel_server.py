"""Focused HTTP checks for the standalone Mycelial deck gate."""
import gzip
import http.client
import os
import re
import socket
import subprocess
import sys
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = 'AngelTest0123456789x'
ORIGIN = 'http://127.0.0.1'


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class Server:
    def __init__(self, *, keys=KEY, mode='release'):
        self.port = free_port()
        env = {**os.environ, 'PORT': str(self.port), 'PUBLIC_ORIGIN': f'{ORIGIN}:{self.port}',
               'DECK_ANGEL_KEYS': keys, 'RUNTIME_MODE': mode}
        self.process = subprocess.Popen([sys.executable, 'serve.py'], cwd=ROOT, env=env,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(100):
            try:
                with socket.create_connection(('127.0.0.1', self.port), timeout=.1):
                    return
            except OSError:
                if self.process.poll() is not None:
                    raise AssertionError(self.process.stderr.read().decode())
                time.sleep(.02)
        self.stop()
        raise AssertionError('server did not start')

    def stop(self):
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=5)
        if self.process.stderr:
            self.process.stderr.close()

    def request(self, method, path, *, headers=None, body=None, follow=True):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        result = {'status': response.status, 'headers': response.headers, 'body': data}
        connection.close()
        if follow and response.status in (301, 302, 303, 307, 308) and response.headers.get('Location'):
            return self.request('GET', response.headers['Location'], headers=headers, follow=False)
        return result


class AngelServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.gate = ROOT / 'mycelial' / 'gate.html'
        cls.had_gate = cls.gate.exists()
        if not cls.had_gate:
            cls.gate.write_text('<!doctype html><title>temporary gate</title><p>Enter the personal key</p>', encoding='utf-8')
        cls.server = Server()

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        if not cls.had_gate:
            cls.gate.unlink(missing_ok=True)

    def test_locked_gate_and_unlocked_cookie_asset(self):
        locked = self.server.request('GET', '/deck/angel/')
        self.assertEqual(locked['status'], 200)
        self.assertIn(b'personal key', locked['body'])
        self.assertEqual(locked['headers']['X-Robots-Tag'], 'noindex')
        self.assertEqual(locked['headers']['Referrer-Policy'], 'same-origin')
        self.assertEqual(locked['headers']['Cache-Control'], 'no-store')

        opened = self.server.request('GET', '/deck/angel/?key=' + KEY)
        self.assertEqual(opened['status'], 200)
        self.assertIn(b'<title>Mycelial</title>', opened['body'])
        cookie = opened['headers'].get('Set-Cookie')
        self.assertRegex(cookie or '', r'deck_angel=[0-9a-f]{64}; Max-Age=2592000; Path=/deck/; HttpOnly; SameSite=Lax')
        asset = self.server.request('GET', '/deck/assets/cards/arca/everyone-all-at-once.avif',
                                    headers={'Cookie': cookie.split(';', 1)[0]})
        self.assertEqual(asset['status'], 200)

    def test_unlock_endpoint_and_hygiene(self):
        self.assertEqual(self.server.request('GET', '/deck/assets/cards/arca/everyone-all-at-once.avif')['status'], 404)
        self.assertEqual(self.server.request('POST', '/deck/angel/unlock', body='key=bad',
                                             headers={'Content-Type': 'application/x-www-form-urlencoded'})['status'], 403)
        valid = self.server.request('POST', '/deck/angel/unlock', body='{"key":"' + KEY + '"}',
                                     headers={'Content-Type': 'application/json'})
        self.assertEqual(valid['status'], 204)
        for path in ('/deck/angel/.secret', '/deck/angel/%2e%2e/serve.py'):
            self.assertEqual(self.server.request('GET', path)['status'], 404)

    def test_release_encoded_and_normalized_mycelial_paths_cannot_bypass_gate(self):
        bypasses = (
            '/%6Dycelial/index.html',
            '//mycelial/index.html',
            '/assets/../mycelial/index.html',
            '/%6Dycelial/dot-transitions.js',
            '//mycelial/dot-transitions.js',
            '/assets/../mycelial/dot-transitions.js',
        )
        for path in bypasses:
            with self.subTest(path=path):
                response = self.server.request('GET', path, follow=False)
                self.assertEqual(response['status'], 308)
                self.assertEqual(response['headers']['Location'], '/deck/angel/')
                self.assertNotIn(b'<title>Mycelial', response['body'])

    def test_encoded_deck_entry_spelling_redirects_to_canonical_root(self):
        # A leading '//' is collapsed by http.server itself before routing, so it serves the canonical page.
        for path in ('/deck/angel%2f', '/deck%2fangel%2f', '/deck/angel/./'):
            with self.subTest(path=path):
                response = self.server.request('GET', path, follow=False)
                self.assertEqual(response['status'], 308)
                self.assertEqual(response['headers']['Location'], '/deck/angel/')

    def test_rejected_range_is_only_a_416_response(self):
        response = self.server.request('GET', '/deck/angel/?key=' + KEY,
                                       headers={'Range': 'bytes=0-1,3-4'})
        self.assertEqual(response['status'], 416)
        self.assertEqual(response['body'], b'')

    def test_case_aliases_cannot_serve_release_mycelial_files(self):
        for path in ('/MYCELIAL/index.html', '/Mycelial/dot-transitions.js'):
            with self.subTest(path=path):
                self.assertNotEqual(self.server.request('GET', path, follow=False)['status'], 200)

    def test_range_keyed_deck_response_sets_cookie_before_headers_end(self):
        response = self.server.request('GET', '/deck/angel/index.html?key=' + KEY,
                                        headers={'Range': 'bytes=0-9'})
        self.assertEqual(response['status'], 206)
        self.assertRegex(response['headers'].get('Set-Cookie', ''), r'deck_angel=[0-9a-f]{64};')

    def test_release_redirect_and_removed_key_revokes_cookie(self):
        redirected = self.server.request('GET', '/mycelial/?x=1', follow=False)
        self.assertEqual(redirected['status'], 308)
        self.assertEqual(redirected['headers']['Location'], '/deck/angel/?x=1')
        opened = self.server.request('GET', '/deck/angel/?key=' + KEY)
        cookie = opened['headers']['Set-Cookie'].split(';', 1)[0]
        revoked = Server(keys='AnotherValidKey123')
        self.addCleanup(revoked.stop)
        response = revoked.request('GET', '/deck/assets/cards/arca/everyone-all-at-once.avif',
                                   headers={'Cookie': cookie})
        self.assertEqual(response['status'], 404)

    def test_text_is_gzipped_only_for_clients_that_accept_it(self):
        path = '/vendor/three/three.module.js'
        plain = self.server.request('GET', path)
        self.assertEqual(plain['status'], 200)
        self.assertIsNone(plain['headers'].get('Content-Encoding'))
        self.assertEqual(plain['headers']['Vary'], 'Accept-Encoding')
        packed = self.server.request('GET', path, headers={'Accept-Encoding': 'gzip, deflate, br'})
        self.assertEqual(packed['headers']['Content-Encoding'], 'gzip')
        self.assertEqual(packed['headers']['Vary'], 'Accept-Encoding')
        self.assertEqual(int(packed['headers']['Content-Length']), len(packed['body']))
        self.assertLess(len(packed['body']), len(plain['body']) / 2)
        self.assertEqual(gzip.decompress(packed['body']), plain['body'])
        self.assertIn('javascript', packed['headers']['Content-Type'])
        self.assertEqual(packed['headers']['Cache-Control'], plain['headers']['Cache-Control'])
        # The second request is served from the cache with identical bytes.
        again = self.server.request('GET', path, headers={'Accept-Encoding': 'gzip'})
        self.assertEqual(again['body'], packed['body'])
        refused = self.server.request('GET', path, headers={'Accept-Encoding': 'gzip;q=0, identity'})
        self.assertIsNone(refused['headers'].get('Content-Encoding'))
        self.assertEqual(refused['body'], plain['body'])

    def test_gzip_head_matches_get_and_sends_no_body(self):
        path = '/vendor/three/three.module.js'
        got = self.server.request('GET', path, headers={'Accept-Encoding': 'gzip'})
        head = self.server.request('HEAD', path, headers={'Accept-Encoding': 'gzip'})
        self.assertEqual(head['status'], 200)
        self.assertEqual(head['body'], b'')
        self.assertEqual(head['headers']['Content-Encoding'], 'gzip')
        self.assertEqual(head['headers']['Content-Length'], got['headers']['Content-Length'])

    def test_range_and_media_are_never_compressed(self):
        packed_ok = {'Accept-Encoding': 'gzip'}
        ranged = self.server.request('GET', '/vendor/three/three.module.js',
                                     headers={**packed_ok, 'Range': 'bytes=0-99'})
        self.assertEqual(ranged['status'], 206)
        self.assertIsNone(ranged['headers'].get('Content-Encoding'))
        self.assertEqual(len(ranged['body']), 100)
        clip = '/assets/astrid/first-light.mp4'
        for headers in (packed_ok, {**packed_ok, 'Range': 'bytes=0-9'}):
            response = self.server.request('GET', clip, headers=headers)
            self.assertIn(response['status'], (200, 206))
            self.assertIsNone(response['headers'].get('Content-Encoding'))
            self.assertIsNone(response['headers'].get('Vary'))
        partial = self.server.request('GET', clip, headers={**packed_ok, 'Range': 'bytes=0-9'})
        self.assertEqual(partial['status'], 206)
        self.assertEqual(len(partial['body']), 10)
        self.assertEqual(partial['headers']['Content-Range'].split('/')[0], 'bytes 0-9')

    def test_gated_deck_is_gzipped_without_loosening_the_gate(self):
        gzip_header = {'Accept-Encoding': 'gzip'}
        locked = self.server.request('GET', '/deck/angel/', headers=gzip_header)
        self.assertEqual(locked['status'], 200)
        gate = gzip.decompress(locked['body']) if locked['headers'].get('Content-Encoding') == 'gzip' else locked['body']
        self.assertIn(b'personal key', gate)
        self.assertNotIn(b'class="slide', gate)
        opened = self.server.request('GET', '/deck/angel/?key=' + KEY, headers=gzip_header)
        self.assertEqual(opened['status'], 200)
        self.assertEqual(opened['headers']['Content-Encoding'], 'gzip')
        self.assertEqual(opened['headers']['Cache-Control'], 'no-store')
        self.assertEqual(opened['headers']['X-Robots-Tag'], 'noindex')
        self.assertIn('deck_angel=', opened['headers']['Set-Cookie'])
        plain = self.server.request('GET', '/deck/angel/?key=' + KEY)
        self.assertIsNone(plain['headers'].get('Content-Encoding'))
        self.assertEqual(gzip.decompress(opened['body']), plain['body'])
        self.assertEqual(int(opened['headers']['Content-Length']), len(opened['body']))
        # Scripts behind the gate need the key or cookie, compressed or not.
        script = '/deck/angel/core.js'
        self.assertEqual(self.server.request('GET', script, headers=gzip_header)['status'], 404)
        cookie = opened['headers']['Set-Cookie'].split(';', 1)[0]
        script_open = self.server.request('GET', script, headers={**gzip_header, 'Cookie': cookie})
        self.assertEqual(script_open['status'], 200)
        self.assertEqual(script_open['headers']['Content-Encoding'], 'gzip')
        self.assertEqual(script_open['headers']['Cache-Control'], 'private, no-cache')

    def test_missing_file_stays_404_with_gzip_accepted(self):
        self.assertEqual(self.server.request('GET', '/no-such-file.js', headers={'Accept-Encoding': 'gzip'})['status'], 404)
        self.assertEqual(self.server.request('HEAD', '/deck/angel/nope.js?key=' + KEY, headers={'Accept-Encoding': 'gzip'})['status'], 404)

    def test_unset_env_fails_closed(self):
        locked = Server(keys='')
        self.addCleanup(locked.stop)
        self.assertEqual(locked.request('GET', '/deck/angel/?key=' + KEY)['status'], 200)
        self.assertEqual(locked.request('POST', '/deck/angel/unlock', body='key=' + KEY,
                                         headers={'Content-Type': 'application/x-www-form-urlencoded'})['status'], 403)


if __name__ == '__main__':
    unittest.main()
