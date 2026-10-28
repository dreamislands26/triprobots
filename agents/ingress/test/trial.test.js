import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTrial,createTrialHandler} from '../src/trial.js';
const input={name:'Test',contact:'test@example.org',company:'Demo',area:'Логистика',message:'Тест',solution:'p2',file:{name:'example.txt',base64:Buffer.from('hello').toString('base64')}};
function fixture(mailFails=false){
 const events=[];let row;
 const client={query:async(sql,values)=>{events.push(sql.split(' ')[0]);if(sql.startsWith('select'))return {rows:[row]};if(sql.includes("email_status='sent'"))row.email_status='sent';if(sql.includes("email_status='failed'"))row.email_status='failed';return {rows:[]};},release(){events.push('release');}};
 const db={query:async(sql,v)=>{events.push('persist');row ||= {name:v[1],contact:v[2],company:v[3],area:v[4],message:v[5],solution:v[6],calculation:v[7],file_name:v[8],file_content:v[9],email_status:'pending'};},connect:async()=>client};
 let message;
 const sendMail=async m=>{events.push('mail');message=m;if(mailFails)throw Error('SMTP unavailable');return {accepted:['mark@triprobots.ru'],messageId:'test'};};
 const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}});
 return {db,sendMail,events,response,get message(){return message;},get row(){return row;}};
}
test('validates a 5 MB attachment and rejects larger, malformed or unsupported uploads',()=>{
 assert.equal(validateTrial(input).file.content.toString(),'hello');
 assert.equal(validateTrial({...input,file:{name:'max.pdf',base64:Buffer.alloc(5*1024*1024).toString('base64')}}).file.content.length,5*1024*1024);
 for(const file of [{name:'oversize.pdf',base64:Buffer.alloc(5*1024*1024+1).toString('base64')},{name:'run.exe',base64:'aGVsbG8='},{name:'test.txt',base64:'!!!='}])assert.throws(()=>validateTrial({...input,file}));
 assert.throws(()=>validateTrial({...input,name:''}));assert.throws(()=>validateTrial({...input,solution:'injected'}));
});
test('persists lead before SMTP, preserves attachment, and does not resend a completed request',async()=>{
 const f=fixture(),h=createTrialHandler({...f,configured:true,from:'forms@triprobots.ru'});
 const request={body:{...input,requestId:'5ae1aee0-4c99-4bf8-bdf9-aa81a417c131'}};
 const r=f.response();await h(request,r);assert.equal(r.statusCode,201);assert.equal(r.data.ok,true);
 assert.ok(f.events.indexOf('persist')<f.events.indexOf('mail'));assert.equal(f.message.attachments[0].content.toString(),'hello');assert.equal(f.message.to,'mark@triprobots.ru');
 await h(request,f.response());assert.equal(f.events.filter(x=>x==='mail').length,1);
});
test('SMTP failure keeps the stored lead, reports delivery failure, and releases DB lock',async()=>{
 const f=fixture(true),h=createTrialHandler({...f,configured:true,from:'forms@triprobots.ru'}),r=f.response();
 await h({body:input},r);assert.equal(r.statusCode,503);assert.equal(r.data.accepted,true);assert.equal(f.row.email_status,'failed');assert.equal(f.events.at(-1),'release');
});
test('unconfigured Russia ingress does not accept personal data',async()=>{
 const f=fixture(),h=createTrialHandler({...f,configured:false}),r=f.response();await h({body:input},r);assert.equal(r.statusCode,503);assert.equal(f.events.length,0);
});
