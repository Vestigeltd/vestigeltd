import zohoModule from './zoho-integration.cjs';
import cleanupModule from './cleanup-expired-checkouts.cjs';

const { handler: zohoHandler, bindCloudflareRuntime: bindZohoRuntime, getGoogleFacingAvailability } = zohoModule;
const { handler: cleanupHandler, bindCloudflareRuntime: bindCleanupRuntime } = cleanupModule;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self'; img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com; media-src 'self'; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
};

function headersObject(headers) {
  const out = {};

  for (const [key, value] of headers.entries()) {
    out[key] = value;
  }

  return out;
}

async function toNetlifyEvent(request) {
  const url = new URL(request.url);

  return {
    path: url.pathname,
    rawUrl: request.url,
    httpMethod: request.method,
    headers: headersObject(request.headers),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: ['GET', 'HEAD'].includes(request.method)
      ? null
      : await request.text(),
    isBase64Encoded: false,
  };
}

function fromLambdaResult(result) {
  const headers = new Headers(result?.headers || {});

  return new Response(result?.body ?? '', {
    status: Number(result?.statusCode || 200),
    headers,
  });
}

async function apiResponse(request, env) {
  bindZohoRuntime(env);

  const event = await toNetlifyEvent(request);

  return fromLambdaResult(
    await zohoHandler(event)
  );
}

function cachePolicyForPath(pathname) {
  const path = String(pathname || '').toLowerCase();

  if (
    path === '/api/zoho' ||
    path === '/api/analytics' ||
    path === '/api/restock-poll' ||
    path === '/owner' ||
    path === '/owner.html' ||
    path === '/owner.js' ||
    path === '/owner.css' ||
    path === '/order-status' ||
    path === '/order-status.html'
  ) {
    return 'no-store';
  }

  if (path === '/robots.txt' || path === '/sitemap.xml') {
    return 'public, max-age=300, s-maxage=3600, must-revalidate';
  }

  if (/^\/flavours\/(blueberry-mint|miami-mint|blue-razz-ice|strawberry-kiwi-ice|watermelon-ice)(?:\.html)?$/.test(path)) {
    return 'public, max-age=30, s-maxage=60, must-revalidate';
  }

  if (
    path === '/' ||
    path.endsWith('.html') ||
    (!path.includes('.') && path !== '')
  ) {
    return 'public, max-age=300, s-maxage=1800, must-revalidate';
  }

  if (path.endsWith('.css') || path.endsWith('.js')) {
    return 'public, max-age=3600, s-maxage=86400, must-revalidate';
  }

  if (/\.(png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?|ttf|otf)$/.test(path)) {
    return 'public, max-age=86400, s-maxage=604800';
  }

  return 'public, max-age=300, s-maxage=3600, must-revalidate';
}

