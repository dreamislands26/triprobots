(() => {
  'use strict';
  const form = document.getElementById('trForm');
  if (!form) return;
  const status = document.getElementById('formStatus');
  const fileInput = document.getElementById('trFile');
  const maxBytes = 5 * 1024 * 1024;
  let trialEndpoint = null;
  const configuration = fetch('/data/form-config.json', {cache:'no-store'}).then(r=>r.ok?r.json():{}).then(config=>{
    if(config.endpoint){
      const url = new URL(config.endpoint, location.origin);
      if(url.protocol === 'https:'){
        trialEndpoint = url.href;form.action=trialEndpoint;form.method='post';
        const note=document.getElementById('trialDeliveryNote');if(note)note.textContent='Файл будет отправлен вместе с заявкой. До 5 МБ.';
      }
    }
  }).catch(()=>{});
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
    const subject = 'Бесплатное демо TRIPROBOTS' + (data.get('solution') ? ` · ${data.get('solution')}` : '');
    const text = ['Имя: ' + data.get('name'), 'Контакт: ' + data.get('contact'), 'Компания: ' + (data.get('company') || '—'), 'Направление: ' + data.get('area'), 'Решение: ' + (data.get('solution') || 'не выбрано'), '', data.get('message') || '', '', form.dataset.calculation || ''].join('\n');
    const file = fileInput.files[0];
    await configuration;
    if (trialEndpoint) {
      if(file?.size > maxBytes){status.textContent='Выберите файл до 5 МБ.';return;}
      const button=form.querySelector('[type=submit]');button.disabled=true;
      status.textContent='Отправляем заявку…';
      try {
        form.dataset.requestId ||= crypto.randomUUID();
        const payload=Object.fromEntries(['name','contact','company','area','message','solution'].map(key=>[key,data.get(key)||'']));
        payload.requestId=form.dataset.requestId;payload.calculation=form.dataset.calculation||'';
        if(file)payload.file={name:file.name,base64:base64(new Uint8Array(await file.arrayBuffer()))};
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
        let response;
        try{response=await fetch(trialEndpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timer);}
        const result=await response.json();
        if(!response.ok||!result.ok){
          status.textContent=result.accepted?'Заявка сохранена, но письмо пока не доставлено. Повторите отправку или свяжитесь с нами напрямую.':'Не удалось отправить заявку. Повторите отправку или свяжитесь с нами напрямую.';
          return;
        }
        status.textContent='Заявка отправлена. Ответим в течение рабочего дня';
        form.reset();delete form.dataset.requestId;delete form.dataset.calculation;
        const selected=document.getElementById('selectedSolution');if(selected)selected.hidden=true;
      } catch { status.textContent='Не удалось подтвердить отправку. Повторите попытку — сохранённая заявка не продублируется.'; }
      finally {button.disabled=false;}
      return;
    }
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
