const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let data, page = location.hash.slice(1) || 'home', query = '', section = 'All';
const icons = { Life: '♡', Media: '♫', Games: '✦', 'Work & websites': '↗', Publishing: '✎', 'Projects in progress': '◒', Other: '◎' };
const guide = [
  { title: 'Make this feel like home', chat: 'Personal setup', body: 'Open Apps → Organise. Add your usual destinations, move them into sections and choose favourites for Home. Each address lives in one place. Your changes are saved on your server and appear on every device.', action: 'Open Apps', href: '#apps' },
  { title: 'Add LifeOS to your iPhone', chat: 'Personal setup', body: 'Open your HTTPS LifeOS address in Safari. Tap Share, then Add to Home Screen. Open the new icon to use the full-screen view. HTTPS and a trusted certificate are required for secure remote access.' },
  { title: 'Find your way back', chat: 'Everyday use', body: 'Links open normally. Use Safari’s Back button, or the browser sheet’s Done control when available from the Home Screen app. If a link hands off to another native app, return using the app switcher or tap your LifeOS icon.' },
  { title: 'Bring in a weekly journal', chat: 'Reflection', body: 'Save a note called YYYY-MM-DD - Title.md in your journal folder. Entries appear newest first after Refresh. You can point LifeOS at an existing Obsidian folder. LifeOS reads the files; it does not create another schedule or overwrite your notes.' },
  { title: 'See useful numbers at a glance', chat: 'System & costs', body: 'An optional adapter can write data/metrics.json with a value, source and checked time for each card. Out-of-date values are hidden. Missing data is never treated as zero. Keep provider passwords and tokens in the adapter’s own private environment.' },
  { title: 'Work with your own agent', chat: 'Projects & planning', body: 'Use separate chats for everyday life, projects, media and system maintenance. Tell your agent what outcome you want and link to the relevant source. Agents are optional: this starter does not install a gateway, send messages or grant approval to execute work.' },
  { title: 'Keep a recovery copy', chat: 'System & costs', body: 'More → Export downloads your links and settings. Keep that file private. Back up your server data and journal separately. Before upgrading, stop LifeOS and copy its data folder; restore into a stopped instance and check your links.' }
];
function notify(message) { $('#status').textContent = message; setTimeout(() => { $('#status').textContent = ''; }, 6000); }
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const value = await response.json();
  if (!response.ok) { if (response.status === 401) login(); throw new Error(value.error || 'Something went wrong. Try again.'); }
  return value;
}
async function load() {
  try { data = await request('/api/dashboard'); render(); }
  catch (error) { if (!$('#login-form')) $('#main').innerHTML = `<section class="hero"><h1>Couldn’t reach your LifeOS</h1><p>${escape(error.message)}</p><button id="retry">Try again</button></section>`; $('#retry')?.addEventListener('click', load); }
}
async function save(state) {
  const result = await request('/api/dashboard', { method: 'PUT', headers: { 'If-Match': data.revision }, body: JSON.stringify(state) });
  data.state = result.state; data.revision = result.revision;
}
function date(value) { return new Date(value.length === 10 ? value + 'T12:00:00Z' : value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: data?.state.timezone || 'Europe/London' }); }
function tile(link) { return `<a class="tile" href="${escape(link.url)}"><span class="app-icon tone-${data.sections.indexOf(link.section)}" aria-hidden="true">${icons[link.section]}</span><span><strong>${escape(link.label)}</strong><small>${escape(link.detail || link.section)}</small></span><span class="arrow" aria-hidden="true">↗</span></a>`; }
function tiles(links) { return `<div class="tiles">${links.map(tile).join('')}</div>`; }
function heading(kicker, title, description = '') { return `<div class="page-heading"><p class="eyebrow">${kicker}</p><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</div>`; }
function empty(title, body) { return `<div class="empty"><h2>${title}</h2><p>${body}</p></div>`; }
function metricCards() {
  return data.metrics.length ? `<div class="metrics">${data.metrics.map(metric => `<article class="metric"><p>${escape(metric.label)}</p><strong>${metric.stale ? 'Needs an update' : escape(metric.value)}</strong><small>${metric.stale ? 'Last reading is out of date' : escape(metric.note)}</small><span class="source">${escape(metric.source)} · ${escape(date(metric.checkedAt))}</span></article>`).join('')}</div>` : `<a href="#guide" class="setup-note"><span aria-hidden="true">◷</span><span><strong>Your numbers, when you’re ready</strong><small>Connect a data feed for costs, allowances or service health.</small></span><span aria-hidden="true">→</span></a>`;
}
function render() {
  if (!data) return;
  $('#brand').textContent = data.state.name; document.title = `${data.state.name} · LifeOS`;
  document.querySelectorAll('.tabs a').forEach(link => { if (link.dataset.page === (page === 'journal' ? 'more' : page)) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  const visible = data.state.links.filter(link => !link.hidden);
  let content = data.demo ? '<div class="notice">Demo · fictional data and example destinations. Changes are disabled.</div>' : '';
  content += data.notices.map(notice => `<div class="notice">${escape(notice)}</div>`).join('');
  if (!data.state.onboarded) {
    content += heading('A PLACE FOR YOUR EVERYDAY', 'Welcome home.', 'A few useful links. The numbers that matter. A little more room to think.') + `<form id="setup" class="panel"><label>What would you like to call it?<input name="name" maxlength="60" value="My LifeOS" required></label><label>Your timezone<input name="timezone" value="${escape(Intl.DateTimeFormat().resolvedOptions().timeZone)}" required></label><button>Make it mine</button><p class="muted">Start with your own links. No accounts or AI subscriptions needed.</p></form>`;
  } else if (page === 'home') {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: data.state.timezone }).format(new Date()));
    content += heading(escape(new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: data.state.timezone }).format(new Date())), hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.', 'Your life, a little more together.');
    content += metricCards() + '<div class="section-head"><h2>Within reach</h2><a href="#apps">All apps →</a></div>';
    const favourites = visible.filter(link => link.favourite);
    content += favourites.length ? tiles(favourites) : empty('Your everyday favourites', 'Add a link in Apps and star it to keep it here.');
    content += `<div class="feature-grid"><a class="feature lavender" href="#journal"><span class="eyebrow">A MOMENT TO REFLECT</span><h2>Your story, week by week.</h2><p>${data.journal.length ? escape(data.journal[0].title) : 'Keep your weekly notes together, newest first.'}</p><span>Open journal →</span></a><a class="feature peach" href="#guide"><span class="eyebrow">A HELPING HAND</span><h2>What can I do here?</h2><p>Find your way around and bring your own agent.</p><span>Explore the guide →</span></a></div>`;
  } else if (page === 'apps' || page === 'life') {
    content += heading(page === 'life' ? 'THE EVERYDAY' : 'EVERYTHING HAS A PLACE', page === 'life' ? 'A little easier living.' : 'Your apps & projects.', page === 'life' ? 'Home, food, clothes and the things that keep life moving.' : 'The useful, the joyful, and the things still taking shape.');
    content += `<div class="toolbar"><input id="search" type="search" aria-label="Search apps" placeholder="Find something…" value="${escape(query)}"><button id="organise" ${data.demo ? 'disabled' : ''}>Organise</button></div>`;
    if (page === 'apps') content += `<div class="filters" aria-label="Filter sections">${['All', ...data.sections].map(name => `<button data-section="${escape(name)}" aria-pressed="${section === name}">${escape(name)}</button>`).join('')}</div>`;
    content += '<div id="app-results"></div>';
  } else if (page === 'journal') {
    content += heading('THE WEEKS ADD UP', 'Your journal.', 'A dated diary, with the newest entry at the top.') + '<button id="refresh" class="quiet">Refresh entries</button>';
    content += data.journal.length ? data.journal.map(entry => `<article class="journal panel"><p class="eyebrow">${escape(date(entry.date))}</p><h2>${escape(entry.title)}</h2><div class="journal-body">${escape(entry.body)}</div></article>`).join('') : empty('Your first chapter is waiting', 'Save a dated Markdown note in your journal folder. The guide explains how.');
  } else if (page === 'guide') {
    content += heading('A LITTLE GUIDANCE', 'Find your way.', 'Search how-tos, or find the right place to ask your agent.') + '<input id="guide-search" type="search" aria-label="Search guide" placeholder="Try “iPhone”, “journal” or “agent”…"><div id="guide-results"></div>';
  } else {
    content += heading('MAKE SPACE', 'Yours to organise.', 'Your setup, your data, your pace.') + `<div class="tiles"><a class="tile" href="#journal"><span class="app-icon">✎</span><span><strong>Dev journal</strong><small>Your dated weekly entries</small></span><span>→</span></a><a class="tile" href="#guide"><span class="app-icon">◎</span><span><strong>Help & setup</strong><small>Phone access, data feeds and backups</small></span><span>→</span></a></div><section class="panel"><h2>Personalise</h2><form id="settings"><label>Dashboard name<input name="name" value="${escape(data.state.name)}" maxlength="60" required></label><label>Timezone<input name="timezone" value="${escape(data.state.timezone)}" required></label><button ${data.demo ? 'disabled' : ''}>Save settings</button></form></section><section class="panel"><h2>Keep a copy</h2><p>Export your links and settings. Your journal and data feeds stay in their own files.</p><div class="actions"><button id="export">Export settings</button><label class="button secondary">Import settings<input id="import" type="file" accept="application/json" ${data.demo ? 'disabled' : ''}></label></div><p class="muted">Exports can contain private addresses. Keep them somewhere safe.</p></section>${data.passwordEnabled ? '<button id="logout" class="quiet">Sign out</button>' : ''}<p class="footnote">Morpheos LifeOS · 0.1.0 · Your server, your data.</p>`;
  }
  $('#main').innerHTML = content; bind();
  if (page === 'apps' || page === 'life') renderApps();
  if (page === 'guide') renderGuide('');
}
function renderApps() {
  const links = data.state.links.filter(link => !link.hidden && (page !== 'life' || link.section === 'Life') && (page !== 'apps' || section === 'All' || link.section === section) && `${link.label} ${link.detail} ${link.section}`.toLowerCase().includes(query.toLowerCase()));
  $('#app-results').innerHTML = links.length ? data.sections.map(name => { const group = links.filter(link => link.section === name); return group.length ? `<section class="app-section"><h2>${escape(name)} <span class="count">${group.length}</span></h2>${tiles(group)}</section>` : ''; }).join('') : empty('Nothing here yet', query ? 'Try a different search.' : 'Open Organise to add your first link.');
}
function renderGuide(search) {
  const entries = guide.filter(item => `${item.title} ${item.body} ${item.chat}`.toLowerCase().includes(search.toLowerCase()));
  $('#guide-results').innerHTML = entries.length ? entries.map(item => `<details class="panel"><summary>${escape(item.title)}</summary><p class="eyebrow">SUGGESTED CHAT · ${escape(item.chat)}</p><p>${escape(item.body)}</p>${item.href ? `<a href="${item.href}">${escape(item.action)} →</a>` : ''}</details>`).join('') : empty('No matching guide', 'Try a shorter phrase.');
}
function bind() {
  $('#search')?.addEventListener('input', event => { query = event.target.value; renderApps(); });
  $('#guide-search')?.addEventListener('input', event => renderGuide(event.target.value));
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => { section = button.dataset.section; render(); }));
  $('#organise')?.addEventListener('click', openEditor);
  $('#refresh')?.addEventListener('click', load);
  for (const id of ['setup', 'settings']) $(`#${id}`)?.addEventListener('submit', async event => { event.preventDefault(); const values = new FormData(event.target); try { await save({ ...data.state, name: values.get('name'), timezone: values.get('timezone'), onboarded: true }); render(); notify('Saved.'); } catch (error) { notify(error.message); } });
  $('#export')?.addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(data.state, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'lifeos-settings.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  $('#import')?.addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 100_000) throw new Error('That file is too large.'); const value = JSON.parse(await file.text()); if (!confirm('Replace your current settings with this file? A server backup will be kept.')) return; await save(value); render(); notify('Settings imported.'); } catch (error) { notify(error.message); } });
  $('#logout')?.addEventListener('click', async () => { await request('/api/logout', { method: 'POST', body: '{}' }); data = null; login(); });
}
function openEditor() {
  let draft = structuredClone(data.state); const dialog = $('#editor');
  function draw() {
    dialog.innerHTML = `<form id="links-form"><div class="section-head"><h2 id="editor-title">Organise your apps</h2><button type="button" id="cancel" class="quiet">Cancel</button></div><p class="muted">One home for each link. Star your everyday favourites.</p><div class="editor-rows">${draft.links.map((link, index) => `<fieldset data-row="${index}"><legend>${escape(link.label || 'New link')}</legend><label>Name<input data-field="label" value="${escape(link.label)}" maxlength="80" required></label><label>Address<input data-field="url" type="url" value="${escape(link.url)}" required placeholder="https://"></label><label>Note<input data-field="detail" value="${escape(link.detail)}" maxlength="180"></label><label>Section<select data-field="section">${data.sections.map(name => `<option ${link.section === name ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select></label><div class="checks"><label><input type="checkbox" data-field="favourite" ${link.favourite ? 'checked' : ''}>Favourite</label><label><input type="checkbox" data-field="hidden" ${link.hidden ? 'checked' : ''}>Hidden</label></div><div class="actions"><button type="button" data-up="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escape(link.label)} up">↑</button><button type="button" data-down="${index}" ${index === draft.links.length - 1 ? 'disabled' : ''} aria-label="Move ${escape(link.label)} down">↓</button><button type="button" data-delete="${index}" class="quiet">Remove</button></div></fieldset>`).join('')}</div><p id="editor-error" class="error" role="alert"></p><div class="dialog-footer"><button type="button" id="add" class="secondary">Add a link</button><button id="save-links">Save changes</button></div></form>`;
    const capture = () => { dialog.querySelectorAll('[data-row]').forEach(row => row.querySelectorAll('[data-field]').forEach(input => { draft.links[Number(row.dataset.row)][input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value; })); };
    $('#cancel').onclick = () => dialog.close();
    $('#add').onclick = () => { capture(); draft.links.push({ id: crypto.randomUUID(), label: '', url: '', detail: '', section: page === 'life' ? 'Life' : 'Other', favourite: true, hidden: false }); draw(); dialog.querySelector('fieldset:last-child input').focus(); };
    for (const direction of ['up', 'down']) dialog.querySelectorAll(`[data-${direction}]`).forEach(button => button.onclick = () => { capture(); const index = Number(button.dataset[direction]), next = index + (direction === 'up' ? -1 : 1); [draft.links[index], draft.links[next]] = [draft.links[next], draft.links[index]]; draw(); });
    dialog.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => { capture(); draft.links.splice(Number(button.dataset.delete), 1); draw(); });
    $('#links-form').onsubmit = async event => { event.preventDefault(); capture(); $('#save-links').disabled = true; try { await save(draft); dialog.close(); render(); notify('Your apps are organised.'); } catch (error) { $('#editor-error').textContent = error.message; $('#save-links').disabled = false; } };
  }
  draw(); dialog.showModal();
}
function login() {
  $('#main').innerHTML = `${heading('YOUR PRIVATE SPACE', 'Welcome back.', 'Sign in for the next 24 hours.')}<form id="login-form" class="panel"><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p class="error" id="login-error" role="alert"></p><button>Open LifeOS</button></form>`;
  $('#login-form').onsubmit = async event => { event.preventDefault(); const values = new FormData(event.target); try { await request('/api/login', { method: 'POST', body: JSON.stringify({ password: values.get('password') }) }); await load(); } catch (error) { $('#login-error').textContent = error.message; } };
}
let theme = 'system'; try { theme = localStorage.getItem('lifeos-theme') || 'system'; } catch {}
function applyTheme() { document.documentElement.dataset.theme = theme; $('#theme').setAttribute('aria-label', `Colour theme: ${theme}. Change theme`); }
$('#theme').onclick = () => { theme = ['system', 'light', 'dark'][(['system', 'light', 'dark'].indexOf(theme) + 1) % 3]; try { localStorage.setItem('lifeos-theme', theme); } catch {} applyTheme(); notify(`Theme: ${theme}`); }; applyTheme();
window.addEventListener('hashchange', () => { page = location.hash.slice(1) || 'home'; query = ''; section = 'All'; if (data) render(); $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); });
load();
