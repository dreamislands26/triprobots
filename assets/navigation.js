(() => {
 'use strict';
 const header=document.querySelector('.site-header'), wrap=header?.querySelector('.nav-wrap');
 if(!wrap)return;
 const home=location.pathname==='/' || location.pathname==='/index.html' ? '' : '/';
 const section=id=>home+'#'+id;
 const burger=document.createElement('button');
 burger.type='button';burger.className='menu-toggle';burger.setAttribute('aria-label','Открыть меню');burger.setAttribute('aria-expanded','false');burger.setAttribute('aria-controls','site-menu');burger.innerHTML='<span aria-hidden="true">☰</span>';
 wrap.append(burger);
 const dialog=document.createElement('dialog');dialog.id='site-menu';dialog.className='mobile-menu';dialog.setAttribute('aria-label','Навигация сайта');
 dialog.innerHTML=`<div class="mobile-menu-head"><a href="/" aria-label="TRIPROBOTS — главная"><img src="/logo.svg?v=original-20261029" alt="TRIPROBOTS" width="180" height="35"></a><button type="button" class="menu-close" aria-label="Закрыть меню">×</button></div><nav aria-label="Основное меню"><a href="${section('solutions')}">Решения</a><a href="${section('integrations')}">Интеграции</a><a href="/cases/">Проекты</a><a href="/articles/">Материалы</a><details><summary>Роботизация</summary><div class="mobile-submenu"><a href="/restaurants/">Рестораны и кафе</a><a href="/hotels/">Отели и апартаменты</a><a href="/industry/">Производство и склады</a><a href="/cleaning/">Коммерческая уборка</a></div></details><a href="${section('pricing')}">Цены</a><a href="${section('approach')}">Как работаем</a><a href="${section('team')}">Команда</a></nav><a class="btn mobile-trial" href="${section('contact')}">Бесплатная проба</a>`;
 document.body.append(dialog);
 let previousOverflow='';
 function close(){if(dialog.open)dialog.close();}
 burger.addEventListener('click',()=>{
  previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  burger.setAttribute('aria-expanded','true');
  dialog.showModal();dialog.querySelector('.menu-close').focus();
 });
 dialog.querySelector('.menu-close').addEventListener('click',close);
 dialog.addEventListener('click',e=>{if(e.target.closest('a'))close();});
 dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;burger.setAttribute('aria-expanded','false');burger.focus({preventScroll:true});});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 matchMedia('(min-width:900px)').addEventListener('change',e=>{if(e.matches)close();});
 // Click, keyboard and touch support for the desktop robotics dropdown.
 header.querySelectorAll('.lob-dropdown').forEach((dropdown,i)=>{
  const anchor=dropdown.querySelector(':scope > a'), menu=dropdown.querySelector('.lob-menu');
  if(!anchor||!menu)return;
  const button=document.createElement('button');button.type='button';button.className='desktop-dropdown-toggle';button.textContent='Роботизация';button.setAttribute('aria-expanded','false');menu.id='robotics-menu-'+i;button.setAttribute('aria-controls',menu.id);anchor.replaceWith(button);
  const set=on=>{dropdown.classList.toggle('is-open',on);button.setAttribute('aria-expanded',String(on));};
  button.addEventListener('click',()=>set(!dropdown.classList.contains('is-open')));
  dropdown.addEventListener('keydown',e=>{if(e.key==='Escape'){set(false);button.focus();}});
  document.addEventListener('click',e=>{if(!dropdown.contains(e.target))set(false);});
  menu.addEventListener('click',()=>set(false));
 });
})();
