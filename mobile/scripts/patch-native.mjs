// Правки нативных проектов после `npx cap add android|ios`
// usage: node scripts/patch-native.mjs android|ios
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2];

if (platform === 'android') {
  const p = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('usesCleartextTraffic')) {
    s = s.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
  }
  fs.writeFileSync(p, s);
  console.log('Android: cleartext разрешён (http-серверы в локальной сети)');
} else if (platform === 'ios') {
  const p = path.join(root, 'ios/App/App/Info.plist');
  let s = fs.readFileSync(p, 'utf8');
  const add = [];
  if (!s.includes('NSAppTransportSecurity'))
    add.push('<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<true/>\n\t</dict>');
  const perms = {
    NSCameraUsageDescription: 'Камера нужна, чтобы снимать фото и видео для чатов.',
    NSMicrophoneUsageDescription: 'Микрофон нужен для голосовых сообщений и видео.',
    NSPhotoLibraryUsageDescription: 'Доступ к фото нужен, чтобы отправлять картинки и ставить аватарку.'
  };
  for (const [k, v] of Object.entries(perms))
    if (!s.includes(k)) add.push(`<key>${k}</key>\n\t<string>${v}</string>`);
  if (add.length) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, '\t' + add.join('\n\t') + '\n</dict>\n</plist>\n');
  fs.writeFileSync(p, s);
  console.log('iOS: ATS и описания разрешений добавлены');
} else {
  console.error('usage: patch-native.mjs android|ios');
  process.exit(1);
}
