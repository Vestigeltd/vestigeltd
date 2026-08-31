'use strict';
const assert=require('assert');

process.env.ZOHO_CLIENT_ID='cid';
process.env.ZOHO_CLIENT_SECRET='secret';
process.env.ZOHO_REFRESH_TOKEN='refresh';
process.env.ZOHO_ORGANIZATION_ID='935297724';
process.env.ZOHO_ADMIN_TEST_KEY='admin-key';
process.env.CHECKOUT_SIGNING_SECRET='0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ZOHO_ACCOUNTS_URL='https://accounts.zoho.com';
process.env.ALLOWED_ORIGIN='https://vestigeltd.netlify.app';
process.env.ZOHO_ITEM_BLUEBERRY_MINT_ID='1001';
process.env.ZOHO_ITEM_MIAMI_MINT_ID='1002';
process.env.ZOHO_ITEM_BLUE_RAZZ_ICE_ID='1003';
process.env.ZOHO_ITEM_STRAWBERRY_KIWI_ICE_ID='1004';
process.env.ZOHO_ITEM_WATERMELON_ICE_ID='1005';
process.env.ZOHO_ITEM_COURIER_LOCKER_ID='2001';
delete process.env.ZOHO_LOCATION_ID;

const names={
  '1001':'ELFBAR BC10000 - Blueberry Mint','1002':'ELFBAR BC10000 - Miami Mint','1003':'ELFBAR BC10000 - Blue Razz Ice','1004':'ELFBAR BC10000 - Strawberry Kiwi Ice','1005':'ELFBAR BC10000 - Watermelon Ice'
};
const state={
  stock:{1001:10,1002:8,1003:6,1004:4,1005:2},
  salesOrders:new Map(), invoices:new Map(), contacts:new Map(), payments:new Map(),
  nextSO:1,nextInv:1,nextContact:1,
  decrementOnOpen:true,
  writes:{contacts:0,salesOrders:0,invoices:0},
  itemOverrides:new Map(),
};
function item(id){
  if(id==='2001') return {item_id:'2001',name:'Courier Guy Locker-to-Locker Delivery',status:'active',rate:60,product_type:'service'};
  const base={item_id:id,name:names[id],status:'active',rate:300,product_type:'goods',available_stock:String(state.stock[id]),stock_on_hand:String(Math.max(state.stock[id],0)),locations:[{location_id:'3001',location_name:'Main',status:'active',is_primary:true,location_available_stock:String(state.stock[id]),location_actual_available_stock:String(state.stock[id]),location_stock_on_hand:String(Math.max(state.stock[id],0))}]};
  return Object.assign(base,state.itemOverrides.get(id)||{});
}
function jsonResponse(data,status=200,headers={}){ return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}}); }
function parseBody(options){ try{return options?.body?JSON.parse(options.body):{};}catch{return{};} }

