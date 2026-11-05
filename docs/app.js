(() => {
  'use strict';
  const KEY = 't2gcs.tasks.v1';
  const $ = selector => document.querySelector(selector);
  let tasks = [];
  let filter = 'all';
  let storageReady = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const value = JSON.parse(raw);
      if (!Array.isArray(value) || !value.every(t => t && typeof t.id === 'string' && typeof t.title === 'string' && t.title.trim() && t.title.length <= 120 && typeof t.completed === 'boolean') || new Set(value.map(t => t.id)).size !== value.length) throw new Error('Invalid data');
      tasks = value;
    }
  } catch {
    storageReady = false;
    $('#message').textContent = 'Não foi possível carregar os dados salvos. Os dados existentes não serão sobrescritos. Verifique o armazenamento do navegador.';
  }
  function save(next) {
    if (!storageReady) return false;
    try { localStorage.setItem(KEY, JSON.stringify(next)); tasks = next; $('#message').textContent = ''; render(); return true; }
    catch { $('#message').textContent = 'Não foi possível salvar. Verifique se o armazenamento do navegador está disponível.'; return false; }
  }
  function render() {
    const done = tasks.filter(t => t.completed).length;
    $('#counter').textContent = `${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}`;
    $('#summary').textContent = tasks.length ? `${done} de ${tasks.length} concluídas. ${done === tasks.length ? 'Tudo em dia!' : 'Você está no caminho.'}` : 'Tudo pronto para começar.';
    $('#clear').disabled = !done || !storageReady;
    $('#task-form button').disabled = !storageReady;
    const visible = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.completed : !t.completed));
    $('#tasks').replaceChildren();
    for (const t of visible) {
      const li = document.createElement('li');
      li.className = `task${t.completed ? ' done' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = t.completed; checkbox.id = `task-${t.id}`; checkbox.disabled = !storageReady;
      checkbox.addEventListener('change', () => {
        if (!save(tasks.map(item => item.id === t.id ? { ...item, completed: checkbox.checked } : item))) checkbox.checked = t.completed;
        const replacement = document.getElementById(checkbox.id);
        if (replacement) replacement.focus(); else $(`[data-filter="${filter}"]`).focus();
      });
      const label = document.createElement('label');
      label.htmlFor = checkbox.id; label.textContent = t.title;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'delete'; remove.textContent = '×'; remove.disabled = !storageReady;
      remove.setAttribute('aria-label', `Excluir tarefa: ${t.title}`);
      remove.addEventListener('click', () => { if (save(tasks.filter(item => item.id !== t.id))) $('#title').focus(); });
      li.append(checkbox, label, remove); $('#tasks').append(li);
    }
    $('#empty').hidden = visible.length > 0;
    $('#empty h3').textContent = tasks.length ? 'Nenhuma tarefa por aqui' : 'Sua próxima conquista começa aqui';
    $('#empty p').textContent = tasks.length ? 'Experimente outro filtro para ver suas tarefas.' : 'Adicione sua primeira tarefa no campo acima.';
  }
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#title').value.trim();
    if (!title || title.length > 120) { $('#message').textContent = 'Escreva uma tarefa com 1 a 120 caracteres.'; return; }
    if (save([{ id: crypto.randomUUID(), title, completed: false }, ...tasks])) {
      $('#title').value = ''; $('#title').focus();
      if (filter === 'done') document.querySelector('[data-filter="all"]').click();
    }
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));
  $('#clear').addEventListener('click', () => {
    if (confirm('Excluir todas as tarefas concluídas?')) { save(tasks.filter(t => !t.completed)); $('#title').focus(); }
  });
  render();
})();
