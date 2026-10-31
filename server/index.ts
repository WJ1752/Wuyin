import { resolve } from 'node:path';
import { createApp } from './app';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.APP_ORIGINS)
  throw new Error('生产环境必须配置 APP_ORIGINS，例如 https://game.example.com。');
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 配置无效。');
const proxyHops = Number(process.env.TRUST_PROXY ?? 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 3)
  throw new Error('TRUST_PROXY 仅允许 0–3，表示受控反向代理的跳数。');
const app = await createApp({
  dbPath: process.env.DATABASE_PATH ?? resolve('data/wuyin.sqlite'),
  origins: process.env.APP_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  secureCookies: production,
  staticDir: production ? resolve('dist') : undefined,
  logger: true,
  trustProxy: proxyHops || false,
});
const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port });
