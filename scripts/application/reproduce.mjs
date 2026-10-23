/** Offline, opt-in verification of browser exports. Does not import files into the application. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { readBrowserMetadata } from '../browser/metadata.ts';
import { ROOT } from '../data/io.ts';
import { canonicalJson } from '../../src/features/simulation/core/serialization.ts';
const [resultPath, provenancePath] = process.argv.slice(2);
assert(resultPath && provenancePath && process.argv.length === 4, 'usage: node scripts/application/reproduce.mjs <run-result.json> <run-provenance.json>');
const body = await readFile(resultPath);
const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
const hash = createHash('sha256').update(body).digest('hex');
assert.equal(hash, provenance.result_sha256, 'saved result SHA-256 differs');
const result = JSON.parse(body.toString('utf8'));
assert.equal(canonicalJson(result), body.toString('utf8'), 'result is not canonical UTF-8 JSON/LF');
const metadata = await readBrowserMetadata();
assert.equal(metadata.verification, 'verified', metadata.reason ?? 'unverified code');
assert.equal(metadata.application_git_revision, provenance.application_git_revision, 'check out the recorded application commit before reproducing');
for (const key of ['data_provenance_sha256', 'code_input_sha256', 'application_input_sha256']) assert.equal(canonicalJson(metadata[key]), canonicalJson(provenance[key]), `${key} differs`);
assert.equal(canonicalJson({ implementation_git_revision: result.implementation_git_revision, data_identity: result.data_identity, specification_sha256: result.specification_sha256 }), canonicalJson(metadata.context), 'data/specification/engine version differs');
const input = { mode: result.execution_mode, request: { selection: result.selection, rate_percent: result.sampling.rate_percent, master_seed: result.randomness.master_seed, ...(result.execution_mode === 'repeated_trials' ? { repetitions: result.requested_repetitions } : {}) } };
assert.equal(canonicalJson(input), canonicalJson(provenance.reproduction), 'saved reproduction conditions differ');
// Vite SSR understands the original ?raw loader. No listening socket or external upload.
const vite = await createServer({ root: ROOT, configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null } });
try {
  const { validateCompletedResult } = await vite.ssrLoadModule('/src/features/execution/validate.ts');
  const { sha256Text } = await vite.ssrLoadModule('/src/features/simulation/hash.ts');
  await validateCompletedResult(result, input, metadata.context, sha256Text);
  const entry = await vite.ssrLoadModule('/src/features/simulation/run.ts');
  const reproduced = input.mode === 'single_trial'
    ? await entry.runObservationSimulation(input.request, metadata.context)
    : await entry.runRepeatedObservationSimulation(input.request, metadata.context);
  assert.equal(canonicalJson(reproduced), body.toString('utf8'), 'recomputed result bytes differ');
  console.log(JSON.stringify({ status: 'passed', result_sha256: hash, trials: result.trials.length, bytes: body.length }));
} finally { await vite.close(); }
