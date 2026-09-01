(function () {
  var gate = document.getElementById('ageGate');
  var enter = document.getElementById('enterSite');
  var leave = document.getElementById('leaveSite');
  try { if (sessionStorage.getItem('vestigeAgeAccepted') === '1' && gate) gate.classList.add('hidden'); } catch (e) {}
  if (enter) enter.onclick = function () { try { sessionStorage.setItem('vestigeAgeAccepted', '1'); } catch (e) {} if (gate) gate.classList.add('hidden'); };
  if (leave) leave.onclick = function () { window.location.href = 'https://www.google.com/'; };

  var bankCss = document.createElement('link');
  bankCss.rel = 'stylesheet';
  bankCss.href = 'bank-payments.css';
  document.head.appendChild(bankCss);

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
  var orderTotal = document.getElementById('orderTotal');
  var orderStatus = document.getElementById('orderStatus');
  var stockStatus = document.getElementById('stockStatus');
  var submitButton = document.getElementById('orderSubmit');
  var paymentPanel = document.getElementById('paymentPanel');
  var receiptPanel = document.getElementById('receiptPanel');
  var PRODUCT_PRICE = 300, DELIVERY_PRICE = 60;
  var API_URL = '/api/zoho';
  var availability = {};
  var checkoutToken = '';
  var activeCheckout = null;

  if (paymentPanel) {
    paymentPanel.classList.add('vestige-bank-panel');
    paymentPanel.innerHTML = [
      '<div class="bank-panel-title"><span class="bank-kicker">SECURE PAYMENT</span><h3>Choose how you would like to pay</h3></div>',
      '<div class="bank-checkout-grid">',
        '<div class="bank-main">',
          '<div class="bank-steps" aria-label="Checkout progress"><span class="done">✓<small>Details</small></span><i></i><span class="current">2<small>Payment</small></span></div>',
          '<div class="bank-method-tabs" role="tablist" aria-label="Payment method">',
            '<button class="bank-method active" id="showCapitec" type="button" role="tab" aria-selected="true"><b>▦</b><span>Capitec QR Pay</span></button>',
            '<button class="bank-method" id="showEft" type="button" role="tab" aria-selected="false"><b>▤</b><span>EFT / Bank Transfer</span></button>',
          '</div>',
          '<section class="bank-method-card" id="capitecCard" aria-labelledby="showCapitec">',
            '<h4>CAPITEC QR PAY</h4>',
            '<p class="bank-note">Open the Capitec app, choose Scan to Pay and scan the QR code below. Pay the exact amount shown for this order.</p>',
            '<div class="bank-qr-shell"><img class="bank-qr" id="capitecQr" src="assets/capitec-pay-me.png" alt="Capitec Pay Me QR code"/></div>',
          '</section>',
          '<section class="bank-method-card" id="eftCard" hidden aria-labelledby="showEft">',
            '<h4>EFT / BANK TRANSFER</h4>',
            '<p class="bank-note">Make a payment using your banking app or internet banking. Use the exact short payment reference shown below.</p>',
            '<div class="eft-grid" id="eftGrid"></div>',
          '</section>',
          '<div class="bank-reservation-note"><span>ⓘ</span><p>Your order is reserved for <strong>30 minutes</strong>. It is confirmed only after the actual bank payment has been verified.</p></div>',
          '<div class="bank-status-actions"><button class="btn btn-outline" id="paymentMade" type="button">I have made the payment</button></div>',
        '</div>',
        '<aside class="bank-side">',
          '<div class="bank-side-card order-summary-card">',
            '<h4>ORDER SUMMARY</h4>',
            '<div class="summary-product"><div><strong>ELFBAR BC10000</strong><span id="summaryFlavour">—</span></div><span id="summaryQty">Qty: —</span></div>',
            '<div class="summary-line"><span>Products</span><strong id="summaryProducts">—</strong></div>',
            '<div class="summary-line"><span>Delivery<br><small>The Courier Guy — Locker to Locker</small></span><strong>R60.00</strong></div>',
            '<div class="summary-total"><span>TOTAL</span><strong id="summaryTotal">—</strong></div>',
          '</div>',
          '<div class="bank-side-card reference-card">',
            '<h4>PAYMENT REFERENCE</h4>',
            '<button class="reference-copy" id="copyReference" type="button" title="Copy payment reference"><strong id="bankReference">—</strong><small>Copy</small></button>',
            '<p>Use this reference when making your payment.</p>',
          '</div>',
          '<div class="bank-side-card amount-card"><span>EXACT AMOUNT DUE</span><strong id="bankAmount">—</strong></div>',
        '</aside>',
      '</div>'
    ].join('');
  }
  if (receiptPanel) receiptPanel.hidden = true;

  function makeCheckoutId(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);
  }
  async function apiRequest(payload){
    var r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
    var contentType=(r.headers.get('content-type')||'').toLowerCase();
    var result=contentType.indexOf('application/json')!==-1 ? await r.json() : null;
    if(!r.ok){ var message=(result&&result.message)||('Request failed ('+r.status+').'); var err=new Error(message); err.status=r.status; err.result=result; throw err; }
    return result;
  }
  function money(n){ return 'R'+Number(n||0).toFixed(2); }
  function updateTotals(){
    if(!quantity||!productTotal||!orderTotal)return;
    var qty=Number(quantity.value)||1, products=qty*PRODUCT_PRICE, total=products+DELIVERY_PRICE;
    productTotal.textContent=money(products); orderTotal.textContent=money(total); orderTotal.dataset.amount=total.toFixed(2); validateSelectedStock();
  }
  function validateSelectedStock(){
    if(!flavour||!quantity||!submitButton)return;
    var name=flavour.value, qty=Number(quantity.value)||1, item=availability[name];
    var canOrder=!!(name && item && item.available && Number(item.stock)>=qty && item.itemId && !checkoutToken);
    submitButton.disabled=!canOrder;
    if(!name){ if(stockStatus){stockStatus.className='stock-status';stockStatus.textContent='Select an available flavour.';} return; }
    if(!item || !item.available){ if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent=(item&&item.reason)||'This flavour is not currently available.';} return; }
    if(Number(item.stock)<qty){ if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent='Only '+item.stock+' unit(s) currently available.';} return; }
    if(stockStatus){stockStatus.className='stock-status ok';stockStatus.textContent=item.stock+' unit(s) currently available.';}
  }
  async function loadAvailability(){
    if(!flavour)return;
    flavour.disabled=true; if(submitButton)submitButton.disabled=true;
    try{
      var result=await apiRequest({action:'availability'}); availability=result.availability||{};
      Array.prototype.forEach.call(flavour.options,function(opt,index){ if(index===0){opt.textContent='Select a flavour';return;} var item=availability[opt.value]; opt.disabled=!(item&&item.available); opt.textContent=opt.value+(item&&item.available?' — '+item.stock+' in stock':' — unavailable'); });
      flavour.disabled=false; if(stockStatus){stockStatus.className='stock-status ok';stockStatus.textContent='Live stock verified with Zoho Books.';}
    }catch(e){
      Array.prototype.forEach.call(flavour.options,function(opt,index){if(index>0)opt.disabled=true;}); flavour.disabled=true; if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent='Stock could not be verified. Ordering is disabled for safety.';}
    }
    validateSelectedStock();
  }
  function copyText(value, button){
    if(!value)return;
    var done=function(){ if(!button)return; var old=button.getAttribute('data-copy-label')||'Copy'; button.setAttribute('data-copy-label',old); var small=button.querySelector&&button.querySelector('small'); if(small){small.textContent='Copied';setTimeout(function(){small.textContent=old;},1200);} else {var t=button.textContent;button.textContent='Copied';setTimeout(function(){button.textContent=t;},1200);} };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(value).then(done).catch(function(){}); }
  }
  function renderEft(eft){
    var grid=document.getElementById('eftGrid'); if(!grid)return; grid.innerHTML='';
    if(!eft||!eft.available){ grid.innerHTML='<p class="bank-note">EFT bank details have not yet been configured on this preview Worker.</p>'; return; }
    [['Bank',eft.bankName],['Account holder',eft.accountHolder],['Account number',eft.accountNumber],['Account type',eft.accountType],['Branch code',eft.branchCode],['Reference',activeCheckout&&activeCheckout.paymentReference]].forEach(function(row){
      if(!row[1])return;
      var wrap=document.createElement('div'); wrap.className='eft-row';
      var label=document.createElement('span'); label.textContent=row[0];
      var value=document.createElement('strong'); value.textContent=row[1];
      var btn=document.createElement('button'); btn.type='button'; btn.className='eft-copy'; btn.textContent='Copy'; btn.setAttribute('aria-label','Copy '+row[0]); btn.addEventListener('click',function(){copyText(String(row[1]),btn);});
      wrap.append(label,value,btn); grid.appendChild(wrap);
    });
  }
  function showBankPayment(result){
    activeCheckout=result; checkoutToken=result.checkoutToken||'';
    var o=result.order||{}, qty=Number(o.quantity||0), products=qty*PRODUCT_PRICE;
    var amount=document.getElementById('bankAmount'), ref=document.getElementById('bankReference'), qr=document.getElementById('capitecQr');
    if(amount)amount.textContent=money(o.amount); if(ref)ref.textContent=result.paymentReference||'—';
    if(qr&&result.capitec&&result.capitec.qrImageUrl)qr.src=result.capitec.qrImageUrl;
    var sf=document.getElementById('summaryFlavour'), sq=document.getElementById('summaryQty'), sp=document.getElementById('summaryProducts'), st=document.getElementById('summaryTotal');
    if(sf)sf.textContent=o.flavour||'—'; if(sq)sq.textContent='Qty: '+qty; if(sp)sp.textContent=money(products); if(st)st.textContent=money(o.amount);
    renderEft(result.eft);
    if(paymentPanel)paymentPanel.hidden=false;
    Array.prototype.forEach.call(form.elements,function(el){ if(el.id!=='paymentMade' && el.tagName!=='BUTTON') el.disabled=true; });
    if(paymentPanel&&paymentPanel.scrollIntoView)paymentPanel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function selectMethod(method){
    var capBtn=document.getElementById('showCapitec'), eftBtn=document.getElementById('showEft'), cap=document.getElementById('capitecCard'), eft=document.getElementById('eftCard');
    var capActive=method==='capitec';
    if(cap)cap.hidden=!capActive; if(eft)eft.hidden=capActive;
    if(capBtn){capBtn.classList.toggle('active',capActive);capBtn.setAttribute('aria-selected',capActive?'true':'false');}
    if(eftBtn){eftBtn.classList.toggle('active',!capActive);eftBtn.setAttribute('aria-selected',!capActive?'true':'false');}
  }

  if(quantity)quantity.addEventListener('change',updateTotals);
  if(flavour)flavour.addEventListener('change',validateSelectedStock);
  updateTotals(); loadAvailability();

  if(form){
    form.addEventListener('submit',async function(event){
      event.preventDefault(); if(!form.reportValidity())return; validateSelectedStock(); if(submitButton&&submitButton.disabled)return;
      var data=new FormData(form), qty=Number(data.get('quantity'))||1, selected=availability[String(data.get('flavour')||'')]||{};
      var payload={ action:'prepare_bank_order', checkoutId:makeCheckoutId(), customerName:String(data.get('name')||''), email:String(data.get('email')||''), mobile:String(data.get('mobile')||''), addressLine1:String(data.get('addressLine1')||''), addressLine2:String(data.get('addressLine2')||''), city:String(data.get('city')||''), province:String(data.get('province')||''), postalCode:String(data.get('postalCode')||''), country:String(data.get('country')||'South Africa'), courierLocker:String(data.get('courierLocker')||''), flavour:String(data.get('flavour')||''), itemId:String(selected.itemId||''), quantity:qty, amount:qty*PRODUCT_PRICE+DELIVERY_PRICE };
      submitButton.disabled=true; if(orderStatus)orderStatus.textContent='Rechecking live stock and reserving your order for bank payment…'; if(paymentPanel)paymentPanel.hidden=true;
      try{ var result=await apiRequest(payload); showBankPayment(result); if(orderStatus)orderStatus.textContent=result.message; }
      catch(e){ if(orderStatus)orderStatus.textContent=e.message||'Unable to reserve the order.'; checkoutToken=''; activeCheckout=null; await loadAvailability(); }
      finally{ validateSelectedStock(); }
    });
  }

  document.addEventListener('click',function(event){
    var target=event.target;
    if(target&&target.closest){
      var cap=target.closest('#showCapitec'), eft=target.closest('#showEft'), copyRef=target.closest('#copyReference'), paid=target.closest('#paymentMade');
      if(cap){selectMethod('capitec');return;}
      if(eft){selectMethod('eft');return;}
      if(copyRef){copyText(activeCheckout&&activeCheckout.paymentReference||'',copyRef);return;}
      if(paid){
        if(!checkoutToken){ if(orderStatus)orderStatus.textContent='No pending bank-payment checkout was found.'; return; }
        paid.disabled=true; if(orderStatus)orderStatus.textContent='Checking order payment status…';
        apiRequest({action:'bank_payment_status',checkoutToken:checkoutToken}).then(function(result){
          if(result.paymentStatus==='confirmed'){ if(orderStatus)orderStatus.textContent='Payment verified. Your order is confirmed.'; }
          else if(result.paymentStatus==='expired'){ if(orderStatus)orderStatus.textContent='This payment reservation has expired. Please start a new checkout.'; }
          else { if(orderStatus)orderStatus.textContent='Payment noted. Your order remains pending until the actual bank credit is verified.'; }
        }).catch(function(e){ if(orderStatus)orderStatus.textContent=e.message||'Unable to check payment status.'; }).finally(function(){paid.disabled=false;});
      }
    }
  });
})();
