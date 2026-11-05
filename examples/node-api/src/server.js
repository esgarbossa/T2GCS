import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT invalida');
const server = createApp({ databasePath: process.env.DATABASE_PATH || './data/tasks.db' });
server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'started', port })));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    console.log(JSON.stringify({ event: 'shutdown', signal }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