global.fetch=async function(url,options={}){
  const u=new URL(String(url)); const method=(options.method||'GET').toUpperCase();
  if(u.hostname.startsWith('accounts.zoho.')) return jsonResponse({access_token:'token',api_domain:'https://www.zohoapis.com',expires_in:3600});
  const path=u.pathname.replace('/books/v3','');
  if(path==='/organizations') return jsonResponse({code:0,organizations:[{organization_id:'935297724',name:'Vestige Ltd'}]});
  if(path==='/itemdetails'){
    const ids=(u.searchParams.get('item_ids')||'').split(',').filter(Boolean); return jsonResponse({code:0,items:ids.map(item)});
  }
  let m=path.match(/^\/items\/(\d+)$/); if(m) return jsonResponse({code:0,item:item(m[1])});
  if(path==='/items') return jsonResponse({code:0,items:Object.keys(names).map(item),page_context:{has_more_page:false}});
  if(path==='/contacts' && method==='GET'){
    const email=(u.searchParams.get('email')||'').toLowerCase(); const c=state.contacts.get(email); return jsonResponse({code:0,contacts:c?[c]:[]});
  }
  if(path==='/contacts' && method==='POST'){
    const b=parseBody(options); const cp=b.contact_persons?.[0]||{}; const email=(cp.email||'').toLowerCase();
    const c={contact_id:String(5000+state.nextContact++),contact_name:b.contact_name,email,billing_address:b.billing_address,shipping_address:null,contact_persons:[{...cp,contact_person_id:'cp1'}]}; state.contacts.set(email,c);state.writes.contacts++; return jsonResponse({code:0,contact:c});
  }
  m=path.match(/^\/contacts\/(\d+)$/); if(m && method==='GET'){
    const c=[...state.contacts.values()].find(x=>x.contact_id===m[1]); return jsonResponse({code:0,contact:c||{}});
  }
  if(m && method==='PUT'){
    const b=parseBody(options); const c=[...state.contacts.values()].find(x=>x.contact_id===m[1])||{}; Object.assign(c,b); return jsonResponse({code:0,contact:c});
  }
  if(path==='/salesorders' && method==='GET'){
    const ref=u.searchParams.get('reference_number'); const arr=[...state.salesOrders.values()].filter(x=>!ref||x.reference_number===ref); return jsonResponse({code:0,salesorders:arr});
  }
  if(path==='/salesorders' && method==='POST'){
    const b=parseBody(options); const id=String(6000+state.nextSO++); const so={...b,salesorder_id:id,salesorder_number:'SO-'+id,status:'draft'};state.salesOrders.set(id,so);state.writes.salesOrders++;return jsonResponse({code:0,salesorder:so});
  }
  m=path.match(/^\/salesorders\/(\d+)\/status\/open$/); if(m&&method==='POST'){
    const so=state.salesOrders.get(m[1]);so.status='open';if(state.decrementOnOpen){const pl=so.line_items.find(x=>String(x.item_id).startsWith('100'));state.stock[pl.item_id]-=Number(pl.quantity);}return jsonResponse({code:0,message:'success'});
  }
  m=path.match(/^\/salesorders\/(\d+)\/status\/void$/); if(m&&method==='POST'){const so=state.salesOrders.get(m[1]);if(so)so.status='void';return jsonResponse({code:0});}
  m=path.match(/^\/salesorders\/(\d+)$/); if(m&&method==='GET'){return jsonResponse({code:0,salesorder:state.salesOrders.get(m[1])||null});}
  if(path==='/invoices' && method==='GET'){
    const customer=u.searchParams.get('customer_id'); const arr=[...state.invoices.values()].filter(x=>!customer||x.customer_id===customer); return jsonResponse({code:0,invoices:arr});
  }
  if(path==='/invoices/fromsalesorder'&&method==='POST'){
    const soid=u.searchParams.get('salesorder_id');const so=state.salesOrders.get(soid);const id=String(7000+state.nextInv++);const total=so.line_items.reduce((a,l)=>a+Number(l.rate)*Number(l.quantity),0);
    const inv={invoice_id:id,invoice_number:'INV-'+id,salesorder_id:soid,customer_id:so.customer_id,status:'draft',total,balance:total,allow_partial_payments:true,reference_number:so.reference_number,payment_options:{payment_gateways:[{gateway_name:'paypal',configured:true}]},invoice_url:'https://zohosecurepay.com/pay/'+id};state.invoices.set(id,inv);state.writes.invoices++;return jsonResponse({code:0,invoice:inv});
  }
  m=path.match(/^\/invoices\/(\d+)$/); if(m&&method==='PUT'){const inv=state.invoices.get(m[1]);Object.assign(inv,parseBody(options));return jsonResponse({code:0,invoice:inv});}
  if(m&&method==='GET') return jsonResponse({code:0,invoice:state.invoices.get(m[1])||{}});
  m=path.match(/^\/invoices\/(\d+)\/status\/sent$/); if(m&&method==='POST'){const inv=state.invoices.get(m[1]);inv.status='sent';return jsonResponse({code:0});}
  m=path.match(/^\/invoices\/(\d+)\/status\/void$/); if(m&&method==='POST'){const inv=state.invoices.get(m[1]);if(inv)inv.status='void';return jsonResponse({code:0});}
  m=path.match(/^\/invoices\/(\d+)\/payments$/); if(m&&method==='GET'){
    const p=[...state.payments.values()].filter(x=>x.invoiceId===m[1]).map(x=>({payment_id:x.payment_id,online_transaction_id:x.online_transaction_id,payment_mode:x.payment_mode}));return jsonResponse({code:0,payments:p});
  }
  m=path.match(/^\/customerpayments\/(\w+)$/); if(m&&method==='GET'){
    const p=state.payments.get(m[1]); if((options.headers?.Accept||options.headers?.accept)==='application/pdf') return new Response(Buffer.from('%PDF-1.4 test receipt'),{status:200,headers:{'content-type':'application/pdf'}}); return jsonResponse({code:0,payment:p});
  }
  if(path==='/share/paymentlink') return jsonResponse({code:0,data:{share_link:'https://zohosecurepay.com/pay/shared'}});
  throw new Error('Unhandled mock '+method+' '+path+'?'+u.searchParams.toString());
};

