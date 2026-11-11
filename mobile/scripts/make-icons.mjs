// Рисует иконку и заставку (нужен playwright; запускается вручную, PNG лежат в resources/)
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const logo = (stroke = '#fff') => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><ellipse cx="12" cy="3.9" rx="5.2" ry="1.5" fill="none" stroke="#ffd86b" stroke-width="1.3"/><path d="M16.9 10.1A6.4 6.4 0 1 0 18.4 14.2H12.6" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const grad = 'linear-gradient(135deg,#8b5cf6,#2aabee)';
const jobs = [
  ['icon-only.png', 1024, `background:${grad}`, 62],
  ['icon-background.png', 1024, `background:${grad}`, 0],
  ['icon-foreground.png', 1024, 'background:transparent', 46],
  ['splash.png', 2732, 'background:#17212b', 16],
  ['splash-dark.png', 2732, 'background:#17212b', 16]
];
const b = await chromium.launch();
for (const [name, size, bg, pct] of jobs) {
  const pg = await b.newPage({ viewport: { width: size, height: size } });
  await pg.setContent(`<body style="margin:0;width:${size}px;height:${size}px;${bg};display:flex;align-items:center;justify-content:center"><div style="width:${pct}%;height:${pct}%">${pct ? logo() : ''}</div></body>`);
  await pg.screenshot({ path: path.join(out, name), omitBackground: bg.includes('transparent') });
  await pg.close();
}
await b.close();
