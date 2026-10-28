(() => {
  'use strict';
  const form = document.getElementById('trForm');
  if (!form) return;
  const status = document.getElementById('formStatus');
  const fileInput = document.getElementById('trFile');
  const maxBytes = 5 * 1024 * 1024;
  fileInput.addEventListener('change', () => {
    fileInput.setCustomValidity(fileInput.files[0]?.size > maxBytes ? 'Выберите файл до 5 МБ.' : '');
    fileInput.reportValidity();
  });
  const base64 = bytes => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  };
  const wrapped = value => value.match(/.{1,76}/g)?.join('\r\n') || '';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = 'Бесплатная проба TRIPROBOTS' + (data.get('solution') ? ` · ${data.get('solution')}` : '');
    const text = ['Имя: ' + data.get('name'), 'Контакт: ' + data.get('contact'), 'Компания: ' + (data.get('company') || '—'), 'Направление: ' + data.get('area'), 'Решение: ' + (data.get('solution') || 'не выбрано'), '', data.get('message') || '', '', form.dataset.calculation || ''].join('\n');
    const file = fileInput.files[0];
    if (!file) {
      location.href = 'mailto:mark@triprobots.ru?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      status.textContent = 'Открываем почтовую программу. Проверьте письмо и нажмите «Отправить». Если программа не открылась, напишите на mark@triprobots.ru.';
      return;
    }
    if (file.size > maxBytes) { status.textContent = 'Выберите файл до 5 МБ.'; return; }
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const boundary = 'triprobots-' + crypto.randomUUID();
      const encoder = new TextEncoder();
      const filename = file.name.replace(/[\r\n"\\]/g, '_');
      const name64 = base64(encoder.encode(filename));
      const draft = ['X-Unsent: 1', 'To: mark@triprobots.ru', 'Subject: =?UTF-8?B?' + base64(encoder.encode(subject)) + '?=', 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrapped(base64(encoder.encode(text))), `--${boundary}`, 'Content-Type: application/octet-stream', 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="=?UTF-8?B?${name64}?="; filename*=UTF-8''${encodeURIComponent(filename)}`, '', wrapped(base64(new Uint8Array(await file.arrayBuffer()))), `--${boundary}--`, ''].join('\r\n');
      const url = URL.createObjectURL(new Blob([draft], {type:'message/rfc822'}));
      const a = document.createElement('a');
      a.href = url; a.download = 'triprobots-trial.eml'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Черновик с вложением скачан. Откройте triprobots-trial.eml в почтовой программе и отправьте письмо. Заявка пока не отправлена.';
    } catch {
      status.textContent = 'Не удалось подготовить черновик. Отправьте пример на mark@triprobots.ru или в Telegram.';
    } finally { button.disabled = false; }
  });
})();
