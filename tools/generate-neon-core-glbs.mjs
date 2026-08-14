#!/usr/bin/env node
/**
 * Génère les 6 motos Néon Core via l'assembleur 3D-editor (AssembleurAPI + GLTFExporter).
 *
 * Prérequis : clone de https://github.com/Arknoid01/3D-editor
 *   EDITOR_ROOT=/chemin/vers/3D-editor node tools/generate-neon-core-glbs.mjs
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EDITOR_ROOT = process.env.EDITOR_ROOT || '/tmp/3D-editor';
const OUT_DIR = path.join(ROOT, 'assets/bikes');
const PORT = Number(process.env.EDITOR_PORT || 8766);

const VARIANTS = [
  { colorId: 'cyan', catalogColor: 'cyan' },
  { colorId: 'magenta', catalogColor: 'magenta' },
  { colorId: 'orange', catalogColor: 'orange' },
  { colorId: 'lime', catalogColor: 'lime' },
  { colorId: 'violet', catalogColor: 'violet' },
  { colorId: 'crimson', catalogColor: 'red' },
];

function buildConfig({ colorId, catalogColor }) {
  return {
    base: 'bike_base',
    assetId: `neon-core-${colorId}`,
    parts: [
      { object: 'liseret', socket: 'neonSide', color: catalogColor },
      { object: 'liseretAr', socket: 'neonRear', color: catalogColor },
      { object: 'poigneeG', socket: 'handleLeft', color: catalogColor },
      { object: 'poigneeD', socket: 'handleRight', color: catalogColor },
    ],
    materials: {
      rouge: catalogColor,
      blanc: 'white',
      noir: 'black',
      chrome: 'chrome',
    },
  };
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Serveur assembleur inaccessible: ${url}`);
}

function startEditorServer() {
  return spawn('python3', ['api-server.py'], {
    cwd: EDITOR_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}


async function main() {
  if (!fs.existsSync(path.join(EDITOR_ROOT, 'api-server.py'))) {
    throw new Error(`3D-editor introuvable dans ${EDITOR_ROOT}. Clone le dépôt ou définis EDITOR_ROOT.`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = startEditorServer();

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/api/catalog`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(180000);
      await page.goto(`http://127.0.0.1:${PORT}/moto-assembleur-v3.html`, {
        waitUntil: 'domcontentloaded',
        timeout: 180000,
      });
      await page.waitForFunction(() => window.AssembleurAPI?.isReady?.(), { timeout: 180000 });

      for (const variant of VARIANTS) {
        const config = buildConfig(variant);
        console.log(`Génération neon-core-${variant.colorId}…`);
        const base64 = await page.evaluate(async (cfg) => {
          const result = AssembleurAPI.assemble(cfg);
          if (!result.success) {
            throw new Error('Assemblage échoué: ' + JSON.stringify(result.errors || result));
          }
          await new Promise(r => setTimeout(r, 400));
          const buffer = await new Promise((resolve, reject) => {
            try {
              assemblage.updateMatrixWorld(true);
              new THREE.GLTFExporter().parse(
                assemblage,
                (res) => resolve(res),
                { binary: true, onlyVisible: true },
              );
            } catch (err) {
              reject(err);
            }
          });
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          return btoa(binary);
        }, config);

        const outPath = path.join(OUT_DIR, `neon-core-${variant.colorId}.glb`);
        fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
        const size = fs.statSync(outPath).size;
        console.log(`  → ${outPath} (${(size / 1024).toFixed(1)} Ko)`);
        if (size < 4096) throw new Error(`Fichier trop petit: ${outPath}`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }

  console.log('Terminé — 6 GLB Néon Core générés.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
