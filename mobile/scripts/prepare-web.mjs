// Готовит веб-часть для мобильного приложения: берёт ../wwwroot -> ./www
// - app.html -> index.html, абсолютные пути (/js/..) -> относительные
// - вставляет gg-config.js (адрес сервера) и gg-mobile.js (подмена адресов API)
// - скрипты приложения подгружает gg-mobile.js, когда адрес сервера известен
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.resolve(root, '..', 'wwwroot');
const out = path.resolve(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

// location.origin в веб-версии = адрес сервера; в приложении это адрес из настроек
for (const f of fs.readdirSync(path.join(out, 'js'))) {
  const p = path.join(out, 'js', f);
  const s = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, s.replaceAll('location.origin', '(window.GG_BASE||location.origin)'));
}

let html = fs.readFileSync(path.join(out, 'app.html'), 'utf8');
fs.rmSync(path.join(out, 'app.html'));

const scripts = [];
html = html.replace(/<script\s+src="\/(js\/[^"?]+)(?:\?[^"]*)?"\s+defer><\/script>\s*/g, (_, p) => {
  scripts.push(p);
  return '';
});
if (!scripts.length) throw new Error('В app.html не найдено ни одного <script src="/js/...">');

html = html.replace(/href="\/styles\.css/g, 'href="styles.css');
html = html.replace(
  '<head>',
  '<head>\n<script src="gg-config.js"></script>\n<script src="gg-mobile.js"></script>'
);
fs.writeFileSync(path.join(out, 'index.html'), html);

const server = (process.env.GODGRAM_SERVER_URL || '').trim();
fs.writeFileSync(
  path.join(out, 'gg-config.js'),
  `window.GG_DEFAULT_SERVER=${JSON.stringify(server)};window.GG_SCRIPTS=${JSON.stringify(scripts)};\n`
);
fs.copyFileSync(path.join(root, 'shim', 'gg-mobile.js'), path.join(out, 'gg-mobile.js'));

console.log('www готов. Скрипты:', scripts.join(', '), '| сервер по умолчанию:', server || '(спросит при первом запуске)');
