(function () {
  var gate = document.getElementById('ageGate');
  var enter = document.getElementById('enterSite');
  var leave = document.getElementById('leaveSite');
  try { if (sessionStorage.getItem('vestigeAgeAccepted') === '1' && gate) gate.classList.add('hidden'); } catch (e) {}
  if (enter) enter.onclick = function () { try { sessionStorage.setItem('vestigeAgeAccepted', '1'); } catch (e) {} if (gate) gate.classList.add('hidden'); };
  if (leave) leave.onclick = function () { window.location.href = 'https://www.google.com/'; };

  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) toggle.onclick = function () { var open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); };

  var left = document.getElementById('calloutLeft');
  var right = document.getElementById('calloutRight');
  var bottom = document.getElementById('calloutBottom');
  var count = document.getElementById('cycleCount');
  if (left && right && bottom) {
    var states = [
      ['Rechargeable','620 mAh battery','USB-C','Type-C charging','Draw-activated','Automatic activation'],
      ['50 mg/ml','Nicotine strength','Mesh coil','Flavour/vapour system','Button-free','No firing button'],
      ['Up to 10,000','Usage dependent','Pre-filled','Non-refillable system','Pocket-sized','All-in-one format'],
      ['USB-C','Charging connection','620 mAh','Rechargeable battery','Sealed system','Pre-filled format']
    ];
    var i = 0;
    function setState(){ var s=states[i]; left.innerHTML='<span class="dot"></span><span><b>'+s[0]+'</b><small>'+s[1]+'</small></span>'; right.innerHTML='<span><b>'+s[2]+'</b><small>'+s[3]+'</small></span><span class="dot"></span>'; bottom.innerHTML='<span class="dot"></span><span><b>'+s[4]+'</b><small>'+s[5]+'</small></span>'; if(count) count.textContent=('0'+(i+1)).slice(-2); i=(i+1)%states.length; }
    setInterval(setState,3200);
  }

  var form = document.getElementById('orderForm');
  var quantity = document.getElementById('quantity');
  var flavour = document.getElementById('flavourSelect');
  var productTotal = document.getElementById('productTotal');
  var productSummaryLabel = document.getElementById('productSummaryLabel');
  var orderTotal = document.getElementById('orderTotal');
  var orderStatus = document.getElementById('orderStatus');
  var stockStatus = document.getElementById('stockStatus');
  var submitButton = document.getElementById('orderSubmit');
  var retryStock = document.getElementById('retryStock');
  var paymentPanel = document.getElementById('paymentPanel');
  var paymentLink = document.getElementById('paymentLink');
  var verifyPayment = document.getElementById('verifyPayment');
  var receiptPanel = document.getElementById('receiptPanel');
  var downloadReceipt = document.getElementById('downloadReceipt');
  var PRODUCT_PRICE = 300, DELIVERY_PRICE = 60;
  var API_URL = '/api/zoho';
  var availability = {};
  var checkoutToken = '';
  var stockLoaded = false;
  var stockLoading = false;
  var orderInFlight = false;

  var CHECKOUT_SESSION_KEY='vestigePendingCheckoutV3';
  var checkoutSessionMemory=null;
  function makeCheckoutId(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    if(window.crypto && typeof window.crypto.getRandomValues === 'function'){
      var bytes=new Uint8Array(16); window.crypto.getRandomValues(bytes);
      var hex=Array.prototype.map.call(bytes,function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
      return 'web-'+hex;
    }
    return 'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14)+'-'+Math.random().toString(36).slice(2,10);
  }
  function checkoutFingerprint(payload){
    return [
      String(payload.customerName||'').trim().toLowerCase(),
      String(payload.email||'').trim().toLowerCase(),
      String(payload.mobile||'').trim(),
      String(payload.addressLine1||'').trim().toLowerCase(),
      String(payload.addressLine2||'').trim().toLowerCase(),
      String(payload.city||'').trim().toLowerCase(),
      String(payload.province||'').trim().toLowerCase(),
      String(payload.postalCode||'').trim().toLowerCase(),
      String(payload.country||'').trim().toLowerCase(),
      String(payload.courierLocker||'').trim().toLowerCase(),
      String(payload.flavour||''),
      String(payload.itemId||''),
      String(payload.quantity||''),
      String(payload.amount||'')
    ].join('|');
  }
  function getOrCreateCheckoutId(payload){
    var fingerprint=checkoutFingerprint(payload), stored=checkoutSessionMemory;
    if(!stored){try{stored=JSON.parse(sessionStorage.getItem(CHECKOUT_SESSION_KEY)||'null');}catch(e){stored=null;}}
    if(stored && /^[A-Za-z0-9-]{16,80}$/.test(String(stored.id||'')) && stored.fingerprint===fingerprint){checkoutSessionMemory=stored;return stored.id;}
    var id=makeCheckoutId();
    checkoutSessionMemory={id:id,fingerprint:fingerprint};
    try{sessionStorage.setItem(CHECKOUT_SESSION_KEY,JSON.stringify(checkoutSessionMemory));}catch(e){}
    return id;
  }
  function clearCheckoutId(){
    checkoutSessionMemory=null;
    try{sessionStorage.removeItem(CHECKOUT_SESSION_KEY);}catch(e){}
  }
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

  async function apiRequest(payload, options){
    options=options||{};
    var maxAttempts=options.retryTransient ? 3 : 1;
    var lastError=null;
    for(var attempt=0;attempt<maxAttempts;attempt+=1){
      try{
        var r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)});
        var contentType=(r.headers.get('content-type')||'').toLowerCase();
        var result=contentType.indexOf('application/json')!==-1 ? await r.json() : null;
        if(!r.ok){
          var message=(result&&result.message)||('Request failed ('+r.status+').');
          var err=new Error(message); err.status=r.status; err.payload=result;
          var transient=r.status===503 || r.status===504;
          if(options.retryTransient && transient && attempt<maxAttempts-1){
            var retryAfter=Number(r.headers.get('retry-after'));
            await wait(Number.isFinite(retryAfter)&&retryAfter>0?Math.min(2500,retryAfter*1000):(700*(attempt+1)));
            continue;
          }
          throw err;
        }
        return result;
      }catch(e){
        lastError=e;
        // A network failure has no HTTP status. prepare_order is safe to repeat with
        // the same checkoutId because the backend uses durable idempotency/recovery.
        if(options.retryTransient && !e.status && attempt<maxAttempts-1){await wait(700*(attempt+1));continue;}
        throw e;
      }
    }
    throw lastError||new Error('Unable to contact the checkout service.');
  }

  function selectedItemId(){
    if(!flavour || !flavour.value) return '';
    var option=flavour.options[flavour.selectedIndex];
    return (option&&option.dataset&&option.dataset.itemId) || (availability[flavour.value]&&availability[flavour.value].itemId) || '';
  }

  function updateTotals(){
    if(!quantity||!productTotal||!orderTotal)return;
    var qty=Number(quantity.value);
    if(!Number.isInteger(qty) || qty < 1){
      productTotal.textContent='';
      if(productSummaryLabel) productSummaryLabel.textContent='Products';
      orderTotal.textContent='';
      orderTotal.dataset.amount='';
      validateSelection();
      return;
    }
    var products=qty*PRODUCT_PRICE;
    var total=products+DELIVERY_PRICE;
    productTotal.textContent='R'+products.toFixed(2);
    if(productSummaryLabel) productSummaryLabel.textContent='BC10000 × '+qty;
    orderTotal.textContent='R'+total.toFixed(2);
    orderTotal.dataset.amount=total.toFixed(2);
    validateSelection();
  }

  function validateSelection(){
    if(!flavour||!quantity||!submitButton)return;
    var name=flavour.value;
    var qty=Number(quantity.value);
    var validQty=Number.isInteger(qty) && qty>=1 && qty<=5;
    var state=name ? availability[name] : null;
    var hasVerifiedItem=!!(state && state.available===true && state.itemId && Number.isFinite(Number(state.stock)));
    var enoughStock=!!(hasVerifiedItem && Number(state.stock)>=qty);
    var hasItemId=!!selectedItemId();

    submitButton.disabled=!(stockLoaded && name && validQty && enoughStock && hasItemId && !checkoutToken && !orderInFlight);

    if(stockLoading){
      if(stockStatus){stockStatus.className='stock-status';stockStatus.textContent='Checking product availability in Zoho Books…';}
      return;
    }
    if(!stockLoaded){
      if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent='Product availability has not been verified. Please use Retry stock check.';}
      return;
    }
    if(!name){
      if(stockStatus){stockStatus.className='stock-status ok';stockStatus.textContent='Live stock loaded. Select an available flavour.';}
      return;
    }
    if(!state || state.available!==true || !state.itemId){
      if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent=(state&&state.reason)||'This flavour is not currently available.';}
      return;
    }
    if(!validQty){
      if(stockStatus){stockStatus.className='stock-status ok';stockStatus.textContent=state.stock+' unit(s) in stock.';}
      return;
    }
    if(Number(state.stock)<qty){
      if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent='Only '+state.stock+' unit(s) are currently available.';}
      return;
    }
    if(stockStatus){stockStatus.className='stock-status ok';stockStatus.textContent='In stock. Ready to order.';}
  }

  function applyAvailability(result){
    availability=(result&&result.availability)||{};
    stockLoaded=true;
    stockLoading=false;
    var availableCount=0;
    Array.prototype.forEach.call(flavour.options,function(opt,index){
      if(index===0){opt.textContent='Select a flavour';opt.disabled=false;if(opt.dataset)opt.dataset.itemId='';return;}
      var item=availability[opt.value];
      var verified=!!(item && item.itemId && Number.isFinite(Number(item.stock)));
      var availableNow=!!(verified && item.available===true && Number(item.stock)>0);
      opt.disabled=!availableNow;
      if(opt.dataset)opt.dataset.itemId=(item&&item.itemId)?String(item.itemId):'';
      if(availableNow) availableCount+=1;
      opt.textContent=opt.value+(availableNow?' — '+item.stock+' in stock':' — unavailable');
    });
    flavour.disabled=false;
    if(quantity)quantity.disabled=false;
    if(flavour.value){
      var selected=availability[flavour.value];
      if(!selected || selected.available!==true || !selected.itemId || Number(selected.stock)<=0){
        flavour.value='';
        if(quantity)quantity.value='';
        updateTotals();
      } else if(quantity && quantity.value){
        var q=Number(quantity.value);
        if(Number.isInteger(q) && q>Number(selected.stock)){
          quantity.value=String(Math.max(1, Number(selected.stock)));
          updateTotals();
        }
      }
    }
    if(retryStock)retryStock.hidden=true;
    if(stockStatus){
      stockStatus.className=availableCount?'stock-status ok':'stock-status warn';
      stockStatus.textContent=availableCount ? 'Live stock loaded from Zoho Books. '+availableCount+' flavour'+(availableCount===1?' is':'s are')+' available.' : 'No BC10000 flavours are currently confirmed in stock.';
    }
    validateSelection();
  }

  async function loadAvailability(){
    if(!flavour)return;
    stockLoading=true;
    stockLoaded=false;
    availability={};
    flavour.disabled=true;
    if(quantity)quantity.disabled=true;
    if(submitButton)submitButton.disabled=true;
    if(retryStock)retryStock.hidden=true;
    if(stockStatus){stockStatus.className='stock-status';stockStatus.textContent='Checking product availability in Zoho Books…';}
    try{
      // One authoritative five-item stock refresh. This is intentionally run only
      // on page load/reload or when the customer explicitly clicks Retry stock check.
      var result=await apiRequest({action:'availability'},{retryTransient:true});
      applyAvailability(result);
    }catch(e){
      stockLoading=false;
      stockLoaded=false;
      availability={};
      Array.prototype.forEach.call(flavour.options,function(opt,index){
        if(index>0){opt.disabled=true;opt.textContent=opt.value+' — unavailable';if(opt.dataset)opt.dataset.itemId='';}
      });
      flavour.disabled=false;
      if(quantity)quantity.disabled=false;
      if(retryStock)retryStock.hidden=false;
      if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent='Unable to load live stock from Zoho Books. Please click Retry stock check.';}
      validateSelection();
    }
  }

  if(quantity)quantity.addEventListener('change',updateTotals);
  if(flavour)flavour.addEventListener('change',function(){
    if(quantity && quantity.value) updateTotals();
    else validateSelection();
  });
  if(retryStock)retryStock.addEventListener('click',function(){ if(orderInFlight||checkoutToken) return; loadAvailability(); });
  updateTotals();
  loadAvailability();
  // Safari, Firefox and Chromium can restore a page from the back/forward cache
  // without performing a normal reload. Treat that restore as a page load and
  // refresh the five-item Zoho stock snapshot once.
  window.addEventListener('pageshow',function(event){ if(event.persisted) loadAvailability(); });

  if(form){
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      if(orderInFlight || checkoutToken) return;
      if(!form.reportValidity())return;
      validateSelection();
      var selectedQty=Number(quantity&&quantity.value);
      var state=availability[flavour&&flavour.value];
      if(state && (state.available===false || (Number.isFinite(Number(state.stock)) && Number(state.stock)<selectedQty))){
        if(orderStatus)orderStatus.textContent=state.reason||'The selected quantity is not currently available.';
        return;
      }
      // The page-load stock snapshot controls the customer experience. The backend
      // silently performs the mandatory final Zoho stock check before creating anything.
      if(submitButton&&submitButton.disabled)return;
      var itemId=selectedItemId();
      if(!itemId){
        if(orderStatus)orderStatus.textContent='Product stock identity is missing. Please use Retry stock check and select the flavour again.';
        return;
      }
      var data=new FormData(form), qty=Number(data.get('quantity'));
      if(!Number.isInteger(qty) || qty<1 || qty>5){ if(orderStatus)orderStatus.textContent='Please select a quantity.'; return; }
      var payload={
        action:'prepare_order',
        customerName:String(data.get('name')||''),
        email:String(data.get('email')||''),
        mobile:String(data.get('mobile')||''),
        addressLine1:String(data.get('addressLine1')||''),
        addressLine2:String(data.get('addressLine2')||''),
        city:String(data.get('city')||''),
        province:String(data.get('province')||''),
        postalCode:String(data.get('postalCode')||''),
        country:String(data.get('country')||'South Africa'),
        courierLocker:String(data.get('courierLocker')||''),
        flavour:String(data.get('flavour')||''),
        itemId:itemId,
        quantity:qty,
        amount:qty*PRODUCT_PRICE+DELIVERY_PRICE
      };
      payload.checkoutId=getOrCreateCheckoutId(payload);
      orderInFlight=true;
      submitButton.disabled=true;
      if(orderStatus)orderStatus.textContent='Preparing your order and secure full-payment invoice…';
      if(paymentPanel)paymentPanel.hidden=true;
      if(receiptPanel)receiptPanel.hidden=true;
      try{
        var result=await apiRequest(payload,{retryTransient:true});
        checkoutToken=result.checkoutToken||'';
        if(orderStatus)orderStatus.textContent=result.message;
        if(paymentLink&&result.paymentUrl){paymentLink.href=result.paymentUrl;}
        if(paymentPanel)paymentPanel.hidden=false;
        Array.prototype.forEach.call(form.elements,function(el){
          if(el!==verifyPayment && el!==downloadReceipt && el.tagName!=='BUTTON') el.disabled=true;
        });
      }catch(e){
        checkoutToken='';
        if(orderStatus)orderStatus.textContent=e.message||'Unable to prepare the order.';
        // Stock conflict: apply server snapshot if present, otherwise refresh.
        // Lock/busy 503: keep the current stock view — another shopper is mid-purchase;
        // transient retry already ran. Only hard stock 409 forces a full refresh.
        if(e.payload && e.payload.availability){
          applyAvailability(e.payload);
        } else if(e.status===409){
          try { await loadAvailability(); } catch(_) {}
        }
      }finally{
        orderInFlight=false;
        validateSelection();
      }
    });
  }

  if(verifyPayment){
    verifyPayment.addEventListener('click',async function(){
      if(!checkoutToken){if(orderStatus)orderStatus.textContent='No pending checkout session was found. Please start the order again.';return;}
      verifyPayment.disabled=true;
      if(orderStatus)orderStatus.textContent='Verifying the exact paid invoice and successful PayPal payment record in Zoho Books…';
      try{
        var result=await apiRequest({action:'verify_payment',checkoutToken:checkoutToken});
        if(orderStatus)orderStatus.textContent=result.message+(result.order&&result.order.salesOrderNumber?' Order '+result.order.salesOrderNumber+'.':'');
        clearCheckoutId();
        if(paymentPanel)paymentPanel.hidden=true;
        if(receiptPanel)receiptPanel.hidden=false;
      }catch(e){
        if(orderStatus)orderStatus.textContent=e.message||'Full payment has not yet been verified.';
      }finally{
        verifyPayment.disabled=false;
      }
    });
  }

  if(downloadReceipt){
    downloadReceipt.addEventListener('click',async function(){
      if(!checkoutToken)return;
      downloadReceipt.disabled=true;
      if(orderStatus)orderStatus.textContent='Generating your verified Zoho Books payment receipt…';
      try{
        var r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'payment_receipt',checkoutToken:checkoutToken})});
        if(!r.ok){
          var result=null; try{result=await r.json();}catch(_){ }
          throw new Error((result&&result.message)||'Unable to retrieve the payment receipt.');
        }
        var blob=await r.blob();
        if(blob.type!=='application/pdf')throw new Error('The receipt response was not a PDF.');
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a'); a.href=url; a.download='Vestige-Payment-Receipt.pdf'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){URL.revokeObjectURL(url);},1000);
        if(orderStatus)orderStatus.textContent='Payment receipt downloaded.';
      }catch(e){
        if(orderStatus)orderStatus.textContent=e.message||'Unable to retrieve the payment receipt.';
      }finally{
        downloadReceipt.disabled=false;
      }
    });
  }
})();
