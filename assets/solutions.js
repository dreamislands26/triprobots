(() => {
  'use strict';
  const cards = document.getElementById('solutionCards');
  if (!cards) return;
  const filters = document.querySelector('.solution-filters');
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (value, max = 1e9) => Math.min(max, Math.max(0, Number(value) || 0));
  function calculate(s) {
    const monthly = number(s.ops) * (s.per === 'day' ? 21.5 : 1);
    const manualHours = s.per === 'hours' ? monthly : monthly * number(s.min) / 60;
    const saved = manualHours * number(s.auto, 100) / 100;
    const saving = saved * number(s.rate);
    return { saved, annual: saving * 12, payback: saving > 0 ? (s.audit + s.impl) / saving : null };
  }
  function result(card, s) {
    const r = calculate(s);
    card.querySelector('[data-saved]').textContent = fmt(r.saved) + ' ч';
    card.querySelector('[data-annual]').textContent = fmt(Math.round(r.annual / 1000)) + ' тыс. ₽';
    card.querySelector('[data-payback]').textContent = r.payback === null ? 'Не окупается' : r.payback.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' мес';
  }
  fetch('/data/solutions.json').then(r => {
    if (!r.ok) throw new Error('solutions_unavailable');
    return r.json();
  }).then(solutions => {
    const buttons = [{ tag: 'Все', slug: '' }, ...solutions];
    filters.innerHTML = buttons.map(s => `<button type="button" data-filter="${esc(s.slug)}" aria-pressed="false">${esc(s.tag)}</button>`).join('');
    cards.innerHTML = solutions.map(s => {
      const field = (key, label, max = 1e9) => `<label for="${s.id}-${key}"><span>${esc(label)}</span><input id="${s.id}-${key}" type="number" inputmode="decimal" min="0" max="${max}" step="any" value="${s[key]}" data-key="${key}"></label>`;
      return `<article class="solution-tile" data-solution="${s.id}" data-sector="${s.slug}"><div class="solution-meta"><span>${esc(s.tag)}</span><span>${s.weeks} ${s.weeks === '4–6' ? 'недель' : 'недели'}</span></div><p class="solution-who">${esc(s.who)}</p><h3>${esc(s.title)}</h3><p class="solution-process">${esc(s.proc)}</p><div class="solution-flow" aria-label="Шаги процесса">${s.flow.map(x => `<span>${esc(x)}</span>`).join('<i aria-hidden="true">→</i>')}</div><div class="solution-inputs">${field('ops', s.unit)}${s.per === 'hours' ? '' : field('min', 'Минут на одну вручную')}${field('auto', 'Берёт на себя агент, %', 100)}${field('rate', 'Стоимость часа сотрудника, ₽')}</div><div class="solution-results" role="status" aria-live="polite" aria-atomic="true"><div><b data-saved></b><span>освобождается в месяц</span></div><div class="solution-saving"><b data-annual></b><span>экономия в год</span></div><div><b data-payback></b><span>окупаемость</span></div></div><div class="solution-price"><span>${s.audit ? `Разбор <b>от ${fmt(s.audit)} ₽</b><br>Внедрение <b>от ${fmt(s.impl)} ₽</b>` : `Демо <b>0 ₽</b><br>Настройка <b>от ${fmt(s.impl)} ₽</b>`}</span><a class="text-link" href="#contact" data-trial="${s.id}">Демо на вашем примере →</a></div></article>`;
    }).join('');
    cards.setAttribute('aria-busy', 'false');
    const state = new Map(solutions.map(s => [s.id, {...s}]));
    cards.querySelectorAll('.solution-tile').forEach(card => result(card, state.get(card.dataset.solution)));
    cards.addEventListener('input', e => {
      if (!e.target.matches('input[data-key]')) return;
      const card = e.target.closest('.solution-tile');
      const s = state.get(card.dataset.solution);
      s[e.target.dataset.key] = number(e.target.value, Number(e.target.max));
      e.target.setAttribute('aria-invalid', String(!e.target.validity.valid));
      result(card, s);
    });
    const applyFilter = () => {
      const slug = location.hash.startsWith('#solutions-') ? location.hash.slice(11) : '';
      const active = solutions.some(s => s.slug === slug) ? slug : '';
      filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === active)));
      cards.querySelectorAll('.solution-tile').forEach(card => { card.hidden = Boolean(active && card.dataset.sector !== active); });
      if (location.hash.startsWith('#solutions-')) document.getElementById('solutions').scrollIntoView({ block: 'start' });
    };
    filters.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      location.hash = b.dataset.filter ? `solutions-${b.dataset.filter}` : 'solutions';
      applyFilter();
    });
    window.addEventListener('hashchange', applyFilter);
    applyFilter();
    cards.addEventListener('click', e => {
      const link = e.target.closest('[data-trial]');
      if (!link) return;
      const s = state.get(link.dataset.trial);
      const form = document.getElementById('trForm');
      form.elements.solution.value = s.id;
      const selected = document.getElementById('selectedSolution');
      selected.hidden = false;
      selected.textContent = `Ваше решение: ${s.title}`;
      form.dataset.calculation = `${s.ops} ${s.unit}; ${s.per === 'hours' ? '' : s.min + ' мин; '}доля агента ${s.auto}%; ${s.rate} ₽/ч. Расчётная экономия ${fmt(Math.round(calculate(s).annual / 1000))} тыс. ₽/год.`;
      requestAnimationFrame(() => form.elements.name.focus({ preventScroll: true }));
    });
  }).catch(() => {
    cards.setAttribute('aria-busy', 'false');
    cards.innerHTML = '<p>Не удалось загрузить решения. <a class="text-link" href="#contact">Пришлите пример — рассчитаем экономию для вас.</a></p>';
  });
})();
