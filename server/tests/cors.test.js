import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corsDelegate, NATIVE_ORIGINS } from '../src/utils/cors.js';

const run = (delegate, origin) => new Promise((resolve) => delegate({ header: (n) => (n === 'Origin' ? origin : undefined) }, (err, opts) => resolve({ err, opts })));
const delegate = corsDelegate(['https://carecompass-pro.vercel.app']);

test('website origin gets credentials', async () => {
  const { err, opts } = await run(delegate, 'https://carecompass-pro.vercel.app');
  assert.equal(err, null);
  assert.deepEqual([opts.origin, opts.credentials], [true, true]);
});

test('requests without an Origin header (curl, server to server) are allowed', async () => {
  const { err, opts } = await run(delegate, undefined);
  assert.equal(err, null);
  assert.equal(opts.credentials, true);
});

test('Android and iOS app origins are allowed, but without credentials', async () => {
  for (const o of NATIVE_ORIGINS) {
    const { err, opts } = await run(delegate, o);
    assert.equal(err, null, o);
    assert.deepEqual([opts.origin, opts.credentials], [true, false], o);
  }
});

test('unknown origins are rejected with 403', async () => {
  const { err } = await run(delegate, 'https://evil.example.com');
  assert.equal(err.status, 403);
  assert.equal(err.code, 'CORS');
});
