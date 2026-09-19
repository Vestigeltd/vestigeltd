import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const tmp=path.join(here,'.worker-test.mjs');
fs.copyFileSync(path.join(root,'src','worker.js'),tmp);
const originalError=console.error, originalWarn=console.warn;
console.error=()=>{}; console.warn=()=>{};
const {default:worker}=await import(pathToFileURL(tmp).href+'?t='+Date.now());
class Stmt{constructor(db,sql){this.db=db;this.sql=sql;this.a=[];}bind(...a){this.a=a;return this;}async first(){const[ns,key]=this.a;if(this.sql.includes('SELECT value_json, etag FROM kv_store WHERE namespace = ?1 AND key = ?2')){const r=this.db.r.get(`${ns}::${key}`);return r?{value_json:JSON.stringify(r.v),etag:r.e}:null;}throw Error('Unhandled first SQL');}async all(){if(this.sql.includes('SELECT key, value_json, etag FROM kv_store WHERE namespace = ?1 ORDER BY updated_at DESC LIMIT 1000')){const[ns]=this.a;return{results:[...this.db.r].filter(([k])=>k.startsWith(ns+'::')).map(([k,r])=>({key:k.slice(ns.length+2),value_json:JSON.stringify(r.v),etag:r.e,updated_at:r.u}))};}throw Error('Unhandled all SQL');}async run(){if(this.sql.startsWith('UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5 WHERE namespace = ?1 AND key = ?2 AND etag = ?6')){const[ns,key,j,e,u,x]=this.a,k=`${ns}::${key}`,r=this.db.r.get(k);if(!r||r.e!==String(x))return{meta:{changes:0}};this.db.r.set(k,{v:JSON.parse(j),e:String(e),u:Number(u)});return{meta:{changes:1}};}if(this.sql.startsWith('INSERT OR IGNORE INTO kv_store')){const[ns,key,j,e,u]=this.a,k=`${ns}::${key}`;if(this.db.r.has(k))return{meta:{changes:0}};this.db.r.set(k,{v:JSON.parse(j),e:String(e),u:Number(u)});return{meta:{changes:1}};}if(this.sql.startsWith('INSERT INTO kv_store(namespace, key, value_json, etag, updated_at) VALUES')){const[ns,key,j,e,u]=this.a;this.db.r.set(`${ns}::${key}`,{v:JSON.parse(j),e:String(e),u:Number(u)});return{meta:{changes:1}};}throw Error('Unhandled run SQL');}}
class DB{constructor(){this.r=new Map();}seed(ns,k,v,e='seed'){this.r.set(`${ns}::${k}`,{v:structuredClone(v),e,u:Date.now()});}prepare(s){return new Stmt(this,s);}}
const db=new DB();
function seed(ref,id,method,state='confirmed'){db.seed('vestige-bank-payment-reference-index',ref,{checkoutId:id,paymentReference:ref});db.seed('vestige-checkouts',`checkout-${id}`,{state,createdAt:Date.now()-10000,updatedAt:Date.now()-5000,progress:{paymentReference:ref,paymentMode:'bank_transfer',amount:300,totalQuantity:1,deliveryMethod:method,deliveryCharge:method==='collection'?0:60,courierLocker:method==='collection'?'Collection':'LOCKER123',customer:{customerName:'Test',email:'buyer@example.com'},items:[]},response:{paymentReference:ref,paymentMode:'bank_transfer',order:{amount:300,totalQuantity:1,deliveryMethod:method,deliveryCharge:method==='collection'?0:60}}});}
seed('V0001','c1','collection');seed('V0002','c2','courier_locker');seed('V0003','c3','collection','pending_payment');
const env={CHECKOUT_DB:db,ASSETS:{fetch:async()=>new Response('asset')},ALLOWED_ORIGIN:'https://vestigeltd.co.za',VESTIGE_PAYMENT_ADMIN_KEY:'0123456789abcdef0123456789abcdef0123456789abcdef',ZOHO_CLIENT_ID:'x',ZOHO_CLIENT_SECRET:'x',ZOHO_REFRESH_TOKEN:'x',ZOHO_ORGANIZATION_ID:'x'};
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
const audits=[...db.r].filter(([k])=>k.startsWith('vestige-owner-audit::'));assert.ok(audits.length>=6);
console.error=originalError;console.warn=originalWarn;fs.unlinkSync(tmp);
console.log('PASS owner authentication boundary');
console.log('PASS collection state machine');
console.log('PASS courier tracking + state machine');
console.log('PASS public fulfilment/tracking status');
console.log('PASS payment-confirmation gate');
console.log('PASS audit persistence');
