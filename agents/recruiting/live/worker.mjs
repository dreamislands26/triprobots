import {screen} from '../screen.mjs';

export default {
 async fetch(request, env) {
   const url = new URL(request.url);
   if (request.method === 'GET' && url.pathname === '/health') return Response.json({status:'ok', monitoringConfigured: Boolean(env.MONITOR_TOKEN)}, {headers:{'Cache-Control':'no-store'}});
   if (request.method !== 'GET' || url.pathname !== '/api/recruiting') return new Response(null,{status:404});
   if (!env.MONITOR_TOKEN || request.headers.get('Authorization') !== 'Bearer '+env.MONITOR_TOKEN) return new Response(null,{status:401});
   const channel = url.searchParams.get('channel') || '';
   if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(channel) || !(env.TELEGRAM_CHANNELS || '').split(',').some(s=>s.trim().toLowerCase()===channel.toLowerCase())) return new Response(null,{status:400});
   const items=[];
   const unavailable=(reason)=>Response.json({error:'source_unavailable',reason},{status:502,headers:{'Cache-Control':'no-store'}});
   let phase='telegram_fetch';
   try {
     const page=await fetch('https://t.me/s/'+channel,{redirect:'error',signal:AbortSignal.timeout(8000)});
     if (!page.ok) return unavailable('telegram_http_'+page.status);
     phase='telegram_parse';
     const body=new HTMLRewriter().on('.tgme_widget_message[data-post]',{element(e){
       const ref=e.getAttribute('data-post');
       if (!ref || !/^\w+\/\d+$/.test(ref) || ref.split('/')[0].toLowerCase()!==channel.toLowerCase()) return;
       items.push({ref,text:''});
     }}).on('.tgme_widget_message_text',{text(t){
       if(items.length && items.at(-1).text.length<8000) items.at(-1).text+=t.text;
     }}).transform(page);
     await body.text();
     if(!items.length) return unavailable('telegram_preview_has_no_posts');
     return Response.json({scanned:items.length,results:items.map(({ref,text})=>({url:'https://t.me/'+ref,text,kind:screen({text})})).filter(x=>x.kind!=='exclude')},{headers:{'Cache-Control':'no-store'}});
   } catch { return unavailable(phase); }
 }
};