const {handler}=require('../netlify/functions/zoho-integration.js');
function event(body,path='/api/zoho',headers={}){return {path,httpMethod:'POST',headers:{host:'vestigeltd.netlify.app',origin:'https://vestigeltd.netlify.app','content-type':'application/json',...headers},body:JSON.stringify(body)};}
function body(res){ return JSON.parse(res.body); }
function order(id,email='buyer@example.com',qty=2,itemId='1001',flavour='Blueberry Mint'){
 return {action:'prepare_order',checkoutId:id,customerName:'Test Buyer',email,mobile:'+27821234567',addressLine1:'1 Test Road',addressLine2:'',city:'Cape Town',province:'Western Cape',postalCode:'8001',country:'South Africa',courierLocker:'PUDO 123 Main Mall',flavour,itemId,quantity:qty,amount:qty*300+60};
}
(async()=>{
  const results=[]; const ok=(name,fn)=>Promise.resolve().then(fn).then(()=>results.push('PASS '+name));
  await ok('availability reads live Zoho stock without touching Blobs',async()=>{
    global.__TEST_BLOB_FAIL__=true;
    const r=await handler(event({action:'availability'})); assert.equal(r.statusCode,200); const b=body(r); assert.equal(b.availability['Blueberry Mint'].stock,10); global.__TEST_BLOB_FAIL__=false;
  });
  await ok('direct canonical function path is rejected (rate-limit bypass closed)',async()=>{const r=await handler(event({action:'availability'},'/.netlify/functions/zoho-integration'));assert.equal(r.statusCode,404);});
  await ok('protected connection test proves Zoho stock + atomic Blob storage',async()=>{const r=await handler(event({action:'connection_test'},'/api/zoho',{'x-vestige-admin-key':'admin-key'}));assert.equal(r.statusCode,200);const b=body(r);assert.equal(b.checkoutStorage.ok,true);assert.equal(b.stockConnection['Blueberry Mint'].itemId,'1001');});
  await ok('explicit available=0 overrides higher physical location stock',async()=>{
    state.itemOverrides.set('1002',{available_stock:'0',actual_available_stock:'0',stock_on_hand:'10',locations:[{location_id:'3001',location_name:'Main',status:'active',is_primary:true,location_available_stock:'',location_actual_available_stock:'',location_stock_on_hand:'10'}]});
    const r=await handler(event({action:'availability'}));const b=body(r);assert.equal(b.availability['Miami Mint'].available,false);assert.equal(b.availability['Miami Mint'].stock,0);state.itemOverrides.delete('1002');
  });
  await ok('Blob outage fails checkout before any Zoho financial writes but stock display still works',async()=>{
    const before={...state.writes};global.__TEST_BLOB_FAIL__=true;const r=await handler(event(order('blob-outage-00000001','blob@example.com',1)));assert.equal(r.statusCode,503);assert.match(body(r).message,/checkout storage/i);assert.deepEqual(state.writes,before);global.__TEST_BLOB_FAIL__=false;
  });
  let pending;
  await ok('valid order succeeds even if Item stock field does not immediately decrease after Open Sales Order',async()=>{
    state.decrementOnOpen=false;const r=await handler(event(order('checkout-good-000001','good@example.com',2)));assert.equal(r.statusCode,200);pending=body(r);assert.equal(pending.pendingPayment,true);assert.equal(pending.order.amount,660);assert.equal(state.writes.salesOrders,1);assert.equal(state.writes.invoices,1);state.decrementOnOpen=true;
  });
  await ok('identical retry replays instead of duplicating Sales Order/invoice',async()=>{const before={...state.writes};const r=await handler(event(order('checkout-good-000001','good@example.com',2)));assert.equal(r.statusCode,200);assert.deepEqual(state.writes,before);});
  await ok('same checkout ID cannot be replayed with changed quantity/customer instruction',async()=>{const changed=order('checkout-good-000001','good@example.com',3);const r=await handler(event(changed));assert.equal(r.statusCode,409);});
  await ok('tampered total is rejected',async()=>{const o=order('tamper-total-000001','tamper@example.com',1);o.amount=1;const r=await handler(event(o));assert.equal(r.statusCode,400);});
  await ok('wrong Zoho item ID cannot be paired with another flavour',async()=>{const before=state.writes.salesOrders;const r=await handler(event(order('wrong-item-00000001','wrong@example.com',1,'1002','Blueberry Mint')));assert.equal(r.statusCode,409);assert.equal(state.writes.salesOrders,before);});
  await ok('price change after page load is rejected server-side',async()=>{state.itemOverrides.set('1004',{rate:301});const before=state.writes.salesOrders;const r=await handler(event(order('price-change-000001','price@example.com',1,'1004','Strawberry Kiwi Ice')));assert.equal(r.statusCode,409);assert.equal(state.writes.salesOrders,before);state.itemOverrides.delete('1004');});
  await ok('item becoming inactive after page load is rejected',async()=>{state.itemOverrides.set('1004',{status:'inactive'});const before=state.writes.salesOrders;const r=await handler(event(order('inactive-item-00001','inactive@example.com',1,'1004','Strawberry Kiwi Ice')));assert.equal(r.statusCode,409);assert.equal(state.writes.salesOrders,before);state.itemOverrides.delete('1004');});
  await ok('stock split across locations is not combined to fulfil one order',async()=>{state.itemOverrides.set('1004',{available_stock:'6',locations:[{location_id:'3101',location_name:'A',status:'active',is_primary:true,location_available_stock:'3',location_actual_available_stock:'3',location_stock_on_hand:'3'},{location_id:'3102',location_name:'B',status:'active',is_primary:false,location_available_stock:'3',location_actual_available_stock:'3',location_stock_on_hand:'3'}]});const before=state.writes.salesOrders;const r=await handler(event(order('split-stock-0000001','split@example.com',5,'1004','Strawberry Kiwi Ice')));assert.equal(r.statusCode,409);assert.equal(state.writes.salesOrders,before);state.itemOverrides.delete('1004');});
  await ok('out-of-stock exact item blocks before Sales Order',async()=>{state.stock['1005']=0;const before=state.writes.salesOrders;const r=await handler(event(order('nostock-test-000001','no@example.com',1,'1005','Watermelon Ice')));assert.equal(r.statusCode,409);assert.equal(state.writes.salesOrders,before);});
  await ok('unpaid, partial, manual and refunded payments cannot confirm; exact PayPal payment can',async()=>{
    let r=await handler(event({action:'verify_payment',checkoutToken:pending.checkoutToken}));assert.equal(r.statusCode,402);
    const inv=[...state.invoices.values()].find(x=>x.invoice_number===pending.order.invoiceNumber);
    inv.status='partially_paid';inv.balance=330;
    state.payments.set('manual1',{payment_id:'manual1',invoiceId:inv.invoice_id,status:'success',amount_refunded:0,payment_mode:'Cash',online_transaction_id:'',invoices:[{invoice_id:inv.invoice_id,amount_applied:330}]});
    r=await handler(event({action:'verify_payment',checkoutToken:pending.checkoutToken}));assert.equal(r.statusCode,402);
    state.payments.delete('manual1');
    inv.status='paid';inv.balance=0;
    state.payments.set('p1',{payment_id:'p1',invoiceId:inv.invoice_id,status:'success',amount_refunded:660,payment_mode:'PayPal',online_transaction_id:'PAYPAL-TX-1',invoices:[{invoice_id:inv.invoice_id,amount_applied:660}]});
    r=await handler(event({action:'verify_payment',checkoutToken:pending.checkoutToken}));assert.equal(r.statusCode,409);
    state.payments.get('p1').amount_refunded=0;
    r=await handler(event({action:'verify_payment',checkoutToken:pending.checkoutToken}));assert.equal(r.statusCode,200);
  });
  await ok('verified payment receipt PDF is returned',async()=>{const r=await handler(event({action:'payment_receipt',checkoutToken:pending.checkoutToken}));assert.equal(r.statusCode,200);assert.equal(r.isBase64Encoded,true);assert.ok(Buffer.from(r.body,'base64').toString('ascii',0,4)==='%PDF');});
  await ok('confirmed-order reservation bridge blocks post-payment oversell while Zoho Item stock is stale',async()=>{state.stock['1001']=2;const before=state.writes.salesOrders;const r=await handler(event(order('postpay-stale-00001','postpay@example.com',1,'1001','Blueberry Mint')));assert.equal(r.statusCode,409);assert.equal(state.writes.salesOrders,before);state.stock['1001']=10;});
  await ok('two concurrent buyers cannot both buy final unit',async()=>{
    state.stock['1003']=1;state.decrementOnOpen=true;const before=state.writes.salesOrders;
    const [a,b]=await Promise.all([handler(event(order('concurrent-a-00001','a@example.com',1,'1003','Blue Razz Ice'))),handler(event(order('concurrent-b-00001','b@example.com',1,'1003','Blue Razz Ice')))]);
    const statuses=[a.statusCode,b.statusCode].sort();assert.ok(statuses.includes(200));assert.ok(statuses.includes(409)||statuses.includes(503));assert.equal(state.writes.salesOrders-before,1);
  });
  await ok('sequential buyer cannot oversell final unit when Zoho Item stock visibility lags after lock release',async()=>{
    state.stock['1002']=1;state.decrementOnOpen=false;const before=state.writes.salesOrders;
    const a=await handler(event(order('lag-sequential-a01','seq-a@example.com',1,'1002','Miami Mint')));assert.equal(a.statusCode,200);
    const b=await handler(event(order('lag-sequential-b01','seq-b@example.com',1,'1002','Miami Mint')));
    assert.ok([409,503].includes(b.statusCode));assert.equal(state.writes.salesOrders-before,1);state.decrementOnOpen=true;
  });
  console.log(results.join('\n')); console.log(`TOTAL ${results.length}/${results.length} PASS`);
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
