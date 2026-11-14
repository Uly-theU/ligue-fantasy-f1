import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const cssPath = path.join(dir, '.demo.css');

const node = process.execPath;
const tailwind = path.join(root, 'node_modules/tailwindcss/lib/cli.js');
const styled = spawnSync(node, [
  tailwind,
  '-c', path.join(root, 'tailwind.config.ts'),
  '-i', path.join(dir, 'input.css'),
  '-o', cssPath,
  '--minify',
], { cwd: root, stdio: 'inherit' });
if (styled.status !== 0) process.exit(styled.status ?? 1);

const css = readFileSync(cssPath, 'utf8').replaceAll('</', '<\\/');

const pages = [
  { entry: 'monaco.tsx', file: 'monaco.html', title: 'Démo — Circuit de Monaco' },
  { entry: 'saison.tsx', file: 'saison.html', title: 'Démo — Saison 2026' },
];

for (const page of pages) {
  const bundled = await build({
    entryPoints: [path.join(dir, page.entry)],
    absWorkingDir: root,
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'at-alias',
      setup(bundle) {
        bundle.onResolve({ filter: /^@\// }, (args) => {
          const base = path.join(root, args.path.slice(2));
          const extensions = ['.tsx', '.ts', '.jsx', '.js'];
          const file = extensions.map((ext) => base + ext).find((candidate) => existsSync(candidate))
            ?? extensions.map((ext) => path.join(base, `index${ext}`)).find((candidate) => existsSync(candidate));
          return { path: file ?? base };
        });
      },
    }, {
      name: 'css-inject',
      setup(bundle) {
        bundle.onLoad({ filter: /\.css$/ }, (args) => {
          const css = readFileSync(args.path, 'utf8');
          return {
            contents: `if (typeof document !== 'undefined' && !document.head.querySelector('style[data-clm-arcade]')) {
              const style = document.createElement('style');
              style.setAttribute('data-clm-arcade', '');
              style.textContent = ${JSON.stringify(css)};
              document.head.appendChild(style);
            }`,
            loader: 'js',
          };
        });
      },
    }],
    loader: { '.svg': 'text', '.json': 'json' },
    logLevel: 'info',
  });

  const js = bundled.outputFiles[0].text.replaceAll('</', '<\\/');
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page.title}</title>
  <style>${css}</style>
</head>
<body>
  <div id="demo"></div>
  <script>${js}</script>
</body>
</html>
`;
  const out = path.join(root, 'minijeu', page.file);
  writeFileSync(out, html);
  console.log(`écrit ${out} (${Math.round(html.length / 1024)} Ko)`);
}

rmSync(cssPath, { force: true });
