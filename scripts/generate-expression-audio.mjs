// Run with node --experimental-strip-types scripts/generate-expression-audio.mjs
// Requires edge-tts in ../.audio-tools or set BILAD_TTS_PYTHON to its Python executable.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expressions } from '../src/lib/expressions.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/audio/expressions');
const python = process.env.BILAD_TTS_PYTHON || path.resolve(root, '../.audio-tools/Scripts/python.exe');
const voice = 'ar-IQ-RanaNeural';
await mkdir(output, { recursive: true });
const worker = `
import asyncio, json, sys
import edge_tts
item = json.loads(sys.stdin.buffer.read().decode("utf-8"))
async def main():
    await edge_tts.Communicate(item["text"], item["voice"], rate="-8%").save(item["file"])
asyncio.run(main())
`;
const manifest = [];
const manifestFile = path.join(output, `generation-${Date.now()}.json`);
for (const phrase of expressions) {
  const file = path.join(output, `${phrase.id}.mp3`);
  let present = false;
  try { present = (await stat(file)).size > 0; } catch {}
  if (present && !process.argv.includes('--replace')) {
    console.log(`Preserved existing ${phrase.id}.mp3`);
    continue;
  }
  await new Promise((resolve, reject) => {
    const child = spawn(python, ['-c', worker], { stdio: ['pipe', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${phrase.id}: speech generation failed (${code})`)));
    child.stdin.end(JSON.stringify({ text: phrase.arabic, voice, file: `${file}.part` }));
  });
  await rename(`${file}.part`, file);
  manifest.push({ id: phrase.id, text: phrase.arabic, file: `${phrase.id}.mp3`, voice, rate: '-8%', synthetic: true });
  await writeFile(manifestFile, JSON.stringify({
    provider: 'Microsoft Edge online speech via edge-tts',
    generatedAt: new Date().toISOString(),
    note: 'Synthetic Iraqi-locale voice. Native Iraqi pronunciation review is still needed.',
    clips: manifest,
  }, null, 2) + '\n');
  console.log(`Generated ${phrase.id}.mp3`);
}
