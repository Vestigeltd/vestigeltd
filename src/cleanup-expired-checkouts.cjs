'use strict';

const REQUEST_TIMEOUT_MS = 7000;
const BOOKS_API_VERSION = 'v3';
const CHECKOUT_PAYMENT_WINDOW_MS = 30 * 60 * 1000; // legacy invoice window; bank rows use their explicit paymentExpiresAt
const PAYMENT_EPSILON = 0.01;
const CHECKOUT_NAMESPACE = 'vestige-checkouts';
const RESERVATION_NAMESPACE = 'vestige-stock-reservations';
const TERMINAL_CHECKOUT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CONFIRMED_CHECKOUT_MINIMISATION_MS = 90 * 24 * 60 * 60 * 1000;
const PROTECTED_FINANCIAL_REFERENCES = new Set(['V0001','V0002','V0004']);
const TERMINAL_STATES = new Set(['expired','cancelled_customer','cancelled_unpaid','failed']);
const ALLOWED_ACCOUNTS_HOSTS = new Set(['accounts.zoho.com','accounts.zoho.eu','accounts.zoho.in','accounts.zoho.com.au','accounts.zoho.jp','accounts.zoho.ca','accounts.zoho.com.cn','accounts.zoho.sa']);
const ALLOWED_API_HOSTS = new Set(['www.zohoapis.com','www.zohoapis.eu','www.zohoapis.in','www.zohoapis.com.au','www.zohoapis.jp','www.zohoapis.ca','www.zohoapis.com.cn','www.zohoapis.sa']);

