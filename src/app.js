import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createApp({ databasePath = './data/tasks.db', logger = console.log } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`);
  const task = row => row && ({ id: row.id, title: row.title, completed: Boolean(row.completed), createdAt: row.created_at });
  const find = id => task(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  const server = createServer(async (req, res) => {
    const start = Date.now();
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => logger(JSON.stringify({ requestId, method: req.method, path: req.url?.split('?')[0], status: res.statusCode, durationMs: Date.now() - start })));
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    const fail = (status, message) => Object.assign(new Error(message), { status });
    const body = async () => {
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw fail(415, 'Use Content-Type: application/json');
      let raw = '';
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) throw fail(413, 'Corpo excede 16 KB');
        raw += chunk.toString();
      }
      let value;
      try { value = JSON.parse(raw); } catch { throw fail(400, 'JSON invalido'); }
      if (!value || Array.isArray(value) || typeof value !== 'object') throw fail(400, 'Envie um objeto JSON');
      return value;
    };
    const validateTitle = title => {
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) throw fail(400, 'title deve conter entre 1 e 120 caracteres');
      return title.trim();
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/') return send(200, { name: 'T2GCS API', version: '1.0.0', endpoints: ['GET /health', 'GET /tasks', 'GET /tasks/:id', 'POST /tasks', 'PATCH /tasks/:id', 'DELETE /tasks/:id'] });
      if (req.method === 'GET' && path === '/health') {
        db.prepare('SELECT 1').get();
        return send(200, { status: 'ok', database: 'ok', uptime: Math.floor(process.uptime()) });
      }
      if (path === '/tasks' && req.method === 'GET') {
        const filter = url.searchParams.get('completed');
        if (filter !== null && !['true', 'false'].includes(filter)) throw fail(400, 'completed deve ser true ou false');
        const rows = filter === null ? db.prepare('SELECT * FROM tasks ORDER BY created_at DESC, id').all() : db.prepare('SELECT * FROM tasks WHERE completed = ? ORDER BY created_at DESC, id').all(Number(filter === 'true'));
        return send(200, { data: rows.map(task), total: rows.length });
      }
      if (path === '/tasks' && req.method === 'POST') {
        const input = await body();
        if (Object.keys(input).some(key => key !== 'title')) throw fail(400, 'Campo permitido: title');
        const title = validateTitle(input.title);
        const id = randomUUID();
        db.prepare('INSERT INTO tasks (id, title, created_at) VALUES (?, ?, ?)').run(id, title, new Date().toISOString());
        res.setHeader('Location', `/tasks/${id}`);
        return send(201, find(id));
      }
      const match = path.match(/^\/tasks\/([^/]+)$/);
      if (match && ['GET', 'PATCH', 'DELETE'].includes(req.method)) {
        const existing = find(match[1]);
        if (!existing) throw fail(404, 'Tarefa nao encontrada');
        if (req.method === 'GET') return send(200, existing);
        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM tasks WHERE id = ?').run(existing.id);
          return send(204);
        }
        const input = await body();
        if (!Object.keys(input).length || Object.keys(input).some(key => !['title', 'completed'].includes(key))) throw fail(400, 'Envie title e/ou completed');
        const title = 'title' in input ? validateTitle(input.title) : existing.title;
        if ('completed' in input && typeof input.completed !== 'boolean') throw fail(400, 'completed deve ser booleano');
        db.prepare('UPDATE tasks SET title = ?, completed = ? WHERE id = ?').run(title, Number(input.completed ?? existing.completed), existing.id);
        return send(200, find(existing.id));
      }
      return send(404, { error: 'Rota nao encontrada', requestId });
    } catch (error) {
      if (!error.status) logger(JSON.stringify({ requestId, error: error.message }));
      if (!res.headersSent && !res.destroyed) send(error.status || 500, { error: error.status ? error.message : 'Erro interno', requestId });
    }
  });
  server.on('close', () => db.close());
  return server;
}
