/** Rebuild notices from installed, lockfile-pinned dependency licenses. */
import {readFile,writeFile,readdir} from 'node:fs/promises';
const names=['react','react-dom','react-router','react-router-dom','scheduler','cookie','set-cookie-parser','tailwindcss','vite','rolldown'];
let text='ECO MIRROR — Third-party notices\n\nIncludes runtime dependencies and build-generated runtime/CSS notices.\nThis does not assign a license to ECO MIRROR original code or its data.\n\n';
for(const name of names){const dir=`node_modules/${name}`,pkg=JSON.parse(await readFile(`${dir}/package.json`,'utf8'));const files=(await readdir(dir)).filter(p=>/^licen[cs]e/i.test(p)).sort();if(!files.length)throw Error(`Missing license: ${name}`);text+=`\n${name} ${pkg.version} (${pkg.license})\n${'='.repeat(60)}\n`;for(const file of files)text+=await readFile(`${dir}/${file}`,'utf8')+'\n';}
await writeFile('public/THIRD-PARTY-NOTICES.txt',text);