function withSecurityHeaders(response, pathname = '', hostname = '') {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  headers.set('Cache-Control', cachePolicyForPath(pathname));

  // Cloudflare preview URLs are public; never allow a workers.dev preview to be indexed.
  if (String(hostname || '').toLowerCase().endsWith('.workers.dev')) {
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  // The Owner Console remains directly reachable for the owner, but must never
  // become a search result or cached copy.
  if (pathname === '/owner' || pathname === '/owner.html') {
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}


function canonicalRedirectResponse(request) {
  const url = new URL(request.url);
  let changed = false;

  // Production hostname canonicalisation only.
  // Preview workers.dev URLs remain untouched for safe testing.
  if (url.hostname.toLowerCase() === 'www.vestigeltd.co.za') {
    url.hostname = 'vestigeltd.co.za';
    changed = true;
  }

  // Public page canonical paths.
  if (url.pathname === '/index.html') {
    url.pathname = '/';
    changed = true;
  } else if (url.pathname === '/contact.html') {
    url.pathname = '/contact';
    changed = true;
  } else if (url.pathname === '/privacy-policy.html') {
    url.pathname = '/privacy-policy';
    changed = true;
  } else if (url.pathname === '/terms-and-conditions.html') {
    url.pathname = '/terms-and-conditions';
    changed = true;
  } else if (url.pathname === '/returns-refunds.html') {
    url.pathname = '/returns-refunds';
    changed = true;
  } else if (url.pathname === '/vape-durbanville.html') {
    url.pathname = '/vape-durbanville';
    changed = true;
  } else if (url.pathname === '/bc10000') {
    url.pathname = '/bc10000/';
    changed = true;
  } else if (url.pathname === '/bc10000/index.html') {
    url.pathname = '/bc10000/';
    changed = true;
  } else if (/^\/flavours\/(blueberry-mint|miami-mint|blue-razz-ice|strawberry-kiwi-ice|watermelon-ice)\.html$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\.html$/, '');
    changed = true;
  }

  if (!changed) return null;

  return new Response(null, {
    status: 301,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
}


/* VESTIGE_CONVERSION_ANALYTICS_V35_10_0
   First-party, no-PII conversion analytics stored in existing D1 kv_store. */
const VESTIGE_ANALYTICS_NAMESPACE = 'vestige-analytics';
const VESTIGE_ANALYTICS_EVENTS = new Set([
  'page_view','shop_view','product_selected','basket_created',
  'product_selection_completed','checkout_started','payment_claimed','payment_confirmed'
]);

function analyticsJson(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
function cleanAnalyticsText(v,max=80){
  return String(v==null?'':v).trim().slice(0,max);
}
function cleanAnalyticsNumber(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null;
}
async function analyticsWrite(env,payload){
  if(!env.CHECKOUT_DB) throw new Error('Analytics database unavailable.');
  const event=cleanAnalyticsText(payload&&payload.event,40);
  if(!VESTIGE_ANALYTICS_EVENTS.has(event)) return analyticsJson({success:false,message:'Unsupported event.'},400);
  const sessionId=cleanAnalyticsText(payload&&payload.sessionId,64);
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return analyticsJson({success:false,message:'Invalid analytics session.'},400);

  const now=Date.now();
  const id=now.toString(36)+'-'+crypto.randomUUID();
  const record={
    event,
    sessionId,
    at:now,
    path:cleanAnalyticsText(payload&&payload.path,160),
    flavour:cleanAnalyticsText(payload&&payload.flavour,60),
    quantity:cleanAnalyticsNumber(payload&&payload.quantity),
    basketItems:cleanAnalyticsNumber(payload&&payload.basketItems),
    amount:cleanAnalyticsNumber(payload&&payload.amount)
  };
  const valueJson=JSON.stringify(record);
  await env.CHECKOUT_DB.prepare(
    'INSERT INTO kv_store (namespace,key,value_json,etag,updated_at) VALUES (?1,?2,?3,?4,?5)'
  ).bind(VESTIGE_ANALYTICS_NAMESPACE,id,valueJson,crypto.randomUUID(),now).run();
  return analyticsJson({success:true});
}
function analyticsCutoff(period){
  if(period==='today'){
    // South Africa Standard Time is UTC+2 year-round.
    const localNow=new Date(Date.now()+(2*60*60*1000));
    return Date.UTC(localNow.getUTCFullYear(),localNow.getUTCMonth(),localNow.getUTCDate())-(2*60*60*1000);
  }
  const days=period==='7'?7:30;
  return Date.now()-(days*86400000);
}
async function analyticsSummary(env,period='30'){
  if(!env.CHECKOUT_DB) throw new Error('Analytics database unavailable.');
  const safePeriod=['today','7','30'].includes(String(period))?String(period):'30';
  const cutoff=analyticsCutoff(safePeriod);
  const result=await env.CHECKOUT_DB.prepare(
    'SELECT value_json FROM kv_store WHERE namespace=?1 AND updated_at>=?2 ORDER BY updated_at DESC LIMIT 10000'
  ).bind(VESTIGE_ANALYTICS_NAMESPACE,cutoff).all();
  const rows=Array.isArray(result&&result.results)?result.results:[];
  const counts={};
  const sessions=new Set();
  let confirmedRevenue=0;
  let confirmedOrders=0;
  let unitsSold=0;
  const flavour={};
  for(const row of rows){
    let r; try{r=JSON.parse(row.value_json||'{}');}catch(_){continue;}
    if(!VESTIGE_ANALYTICS_EVENTS.has(r.event)) continue;
    counts[r.event]=(counts[r.event]||0)+1;
    if(r.sessionId)sessions.add(r.sessionId);
    if(r.event==='payment_confirmed'){
      confirmedOrders++;
      if(Number.isFinite(Number(r.amount))) confirmedRevenue+=Number(r.amount);
      if(Number.isFinite(Number(r.basketItems))) unitsSold+=Number(r.basketItems);
    }
    if(r.event==='product_selected'&&r.flavour){
      flavour[r.flavour]=(flavour[r.flavour]||0)+1;
    }
  }
  const starts=counts.checkout_started||0;
  const claims=counts.payment_claimed||0;
  const confirmed=counts.payment_confirmed||0;
  const baskets=counts.basket_created||0;
  const conversion=starts?Math.round((confirmed/starts)*1000)/10:0;
  const claimRate=starts?Math.round((claims/starts)*1000)/10:0;
  const abandonment=starts?Math.max(0,Math.round(((starts-confirmed)/starts)*1000)/10):0;
  return {
    success:true,period:safePeriod,events:counts,uniqueSessions:sessions.size,
    pageViews:counts.page_view||0,shopViews:counts.shop_view||0,
    productSelections:counts.product_selected||0,
    checkoutStarts:starts,baskets,paymentClaims:claims,confirmedOrders:confirmed,
    unitsSold,
    confirmedRevenue:Math.round(confirmedRevenue*100)/100,
    averageOrderValue:confirmedOrders?Math.round((confirmedRevenue/confirmedOrders)*100)/100:0,
    checkoutConversionPercent:conversion,paymentClaimPercent:claimRate,
    checkoutAbandonmentPercent:abandonment,
    flavourSelections:Object.entries(flavour).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}))
  };
}
async function handleVestigeAnalytics(request,env){
  if(request.method!=='POST') return analyticsJson({success:false,message:'Method not allowed.'},405);
  let body={}; try{body=await request.json();}catch(_){return analyticsJson({success:false,message:'Invalid JSON.'},400);}
  if(body&&body.action==='admin_summary'){
    /*
      V35.10.0C:
      Do NOT duplicate the Owner Console secret check here.
      Delegate authentication to the already-proven /api/zoho owner-auth path
      using the same header and the harmless admin_bank_confirmation_health action.
      This guarantees analytics uses exactly the same authentication contract as
      the existing Owner Console, without exposing or copying the secret.
    */
    const authHeaders = new Headers(request.headers);
    authHeaders.set('Content-Type','application/json');
    const authRequest = new Request(
      new URL('/api/zoho', request.url).toString(),
      {
        method:'POST',
        headers:authHeaders,
        body:JSON.stringify({action:'admin_bank_confirmation_health'})
      }
    );
    const authResponse = await apiResponse(authRequest, env);
    if(!authResponse.ok){
      return analyticsJson({success:false,message:'Unauthorized.'},401);
    }
    return analyticsJson(await analyticsSummary(env,body.period||body.days));
  }
  return analyticsWrite(env,body);
}


/* VESTIGE_RESTOCK_DEMAND_V35_28_0
   Anonymous aggregate-only restock voting. The Worker never reads or stores
   names, contact details, account identifiers, raw IP addresses or user agents. */
const VESTIGE_RESTOCK_NAMESPACE = 'vestige-restock-demand';
const VESTIGE_RESTOCK_FLAVOURS = Object.freeze({
  'blueberry-mint': 'Blueberry Mint',
  'miami-mint': 'Miami Mint',
  'blue-razz-ice': 'Blue Razz Ice',
  'strawberry-kiwi-ice': 'Strawberry Kiwi Ice',
  'watermelon-ice': 'Watermelon Ice',
  'peach-ice': 'Peach Ice',
  'red-berry-cherry': 'Red Berry Cherry',
  'tobacco': 'Tobacco',
  'grape-cherry': 'Grape Cherry',
  'cherry-watermelon': 'Cherry Watermelon',
  'double-mango': 'Double Mango',
  'strawberry-ice': 'Strawberry Ice',
  'blueberry-ice': 'Blueberry Ice'
});

function restockJson(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}

function sameOriginPost(request){
  const origin=request.headers.get('Origin');
  if(!origin)return false;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch(_){return false;}
}

async function authorizeOwnerRequest(request,env){
  const authHeaders=new Headers(request.headers);
  authHeaders.set('Content-Type','application/json');
  const authRequest=new Request(new URL('/api/zoho',request.url).toString(),{
    method:'POST',headers:authHeaders,
    body:JSON.stringify({action:'admin_bank_confirmation_health'})
  });
  return apiResponse(authRequest,env);
}

async function writeRestockVote(env,selections){
  if(!env.CHECKOUT_DB)throw new Error('Restock voting database unavailable.');
  const now=Date.now();
  const increment=function(key,label){
    return env.CHECKOUT_DB.prepare(
      "INSERT INTO kv_store (namespace,key,value_json,etag,updated_at) "+
      "VALUES (?1,?2,json_object('flavour',?3,'count',1),?4,?5) "+
      "ON CONFLICT(namespace,key) DO UPDATE SET "+
      "value_json=json_object('flavour',?3,'count',COALESCE(CAST(json_extract(kv_store.value_json,'$.count') AS INTEGER),0)+1), "+
      "etag=?4,updated_at=?5"
    ).bind(VESTIGE_RESTOCK_NAMESPACE,key,label,crypto.randomUUID(),now);
  };
  const statements=selections.map(slug=>increment(slug,VESTIGE_RESTOCK_FLAVOURS[slug]));
  statements.push(increment('_submissions','Submissions'));
  await env.CHECKOUT_DB.batch(statements);
}

async function restockSummary(env){
  if(!env.CHECKOUT_DB)throw new Error('Restock voting database unavailable.');
  const result=await env.CHECKOUT_DB.prepare(
    'SELECT key,value_json,updated_at FROM kv_store WHERE namespace=?1'
  ).bind(VESTIGE_RESTOCK_NAMESPACE).all();
  let submissions=0;
  const bySlug={};
  for(const row of (result&&result.results)||[]){
    let value={};try{value=JSON.parse(row.value_json||'{}');}catch(_){}
    const count=Math.max(0,Number(value.count)||0);
    if(row.key==='_submissions')submissions=count;
    else if(VESTIGE_RESTOCK_FLAVOURS[row.key])bySlug[row.key]=count;
  }
  const flavours=Object.entries(VESTIGE_RESTOCK_FLAVOURS).map(([slug,name])=>({
    slug,name,count:bySlug[slug]||0
  })).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  return {success:true,submissions,totalVotes:flavours.reduce((sum,row)=>sum+row.count,0),flavours};
}

async function handleRestockPoll(request,env){
  if(request.method!=='POST')return restockJson({success:false,message:'Method not allowed.'},405);
  if(!String(request.headers.get('Content-Type')||'').toLowerCase().includes('application/json')){
    return restockJson({success:false,message:'Content-Type must be application/json.'},415);
  }
  let body={};try{body=await request.json();}catch(_){return restockJson({success:false,message:'Invalid JSON.'},400);}
  if(body&&body.action==='admin_summary'){
    const authResponse=await authorizeOwnerRequest(request,env);
    if(!authResponse.ok)return restockJson({success:false,message:'Unauthorized.'},401);
    return restockJson(await restockSummary(env));
  }
  if(!sameOriginPost(request))return restockJson({success:false,message:'Origin not allowed.'},403);
  if(body&&body.action!=='vote')return restockJson({success:false,message:'Unsupported action.'},400);
  const raw=Array.isArray(body&&body.selections)?body.selections:[];
  const selections=[...new Set(raw.map(v=>String(v||'').trim()).filter(v=>VESTIGE_RESTOCK_FLAVOURS[v]))];
  if(!selections.length)return restockJson({success:false,message:'Select at least one flavour.'},400);
  if(selections.length!==raw.length)return restockJson({success:false,message:'Invalid or duplicate flavour selection.'},400);
  await writeRestockVote(env,selections);
  return restockJson({success:true,message:'Thank you. Your flavour preferences have been recorded.'});
}


const FLAVOUR_BY_SLUG = Object.freeze({
  'blueberry-mint': 'Blueberry Mint',
  'miami-mint': 'Miami Mint',
  'blue-razz-ice': 'Blue Razz Ice',
  'strawberry-kiwi-ice': 'Strawberry Kiwi Ice',
  'watermelon-ice': 'Watermelon Ice',
});

function availabilityUrl(stock) {
  return Number(stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

const VESTIGE_SHIPPING_DETAILS = Object.freeze({
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: '60.00', currency: 'ZAR' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ZA' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' }
  }
});

const VESTIGE_RETURN_POLICY = Object.freeze({
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'ZA',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
  itemCondition: 'https://schema.org/NewCondition'
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function enrichOfferForGoogle(offer, stock) {
  offer.availability = availabilityUrl(stock);
  offer.itemCondition = offer.itemCondition || 'https://schema.org/NewCondition';
  offer.seller = offer.seller || { '@type': 'Organization', name: 'Vestige Ltd' };
  offer.shippingDetails = cloneJson(VESTIGE_SHIPPING_DETAILS);
  offer.hasMerchantReturnPolicy = cloneJson(VESTIGE_RETURN_POLICY);
}

function enrichFirstProductJsonLd(html, stock) {
  const marker = '<script type="application/ld+json">';
  let cursor = 0;
  while (true) {
    const start = html.indexOf(marker, cursor);
    if (start < 0) return null;
    const jsonStart = start + marker.length;
    const end = html.indexOf('</script>', jsonStart);
    if (end < 0) return null;
    let data;
    try { data = JSON.parse(html.slice(jsonStart, end)); } catch (_) { cursor = end + 9; continue; }

    let product = null;
    if (data?.['@type'] === 'Product') product = data;
    else if (Array.isArray(data?.['@graph'])) product = data['@graph'].find(node => node?.['@type'] === 'Product') || null;
    if (!product || !product.offers || typeof product.offers !== 'object') { cursor = end + 9; continue; }

    enrichOfferForGoogle(product.offers, stock);
    return html.slice(0, jsonStart) + JSON.stringify(data) + html.slice(end);
  }
}

async function injectGoogleAvailability(request, env, response, pathname) {
  if (!getGoogleFacingAvailability || !response.ok || request.method !== 'GET') return response;
  const flavourMatch = pathname.match(/^\/flavours\/([^/]+)$/);
  const isProductHub = pathname === '/bc10000/' || pathname === '/bc10000';
  if (!flavourMatch && !isProductHub) return response;

  try {
    const availability = await getGoogleFacingAvailability(env);
    let stock = 0;
    if (flavourMatch) {
      const flavour = FLAVOUR_BY_SLUG[flavourMatch[1]];
      if (!flavour || !availability?.[flavour]) return response;
      stock = Number(availability[flavour].stock || 0);
    } else {
      stock = Object.values(availability || {}).reduce((sum, state) => sum + Math.max(0, Number(state?.stock || 0)), 0);
    }

    const html = await response.text();
    const updated = enrichFirstProductJsonLd(html, stock);
    if (!updated) return response;
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('X-Vestige-Availability', stock > 0 ? 'in-stock' : 'out-of-stock');
    headers.set('X-Vestige-Merchant-Data', 'v35.26.7');
    return new Response(updated, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    // Fail open: inventory/SEO enrichment must never make a public page unavailable.
    return response;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonical host/path redirects must run before any asset rewrite can return a response.
    const canonicalRedirect = canonicalRedirectResponse(request);
    if (canonicalRedirect) {
      return withSecurityHeaders(canonicalRedirect, url.pathname, url.hostname);
    }


    /* V35_11_2A_EXTENSIONLESS_FLAVOUR_ROUTE_REPAIR
       Serve /flavours/<slug> from the matching .html asset while keeping
       the clean extensionless URL visible to visitors and search engines. */
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      /^\/flavours\/(blueberry-mint|miami-mint|blue-razz-ice|strawberry-kiwi-ice|watermelon-ice)$/.test(url.pathname)
    ) {
      const rewritten = new URL(request.url);
      rewritten.pathname = url.pathname + '.html';

      const assetRequest = new Request(rewritten.toString(), {
        method: request.method,
        headers: request.headers
      });

      const assetResponse = await env.ASSETS.fetch(assetRequest);

      if (assetResponse.status !== 404) {
        const enriched = await injectGoogleAvailability(request, env, assetResponse, url.pathname);
        return withSecurityHeaders(enriched, url.pathname, url.hostname);
      }
    }


    /* V35_26_0_EXTENSIONLESS_PUBLIC_ROUTE_MAP
       Deterministically serve canonical public pages from their .html assets.
       This avoids depending on implicit static-asset HTML handling. */
    if ((request.method === 'GET' || request.method === 'HEAD')) {
      const publicPageAssets = {
        '/contact': '/contact.html',
        '/privacy-policy': '/privacy-policy.html',
        '/terms-and-conditions': '/terms-and-conditions.html',
        '/returns-refunds': '/returns-refunds.html',
        '/vape-durbanville': '/vape-durbanville.html'
      };
      const assetPath = publicPageAssets[url.pathname];
      if (assetPath) {
        const rewritten = new URL(request.url);
        rewritten.pathname = assetPath;
        const assetRequest = new Request(rewritten.toString(), {
          method: request.method,
          headers: request.headers
        });
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        if (assetResponse.status !== 404) {
          return withSecurityHeaders(assetResponse, url.pathname, url.hostname);
        }
      }
    }

    if (url.pathname === '/api/analytics') {
      return withSecurityHeaders(await handleVestigeAnalytics(request, env), url.pathname, url.hostname);
    }

    if (url.pathname === '/api/restock-poll') {
      return withSecurityHeaders(await handleRestockPoll(request, env), url.pathname, url.hostname);
    }

    if (url.pathname === '/api/zoho') {
      return withSecurityHeaders(
        await apiResponse(request, env),
        url.pathname,
        url.hostname
      );
    }


    if (!env.ASSETS) {
      return new Response(
        'Static asset binding is missing.',
        {
          status: 503,
        }
      );
    }

    const publicAssetResponse = await env.ASSETS.fetch(request);
    const merchantEnriched = await injectGoogleAvailability(request, env, publicAssetResponse, url.pathname);
    return withSecurityHeaders(merchantEnriched, url.pathname, url.hostname);
  },

  async scheduled(_controller, env, ctx) {
    bindCleanupRuntime(env);

    ctx.waitUntil(
      cleanupHandler()
    );
  },
};
