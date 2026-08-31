'use strict';

const REQUEST_TIMEOUT_MS = 7000;
const BOOKS_API_VERSION = 'v3';
const ABANDONED_GRACE_MS = 60 * 60 * 1000;
const ALLOWED_ACCOUNTS_HOSTS = new Set(['accounts.zoho.com','accounts.zoho.eu','accounts.zoho.in','accounts.zoho.com.au','accounts.zoho.jp','accounts.zoho.ca','accounts.zoho.com.cn','accounts.zoho.sa']);
const ALLOWED_API_HOSTS = new Set(['www.zohoapis.com','www.zohoapis.eu','www.zohoapis.in','www.zohoapis.com.au','www.zohoapis.jp','www.zohoapis.ca','www.zohoapis.com.cn','www.zohoapis.sa']);

function env(name){ const v=process.env[name]; if(!v||!String(v).trim()) throw new Error(`Missing ${name}`); return String(v).trim(); }
async function timedFetch(url, options={}){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),REQUEST_TIMEOUT_MS); try{return await fetch(url,{...options,signal:c.signal});}finally{clearTimeout(t);} }
function accountsUrl(){ const u=new URL(process.env.ZOHO_ACCOUNTS_URL||'https://accounts.zoho.com'); if(u.protocol!=='https:'||!ALLOWED_ACCOUNTS_HOSTS.has(u.hostname)) throw new Error('Unapproved Zoho Accounts host'); return `${u.protocol}//${u.hostname}`; }
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
  let d={};try{d=await r.json();}catch(_){ } if(!r.ok||d.code!==0) throw new Error(`Zoho API failure ${r.status}/${d.code}`); return d;
}
function ageMs(invoice){ const raw=invoice.created_time||invoice.date; const t=Date.parse(raw); return Number.isFinite(t)?Date.now()-t:0; }

exports.handler=async function(){
  try{
    const auth=await access();
    const invoices=[];
    let page=1;
    do{
      // Zoho's current List Invoices API documents exact `reference_number`, not
      // `reference_number_startswith`. Scan only a bounded recent window with a
      // documented date filter, then match WEB- references locally.
      const startDate=new Date(Date.now()-14*24*60*60*1000).toISOString().slice(0,10);
      const data=await zoho(auth,`/invoices?${query({date_start:startDate,per_page:'100',page:String(page)})}`);
      if(Array.isArray(data.invoices)) invoices.push(...data.invoices.filter(inv=>String(inv.reference_number||'').startsWith('WEB-')));
      if(!data.page_context?.has_more_page) break;
      page+=1;
      if(page>50) throw new Error('Expired checkout scan exceeded safety pagination limit.');
    }while(true);
    let voided=0, skippedPaid=0, manualReview=0;
    for(const summary of invoices){
      if(ageMs(summary)<ABANDONED_GRACE_MS) continue;
      const initialStatus=String(summary.status||'').toLowerCase();
      if(initialStatus==='paid'||initialStatus==='void') { skippedPaid++; continue; }
      const full=await zoho(auth,`/invoices/${encodeURIComponent(summary.invoice_id)}?${query()}`);
      const invoice=full.invoice||{};
      const status=String(invoice.status||'').toLowerCase();
      const balance=Number(invoice.balance);
      if(status==='paid'||status==='void'||(Number.isFinite(balance)&&Math.abs(balance)<0.01)){ skippedPaid++; continue; }

      // Never automatically void any invoice that has a payment record, partial or
      // otherwise. PayPal/Zoho reconciliation can race the scheduled cleanup; money
      // evidence always requires manual review instead of automatic stock release.
      let paymentRows=[];
      try{
        const paymentData=await zoho(auth,`/invoices/${encodeURIComponent(invoice.invoice_id)}/payments?${query()}`);
        paymentRows=Array.isArray(paymentData.payments)?paymentData.payments:[];
      }catch(e){
        manualReview++; console.warn('Unable to verify payment state before cleanup; leaving transaction untouched',{invoiceId:String(invoice.invoice_id)}); continue;
      }
      const hasPaymentEvidence=paymentRows.some(p=>String(p.payment_id||'').trim()||String(p.online_transaction_id||'').trim()||Number(p.amount||p.amount_applied||0)>0);
      if(status==='partially_paid'||hasPaymentEvidence){ manualReview++; console.warn('Expired website invoice has payment evidence; manual review required',{invoiceId:String(invoice.invoice_id)}); continue; }

      // Re-read immediately before voiding to close the window where a payment lands
      // between the first status check and cleanup action.
      const finalRead=await zoho(auth,`/invoices/${encodeURIComponent(invoice.invoice_id)}?${query()}`);
      const current=finalRead.invoice||{};
      const finalStatus=String(current.status||'').toLowerCase();
      const finalBalance=Number(current.balance);
      if(finalStatus==='paid'||finalStatus==='void'||(Number.isFinite(finalBalance)&&Math.abs(finalBalance)<0.01)){ skippedPaid++; continue; }

      await zoho(auth,`/invoices/${encodeURIComponent(current.invoice_id)}/status/void?${query()}`,{method:'POST'});
      if(current.salesorder_id){
        try{await zoho(auth,`/salesorders/${encodeURIComponent(current.salesorder_id)}/status/void?${query()}`,{method:'POST',body:{reason:'Expired unpaid Vestige website checkout.'}});}catch(e){console.warn('Invoice voided but Sales Order void failed',{salesOrderId:String(current.salesorder_id)});}
      }
      voided++;
    }
    console.log('Vestige expired checkout cleanup complete',{scanned:invoices.length,voided,skippedPaid,manualReview});
    return {statusCode:200,body:JSON.stringify({success:true,scanned:invoices.length,voided,skippedPaid,manualReview})};
  }catch(error){ console.error('Expired checkout cleanup failed',{message:error.message}); return {statusCode:500,body:JSON.stringify({success:false})}; }
};
