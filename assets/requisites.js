document.getElementById('copyRequisites').addEventListener('click', async () => {
  const text = Array.from(document.querySelectorAll('table tr'), row => Array.from(row.cells, cell => cell.textContent.trim()).join(': ')).join('\n');
  const status = document.getElementById('copyStatus');
  try { await navigator.clipboard.writeText(text); status.textContent = 'Реквизиты скопированы'; }
  catch { status.textContent = 'Не удалось скопировать. Выделите и скопируйте реквизиты из таблицы.'; }
});
