const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname,'..');
const solutions = JSON.parse(fs.readFileSync(path.join(root,'data/solutions.json'),'utf8'));
function calculate() {
 const context = {document:{getElementById:()=>({}),querySelector:()=>({})},fetch:()=>new Promise(()=>{}),Intl};
 const code = fs.readFileSync(path.join(root,'assets/solutions.js'),'utf8').replace("fetch('/data/solutions.json')", "globalThis.calculate = calculate; fetch('/data/solutions.json')");
 vm.runInNewContext(code,context);
 return context.calculate;
}
test('default scenarios match the agreed economics',()=>{
 const calc=calculate();
 const expected={p2:[139.75,2012400,540000/167700],p1:[66,1188000,540000/99000],p3:[140,1512000,450000/126000],p4:[175,1890000,540000/157500],p6:[60,648000,450000/54000],p5:[7,168000,40000/14000]};
 for(const s of solutions){const r=calc(s),e=expected[s.id];assert.ok(Math.abs(r.saved-e[0])<1e-8);assert.ok(Math.abs(r.annual-e[1])<1e-8);assert.ok(Math.abs(r.payback-e[2])<1e-8);}
});
test('zero, negative, invalid and over-100% inputs do not create misleading savings',()=>{
 const calc=calculate(),s=solutions[0];
 for(const value of [0,-1,'bad',Infinity]){const r=calc({...s,ops:value});assert.ok(Number.isFinite(r.annual));if(value!==Infinity){assert.equal(r.annual,0);assert.equal(r.payback,null);}}
 assert.equal(calc({...s,auto:500}).saved,215);
 assert.equal(calc({...s,rate:0}).payback,null);
});
test('form produces a real MIME draft with solution and original attachment bytes',async()=>{
 let submit,blob,download;
 const file={name:'пример.txt',size:5,arrayBuffer:async()=>new TextEncoder().encode('hello').buffer};
 const button={disabled:false},status={},fileInput={files:[file],addEventListener(){},reportValidity(){}};
 const values=new Map([['name','Test'],['contact','test@example.org'],['company','Demo'],['area','Логистика'],['solution','p2'],['message','Проверка']]);
 const form={dataset:{calculation:'Расчёт'},reportValidity:()=>true,querySelector:()=>button,addEventListener:(event,handler)=>{if(event==='submit')submit=handler}};
 const context={document:{getElementById:id=>({trForm:form,formStatus:status,trFile:fileInput}[id]),createElement:()=>({click(){download=this.download}})},FormData:class{get(key){return values.get(key)}},TextEncoder,Uint8Array,Blob,btoa:x=>Buffer.from(x,'binary').toString('base64'),crypto:require('node:crypto').webcrypto,URL:{createObjectURL:b=>{blob=b;return 'blob:test'},revokeObjectURL(){}},setTimeout(){},location:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/trial-form.js'),'utf8'),context);
 await submit({preventDefault(){}});
 assert.equal(download,'triprobots-trial.eml');
 const draft=await blob.text();
 assert.match(draft,/X-Unsent: 1/);assert.match(draft,/multipart\/mixed/);assert.match(draft,/aGVsbG8=/);
 const textPart=draft.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
 assert.match(Buffer.from(textPart,'base64').toString('utf8'),/Решение: p2/);
 assert.match(status.textContent,/пока не отправлена/);assert.equal(button.disabled,false);

});