let d1Database = null;
function bindCloudflareRuntime(e){ d1Database=e?.CHECKOUT_DB||null; globalThis.__VESTIGE_ENV=e||{}; }
function runtimeEnv(name){ const e=globalThis.__VESTIGE_ENV||{}; const v=e[name] ?? (typeof process !== 'undefined' && process.env ? process.env[name] : undefined); return v; }
function env(name){ const v=runtimeEnv(name); if(!v||!String(v).trim()) throw new Error(`Missing ${name}`); return String(v).trim(); }
function requireDatabase(){ if(!d1Database) throw new Error('Cloudflare D1 checkout storage is not bound.'); return d1Database; }
async function timedFetch(url, options={}){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),REQUEST_TIMEOUT_MS); try{return await fetch(url,{...options,signal:c.signal});}finally{clearTimeout(t);} }
function accountsUrl(){ const u=new URL(runtimeEnv('ZOHO_ACCOUNTS_URL')||'https://accounts.zoho.com'); if(u.protocol!=='https:'||!ALLOWED_ACCOUNTS_HOSTS.has(u.hostname)) throw new Error('Unapproved Zoho Accounts host'); return `${u.protocol}//${u.hostname}`; }
async function access(){
  const form=new URLSearchParams({refresh_token:env('ZOHO_REFRESH_TOKEN'),client_id:env('ZOHO_CLIENT_ID'),client_secret:env('ZOHO_CLIENT_SECRET'),grant_type:'refresh_token'});
  const r=await timedFetch(`${accountsUrl()}/oauth/v2/token`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
  const d=await r.json(); if(!r.ok||!d.access_token||!d.api_domain) throw new Error('Zoho OAuth failed');
  const api=new URL(d.api_domain); if(api.protocol!=='https:'||!ALLOWED_API_HOSTS.has(api.hostname)) throw new Error('Unapproved Zoho API host');
  return {token:d.access_token,api:`${api.protocol}//${api.hostname}`};
}
function query(extra={}){ return new URLSearchParams({organization_id:env('ZOHO_ORGANIZATION_ID'),...extra}).toString(); }
async function zoho(auth,path,{method='GET',body}={}){
  const r=await timedFetch(`${auth.api}/books/${BOOKS_API_VERSION}${path}`,{method,headers:{Authorization:`Zoho-oauthtoken ${auth.token}`,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let d={}; try{d=await r.json();}catch(_){ }
  if(!r.ok||d.code!==0){ const e=new Error(`Zoho API failure ${r.status}/${d.code}`); e.httpStatus=r.status; e.zohoCode=d.code; throw e; }
  return d;
}
function webReference(checkoutId){ return `WEB-${checkoutId}`.slice(0,100); }
function isVoidedStatus(status){ return ['void','voided','cancelled','canceled'].includes(String(status||'').toLowerCase()); }
function isPaidInvoice(invoice){ const status=String(invoice?.status||'').toLowerCase(); const balance=Number(invoice?.balance); return status==='paid'||(Number.isFinite(balance)&&Math.abs(balance)<=PAYMENT_EPSILON); }
function hasPaymentEvidence(rows){ return (Array.isArray(rows)?rows:[]).some(p=>String(p.payment_id||'').trim()||String(p.online_transaction_id||'').trim()||Number(p.amount||p.amount_applied||0)>0); }

async function listExpiredPendingCheckouts(now){
  const cutoff=now-CHECKOUT_PAYMENT_WINDOW_MS;
  const result=await requireDatabase().prepare(
    `SELECT key, value_json, etag, updated_at
       FROM kv_store
      WHERE namespace = ?1
        AND json_extract(value_json, '$.state') = 'pending_payment'
        AND updated_at <= ?2
      ORDER BY updated_at ASC
      LIMIT 200`
  ).bind(CHECKOUT_NAMESPACE,cutoff).all();
  return Array.isArray(result?.results)?result.results:[];
}

async function findReservations(checkoutId){
  const result=await requireDatabase().prepare(
    `SELECT key, value_json, etag
       FROM kv_store
      WHERE namespace = ?1
        AND value_json LIKE ?2
      LIMIT 100`
  ).bind(RESERVATION_NAMESPACE,`%${String(checkoutId)}%`).all();
  const matches=[];
  for(const row of (result?.results||[])){
    let data; try{data=JSON.parse(row.value_json);}catch(_){continue;}
    const reservations=Array.isArray(data?.reservations)?data.reservations:[];
    if(reservations.some(r=>String(r?.checkoutId||'')===String(checkoutId))) matches.push({row,data});
  }
  return matches;
}

async function releaseReservation(checkoutId){
  let releasedCount=0;
  for(let pass=0;pass<6;pass+=1){
    const found=await findReservations(checkoutId);
    if(!found.length) return {released:releasedCount>0,releasedCount};
    let conflict=false;
    for(const {row,data} of found){
      const before=Array.isArray(data.reservations)?data.reservations:[];
      const after=before.filter(r=>String(r?.checkoutId||'')!==String(checkoutId));
      if(after.length===before.length) continue;
      const next={...data,reservations:after,updatedAt:Date.now()};
      const etag=crypto.randomUUID();
      const result=await requireDatabase().prepare(
        `UPDATE kv_store
            SET value_json = ?3, etag = ?4, updated_at = ?5
          WHERE namespace = ?1 AND key = ?2 AND etag = ?6`
      ).bind(RESERVATION_NAMESPACE,String(row.key),JSON.stringify(next),etag,Date.now(),String(row.etag)).run();
      if(Number(result?.meta?.changes||0)>0) releasedCount+=1;
      else conflict=true;
    }
    if(!conflict) return {released:releasedCount>0,releasedCount};
  }
  throw new Error('Unable to release all website stock reservations safely after repeated D1 conflicts.');
}

async function markCheckoutExpired(row, checkoutId, invoice){
  let current; try{current=JSON.parse(row.value_json);}catch(_){current={};}
  const response=current.response&&typeof current.response==='object'?{...current.response}:{};
  delete response.paymentUrl;
  delete response.checkoutToken;
  response.success=false;
  response.pendingPayment=false;
  response.message='This checkout expired before full payment was confirmed. Please start a new checkout.';
  const record={
    ...current,
    state:'expired',
    response,
    expired:{invoiceId:String(invoice?.invoice_id||current?.progress?.invoiceId||''),expiredAt:new Date().toISOString(),reason:'payment_window_elapsed'},
    updatedAt:Date.now(),
    expiresAt:Date.now(),
  };
  const result=await requireDatabase().prepare(
    `UPDATE kv_store
        SET value_json = ?3, etag = ?4, updated_at = ?5
      WHERE namespace = ?1 AND key = ?2 AND etag = ?6`
  ).bind(CHECKOUT_NAMESPACE,String(row.key),JSON.stringify(record),crypto.randomUUID(),Date.now(),String(row.etag)).run();
  if(Number(result?.meta?.changes||0)===0) throw new Error('Checkout state changed during cleanup; leaving it for the next run.');
}

async function getInvoice(auth,invoiceId){ const data=await zoho(auth,`/invoices/${encodeURIComponent(invoiceId)}?${query()}`); return data.invoice||{}; }
async function getPayments(auth,invoiceId){ const data=await zoho(auth,`/invoices/${encodeURIComponent(invoiceId)}/payments?${query()}`); return Array.isArray(data.payments)?data.payments:[]; }

function paymentReferenceFromCheckout(checkout){
  return String(checkout?.progress?.paymentReference||checkout?.response?.paymentReference||'').trim().toUpperCase();
}
function isProtectedFinancialCheckout(checkout){
  return PROTECTED_FINANCIAL_REFERENCES.has(paymentReferenceFromCheckout(checkout));
}

function minimisedConfirmedCheckout(checkout,now){
  const progress=checkout?.progress&&typeof checkout.progress==='object'?checkout.progress:{};
  const verified=checkout?.verified&&typeof checkout.verified==='object'?checkout.verified:{};
  return {
    state:'confirmed',
    progress:{
      paymentMode:progress.paymentMode||null,
      paymentReference:progress.paymentReference||null,
      items:Array.isArray(progress.items)?progress.items.map(line=>({
        flavour:String(line?.flavour||'').slice(0,80),
        itemId:String(line?.itemId||'').slice(0,80),
        quantity:Number(line?.quantity||0),
      })):[],
      totalQuantity:Number(progress.totalQuantity||0),
      amount:Number(progress.amount||0),
      deliveryMethod:progress.deliveryMethod||null,
      deliveryCharge:Number(progress.deliveryCharge||0),
      bankInvoiceId:progress.bankInvoiceId||progress.invoiceId||null,
      bankPaymentId:progress.bankPaymentId||progress.paymentId||null,
      bankPaymentDate:progress.bankPaymentDate||null,
      bankConfirmedAmount:Number(progress.bankConfirmedAmount||0),
    },
    verified:{
      paymentId:verified.paymentId||null,
      invoiceId:verified.invoiceId||null,
      amount:Number(verified.amount||0),
      paymentMode:verified.paymentMode||null,
      confirmationSource:verified.confirmationSource||null,
      confirmedAt:verified.confirmedAt||null,
    },
    retention:{personalDataRemovedAt:new Date(now).toISOString(),policy:'confirmed_checkout_90_days'},
    updatedAt:now,
    expiresAt:now,
  };
}

async function enforceCheckoutRetention(now){
  const cutoff=now-TERMINAL_CHECKOUT_RETENTION_MS;
  const result=await requireDatabase().prepare(
    `SELECT key, value_json, etag, updated_at
       FROM kv_store
      WHERE namespace = ?1
        AND updated_at <= ?2
        AND json_extract(value_json, '$.state') IN ('confirmed','expired','cancelled_customer','cancelled_unpaid','failed')
      ORDER BY updated_at ASC
      LIMIT 200`
  ).bind(CHECKOUT_NAMESPACE,cutoff).all();
  const stats={retentionScanned:0,terminalDeleted:0,confirmedMinimised:0,protectedFinancialRecords:0,retentionConflicts:0};
  for(const row of (result?.results||[])){
    stats.retentionScanned++;
    let checkout; try{checkout=JSON.parse(row.value_json);}catch(_){continue;}
    if(isProtectedFinancialCheckout(checkout)){
      stats.protectedFinancialRecords++;
      continue;
    }
    const age=now-Number(row.updated_at||0);
    const state=String(checkout?.state||'');
    if(TERMINAL_STATES.has(state)&&age>=TERMINAL_CHECKOUT_RETENTION_MS){
      const deleted=await requireDatabase().prepare(
        `DELETE FROM kv_store WHERE namespace = ?1 AND key = ?2 AND etag = ?3`
      ).bind(CHECKOUT_NAMESPACE,String(row.key),String(row.etag)).run();
      if(Number(deleted?.meta?.changes||0)>0) stats.terminalDeleted++;
      else stats.retentionConflicts++;
      continue;
    }
    if(state==='confirmed'&&age>=CONFIRMED_CHECKOUT_MINIMISATION_MS&&!checkout?.retention?.personalDataRemovedAt){
      const minimised=minimisedConfirmedCheckout(checkout,now);
      const updated=await requireDatabase().prepare(
        `UPDATE kv_store SET value_json = ?3, etag = ?4, updated_at = ?5
          WHERE namespace = ?1 AND key = ?2 AND etag = ?6`
      ).bind(CHECKOUT_NAMESPACE,String(row.key),JSON.stringify(minimised),crypto.randomUUID(),now,String(row.etag)).run();
      if(Number(updated?.meta?.changes||0)>0) stats.confirmedMinimised++;
      else stats.retentionConflicts++;
    }
  }
  return stats;
}

exports.handler=async function(){
  const stats={scanned:0,voided:0,alreadyVoided:0,skippedPaid:0,manualReview:0,bankExpired:0,reservationsReleased:0,expiredMarked:0,paymentReviewHeld:0};
  try{
    Object.assign(stats,await enforceCheckoutRetention(Date.now()));
    const auth=await access();
    const rows=await listExpiredPendingCheckouts(Date.now());
    stats.scanned=rows.length;

    for(const row of rows){
      const checkoutId=String(row.key||'').replace(/^checkout-/,'');
      if(!checkoutId){ stats.manualReview++; continue; }
      let checkout; try{checkout=JSON.parse(row.value_json);}catch(_){ stats.manualReview++; console.warn('Invalid checkout JSON; manual review required',{checkoutId}); continue; }
      const paymentMode=String(checkout?.progress?.paymentMode||'').trim();
      const paymentExpiresAt=Number(checkout?.progress?.paymentExpiresAt||0);
      const paymentClaimedAt=Number(checkout?.progress?.paymentClaimedAt||0);
      const invoiceId=String(checkout?.progress?.invoiceId||'').trim();

      if(paymentMode==='bank_transfer' && !invoiceId){
        // Once the customer reports payment sent, the checkout becomes an OWNER PAYMENT
        // REVIEW HOLD. Never auto-expire or auto-release its stock. Only the protected
        // owner confirm/void actions may resolve it.
        if(paymentClaimedAt>0){
          stats.paymentReviewHeld++;
          continue;
        }

        // Ordinary unclaimed bank/EFT checkout: respect the explicit payment deadline,
        // then release the website reservation and expire the checkout.
        if(paymentExpiresAt && Date.now()<paymentExpiresAt) continue;
        try{
          const rel=await releaseReservation(checkoutId);
          if(rel.released) stats.reservationsReleased++;
          await markCheckoutExpired(row,checkoutId,null);
          stats.bankExpired++;
          stats.expiredMarked++;
        }catch(error){
          stats.manualReview++;
          console.warn('Bank checkout cleanup needs retry',{checkoutId,message:error.message});
        }
        continue;
      }

      if(!invoiceId){ stats.manualReview++; console.warn('Expired checkout has no invoice ID and is not a recognised bank-payment checkout; manual review required',{checkoutId}); continue; }

      let invoice;
      try{ invoice=await getInvoice(auth,invoiceId); }
      catch(error){ stats.manualReview++; console.warn('Unable to read expired checkout invoice; leaving untouched',{checkoutId,invoiceId}); continue; }

      if(String(invoice.reference_number||'')!==webReference(checkoutId)){
        stats.manualReview++; console.warn('Invoice reference does not match checkout; refusing automatic cleanup',{checkoutId,invoiceId}); continue;
      }
      if(isPaidInvoice(invoice)){
        stats.skippedPaid++; console.log('Expired timer reached but invoice is paid; no void performed',{checkoutId,invoiceId}); continue;
      }
      if(isVoidedStatus(invoice.status)){
        stats.alreadyVoided++;
        try{ const rel=await releaseReservation(checkoutId); if(rel.released) stats.reservationsReleased++; await markCheckoutExpired(row,checkoutId,invoice); stats.expiredMarked++; }
        catch(error){ stats.manualReview++; console.warn('Invoice already void but D1 cleanup needs retry',{checkoutId,invoiceId,message:error.message}); }
        continue;
      }

      let paymentRows;
      try{ paymentRows=await getPayments(auth,invoiceId); }
      catch(error){ stats.manualReview++; console.warn('Unable to verify payment state; refusing automatic void',{checkoutId,invoiceId}); continue; }
      if(String(invoice.status||'').toLowerCase()==='partially_paid'||hasPaymentEvidence(paymentRows)){
        stats.manualReview++; console.warn('Expired invoice has payment evidence; manual review required',{checkoutId,invoiceId}); continue;
      }

      // Re-read immediately before voiding so a payment that lands during cleanup wins.
      let finalInvoice;
      try{ finalInvoice=await getInvoice(auth,invoiceId); }
      catch(error){ stats.manualReview++; continue; }
      if(isPaidInvoice(finalInvoice)){ stats.skippedPaid++; continue; }
      if(isVoidedStatus(finalInvoice.status)){ stats.alreadyVoided++; }
      else{
        let finalPayments;
        try{ finalPayments=await getPayments(auth,invoiceId); }
        catch(error){ stats.manualReview++; continue; }
        if(String(finalInvoice.status||'').toLowerCase()==='partially_paid'||hasPaymentEvidence(finalPayments)){
          stats.manualReview++; continue;
        }
        await zoho(auth,`/invoices/${encodeURIComponent(invoiceId)}/status/void?${query()}`,{method:'POST'});
        stats.voided++;
      }

      // Only release the website reservation after Zoho has confirmed the invoice is
      // void (or the void call succeeded). This keeps stock conservative on failures.
      const rel=await releaseReservation(checkoutId);
      if(rel.released) stats.reservationsReleased++;
      await markCheckoutExpired(row,checkoutId,finalInvoice);
      stats.expiredMarked++;
    }

    console.log('Vestige mixed invoice/bank expired checkout cleanup complete',stats);
    return {statusCode:200,body:JSON.stringify({success:true,...stats})};
  }catch(error){
    console.error('Expired checkout cleanup failed',{message:error.message});
    return {statusCode:500,body:JSON.stringify({success:false})};
  }
};

exports.bindCloudflareRuntime=bindCloudflareRuntime;
exports.__retentionTest={paymentReferenceFromCheckout,isProtectedFinancialCheckout,minimisedConfirmedCheckout};
