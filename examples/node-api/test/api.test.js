import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

async function start(databasePath = ':memory:') {
  const server = createApp({ databasePath, logger: () => {} });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
const stop = server => new Promise(resolve => server.close(resolve));
const json = (method, value) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

test('CRUD completo, filtro e health check', async () => {
  const { server, url } = await start();
  try {
    assert.equal((await (await fetch(`${url}/health`)).json()).database, 'ok');
    const created = await fetch(`${url}/tasks`, json('POST', { title: ' Apresentar deploy ' }));
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal(task.title, 'Apresentar deploy');
    assert.equal(task.completed, false);
    assert.equal(created.headers.get('location'), `/tasks/${task.id}`);
    assert.equal((await fetch(`${url}/tasks/${task.id}`)).status, 200);
    const updated = await fetch(`${url}/tasks/${task.id}`, json('PATCH', { completed: true }));
    assert.equal((await updated.json()).completed, true);
    assert.equal((await (await fetch(`${url}/tasks?completed=true`)).json()).total, 1);
    assert.equal((await (await fetch(`${url}/tasks?completed=false`)).json()).total, 0);
    assert.equal((await fetch(`${url}/tasks/${task.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${url}/tasks/${task.id}`)).status, 404);
  } finally { await stop(server); }
});

test('rejeita dados invalidos e preserva o servidor', async () => {
  const { server, url } = await start();
  try {
    for (const value of [{}, { title: ' ' }, { title: 'x'.repeat(121) }, [], null, { title: 'ok', unexpected: true }]) {
      assert.equal((await fetch(`${url}/tasks`, json('POST', value))).status, 400);
    }
    assert.equal((await fetch(`${url}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await fetch(`${url}/tasks`, { method: 'POST', body: '{}' })).status, 415);
    assert.equal((await fetch(`${url}/tasks`, json('POST', { title: 'x'.repeat(17000) }))).status, 413);
    assert.equal((await fetch(`${url}/tasks?completed=invalid`)).status, 400);
    const task = await (await fetch(`${url}/tasks`, json('POST', { title: 'teste' }))).json();
    assert.equal((await fetch(`${url}/tasks/${task.id}`, json('PATCH', { completed: 'true' }))).status, 400);
    assert.equal((await fetch(`${url}/health`)).status, 200);
  } finally { await stop(server); }
});

test('persiste os dados depois de reiniciar a aplicacao', async () => {
  const dir = mkdtempSync(join(tmpdir(), 't2gcs-'));
  const path = join(dir, 'tasks.db');
  let app = await start(path);
  try {
    const task = await (await fetch(`${app.url}/tasks`, json('POST', { title: 'Persistente' }))).json();
    await stop(app.server);
    app = await start(path);
    assert.equal((await (await fetch(`${app.url}/tasks/${task.id}`)).json()).title, 'Persistente');
  } finally { await stop(app.server); rmSync(dir, { recursive: true, force: true }); }
});
