(function () {
  const state = {
    tags: [],
    filters: { source: '', tag: '' },
    leads: [],
  };

  const leadsBody = document.getElementById('leadsBody');
  const filterSource = document.getElementById('filterSource');
  const filterTag = document.getElementById('filterTag');
  const addLeadBtn = document.getElementById('addLeadBtn');
  const addLeadDialog = document.getElementById('addLeadDialog');
  const addLeadForm = document.getElementById('addLeadForm');
  const addLeadCloseBtn = document.getElementById('addLeadCloseBtn');
  const alError = document.getElementById('alError');
  const logoutBtn = document.getElementById('logoutBtn');

  const leadDialog = document.getElementById('leadDialog');
  const ldName = document.getElementById('ldName');
  const ldContact = document.getElementById('ldContact');
  const ldRequest = document.getElementById('ldRequest');
  const ldSource = document.getElementById('ldSource');
  const ldCreatedAt = document.getElementById('ldCreatedAt');
  const ldStatus = document.getElementById('ldStatus');
  const ldTags = document.getElementById('ldTags');
  const ldExistingTagSelect = document.getElementById('ldExistingTagSelect');
  const ldAssignExistingTagBtn = document.getElementById('ldAssignExistingTagBtn');
  const ldNewTagInput = document.getElementById('ldNewTagInput');
  const ldCreateTagBtn = document.getElementById('ldCreateTagBtn');
  const ldMessages = document.getElementById('ldMessages');

  let currentLeadId = null;

  const SOURCE_LABELS = { bot: 'Бот', manual: 'Вручную', telegram: 'Telegram' };
  const STATUS_LABELS = { new: 'Новый', in_progress: 'В работе', done: 'Готово' };

  // Единая точка похода к API: при 401 (сессия истекла/не было) уводим на логин.
  async function api(path, options) {
    const res = await fetch(path, options);
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('unauthorized');
    }
    return res;
  }

  async function checkAuth() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  }

  // created_at из SQLite — 'YYYY-MM-DD HH:MM:SS' в UTC (datetime('now')).
  function formatDate(value) {
    if (!value) return '';
    const iso = value.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function makeCell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  // Везде ниже — textContent, никогда innerHTML с данными от пользователя/лида:
  // экранирование от XSS получаем автоматически, без отдельной escape-функции.
  function renderLeadsTable() {
    clearChildren(leadsBody);
    if (state.leads.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'empty';
      td.textContent = 'Пока нет лидов';
      tr.appendChild(td);
      leadsBody.appendChild(tr);
      return;
    }

    for (const lead of state.leads) {
      const tr = document.createElement('tr');
      tr.className = 'lead-row';
      tr.tabIndex = 0;

      tr.appendChild(makeCell(lead.name));
      tr.appendChild(makeCell(lead.contact));
      tr.appendChild(makeCell(lead.request));

      const sourceTd = document.createElement('td');
      const sourceBadge = document.createElement('span');
      sourceBadge.className = 'badge badge-source-' + lead.source;
      sourceBadge.textContent = SOURCE_LABELS[lead.source] || lead.source;
      sourceTd.appendChild(sourceBadge);
      tr.appendChild(sourceTd);

      const tagsTd = document.createElement('td');
      tagsTd.className = 'tags-cell';
      for (const tag of lead.tags) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = tag.name;
        tagsTd.appendChild(chip);
      }
      tr.appendChild(tagsTd);

      const statusTd = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge badge-status-' + lead.status;
      statusBadge.textContent = STATUS_LABELS[lead.status] || lead.status;
      statusTd.appendChild(statusBadge);
      tr.appendChild(statusTd);

      tr.appendChild(makeCell(formatDate(lead.createdAt)));

      tr.addEventListener('click', () => openLeadDialog(lead.id));
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') openLeadDialog(lead.id);
      });

      leadsBody.appendChild(tr);
    }
  }

  async function loadTagsIntoFilters() {
    const res = await api('/api/tags');
    const data = await res.json();
    state.tags = data.tags;

    const prevValue = filterTag.value;
    clearChildren(filterTag);
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'Все';
    filterTag.appendChild(allOpt);
    for (const tag of state.tags) {
      const opt = document.createElement('option');
      opt.value = String(tag.id);
      opt.textContent = tag.name;
      filterTag.appendChild(opt);
    }
    if ([...filterTag.options].some((o) => o.value === prevValue)) {
      filterTag.value = prevValue;
    }
  }

  async function loadLeads() {
    const params = new URLSearchParams();
    if (state.filters.source) params.set('source', state.filters.source);
    if (state.filters.tag) params.set('tag', state.filters.tag);
    const res = await api('/api/leads?' + params.toString());
    const data = await res.json();
    state.leads = data.leads;
    renderLeadsTable();
  }

  function populateExistingTagSelect(assignedTagIds) {
    clearChildren(ldExistingTagSelect);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— выбрать тег —';
    ldExistingTagSelect.appendChild(placeholder);
    for (const tag of state.tags) {
      if (assignedTagIds.has(tag.id)) continue;
      const opt = document.createElement('option');
      opt.value = String(tag.id);
      opt.textContent = tag.name;
      ldExistingTagSelect.appendChild(opt);
    }
  }

  function renderLeadTags(tags) {
    clearChildren(ldTags);
    if (tags.length === 0) {
      const span = document.createElement('span');
      span.className = 'muted';
      span.textContent = 'Нет тегов';
      ldTags.appendChild(span);
    }
    for (const tag of tags) {
      const chip = document.createElement('span');
      chip.className = 'chip chip-removable';
      const label = document.createElement('span');
      label.textContent = tag.name;
      chip.appendChild(label);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-remove';
      removeBtn.setAttribute('aria-label', 'Снять тег ' + tag.name);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async () => {
        await api(`/api/leads/${currentLeadId}/tags/${tag.id}`, { method: 'DELETE' });
        await openLeadDialog(currentLeadId, { keepOpen: true });
        await loadLeads();
      });
      chip.appendChild(removeBtn);
      ldTags.appendChild(chip);
    }
    populateExistingTagSelect(new Set(tags.map((t) => t.id)));
  }

  function renderMessages(messages) {
    clearChildren(ldMessages);
    if (messages.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Сообщений пока нет';
      ldMessages.appendChild(li);
      return;
    }
    for (const msg of messages) {
      const li = document.createElement('li');
      const time = document.createElement('span');
      time.className = 'message-time';
      time.textContent = formatDate(msg.createdAt);
      const text = document.createElement('span');
      text.className = 'message-text';
      text.textContent = msg.text;
      li.appendChild(time);
      li.appendChild(text);
      ldMessages.appendChild(li);
    }
  }

  async function openLeadDialog(id, opts) {
    const res = await api('/api/leads/' + id);
    const data = await res.json();
    currentLeadId = id;

    ldName.textContent = data.lead.name;
    ldContact.textContent = data.lead.contact;
    ldRequest.textContent = data.lead.request;
    ldSource.textContent = SOURCE_LABELS[data.lead.source] || data.lead.source;
    ldCreatedAt.textContent = formatDate(data.lead.createdAt);
    ldStatus.value = data.lead.status;

    renderLeadTags(data.lead.tags);
    renderMessages(data.messages);

    if (!opts || !opts.keepOpen) {
      if (!leadDialog.open) leadDialog.showModal();
    }
  }

  ldStatus.addEventListener('change', async () => {
    await api(`/api/leads/${currentLeadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ldStatus.value }),
    });
    await loadLeads();
  });

  ldAssignExistingTagBtn.addEventListener('click', async () => {
    const tagId = ldExistingTagSelect.value;
    if (!tagId) return;
    await api(`/api/leads/${currentLeadId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: Number(tagId) }),
    });
    await openLeadDialog(currentLeadId, { keepOpen: true });
    await loadLeads();
  });

  ldCreateTagBtn.addEventListener('click', async () => {
    const name = ldNewTagInput.value.trim();
    if (!name) return;
    const res = await api('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.status === 409) {
      alert('Такой тег уже существует');
      return;
    }
    const data = await res.json();
    ldNewTagInput.value = '';
    await loadTagsIntoFilters();
    await api(`/api/leads/${currentLeadId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: data.tag.id }),
    });
    await openLeadDialog(currentLeadId, { keepOpen: true });
    await loadLeads();
  });

  filterSource.addEventListener('change', () => {
    state.filters.source = filterSource.value;
    loadLeads();
  });
  filterTag.addEventListener('change', () => {
    state.filters.tag = filterTag.value;
    loadLeads();
  });

  addLeadBtn.addEventListener('click', () => {
    addLeadForm.reset();
    alError.textContent = '';
    addLeadDialog.showModal();
  });
  addLeadCloseBtn.addEventListener('click', () => addLeadDialog.close());

  addLeadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    alError.textContent = '';
    const name = document.getElementById('alName').value.trim();
    const contact = document.getElementById('alContact').value.trim();
    const request = document.getElementById('alRequest').value.trim();

    const res = await api('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, request }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alError.textContent = err.error || 'Ошибка сохранения';
      return;
    }
    addLeadDialog.close();
    await loadLeads();
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  async function init() {
    const ok = await checkAuth();
    if (!ok) return;
    await loadTagsIntoFilters();
    await loadLeads();
    setInterval(loadLeads, 7000);
  }

  init();
})();
