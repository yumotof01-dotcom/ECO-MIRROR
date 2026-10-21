/** Builds locally; never uploads, deploys or creates a public URL. */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,stat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readBrowserMetadata} from '../browser/metadata.ts';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git('rev-parse','--is-shallow-repository')!=='false')throw Error('RELEASE_HISTORY: fetch full Git history before building');
if(git('status','--porcelain'))throw Error('RELEASE_DIRTY: commit or preserve outstanding changes before release build');
const source_revision=git('rev-parse','HEAD'),meta=await readBrowserMetadata();
if(meta.verification!=='verified')throw Error(`RELEASE_PROVENANCE: ${meta.reason}`);
execFileSync('npm',['run','build'],{stdio:'inherit'});
const files=[];async function walk(dir){for(const name of (await readdir(dir)).sort()){const path=`${dir}/${name}`;if((await stat(path)).isDirectory())await walk(path);else{const bytes=await readFile(path);if(bytes.length>25*1024*1024)throw Error(`ASSET_TOO_LARGE: ${path}`);if(/\.map$|\.env|\/dev\/|preview\.html|\.test\./.test(path))throw Error(`UNEXPECTED_ASSET: ${path}`);files.push({path:path.slice(5),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}await walk('dist');
if(files.length>1000)throw Error('Too many files for documented drag-and-drop route');
for(const required of ['index.html','_headers','DATA-ATTRIBUTION.txt','THIRD-PARTY-NOTICES.txt'])if(!files.some(f=>f.path===required))throw Error(`MISSING_ASSET: ${required}`);
if(!files.some(f=>/^assets\/worker-.*\.js$/.test(f.path)))throw Error('MISSING_WORKER');
const after=await readBrowserMetadata();if(git('status','--porcelain')||git('rev-parse','HEAD')!==source_revision||JSON.stringify(meta)!==JSON.stringify(after))throw Error('BUILD_INPUT_CHANGED');
await mkdir('.release',{recursive:true});await writeFile('.release/build-manifest.json',JSON.stringify({manifest_version:1,source_revision,node:process.version,metadata:meta,files,commands:['npm ci','npm run check','node scripts/release/build.mjs'],hosting:'Static Pages; no deployment performed',manifest_scope:'All dist bytes; this manifest is outside dist and is not self-hashed'},null,2)+'\n');
console.log(`Verified ${files.length} files; manifest .release/build-manifest.json; no deployment performed.`);
