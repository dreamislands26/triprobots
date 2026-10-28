import { randomUUID } from 'node:crypto';
const MAX_FILE = 5 * 1024 * 1024;
const extensions = new Set(['pdf','txt','csv','doc','docx','xls','xlsx','eml','png','jpg','jpeg']);
const field = (value,max,required=false) => {
 if(typeof value!=='string' || value.length>max || (required&&!value.trim()))throw new Error('invalid_fields');
 return value.trim();
};
export function validateTrial(body) {
 const data={name:field(body.name,160,true),contact:field(body.contact,240,true),company:field(body.company||'',240),area:field(body.area||'',240),message:field(body.message||'',20000),solution:field(body.solution||'',16),calculation:field(body.calculation||'',2000)};
 if(data.solution&&!/^p[1-6]$/.test(data.solution))throw new Error('invalid_solution');
 if(body.requestId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))throw new Error('invalid_request_id');
 data.requestId=body.requestId||randomUUID();
 if(body.file){
  const name=field(body.file.name,200,true).replace(/[\r\n\\/]/g,'_');
  if(!extensions.has(name.split('.').pop().toLowerCase()))throw new Error('unsupported_file');
  const encoded=body.file.base64;
  if(typeof encoded!=='string'||encoded.length>Math.ceil(MAX_FILE/3)*4||(encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)))throw new Error('invalid_file');
  const content=Buffer.from(encoded,'base64');
  if(!content.length||content.length>MAX_FILE)throw new Error('invalid_file');
  data.file={name,content};
 }
 return data;
}
export function createTrialHandler({db,sendMail,configured,from}) {
 return async(req,res)=>{
  if(!configured)return res.status(503).json({ok:false,error:'trial_not_configured'});
  let d;
  try{d=validateTrial(req.body||{});}catch{return res.status(400).json({ok:false,error:'invalid_submission'});}
  let client;
  try{
   // Commit the raw submission in Russia before attempting SMTP delivery.
   await db.query(`insert into trial_submissions(request_id,name,contact,company,area,message,solution,calculation,file_name,file_content)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(request_id) do nothing`,[d.requestId,d.name,d.contact,d.company,d.area,d.message,d.solution,d.calculation,d.file?.name||null,d.file?.content||null]);
   client=await db.connect();await client.query('begin');
   const {rows}=await client.query('select * from trial_submissions where request_id=$1 for update',[d.requestId]);
   const row=rows[0];
   if(row.email_status!=='sent'){
    try{
     const info=await sendMail({from,to:'mark@triprobots.ru',subject:'Бесплатная проба TRIPROBOTS'+(row.solution?' · '+row.solution:''),text:[`Имя: ${row.name}`,`Контакт: ${row.contact}`,`Компания: ${row.company}`,`Направление: ${row.area}`,`Решение: ${row.solution}`,'',row.message,'',row.calculation].join('\n'),attachments:row.file_content?[{filename:row.file_name,content:row.file_content,contentType:'application/octet-stream'}]:[],disableFileAccess:true,disableUrlAccess:true});
     if(!info.accepted?.some(address=>String(address).toLowerCase()==='mark@triprobots.ru'))throw new Error('mail_not_accepted');
     await client.query("update trial_submissions set email_status='sent',email_sent_at=now(),email_message_id=$2 where request_id=$1",[d.requestId,info.messageId||null]);
    }catch{
     await client.query("update trial_submissions set email_status='failed' where request_id=$1",[d.requestId]);await client.query('commit');
     return res.status(503).json({ok:false,accepted:true,error:'mail_delivery_failed',requestId:d.requestId});
    }
   }
   await client.query('commit');return res.status(201).json({ok:true,accepted:true,requestId:d.requestId});
  }catch{
   if(client)await client.query('rollback').catch(()=>{});
   return res.status(500).json({ok:false,error:'trial_unavailable'});
  }finally{client?.release();}
 };
}
