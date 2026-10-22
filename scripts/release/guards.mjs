/** Exercise release refusals in disposable clones; never mutate source Git history. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'eco-release-guards-'));
const report = { source_revision: execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim(), checks: [] };
try {
  for (const mode of ['shallow', 'dirty']) {
    const target = join(temp, mode);
    execFileSync('git', ['clone', ...(mode === 'shallow' ? ['--depth','1'] : []), pathToFileURL(root).href, target], {stdio:'pipe'});
    await symlink(join(root,'node_modules'), join(target,'node_modules'));
    if (mode === 'dirty') await writeFile(join(target, 'release-guard-probe.txt'), 'intentional uncommitted test file\n');
    const run = spawnSync(process.execPath, ['scripts/release/build.mjs'], {cwd: target, encoding:'utf8'});
    const expected = mode === 'shallow' ? 'RELEASE_HISTORY' : 'RELEASE_DIRTY';
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, new RegExp(expected));
    report.checks.push({mode, expected, exit_code:run.status, passed:true});
  }
  report.status = 'PASS';
  await writeFile('docs/release/build-guards.json', JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally { await rm(temp,{recursive:true,force:true}); }
