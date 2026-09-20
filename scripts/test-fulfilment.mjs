import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const tmp=path.join(here,'.worker-test.mjs');
fs.copyFileSync(path.join(root,'src','worker.js'),tmp);
const originalError=console.error, originalWarn=console.warn, originalFetch=globalThis.fetch;
console.error=()=>{}; console.warn=()=>{};
const sentEmails=[];
globalThis.fetch=async(input,init={})=>{
  if(String(input)==='https://api.resend.com/emails'){
    const body=JSON.parse(String(init.body||'{}'));
    sentEmails.push({headers:{...(init.headers||{})},body});
    return new Response(JSON.stringify({id:'email-'+sentEmails.length}),{status:200,headers:{'content-type':'application/json'}});
  }
  return originalFetch(input,init);
};
const {default:worker}=await import(pathToFileURL(tmp).href+'?t='+Date.now());
class Stmt{constructor(db,sql){this.db=db;this.sql=sql;this.a=[];}bind(...a){this.a=a;return this;}async first(){const[ns,key]=this.a;if(this.sql.includes('SELECT value_json, etag FROM kv_store WHERE namespace = ?1 AND key = ?2')){const r=this.db.r.get(`${ns}::${key}`);return r?{value_json:JSON.stringify(r.v),etag:r.e}:null;}throw Error('Unhandled first SQL');}async all(){if(this.sql.includes('SELECT key, value_json, etag FROM kv_store WHERE namespace = ?1 ORDER BY updated_at DESC LIMIT 1000')){const[ns]=this.a;return{results:[...this.db.r].filter(([k])=>k.startsWith(ns+'::')).map(([k,r])=>({key:k.slice(ns.length+2),value_json:JSON.stringify(r.v),etag:r.e,updated_at:r.u}))};}throw Error('Unhandled all SQL');}async run(){if(this.sql.startsWith('UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5 WHERE namespace = ?1 AND key = ?2 AND etag = ?6')){const[ns,key,j,e,u,x]=this.a,k=`${ns}::${key}`,r=this.db.r.get(k);if(!r||r.e!==String(x))return{meta:{changes:0}};this.db.r.set(k,{v:JSON.parse(j),e:String(e),u:Number(u)});return{meta:{changes:1}};}if(this.sql.startsWith('INSERT OR IGNORE INTO kv_store')){const[ns,key,j,e,u]=this.a,k=`${ns}::${key}`;if(this.db.r.has(k))return{meta:{changes:0}};this.db.r.set(k,{v:JSON.parse(j),e:String(e),u:Number(u)});return{meta:{changes:1}};}if(this.sql.startsWith('INSERT INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES')){const[ns,key,j,e,u]=this.a;this.db.r.set(`${ns}::${key}`,{v:JSON.parse(j),e:String(e),u:Number(u)});return{meta:{changes:1}};}throw Error('Unhandled run SQL');}}
class DB{constructor(){this.r=new Map();}seed(ns,k,v,e='seed'){this.r.set(`${ns}::${k}`,{v:structuredClone(v),e,u:Date.now()});}prepare(s){return new Stmt(this,s);}}
const db=new DB();
function seed(ref,id,method,state='confirmed'){db.seed('vestige-bank-payment-reference-index',ref,{checkoutId:id,paymentReference:ref});db.seed('vestige-checkouts',`checkout-${id}`,{state,createdAt:Date.now()-10000,updatedAt:Date.now()-5000,progress:{paymentReference:ref,paymentMode:'bank_transfer',amount:300,totalQuantity:1,deliveryMethod:method,deliveryCharge:method==='collection'?0:60,courierLocker:method==='collection'?'Collection':'LOCKER123',customer:{customerName:'Test Buyer',email:'buyer@example.com'},items:[]},response:{paymentReference:ref,paymentMode:'bank_transfer',order:{amount:300,totalQuantity:1,deliveryMethod:method,deliveryCharge:method==='collection'?0:60}}});}
seed('V0001','c1','collection');seed('V0002','c2','courier_locker');seed('V0003','c3','collection','pending_payment');seed('V0099','c99','courier_locker');
const env={CHECKOUT_DB:db,ASSETS:{fetch:async()=>new Response('asset')},ALLOWED_ORIGIN:'https://vestigeltd.co.za',VESTIGE_PAYMENT_ADMIN_KEY:'0123456789abcdef0123456789abcdef0123456789abcdef',ZOHO_CLIENT_ID:'x',ZOHO_CLIENT_SECRET:'x',ZOHO_REFRESH_TOKEN:'x',ZOHO_ORGANIZATION_ID:'x',RESEND_API_KEY:'test-resend-key'};
async function call(body,key=env.VESTIGE_PAYMENT_ADMIN_KEY){const r=await worker.fetch(new Request('https://vestigeltd.co.za/api/zoho',{method:'POST',headers:{'content-type':'application/json','origin':'https://vestigeltd.co.za','x-vestige-payment-admin-key':key},body:JSON.stringify(body)}),env);let d={};try{d=await r.json();}catch{}return[r.status,d];}
async function status(ref){const r=await worker.fetch(new Request('https://vestigeltd.co.za/api/zoho',{method:'POST',headers:{'content-type':'application/json','origin':'https://vestigeltd.co.za'},body:JSON.stringify({action:'public_order_status',paymentReference:ref,email:'buyer@example.com'})}),env);return[r.status,await r.json()];}
let r=await call({action:'admin_update_fulfilment',paymentReference:'V0001',fulfilmentState:'preparing'},'bad');assert.equal(r[0],401);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0001',fulfilmentState:'preparing'});assert.equal(r[0],200);assert.equal(r[1].order.fulfilment.state,'preparing');
r=await call({action:'admin_update_fulfilment',paymentReference:'V0001',fulfilmentState:'dispatched'});assert.equal(r[0],409);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0001',fulfilmentState:'ready_for_collection'});assert.equal(r[0],200);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0001',fulfilmentState:'completed'});assert.equal(r[0],200);let s=await status('V0001');assert.equal(s[1].order.status,'completed');assert.equal(s[1].order.trackingReference,null);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0002',fulfilmentState:'preparing'});assert.equal(r[0],200);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0002',fulfilmentState:'dispatched'});assert.equal(r[0],400);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0002',fulfilmentState:'dispatched',trackingReference:'TCG-ABC-123'});assert.equal(r[0],200);s=await status('V0002');assert.equal(s[1].order.status,'dispatched');assert.equal(s[1].order.trackingReference,'TCG-ABC-123');
r=await call({action:'admin_update_fulfilment',paymentReference:'V0002',fulfilmentState:'completed',trackingReference:'TCG-ABC-123'});assert.equal(r[0],200);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0002',fulfilmentState:'completed'});assert.equal(r[1].replayed,true);
r=await call({action:'admin_update_fulfilment',paymentReference:'V0003',fulfilmentState:'preparing'});assert.equal(r[0],409);s=await status('V0003');assert.equal(s[1].order.fulfilmentState,null);
assert.equal(sentEmails.length,6,'expected one customer email for each successful non-replayed fulfilment transition');
assert.equal(new Set(sentEmails.map(e=>e.headers['Idempotency-Key'])).size,6,'customer notification idempotency keys must be unique per order state');
for(const email of sentEmails){
  assert.deepEqual(email.body.to,['buyer@example.com']);
  assert.match(email.body.from,/contact@vestigeltd\.co\.za/);
  assert.equal(email.body.reply_to,'contact@vestigeltd.co.za');
  assert.match(email.body.text,/^Dear Test,/);
  assert.doesNotMatch(email.body.text,/Dear Test Buyer,/);
  assert.match(email.body.text,/https:\/\/vestigeltd\.co\.za\/order-status/);
}
const dispatchEmail=sentEmails.find(e=>/V0002 — dispatched/.test(e.body.subject));
assert.ok(dispatchEmail,'courier dispatch email must be sent');
assert.match(dispatchEmail.body.text,/Tracking reference: TCG-ABC-123/);
const collectionEmails=sentEmails.filter(e=>/V0001/.test(e.body.subject));
assert.ok(collectionEmails.every(e=>!e.body.text.includes('Tracking reference:')),'collection emails must not include courier tracking');
const sentBeforeReplay=sentEmails.length;
r=await call({action:'admin_update_fulfilment',paymentReference:'V0002',fulfilmentState:'completed'});assert.equal(r[1].replayed,true);assert.equal(sentEmails.length,sentBeforeReplay,'replayed transition must not send a duplicate email');
const savedKey=env.RESEND_API_KEY;env.RESEND_API_KEY='';
r=await call({action:'admin_update_fulfilment',paymentReference:'V0099',fulfilmentState:'preparing'});assert.equal(r[0],200);assert.equal(r[1].customerNotification.sent,false);assert.match(r[1].message,/notification needs review/i);env.RESEND_API_KEY=savedKey;
const audits=[...db.r].filter(([k])=>k.startsWith('vestige-owner-audit::'));assert.ok(audits.length>=12);
const customerEmailAudits=audits.map(([,r])=>r.v).filter(v=>v.action==='customer_fulfilment_email');assert.ok(customerEmailAudits.length>=7);
console.error=originalError;console.warn=originalWarn;globalThis.fetch=originalFetch;fs.unlinkSync(tmp);
console.log('PASS owner authentication boundary');
console.log('PASS collection state machine');
console.log('PASS courier tracking + state machine');
console.log('PASS public fulfilment/tracking status');
console.log('PASS payment-confirmation gate');
console.log('PASS customer fulfilment notification idempotency');
console.log('PASS first-name-only customer notification privacy');
console.log('PASS notification failure does not block fulfilment');
console.log('PASS audit persistence');
