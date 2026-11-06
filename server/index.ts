import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { createApp } from './app';

const localPlay = process.argv.includes('--play');
const lanPlay = localPlay && process.argv.includes('--lan');
const production = !localPlay && process.env.NODE_ENV === 'production';
const publicHttpTest = production && process.env.ALLOW_INSECURE_PUBLIC_TEST === '1';
if (production && !process.env.APP_ORIGINS)
  throw new Error('生产环境必须配置 APP_ORIGINS，例如 https://game.example.com。');
if (
  publicHttpTest &&
  !process.env.APP_ORIGINS?.split(',').every((origin) => {
    const parsed = new URL(origin.trim());
    return parsed.protocol === 'http:' && parsed.origin === origin.trim();
  })
)
  throw new Error('公网 HTTP 测试必须显式配置精确的 HTTP APP_ORIGINS。');
// Keep the usual frontend address so returning guests retain their browser saves.
const port = localPlay ? 5173 : Number(process.env.PORT ?? 3001);
function lanAddress() {
  const privateAddresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry?.family === 'IPv4' && !entry.internal)
    .map((entry) => entry!.address)
    .filter((ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
  const address = process.env.LAN_HOST ?? privateAddresses[0];
  if (!address || !privateAddresses.includes(address))
    throw new Error(
      '未找到可用的局域网 IPv4 地址。请连接 Wi-Fi 或网线，多网卡时可用 LAN_HOST 指定本机的局域网地址。',
    );
  return address;
}
const host = lanPlay ? lanAddress() : localPlay ? '127.0.0.1' : (process.env.HOST ?? '127.0.0.1');
const localUrl = `http://${host}:${port}`;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 配置无效。');
const proxyHops = Number(process.env.TRUST_PROXY ?? 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 3)
  throw new Error('TRUST_PROXY 仅允许 0–3，表示受控反向代理的跳数。');
const app = await createApp({
  dbPath: process.env.DATABASE_PATH ?? resolve('data/wuyin.sqlite'),
  origins: localPlay
    ? [localUrl]
    : process.env.APP_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
  secureCookies: production && !publicHttpTest,
  staticDir: production || localPlay ? resolve('dist') : undefined,
  logger: !localPlay,
  trustProxy: proxyHops || false,
});
if (publicHttpTest)
  console.warn(
    '已显式启用未加密的公网 HTTP 测试入口。仅使用独立测试密码；接入 HTTPS 后移除 ALLOW_INSECURE_PUBLIC_TEST。',
  );
const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
try {
  await app.listen({ host, port });
} catch (error) {
  await app.close();
  if (!localPlay || (error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
  const [homepage, health] = await Promise.all([
    fetch(localUrl, { signal: AbortSignal.timeout(2000) }).then((r) => r.text()),
    fetch(`${localUrl}/api/health`, { signal: AbortSignal.timeout(2000) })
      .then((r) => r.json())
      .catch(() => null),
  ]);
  if (!homepage.includes('<title>雾隐 · MIST CONTINENT</title>') || health?.ok !== true)
    throw new Error('5173 端口被其他程序占用，请释放端口后重新启动。');
}
if (localPlay) {
  console.log(`雾隐已就绪，请用浏览器打开 ${localUrl}/`);
  if (lanPlay)
    console.log('主机和好友都请打开上面同一个地址，用各自的账号登录，通过传送阵创建或加入队伍。');
  if (process.platform === 'win32' && process.argv.includes('--open'))
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', localUrl], (err) => {
      if (err) console.error('浏览器未能自动打开，请点击上方地址。');
    });
}
