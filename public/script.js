(function () {
  var gate = document.getElementById('ageGate');
  var enter = document.getElementById('enterSite');
  var leave = document.getElementById('leaveSite');
  try { if (sessionStorage.getItem('vestigeAgeAccepted') === '1' && gate) gate.classList.add('hidden'); } catch (e) {}
  if (enter) enter.onclick = function () { try { sessionStorage.setItem('vestigeAgeAccepted', '1'); } catch (e) {} if (gate) gate.classList.add('hidden'); };
  if (leave) leave.onclick = function () { window.location.href = 'https://www.google.com/'; };

  var bankCss = document.createElement('link'); bankCss.rel='stylesheet'; bankCss.href='bank-payments.css?v=35.22.0'; document.head.appendChild(bankCss);
  var paymentVisibilityCss = document.createElement('link'); paymentVisibilityCss.rel='stylesheet'; paymentVisibilityCss.href='payment-visibility.css?v=35.22.0'; document.head.appendChild(paymentVisibilityCss);
  var toggle=document.getElementById('navToggle'), nav=document.getElementById('mainNav');
  if(toggle&&nav) toggle.onclick=function(){var open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open?'true':'false');};

  var left=document.getElementById('calloutLeft'), right=document.getElementById('calloutRight'), bottom=document.getElementById('calloutBottom'), count=document.getElementById('cycleCount');
  if(left&&right&&bottom){var states=[['Rechargeable','620 mAh battery','USB-C','Type-C charging','Draw-activated','Automatic activation'],['50 mg/ml','Nicotine strength','Mesh coil','Flavour/vapour system','Button-free','No firing button'],['Up to 10,000','Usage dependent','Pre-filled','Non-refillable system','Pocket-sized','All-in-one format'],['USB-C','Charging connection','620 mAh','Rechargeable battery','Sealed system','Pre-filled format']];var si=0;function setState(){var s=states[si];left.innerHTML='<span class="dot"></span><span><b>'+s[0]+'</b><small>'+s[1]+'</small></span>';right.innerHTML='<span><b>'+s[2]+'</b><small>'+s[3]+'</small></span><span class="dot"></span>';bottom.innerHTML='<span class="dot"></span><span><b>'+s[4]+'</b><small>'+s[5]+'</small></span>';if(count)count.textContent=('0'+(si+1)).slice(-2);si=(si+1)%states.length;}setState();setInterval(setState,3200);}

  var form=document.getElementById('orderForm'), quantity=document.getElementById('quantity'), flavour=document.getElementById('flavourSelect');
  var checkoutShell=document.querySelector('.checkout-shell'), soldOutOverlay=document.getElementById('soldOutOverlay'), soldOutRetry=document.getElementById('soldOutRetry');
  var productTotal=document.getElementById('productTotal'), orderTotal=document.getElementById('orderTotal'), orderStatus=document.getElementById('orderStatus'), stockStatus=document.getElementById('stockStatus');
  var deliveryMethodInputs=document.querySelectorAll('input[name="deliveryMethod"]'), courierLockerWrap=document.getElementById('courierLockerWrap'), collectionNote=document.getElementById('collectionNote'), courierLockerInput=form&&form.elements?form.elements.courierLocker:null;
  var collectionMethod=document.getElementById('collectionMethod'), collectionOption=document.getElementById('collectionOption'), collectionCodeInput=document.getElementById('collectionAccessCode'), validateCollectionButton=document.getElementById('validateCollectionAccess'), collectionAccessStatus=document.getElementById('collectionAccessStatus'), collectionLockLabel=document.getElementById('collectionLockLabel');
  var submitButton=document.getElementById('orderSubmit'), paymentPanel=document.getElementById('paymentPanel'), receiptPanel=document.getElementById('receiptPanel');
  var PRODUCT_PRICE=300, DELIVERY_PRICE=60, API_URL='/api/zoho', availability={}, checkoutToken='', activeCheckout=null, cart=[], checkoutBusy=false, reservationTimer=null, collectionAccessToken='', draftCheckoutId=makeCheckoutId(), globalSoldOut=false;

  // Flavour/quantity are basket-builder controls, not final form requirements.
  // Their validity is enforced before an item can be added to the basket.
  if(flavour) flavour.required=false;
  if(quantity) quantity.required=false;

  function money(n){return 'R'+Number(n||0).toFixed(2);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function availabilityConfirmsSoldOut(){
    var names=Array.prototype.map.call(flavour&&flavour.options||[],function(opt){return String(opt.value||'').trim();}).filter(Boolean);
    return names.length>0&&names.every(function(name){
      var item=availability[name];
      var stock=Number(item&&item.stock);
      return !!item&&Number.isFinite(stock)&&stock<=0;
    });
  }
  function setShopSoldOut(soldOut){
    var effective=!!soldOut&&!activeCheckout&&!checkoutToken;
    globalSoldOut=effective;
    if(checkoutShell)checkoutShell.classList.toggle('is-sold-out',effective);
    if(soldOutOverlay)soldOutOverlay.hidden=!effective;
    if(form){form.toggleAttribute('inert',effective);if(effective)form.setAttribute('aria-disabled','true');else form.removeAttribute('aria-disabled');}
  }
  function cartQuantity(){return cart.reduce(function(sum,item){return sum+Number(item.quantity||0);},0);}
  function cartProductsTotal(){return cartQuantity()*PRODUCT_PRICE;}
  var BASKET_SESSION_KEY='vestigeBasketV1';
  function saveBasketSession(){
    try{
      if(cart.length)sessionStorage.setItem(BASKET_SESSION_KEY,JSON.stringify(cart));
      else sessionStorage.removeItem(BASKET_SESSION_KEY);
    }catch(_){}
  }
  function restoreBasketSession(){
    try{
      var stored=JSON.parse(sessionStorage.getItem(BASKET_SESSION_KEY)||'[]');
      if(!Array.isArray(stored))return;
      var validFlavours=Array.prototype.map.call(flavour&&flavour.options||[],function(opt){return String(opt.value||'');});
      cart=stored.map(function(item){
        return {flavour:String(item&&item.flavour||''),itemId:String(item&&item.itemId||''),quantity:Number(item&&item.quantity||0)};
      }).filter(function(item){
        return validFlavours.indexOf(item.flavour)!==-1&&item.itemId&&Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=5;
      });
    }catch(_){cart=[];}
  }
  function revalidateBasketAgainstAvailability(){
    cart=cart.map(function(item){
      var live=availability[item.flavour];
      var liveId=String(live&&(live.itemId||live.item_id)||'').trim();
      var quantity=Math.min(Number(item.quantity||0),Number(live&&live.stock||0),5);
      return live&&live.available&&liveId&&quantity>0?{flavour:item.flavour,itemId:liveId,quantity:quantity}:null;
    }).filter(Boolean);
    renderCart();
  }
  function publishCartSummary(){
    if(!form)return;
    var summary={
      items:cart.map(function(item){return {flavour:item.flavour,quantity:Number(item.quantity||0)};}),
      totalQuantity:cartQuantity(),
      productsTotal:cartProductsTotal(),
      deliveryMethod:selectedDeliveryMethod(),
      deliveryPrice:currentDeliveryPrice(),
      grandTotal:cartGrandTotal()
    };
    form.dataset.basketSummary=JSON.stringify(summary);
    document.dispatchEvent(new CustomEvent('vestige:cart-updated',{detail:summary}));
  }

  function resetCollectionAccess(){
    collectionAccessToken='';
    draftCheckoutId=makeCheckoutId();
    if(collectionMethod){collectionMethod.checked=false;collectionMethod.disabled=true;}
    var courier=document.querySelector('input[name="deliveryMethod"][value="courier_locker"]');
    if(courier)courier.checked=true;
    if(collectionOption)collectionOption.classList.add('fulfilment-option-locked');
    if(collectionCodeInput){collectionCodeInput.value='';collectionCodeInput.disabled=false;}
    if(validateCollectionButton){validateCollectionButton.disabled=false;validateCollectionButton.textContent='Validate collection code';}
    if(collectionAccessStatus){collectionAccessStatus.textContent='Collection remains locked until the code is validated.';collectionAccessStatus.className='collection-access-status';}
    if(collectionLockLabel)collectionLockLabel.textContent='— access code required';
    syncFulfilmentUi();
  }
  async function validateCollectionAccess(){
    var code=String(collectionCodeInput&&collectionCodeInput.value||'');
    if(!code){
      if(collectionAccessStatus){collectionAccessStatus.textContent='Enter the collection access code first.';collectionAccessStatus.className='collection-access-status error';}
      return;
    }
    if(validateCollectionButton)validateCollectionButton.disabled=true;
    if(collectionAccessStatus){collectionAccessStatus.textContent='Validating collection access…';collectionAccessStatus.className='collection-access-status';}
    try{
      var result=await apiRequest({action:'verify_collection_access',checkoutId:draftCheckoutId,code:code});
      collectionAccessToken=String(result.collectionAccessToken||'');
      if(!collectionAccessToken)throw new Error('Collection authorisation token was not returned.');
      if(collectionMethod){collectionMethod.disabled=false;collectionMethod.checked=true;}
      var courier=document.querySelector('input[name="deliveryMethod"][value="courier_locker"]');
      if(courier)courier.checked=false;
      if(collectionOption)collectionOption.classList.remove('fulfilment-option-locked');
      if(collectionCodeInput){collectionCodeInput.value='';collectionCodeInput.disabled=true;}
      if(validateCollectionButton){validateCollectionButton.textContent='Collection unlocked';validateCollectionButton.disabled=true;}
      if(collectionAccessStatus){collectionAccessStatus.textContent='Collection access approved for this checkout.';collectionAccessStatus.className='collection-access-status ok';}
      if(collectionLockLabel)collectionLockLabel.textContent='— unlocked';
      syncFulfilmentUi();
    }catch(e){
      collectionAccessToken='';
      if(collectionMethod){collectionMethod.checked=false;collectionMethod.disabled=true;}
      var courier=document.querySelector('input[name="deliveryMethod"][value="courier_locker"]');
      if(courier)courier.checked=true;
      if(collectionOption)collectionOption.classList.add('fulfilment-option-locked');
      if(collectionAccessStatus){collectionAccessStatus.textContent=e.message||'Collection access code was not accepted.';collectionAccessStatus.className='collection-access-status error';}
      if(validateCollectionButton)validateCollectionButton.disabled=false;
      syncFulfilmentUi();
    }
  }

  function selectedDeliveryMethod(){
    var selected=document.querySelector('input[name="deliveryMethod"]:checked');
    return selected&&selected.value==='collection'?'collection':'courier_locker';
  }
  function currentDeliveryPrice(){return selectedDeliveryMethod()==='collection'?0:DELIVERY_PRICE;}
  function cartGrandTotal(){return cart.length?cartProductsTotal()+currentDeliveryPrice():0;}
  function syncFulfilmentUi(){
    if(selectedDeliveryMethod()==='collection'&&!collectionAccessToken){
      if(collectionMethod)collectionMethod.checked=false;
      var fallback=document.querySelector('input[name="deliveryMethod"][value="courier_locker"]');
      if(fallback)fallback.checked=true;
    }
    var collection=selectedDeliveryMethod()==='collection';
    if(courierLockerWrap)courierLockerWrap.hidden=collection;
    if(collectionNote)collectionNote.hidden=!collection;
    if(courierLockerInput){
      courierLockerInput.required=!collection;
      courierLockerInput.disabled=collection;
      if(collection)courierLockerInput.value='';
    }
    var label=document.getElementById('deliverySummaryLabel');
    if(label)label.textContent=collection?'Collection':'Courier Guy Locker';
    renderCart();
  }

  if(paymentPanel){paymentPanel.classList.add('vestige-bank-panel');paymentPanel.innerHTML=[
    '<div class="bank-panel-title"><span class="bank-kicker">SECURE PAYMENT</span><h3>Choose how you would like to pay</h3></div>',
    '<div class="bank-checkout-grid"><div class="bank-main">',
    '<div class="bank-steps" aria-label="Checkout progress"><span class="done">✓<small>Details</small></span><i></i><span class="current">2<small>Payment</small></span></div>',
    '<div class="bank-method-tabs" role="tablist" aria-label="Payment method"><button class="bank-method active" id="showCapitec" type="button" role="tab" aria-selected="true" aria-controls="capitecCard"><b>▦</b><span>Capitec QR Pay</span></button><button class="bank-method" id="showEft" type="button" role="tab" aria-selected="false" aria-controls="eftCard"><b>▤</b><span>EFT / Bank Transfer</span></button></div>',
    '<section class="bank-method-card" id="capitecCard" role="tabpanel" aria-labelledby="showCapitec"><h4>CAPITEC QR PAY</h4><p class="bank-note">Open the Capitec app, choose Scan to Pay and scan the QR code below. Pay the exact amount shown for this order.</p><div class="bank-qr-shell"><img class="bank-qr" id="capitecQr" src="assets/capitec-pay-me.png" alt="Capitec Pay Me QR code"/></div></section>',
    '<section class="bank-method-card" id="eftCard" role="tabpanel" aria-labelledby="showEft" hidden><h4>EFT / BANK TRANSFER</h4><p class="bank-note">Make a payment using your banking app or internet banking. Use the exact short payment reference shown below.</p><div class="eft-grid" id="eftGrid"></div></section>',
    '<div class="bank-reservation-note"><span>ⓘ</span><p>Your complete basket is reserved while payment is pending. <strong id="customerReservationCountdown">30:00 remaining</strong><small class="bank-recovery-note">You can safely refresh this page in the same browser tab — your pending payment screen will be restored.</small></p></div>',
    '<p class="bank-live-status" id="paymentLiveStatus" role="status" aria-live="polite"></p><div class="bank-status-actions"><button class="btn btn-outline" id="paymentMade" type="button">I have made the payment</button><button class="btn bank-return-shop" id="returnToShop" type="button">Return to shop &amp; edit basket</button><button class="btn bank-cancel-order" id="cancelBankOrder" type="button">Cancel order &amp; release stock</button></div></div>',
    '<aside class="bank-side"><div class="bank-side-card order-summary-card"><h4>ORDER SUMMARY</h4><div id="summaryItems" class="summary-items"></div><div class="summary-line"><span>Products</span><strong id="summaryProducts">—</strong></div><div class="summary-line"><span id="paymentFulfilmentLabel">Delivery<br><small>The Courier Guy — Locker to Locker</small></span><strong id="paymentDeliveryCharge">R60.00</strong></div><div class="summary-total"><span>TOTAL</span><strong id="summaryTotal">—</strong></div></div>',
    '<div class="bank-side-card reference-card"><h4>PAYMENT REFERENCE</h4><button class="reference-copy" id="copyReference" type="button"><strong id="bankReference">—</strong><small>Copy</small></button><p>Use this reference when making your payment.</p></div>',
    '<div class="bank-side-card amount-card"><span>EXACT AMOUNT DUE</span><strong id="bankAmount">—</strong></div></aside></div>'
  ].join('');}
  if(orderStatus&&window.MutationObserver){
    var paymentStatusObserver=new MutationObserver(function(){var live=document.getElementById('paymentLiveStatus');if(live)live.textContent=orderStatus.textContent||'';});
    paymentStatusObserver.observe(orderStatus,{childList:true,characterData:true,subtree:true});
  }
  if(receiptPanel)receiptPanel.hidden=true;

  var addButton=document.getElementById('addToBasket'), cartBox=document.getElementById('vestigeCart');
  if(form&&submitButton){
    form.setAttribute('data-cart-ui-version','32.6');
    // v32.6: controls are present in index.html, so checkout does not depend on
    // JavaScript creating/replacing buttons after page load. Keep a fallback for
    // older cached HTML while the preview is being tested.
    if(!addButton||!cartBox){
      var builder=document.createElement('div');
      builder.className='vestige-cart-builder';
      builder.id='vestigeCartBuilder';
      builder.innerHTML='<div class="cart-builder-actions"><button class="btn btn-outline" id="addToBasket" type="button">Add selected flavour to basket</button><span class="cart-hint">Add one or more flavours, then continue once.</span></div><div class="vestige-cart" id="vestigeCart" hidden></div>';
      submitButton.parentNode.insertBefore(builder,submitButton);
      addButton=builder.querySelector('#addToBasket');
      cartBox=builder.querySelector('#vestigeCart');
    }
    submitButton.disabled=false;
    submitButton.removeAttribute('disabled');
    submitButton.removeAttribute('aria-disabled');
    submitButton.textContent='Reserve basket & continue to payment';
    if(addButton){
      addButton.disabled=false;
      addButton.removeAttribute('disabled');
      addButton.removeAttribute('aria-disabled');
      addButton.style.pointerEvents='auto';
      addButton.style.cursor='pointer';
    }
  }

  function makeCheckoutId(){if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();return 'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);}
  async function apiRequest(payload){var r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});var ct=(r.headers.get('content-type')||'').toLowerCase();var result=ct.indexOf('application/json')!==-1?await r.json():null;if(!r.ok){var message=(result&&result.message)||('Request failed ('+r.status+').');var err=new Error(message);err.status=r.status;err.result=result;throw err;}return result;}


  var PENDING_CHECKOUT_KEY='vestigePendingBankCheckoutV1';

  function clearPendingCheckoutRecovery(){
    if(reservationTimer){clearInterval(reservationTimer);reservationTimer=null;}
    try{sessionStorage.removeItem(PENDING_CHECKOUT_KEY);}catch(_){}
  }
  function savePendingCheckoutRecovery(result){
    if(!result||!result.checkoutToken)return;
    var expiry=Number(result.paymentExpiresAt||0);
    if(!expiry&&Number(result.expiresInMinutes||0)>0)expiry=Date.now()+Number(result.expiresInMinutes)*60000;
    var record={
      checkoutToken:String(result.checkoutToken),
      paymentReference:String(result.paymentReference||''),
      paymentExpiresAt:expiry,
      result:result,
      savedAt:Date.now()
    };
    try{sessionStorage.setItem(PENDING_CHECKOUT_KEY,JSON.stringify(record));}catch(_){}
  }
  function readPendingCheckoutRecovery(){
    try{
      var raw=sessionStorage.getItem(PENDING_CHECKOUT_KEY);
      if(!raw)return null;
      var record=JSON.parse(raw);
      if(!record||!record.checkoutToken||!record.result)return null;
      return record;
    }catch(_){return null;}
  }
  function formatReservationRemaining(ms){
    if(ms<=0)return '00:00 remaining';
    var total=Math.ceil(ms/1000);
    var min=Math.floor(total/60),sec=total%60;
    return String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0')+' remaining';
  }
  function startReservationCountdown(expiry){
    if(reservationTimer){clearInterval(reservationTimer);reservationTimer=null;}
    var end=Number(expiry||0);
    var el=document.getElementById('customerReservationCountdown');
    if(!end||!el)return;

    function tick(){
      var remaining=end-Date.now();
      el.textContent=formatReservationRemaining(remaining);
      el.classList.toggle('reservation-ending',remaining>0&&remaining<=5*60*1000);
      el.classList.toggle('reservation-expired',remaining<=0);
      if(remaining<=0){
        clearInterval(reservationTimer);
        reservationTimer=null;
        if(orderStatus)orderStatus.textContent='This payment reservation has reached its time limit. Checking the order status…';
        if(checkoutToken){
          apiRequest({action:'bank_payment_status',checkoutToken:checkoutToken}).then(function(result){
            if(result.paymentStatus==='confirmed'){
              if(orderStatus)orderStatus.textContent='Payment verified. Your order is confirmed.';
              clearPendingCheckoutRecovery();
            }else if(result.paymentStatus==='cancelled'){
              if(orderStatus)orderStatus.textContent='This order has been cancelled and its stock reservation has been released.';
              closePaymentView();
              clearPendingCheckoutRecovery();
              checkoutToken='';activeCheckout=null;checkoutBusy=false;draftCheckoutId=makeCheckoutId();cart=[];renderCart();
              Array.prototype.forEach.call(form.elements,function(control){control.disabled=false;});
              resetCollectionAccess();loadAvailability();
            }else if(result.paymentStatus==='expired'){
              if(orderStatus)orderStatus.textContent='This payment reservation has expired. Please start a new checkout.';
              closePaymentView();
              checkoutToken='';
              activeCheckout=null;
              checkoutBusy=false;
              draftCheckoutId=makeCheckoutId();
              clearPendingCheckoutRecovery();
              Array.prototype.forEach.call(form.elements,function(control){control.disabled=false;});
              cart=[];
              renderCart();
              resetCollectionAccess();
              loadAvailability();
            }else{
              if(orderStatus)orderStatus.textContent='The reservation time has ended. Please use the payment-status button before taking further action.';
            }
          }).catch(function(){
            if(orderStatus)orderStatus.textContent='The reservation time has ended. Please check your payment status.';
          });
        }
      }
    }
    tick();
    if(end>Date.now())reservationTimer=setInterval(tick,1000);
  }
  async function restorePendingCheckout(){
    var record=readPendingCheckoutRecovery();
    if(!record)return;
    checkoutToken=String(record.checkoutToken||'');
    activeCheckout=record.result||null;
    if(!checkoutToken||!activeCheckout){clearPendingCheckoutRecovery();return;}

    try{
      var status=await apiRequest({action:'bank_payment_status',checkoutToken:checkoutToken});
      if(status.paymentStatus==='confirmed'){
        if(orderStatus)orderStatus.textContent='Payment verified. Your order is confirmed.';
        clearPendingCheckoutRecovery();
        checkoutToken='';
        activeCheckout=null;
        return;
      }
      if(status.paymentStatus==='cancelled'){
        if(orderStatus)orderStatus.textContent='Your previous order was cancelled and its stock reservation was released.';
        clearPendingCheckoutRecovery();
        checkoutToken='';
        activeCheckout=null;
        await loadAvailability();
        return;
      }
      if(status.paymentStatus==='expired'){
        if(orderStatus)orderStatus.textContent='Your previous payment reservation expired. You can start a new basket.';
        clearPendingCheckoutRecovery();
        checkoutToken='';
        activeCheckout=null;
        await loadAvailability();
        return;
      }

      showBankPayment(activeCheckout,true);
      var paidButton=document.getElementById('paymentMade');
      if(status.paymentClaimedAt&&status.ownerAlertStatus==='sent'){
        if(orderStatus)orderStatus.textContent='Your payment notice was sent to Vestige. Your order remains pending until the cleared bank credit is verified.';
        if(paidButton){paidButton.textContent='Payment notice sent';paidButton.disabled=true;}
      }else if(status.paymentClaimedAt){
        if(orderStatus)orderStatus.textContent='Your payment notice is recorded, but delivery to Vestige has not been confirmed. Please retry the notice.';
        if(paidButton){paidButton.textContent='Retry payment notice';paidButton.disabled=false;}
      }else if(orderStatus){
        orderStatus.textContent='Your pending '+String(activeCheckout.paymentReference||'order')+' payment screen was restored after refresh.';
      }
    }catch(e){
      // A malformed/invalid token must never leave the shop locked.
      if(e&&e.status===401){
        clearPendingCheckoutRecovery();
        checkoutToken='';
        activeCheckout=null;
        return;
      }
      if(orderStatus)orderStatus.textContent='We could not restore the pending payment screen automatically. Please try again or contact Vestige Ltd.';
    }
  }

  function currentSelection(){
    var name=String(flavour&&flavour.value||'').trim();
    var qty=Number(quantity&&quantity.value||0);
    var item=availability[name]||null;
    var itemId=item?String(item.itemId||item.item_id||'').trim():'';
    return {name:name,qty:qty,item:item,itemId:itemId};
  }
  function updateTotals(){
    if(!productTotal||!orderTotal)return;
    // Only items actually added to the basket count toward checkout totals.
    // Merely choosing a flavour/quantity must leave the order at R0.00.
    var products=cart.length?cartProductsTotal():0;
    var delivery=cart.length?currentDeliveryPrice():0;
    var total=products+delivery;
    productTotal.textContent=money(products);
    orderTotal.textContent=money(total);
    orderTotal.dataset.amount=total.toFixed(2);
    var deliveryCell=document.getElementById('deliveryTotal');
    if(!deliveryCell){
      var rows=document.querySelectorAll('.confirmation-table tbody tr');
      Array.prototype.forEach.call(rows,function(row){
        var th=row.querySelector('th');
        if(!deliveryCell&&th&&/Courier Guy Locker/i.test(th.textContent||'')){
          deliveryCell=row.querySelector('td');
          if(deliveryCell)deliveryCell.id='deliveryTotal';
        }
      });
    }
    if(deliveryCell)deliveryCell.textContent=money(delivery);
    validateSelectedStock();
  }
  function validateSelectedStock(){
    var selection=currentSelection(),name=selection.name,qty=selection.qty,item=selection.item,itemId=selection.itemId;
    var existing=name?cart.find(function(x){return x.flavour===name;}):null;
    var combined=(existing?Number(existing.quantity||0):0)+qty;
    var canAdd=!!(name&&qty>0&&item&&item.available&&Number(item.stock)>=combined&&itemId&&!checkoutToken&&!checkoutBusy);
    // Do not use the native disabled attribute for the basket controls. Some versions of
    // the existing page/CSS leave dynamically-disabled buttons impossible to re-activate.
    // Keep them clickable and enforce validity in the click/submit handlers instead.
    if(addButton){
      var addLocked=!!(checkoutToken||checkoutBusy);
      addButton.disabled=false;
      addButton.removeAttribute('disabled');
      addButton.removeAttribute('aria-disabled');
      addButton.setAttribute('aria-busy',addLocked?'true':'false');
      addButton.classList.toggle('is-busy',addLocked);
      addButton.style.pointerEvents=addLocked?'none':'auto';
      addButton.style.cursor=addLocked?'wait':'pointer';
    }
    if(submitButton){
      var checkoutLocked=!!(checkoutToken||checkoutBusy);
      submitButton.disabled=false;
      submitButton.removeAttribute('disabled');
      submitButton.removeAttribute('aria-disabled');
      submitButton.setAttribute('aria-busy',checkoutLocked?'true':'false');
      submitButton.style.pointerEvents=checkoutLocked?'none':'auto';
      submitButton.style.cursor=checkoutLocked?'wait':'pointer';
    }
    if(!stockStatus)return;
    if(!name){stockStatus.className='stock-status';stockStatus.textContent=cart.length?'Select another flavour to add, or continue with your basket.':'Select an available flavour.';return;}
    if(!item||!item.available){stockStatus.className='stock-status warn';stockStatus.textContent=(item&&item.reason)||'This flavour is not currently available.';return;}
    if(qty<=0){stockStatus.className='stock-status';stockStatus.textContent='Select a quantity to add this flavour to your basket.';return;}
    if(!itemId){stockStatus.className='stock-status warn';stockStatus.textContent='This flavour could not be linked to its Zoho item. Please refresh and try again.';return;}
    if(Number(item.stock)<combined){stockStatus.className='stock-status warn';stockStatus.textContent='Basket plus selection would exceed the '+item.stock+' unit(s) currently available.';return;}
    stockStatus.className='stock-status ok';stockStatus.textContent=item.stock+' unit(s) currently available. Ready to add to basket.';
  }
  function renderCart(){
    if(!cartBox)return;
    if(!cart.length){cartBox.hidden=true;cartBox.innerHTML='';updateTotals();saveBasketSession();publishCartSummary();return;}
    cartBox.hidden=false;
    var rows=cart.map(function(item,index){return '<div class="cart-row"><div><strong>'+esc(item.flavour)+'</strong><small>'+money(PRODUCT_PRICE)+' each</small></div><span>Qty '+item.quantity+'</span><strong>'+money(item.quantity*PRODUCT_PRICE)+'</strong><button type="button" class="cart-remove" data-cart-index="'+index+'" aria-label="Remove '+esc(item.flavour)+'">Remove</button></div>';}).join('');
    cartBox.innerHTML='<div class="cart-head"><strong>YOUR BASKET</strong><span>'+cartQuantity()+' item'+(cartQuantity()===1?'':'s')+'</span></div>'+rows+'<div class="cart-foot"><span>Products '+money(cartProductsTotal())+' + '+(selectedDeliveryMethod()==='collection'?'collection ':'delivery ')+money(currentDeliveryPrice())+'</span><strong>'+money(cartGrandTotal())+'</strong></div>';
    updateTotals();
    saveBasketSession();
    publishCartSummary();
  }
  function addSelectionToCart(){
    if(globalSoldOut){if(orderStatus)orderStatus.textContent='All BC10000 flavours are currently sold out.';return;}
    var selection=currentSelection(),name=selection.name,qty=selection.qty,item=selection.item,itemId=selection.itemId;
    if(!name){if(orderStatus)orderStatus.textContent='Select a flavour first.';return;}
    if(qty<=0){if(orderStatus)orderStatus.textContent='Select a quantity first.';return;}
    if(!item||!item.available){if(orderStatus)orderStatus.textContent=(item&&item.reason)||'This flavour is not currently available.';return;}
    if(!itemId){if(orderStatus)orderStatus.textContent='This flavour could not be linked to its Zoho item. Refresh the page and try again.';return;}
    var existing=cart.find(function(x){return x.flavour===name;});var next=(existing?existing.quantity:0)+qty;
    if(next>5){if(orderStatus)orderStatus.textContent='Maximum quantity per flavour is 5.';return;}
    if(next>Number(item.stock)){if(orderStatus)orderStatus.textContent='That quantity exceeds current stock for '+name+'.';return;}
    if(existing)existing.quantity=next;else cart.push({flavour:name,itemId:itemId,quantity:qty});
    if(flavour)flavour.value='';if(quantity)quantity.value='';if(orderStatus)orderStatus.textContent=name+' added to your basket.';renderCart();
  }
  async function loadAvailability(){
    if(!flavour)return;flavour.disabled=true;
    try{var result=await apiRequest({action:'availability'});availability=result.availability||{};var allSoldOut=availabilityConfirmsSoldOut();Array.prototype.forEach.call(flavour.options,function(opt,index){if(index===0){opt.textContent='Select a flavour';return;}var item=availability[opt.value];opt.disabled=!(item&&item.available);opt.textContent=opt.value+(item&&item.available?' — '+item.stock+' in stock':' — unavailable');});flavour.disabled=allSoldOut;revalidateBasketAgainstAvailability();setShopSoldOut(allSoldOut);if(stockStatus){stockStatus.className='stock-status ok';stockStatus.textContent=allSoldOut?'All BC10000 flavours are currently sold out.':(cart.length?'Live stock verified. Your saved basket is ready.':'Live stock verified with Zoho Books.');}}
    catch(e){setShopSoldOut(false);Array.prototype.forEach.call(flavour.options,function(opt,index){if(index>0)opt.disabled=true;});flavour.disabled=true;if(stockStatus){stockStatus.className='stock-status warn';stockStatus.textContent='Stock could not be verified. Ordering is disabled for safety.';}}
    validateSelectedStock();
  }
  async function clipboardMatches(value){
    if(!navigator.clipboard||typeof navigator.clipboard.readText!=='function')return null;
    try{return (await navigator.clipboard.readText())===value;}catch(_){return null;}
  }
  function visibleCopyValue(button,fallbackValue){
    if(button){
      var row=button.closest&&button.closest('.eft-row');
      var adjacent=row&&row.querySelector('strong');
      if(adjacent)return String(adjacent.textContent||'').trim();
      var embedded=button.querySelector&&button.querySelector('strong');
      if(embedded)return String(embedded.textContent||'').trim();
    }
    return String(fallbackValue||'').trim();
  }
  function selectVisibleCopyValue(button){
    var row=button&&button.closest&&button.closest('.eft-row');
    var valueNode=(row&&row.querySelector('strong'))||(button&&button.querySelector&&button.querySelector('strong'));
    if(!valueNode||!window.getSelection||!document.createRange)return;
    var range=document.createRange();range.selectNodeContents(valueNode);
    var selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  }
  async function copyText(fallbackValue,button){
    var value=visibleCopyValue(button,fallbackValue);
    if(!value){if(orderStatus)orderStatus.textContent='There is no payment value available to copy.';return false;}
    if(button&&button.dataset.copyBusy==='1')return false;
    if(button){button.dataset.copyBusy='1';button.setAttribute('aria-busy','true');}
    var originalLabel='Copy',label=button&&button.querySelector&&button.querySelector('small');
    if(label)originalLabel=label.textContent;else if(button)originalLabel=button.textContent;
    var setLabel=function(text){if(label)label.textContent=text;else if(button)button.textContent=text;};
    var finish=function(){if(button){delete button.dataset.copyBusy;button.removeAttribute('aria-busy');}};
    var success=function(){setLabel('Copied');if(orderStatus)orderStatus.textContent='Copied: '+value;window.setTimeout(function(){setLabel(originalLabel);},1600);finish();return true;};
    var failure=function(){selectVisibleCopyValue(button);setLabel('Select & copy');if(orderStatus)orderStatus.textContent='Your browser could not verify the copy. The exact value is selected—use Ctrl+C, or press and hold it on mobile.';window.setTimeout(function(){setLabel(originalLabel);},3000);finish();return false;};
    try{
      if(navigator.clipboard&&typeof navigator.clipboard.writeText==='function'){
        await navigator.clipboard.writeText(value);
        var verified=await clipboardMatches(value);
        if(verified===false)return failure();
        return success();
      }
      var area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-9999px';area.style.top='0';document.body.appendChild(area);area.focus();area.select();area.setSelectionRange(0,value.length);
      var copied=!!(document.execCommand&&document.execCommand('copy'));area.remove();
      if(!copied)return failure();
      var fallbackVerified=await clipboardMatches(value);
      if(fallbackVerified===false)return failure();
      return success();
    }catch(_){return failure();}
  }
  function renderEft(eft){var grid=document.getElementById('eftGrid');if(!grid)return;grid.innerHTML='';if(!eft||!eft.available){grid.innerHTML='<p class="bank-note">EFT bank details have not yet been configured on this preview Worker.</p>';return;}[['Bank',eft.bankName],['Account holder',eft.accountHolder],['Account number',eft.accountNumber],['Account type',eft.accountType],['Branch code',eft.branchCode],['SWIFT code',eft.swiftCode],['Reference',activeCheckout&&activeCheckout.paymentReference]].forEach(function(row){if(!row[1])return;var wrap=document.createElement('div');wrap.className='eft-row';var label=document.createElement('span');label.textContent=row[0];var value=document.createElement('strong');value.textContent=String(row[1]);var btn=document.createElement('button');btn.type='button';btn.className='eft-copy';btn.textContent='Copy';btn.setAttribute('aria-label','Copy '+row[0]);btn.addEventListener('click',function(){copyText('',btn);});wrap.append(label,value,btn);grid.appendChild(wrap);});}
  function showBankPayment(result,restored){
    activeCheckout=result;checkoutToken=result.checkoutToken||'';setShopSoldOut(false);var o=result.order||{},items=Array.isArray(o.items)?o.items:[];
    if(!restored)savePendingCheckoutRecovery(result);
    try{sessionStorage.removeItem(BASKET_SESSION_KEY);}catch(_){}

    var amount=document.getElementById('bankAmount'),ref=document.getElementById('bankReference'),qr=document.getElementById('capitecQr');if(amount)amount.textContent=money(o.amount);if(ref)ref.textContent=result.paymentReference||'—';if(qr&&result.capitec&&result.capitec.qrImageUrl)qr.src=result.capitec.qrImageUrl;
    var summary=document.getElementById('summaryItems');if(summary){summary.innerHTML='';items.forEach(function(item){var row=document.createElement('div');row.className='summary-product';var d=document.createElement('div');var name=document.createElement('strong');name.textContent='ELFBAR BC10000';var f=document.createElement('span');f.textContent=item.flavour;d.append(name,f);var q=document.createElement('span');q.textContent='Qty: '+item.quantity;var line=document.createElement('strong');line.className='summary-item-total';line.textContent=money(Number(item.quantity)*PRODUCT_PRICE);row.append(d,q,line);summary.appendChild(row);});}
    var sp=document.getElementById('summaryProducts'),st=document.getElementById('summaryTotal');if(sp)sp.textContent=money((Number(o.totalQuantity)||items.reduce(function(s,x){return s+Number(x.quantity||0);},0))*PRODUCT_PRICE);if(st)st.textContent=money(o.amount);
    var fulfilLabel=document.getElementById('paymentFulfilmentLabel'),deliveryCharge=document.getElementById('paymentDeliveryCharge');
    if(fulfilLabel)fulfilLabel.innerHTML=o.deliveryMethod==='collection'?'Collection<br><small>Vestige Ltd — arranged collection</small>':'Delivery<br><small>The Courier Guy — Locker to Locker</small>';
    if(deliveryCharge)deliveryCharge.textContent=money(Number(o.deliveryCharge||0));
    renderEft(result.eft);
    if(paymentPanel){
      var header=document.querySelector('.site-header');
      var headerHeight=header?Math.ceil(header.getBoundingClientRect().height):82;
      paymentPanel.style.setProperty('--payment-header-height',headerHeight+'px');
      paymentPanel.hidden=false;
      paymentPanel.setAttribute('role','region');
      paymentPanel.setAttribute('aria-label','Secure payment');
    }
    if(form)form.classList.add('is-payment-mode');
    document.documentElement.classList.add('vestige-payment-open');
    window.requestAnimationFrame(function(){if(paymentPanel)paymentPanel.classList.add('is-payment-visible');});
    Array.prototype.forEach.call(form.elements,function(el){
      // Lock only the order-entry controls after the basket is reserved.
      // Payment-panel controls (QR/EFT tabs, copy buttons and status check) must remain interactive.
      if(paymentPanel&&paymentPanel.contains(el)){el.disabled=false;return;}
      el.disabled=true;
    });
    if(addButton){addButton.setAttribute('aria-busy','true');addButton.classList.add('is-busy');}
    if(paymentPanel){
      Array.prototype.forEach.call(paymentPanel.querySelectorAll('button'),function(btn){btn.disabled=false;});
    }
    var recovery=readPendingCheckoutRecovery();
    var expiresAt=Number(result.paymentExpiresAt||(recovery&&recovery.paymentExpiresAt)||0);
    if(expiresAt)startReservationCountdown(expiresAt);
    if(paymentPanel&&!restored){
      var paymentTitle=paymentPanel.querySelector('.bank-panel-title h3');
      if(paymentTitle){paymentTitle.setAttribute('tabindex','-1');window.setTimeout(function(){paymentTitle.focus({preventScroll:true});},190);}
    }
  }
  function closePaymentView(){
    if(paymentPanel)paymentPanel.classList.remove('is-payment-visible');
    document.documentElement.classList.remove('vestige-payment-open');
    window.setTimeout(function(){if(paymentPanel)paymentPanel.hidden=true;if(form)form.classList.remove('is-payment-mode');},190);
  }
  async function releasePendingBankOrder(preserveBasket){
    if(!checkoutToken){
      if(orderStatus)orderStatus.textContent='No pending checkout was found to cancel.';
      return;
    }
    if(preserveBasket){
      var proceed=window.confirm('Return to the shop and edit your basket?\n\nThis releases the reserved stock. Only continue if you have NOT sent the bank payment. If you have already paid, remain on this page and contact Vestige Ltd.');
      if(!proceed)return;
    }

    var cancelButton=document.getElementById('cancelBankOrder');
    var returnButton=document.getElementById('returnToShop');
    var paidButton=document.getElementById('paymentMade');
    if(cancelButton)cancelButton.disabled=true;
    if(returnButton)returnButton.disabled=true;
    if(paidButton)paidButton.disabled=true;
    if(orderStatus)orderStatus.textContent=preserveBasket?'Releasing the reservation and returning to your basket…':'Cancelling your order and releasing the reserved stock…';

    try{
      var editableCart=[];
      if(preserveBasket&&activeCheckout&&activeCheckout.order&&Array.isArray(activeCheckout.order.items)){
        editableCart=activeCheckout.order.items.map(function(item){return {flavour:String(item.flavour||''),itemId:String(item.itemId||''),quantity:Number(item.quantity||0)};}).filter(function(item){return item.flavour&&item.itemId&&Number.isInteger(item.quantity)&&item.quantity>0;});
      }
      var result=await apiRequest({action:'cancel_bank_order',checkoutToken:checkoutToken});
      closePaymentView();
      checkoutToken='';
      activeCheckout=null;
      checkoutBusy=false;
      draftCheckoutId=makeCheckoutId();
      clearPendingCheckoutRecovery();
      if(preserveBasket)cart=editableCart;else cart=[];
      renderCart();

      Array.prototype.forEach.call(form.elements,function(el){
        if(el.id==='paymentMade'||el.id==='returnToShop'||el.id==='cancelBankOrder')return;
        el.disabled=false;
      });
      resetCollectionAccess();
      if(flavour)flavour.value='';
      if(quantity)quantity.value='';
      if(orderStatus)orderStatus.textContent=preserveBasket?'Reservation released. Your basket and details are ready to edit. If you need collection, validate the collection code again.':(result.message||'Order cancelled. Reserved stock has been released.');
      await loadAvailability();
      validateSelectedStock();
      if(!preserveBasket){
        window.location.replace('/#top');
        return;
      }
      window.setTimeout(function(){var shopHeading=document.getElementById('productSelectionHeading');if(shopHeading){shopHeading.setAttribute('tabindex','-1');shopHeading.focus({preventScroll:true});}},210);
    }catch(e){
      if(orderStatus)orderStatus.textContent=e.message||'Unable to cancel the order automatically. Please contact Vestige Ltd.';
      if(cancelButton)cancelButton.disabled=false;
      if(returnButton)returnButton.disabled=false;
      if(paidButton)paidButton.disabled=false;
    }
  }
  function cancelPendingBankOrder(){return releasePendingBankOrder(false);}
  function returnToShopAndEdit(){return releasePendingBankOrder(true);}

  function selectMethod(method){var capBtn=document.getElementById('showCapitec'),eftBtn=document.getElementById('showEft'),cap=document.getElementById('capitecCard'),eft=document.getElementById('eftCard'),ca=method==='capitec';if(cap)cap.hidden=!ca;if(eft)eft.hidden=ca;if(capBtn){capBtn.classList.toggle('active',ca);capBtn.setAttribute('aria-selected',ca?'true':'false');capBtn.tabIndex=ca?0:-1;}if(eftBtn){eftBtn.classList.toggle('active',!ca);eftBtn.setAttribute('aria-selected',!ca?'true':'false');eftBtn.tabIndex=ca?-1:0;}}
  document.addEventListener('keydown',function(event){var current=event.target&&event.target.closest?event.target.closest('#showCapitec,#showEft'):null;if(!current)return;var next=null;if(event.key==='ArrowRight'||event.key==='ArrowDown'||event.key==='End')next=document.getElementById('showEft');if(event.key==='ArrowLeft'||event.key==='ArrowUp'||event.key==='Home')next=document.getElementById('showCapitec');if(next){event.preventDefault();selectMethod(next.id==='showCapitec'?'capitec':'eft');next.focus();}});

  function selectionChanged(){validateSelectedStock();}
  if(quantity){quantity.addEventListener('change',selectionChanged);quantity.addEventListener('input',selectionChanged);}
  if(flavour){flavour.addEventListener('change',selectionChanged);flavour.addEventListener('input',selectionChanged);}
  document.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target.closest('#addToBasket'):null;
    if(!target)return;
    e.preventDefault();
    e.stopPropagation();
    if(checkoutToken||checkoutBusy){if(orderStatus)orderStatus.textContent='Checkout is already being processed.';return;}
    addSelectionToCart();
  },true);
  if(cartBox)cartBox.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.cart-remove');if(!b)return;var i=Number(b.getAttribute('data-cart-index'));if(Number.isInteger(i)&&cart[i]){cart.splice(i,1);if(orderStatus)orderStatus.textContent='Basket updated.';renderCart();}});
  if(quantity){
    var blankQuantity=Array.prototype.some.call(quantity.options||[],function(opt){return String(opt.value)==='';});
    if(blankQuantity)quantity.value='';
    else if(Array.prototype.some.call(quantity.options||[],function(opt){return String(opt.value)==='0';}))quantity.value='0';
  }
  Array.prototype.forEach.call(deliveryMethodInputs,function(input){input.addEventListener('change',syncFulfilmentUi);});
  if(validateCollectionButton)validateCollectionButton.addEventListener('click',validateCollectionAccess);
  if(soldOutRetry)soldOutRetry.addEventListener('click',async function(){soldOutRetry.disabled=true;soldOutRetry.textContent='Checking stock…';await loadAvailability();soldOutRetry.disabled=false;soldOutRetry.textContent='Check stock again';});
  if(collectionCodeInput)collectionCodeInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();validateCollectionAccess();}});
  restoreBasketSession();
  syncFulfilmentUi();
  updateTotals();loadAvailability();restorePendingCheckout();

  document.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target.closest('#orderSubmit'):null;
    if(!target)return;
    if(checkoutBusy||checkoutToken){e.preventDefault();if(orderStatus)orderStatus.textContent='Checkout is already being processed.';return;}
    if(!cart.length){e.preventDefault();if(orderStatus)orderStatus.textContent='Add at least one flavour to your basket first.';}
  },true);

  if(form)form.addEventListener('submit',async function(event){
    event.preventDefault();
    if(globalSoldOut){if(orderStatus)orderStatus.textContent='All BC10000 flavours are currently sold out.';return;}
    if(checkoutBusy||checkoutToken)return;
    if(!cart.length){if(orderStatus)orderStatus.textContent='Add at least one flavour to your basket first.';return;}
    if(!form.reportValidity())return;
    var data=new FormData(form),payload={action:'prepare_bank_order',checkoutId:draftCheckoutId,collectionAccessToken:collectionAccessToken,customerName:String(data.get('name')||''),email:String(data.get('email')||''),mobile:String(data.get('mobile')||''),addressLine1:String(data.get('addressLine1')||''),addressLine2:String(data.get('addressLine2')||''),city:String(data.get('city')||''),province:String(data.get('province')||''),postalCode:String(data.get('postalCode')||''),country:String(data.get('country')||'South Africa'),deliveryMethod:selectedDeliveryMethod(),courierLocker:String(data.get('courierLocker')||''),items:cart.map(function(x){return {flavour:x.flavour,itemId:x.itemId,quantity:x.quantity};}),amount:cartGrandTotal()};
    checkoutBusy=true;validateSelectedStock();if(orderStatus)orderStatus.textContent='Rechecking live stock and reserving your complete basket for bank payment…';if(paymentPanel)paymentPanel.hidden=true;
    try{var result=await apiRequest(payload);showBankPayment(result);if(orderStatus)orderStatus.textContent=result.message;}
    catch(e){if(orderStatus)orderStatus.textContent=e.message||'Unable to reserve the basket.';checkoutToken='';activeCheckout=null;clearPendingCheckoutRecovery();await loadAvailability();}
    finally{checkoutBusy=false;validateSelectedStock();}
  });

  document.addEventListener('click',function(event){var target=event.target;if(target&&target.closest){var cap=target.closest('#showCapitec'),eft=target.closest('#showEft'),copyRef=target.closest('#copyReference'),paid=target.closest('#paymentMade'),returnShop=target.closest('#returnToShop'),cancelOrder=target.closest('#cancelBankOrder');if(cap){selectMethod('capitec');return;}if(eft){selectMethod('eft');return;}if(copyRef){copyText(activeCheckout&&activeCheckout.paymentReference||'',copyRef);return;}if(returnShop){event.preventDefault();event.stopPropagation();returnToShopAndEdit();return;}if(cancelOrder){event.preventDefault();event.stopPropagation();cancelPendingBankOrder();return;}if(paid){if(!checkoutToken){if(orderStatus)orderStatus.textContent='No pending bank-payment checkout was found.';return;}paid.disabled=true;if(orderStatus)orderStatus.textContent='Notifying Vestige that you have sent payment…';apiRequest({action:'claim_bank_payment',checkoutToken:checkoutToken}).then(function(result){if(result.alreadyConfirmed){if(orderStatus)orderStatus.textContent='Payment verified. Your order is confirmed.';clearPendingCheckoutRecovery();paid.textContent='Payment confirmed';paid.disabled=true;}else{if(orderStatus)orderStatus.textContent=result.message||'Your payment notice was recorded. Your order remains pending until the cleared bank credit is verified.';if(result.ownerAlertSent){paid.textContent='Payment notice sent';paid.disabled=true;}else{paid.textContent='Retry payment notice';paid.disabled=false;}}}).catch(function(e){if(orderStatus)orderStatus.textContent=e.message||'Unable to send the payment notice. Please try again.';paid.textContent='Retry payment notice';paid.disabled=false;});}}});
})();


/* VESTIGE_DEFERRED_MEDIA_V35_9_3
   Loads the below-the-fold technical-profile video only when it is near view.
   This does not alter checkout, stock, payment, Zoho or owner logic. */
(() => {
  const video = document.querySelector('video[data-vestige-deferred-video="true"]');
  if (!video) return;

  let loaded = false;
  const loadVideo = () => {
    if (loaded) return;
    loaded = true;
    const source = video.querySelector('source[data-src]');
    if (source) {
      source.src = source.dataset.src;
      source.removeAttribute('data-src');
    }
    video.load();
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        loadVideo();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(video);
  } else {
    loadVideo();
  }
})();


/* VESTIGE_FUNNEL_ANALYTICS_V35_10_0
   First-party anonymous funnel events. No name/email/mobile/address is sent. */
(() => {
  const ENDPOINT='/api/analytics';
  function sessionId(){
    try{
      let id=sessionStorage.getItem('vestigeAnalyticsSession');
      if(!id){
        id='v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
        sessionStorage.setItem('vestigeAnalyticsSession',id);
      }
      return id;
    }catch(_){return 'v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
  }
  function track(event,extra){
    const payload=Object.assign({event,sessionId:sessionId(),path:location.pathname},extra||{});
    try{
      fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
        keepalive:true,body:JSON.stringify(payload)}).catch(()=>{});
    }catch(_){}
  }
  window.vestigeTrackConversion=track;
  track('page_view');

  const shop=document.getElementById('buy-now');
  if(shop&&'IntersectionObserver' in window){
    let seen=false;
    const io=new IntersectionObserver(entries=>{
      if(!seen&&entries.some(e=>e.isIntersecting)){seen=true;io.disconnect();track('shop_view');}
    },{threshold:.15});
    io.observe(shop);
  }

  const flavour=document.querySelector('[name="flavour"],#flavour');
  const quantity=document.querySelector('[name="quantity"],#quantity');
  if(flavour){
    flavour.addEventListener('change',()=>{
      const name=String(flavour.value||'').trim();
      if(name)track('product_selected',{flavour:name,quantity:quantity?Number(quantity.value||0):null});
    });
  }

  const add=document.getElementById('addToBasket');
  if(add) add.addEventListener('click',()=>{
    setTimeout(()=>{
      const cart=document.getElementById('vestigeCart');
      const items=cart?cart.querySelectorAll('.cart-row').length:0;
      track('basket_created',{basketItems:items||1,flavour:flavour?String(flavour.value||''):''});
    },0);
  });

  const orderForm=document.getElementById('orderForm');
  if(orderForm) orderForm.addEventListener('submit',()=>{
    const amountNode=document.getElementById('orderTotal');
    const amount=amountNode?Number(String(amountNode.textContent||'').replace(/[^0-9.]/g,'')):null;
    track('checkout_started',{basketItems:document.querySelectorAll('#vestigeCart .cart-row').length||1,amount});
  });

  document.addEventListener('click',e=>{
    const t=e.target&&e.target.closest?e.target.closest('button,a'):null;
    if(!t)return;
    const text=String(t.textContent||'').toLowerCase();
    const id=String(t.id||'');
    if(id==='customerPaidButton'||id==='paymentClaimed'||text.includes('i have made payment')){
      track('payment_claimed');
    }
  });

  // Observe visible success states so confirmed tracking works across existing payment flows.
  const receipt=document.getElementById('receiptPanel');
  if(receipt&&'MutationObserver' in window){
    let sent=false;
    const send=()=>{
      if(sent||receipt.hidden)return;
      sent=true;
      const amountNode=document.getElementById('orderTotal');
      const amount=amountNode?Number(String(amountNode.textContent||'').replace(/[^0-9.]/g,'')):null;
      track('payment_confirmed',{amount});
    };
    new MutationObserver(send).observe(receipt,{attributes:true,attributeFilter:['hidden','style','class']});
    send();
  }
})();





/* V35_11_3B_INDIVIDUAL_CARDS_AND_PRESELECT
   Fixes two issues:
   1) the whole flavour tray was being treated as one card;
   2) flavour deep-link preselection could fire before the live stock UI settled. */
(function () {
  const FLAVOURS = [
    ['blueberry-mint','Blueberry Mint'],
    ['miami-mint','Miami Mint'],
    ['blue-razz-ice','Blue Razz Ice'],
    ['strawberry-kiwi-ice','Strawberry Kiwi Ice'],
    ['watermelon-ice','Watermelon Ice']
  ];

  const flavourNamesLower = FLAVOURS.map(x => x[1].toLowerCase());

  function flavourCount(el) {
    const t = (el.textContent || '').toLowerCase();
    return flavourNamesLower.reduce((n, name) => n + (t.includes(name) ? 1 : 0), 0);
  }

  function findIndividualCard(labelEl) {
    let el = labelEl;
    let best = null;

    while (el && el !== document.body) {
      const count = flavourCount(el);
      if (count === 1) best = el;
      if (count > 1) break;
      el = el.parentElement;
    }

    if (!best) return labelEl.parentElement || labelEl;

    // Prefer a visually card-like ancestor if one exists before the multi-card tray.
    let card = labelEl;
    while (card && card !== best.parentElement) {
      const cls = String(card.className || '').toLowerCase();
      if (
        flavourCount(card) === 1 &&
        /(card|tile|flavour|flavor|item|option)/.test(cls)
      ) {
        best = card;
      }
      card = card.parentElement;
    }
    return best;
  }

  function wireIndividualFlavourCards() {
    // First remove the old tray-level behaviour from any element containing multiple flavours.
    document.querySelectorAll('[data-flavour-card]').forEach(el => {
      if (flavourCount(el) > 1) {
        el.removeAttribute('data-flavour-card');
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        el.removeAttribute('onclick');
        el.removeAttribute('onkeydown');
        el.querySelectorAll(':scope > .flavour-card-action').forEach(n => n.remove());
      }
    });

    FLAVOURS.forEach(([slug, name]) => {
      const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,span,strong,b,div,a'))
        .filter(el => (el.textContent || '').trim().toLowerCase() === name.toLowerCase());

      const label = candidates[0];
      if (!label) return;

      const card = findIndividualCard(label);
      if (!card) return;

      card.dataset.flavourCard = slug;
      card.setAttribute('tabindex','0');
      card.setAttribute('role','link');
      card.setAttribute('aria-label','Explore ' + name);

      if (!card.querySelector(':scope > .flavour-card-action')) {
        const cue = document.createElement('span');
        cue.className = 'flavour-card-action';
        cue.setAttribute('aria-hidden','true');
        cue.innerHTML = 'Explore flavour <span>→</span>';
        card.appendChild(cue);
      }

      if (!card.dataset.vestigeCardWired) {
        card.dataset.vestigeCardWired = '1';
        card.addEventListener('click', function (event) {
          if (event.target.closest('a,button,input,select,textarea')) return;
          window.location.href = '/flavours/' + slug;
        });
        card.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            window.location.href = '/flavours/' + slug;
          }
        });
      }
    });
  }

  function findFlavourSelect() {
    return Array.from(document.querySelectorAll('select')).find(s =>
      FLAVOURS.some(([,name]) =>
        Array.from(s.options || []).some(o =>
          (o.textContent || '').trim().toLowerCase() === name.toLowerCase()
        )
      )
    );
  }

  function findQuantitySelect(flavourSelect) {
    return Array.from(document.querySelectorAll('select')).find(s => {
      if (s === flavourSelect) return false;
      const txt = Array.from(s.options || []).map(o => (o.textContent || '').trim());
      return txt.some(v => /^1$/.test(v)) && txt.some(v => /^2$/.test(v));
    });
  }

  function clearStaleUnavailableMessageNear(select) {
    const scope = select.closest('section,fieldset,form,.card,.panel') || select.parentElement;
    if (!scope) return;
    Array.from(scope.querySelectorAll('p,div,span,small')).forEach(el => {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'this flavour is not currently available.' && !select.disabled) {
        // Only hide a stale message before quantity is deliberately chosen.
        el.dataset.vestigeStaleAvailability = '1';
        el.style.display = 'none';
      }
    });
  }

  function preselectFromLandingPage() {
    const params = new URLSearchParams(window.location.search);
    const slug = (params.get('flavour') || '').trim().toLowerCase();
    if (!slug) return;

    const entry = FLAVOURS.find(x => x[0] === slug);
    if (!entry) return;
    const desiredName = entry[1];

    let attempts = 0;
    const maxAttempts = 60; // up to ~9 seconds for initial live stock hydration

    const timer = setInterval(() => {
      attempts++;

      const flavourSelect = findFlavourSelect();
      if (!flavourSelect) {
        if (attempts >= maxAttempts) clearInterval(timer);
        return;
      }

      // Wait until existing stock initialization has finished touching the control.
      if (flavourSelect.disabled) {
        if (attempts >= maxAttempts) {
          flavourSelect.disabled = false; // never strand the customer with no alternative
          clearInterval(timer);
        }
        return;
      }

      const option = Array.from(flavourSelect.options).find(o =>
        (o.textContent || '').trim().toLowerCase() === desiredName.toLowerCase()
      );
      if (!option) {
        if (attempts >= maxAttempts) clearInterval(timer);
        return;
      }

      // Keep choice flexible even if the selected landing flavour is unavailable.
      // Backend/normal stock logic still decides whether an order can proceed.
      const quantitySelect = findQuantitySelect(flavourSelect);
      if (quantitySelect) {
        const blank = Array.from(quantitySelect.options).find(o =>
          (o.value || '') === '' || (o.textContent || '').trim() === ''
        );
        if (blank) quantitySelect.value = blank.value;
      }

      flavourSelect.value = option.value;
      flavourSelect.dispatchEvent(new Event('change', {bubbles:true}));
      flavourSelect.disabled = false;
      flavourSelect.classList.add('preselected-flavour-control');
      setTimeout(() => flavourSelect.classList.remove('preselected-flavour-control'), 1600);

      clearStaleUnavailableMessageNear(flavourSelect);

      const target = document.getElementById('buy-now') || flavourSelect.closest('section') || flavourSelect;
      setTimeout(() => target.scrollIntoView({behavior:'smooth',block:'start'}),120);

      clearInterval(timer);
    },150);
  }

  function init() {
    wireIndividualFlavourCards();
  /* v35.11.5: preselection handled by final value-based handoff below */
// Re-run card discovery after late-rendered content without duplicating listeners.
    setTimeout(wireIndividualFlavourCards, 500);
    setTimeout(wireIndividualFlavourCards, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();




/* V35_11_5_FINAL_FLAVOUR_PRESELECTION
   Final flavour-page -> Shop handoff.
   IMPORTANT: loadAvailability() changes option.textContent to:
   "Blueberry Mint — 3 in stock"
   but leaves option.value as "Blueberry Mint".
   Therefore preselection MUST match option.value, never display text. */
(function () {
  const requestedSlug = (new URLSearchParams(window.location.search).get('flavour') || '').trim().toLowerCase();
  if (!requestedSlug) return;

  const flavourBySlug = {
    'blueberry-mint': 'Blueberry Mint',
    'miami-mint': 'Miami Mint',
    'blue-razz-ice': 'Blue Razz Ice',
    'strawberry-kiwi-ice': 'Strawberry Kiwi Ice',
    'watermelon-ice': 'Watermelon Ice'
  };

  const requestedValue = flavourBySlug[requestedSlug];
  if (!requestedValue) return;

  function applyRequestedFlavour() {
    const select = document.getElementById('flavourSelect');
    if (!select || select.disabled) return false;

    const option = Array.from(select.options || []).find(
      o => String(o.value || '').trim() === requestedValue
    );

    // Existing live-stock logic remains authoritative.
    if (!option || option.disabled) return false;

    const quantity = document.getElementById('quantity');
    if (quantity) {
      const blank = Array.from(quantity.options || []).find(o => String(o.value || '') === '');
      if (blank) quantity.value = '';
    }

    if (select.value !== requestedValue) {
      select.value = requestedValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    select.classList.add('preselected-flavour-control');
    setTimeout(() => select.classList.remove('preselected-flavour-control'), 1400);

    const target = document.getElementById('buy-now') || select.closest('section') || select;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Consume the marketing parameter after successful application so later
    // stock/UI mutations cannot repeatedly re-run the handoff.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('flavour');
    history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);

    return true;
  }

  function start() {
    const select = document.getElementById('flavourSelect');
    if (!select) {
      setTimeout(start, 100);
      return;
    }

    if (applyRequestedFlavour()) return;

    // loadAvailability() asynchronously enables/disables options and rewrites
    // their visible labels. Observe those mutations, then apply by VALUE.
    const observer = new MutationObserver(() => {
      if (applyRequestedFlavour()) observer.disconnect();
    });

    observer.observe(select, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['disabled']
    });

    // Defensive polling covers browsers where option.disabled mutations are not
    // consistently surfaced through MutationObserver.
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (applyRequestedFlavour() || attempts >= 60) {
        clearInterval(timer);
        observer.disconnect();
      }
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();


/* V35_13_0_SHOP_CONVERSION_OPTIMIZATION
   Front-end conversion layer only.
   No checkout, stock, Zoho, D1 or payment server logic is changed. */
(function () {
  const PRODUCT_PRICE = 300;
  const DELIVERY_PRICE = 60;

  function money(n) {
    return 'R' + Number(n || 0).toFixed(2);
  }

  function findShopRoot() {
    return document.getElementById('buy-now') ||
      document.querySelector('[data-shop-section]') ||
      document.querySelector('form');
  }

  function ensurePanel() {
    // The larger "Your Selection" panel was easily mistaken for the product
    // picker. The compact checkout journey now carries the useful static pricing
    // guidance, while the existing confirmation table remains authoritative.
    const panel = document.getElementById('vestigeConversionSummary');
    if (panel) panel.remove();
    return null;
  }

  function getSelectedText(select) {
    const opt = select && select.options ? select.options[select.selectedIndex] : null;
    return opt ? (opt.textContent || '').trim() : '';
  }

  function updateSummary() {
    const panel = document.getElementById('vestigeCheckoutJourney');
    const form = document.getElementById('orderForm');
    if (!panel || !form) return;
    let basket = {};
    try { basket = JSON.parse(form.dataset.basketSummary || '{}'); } catch (_) {}
    const items = Array.isArray(basket.items) ? basket.items : [];
    const qty = Number(basket.totalQuantity || 0);

    const flavourEl = document.getElementById('vcsFlavour');
    const qtyEl = document.getElementById('vcsQty');
    const productsEl = document.getElementById('vcsProducts');
    const deliveryEl = document.getElementById('vcsDelivery');
    const totalEl = document.getElementById('vcsTotal');
    const noteEl = document.getElementById('vcsNote');

    flavourEl.textContent = items.length
      ? items.map(item => item.flavour + ' × ' + item.quantity).join(', ')
      : 'Your basket is empty';
    qtyEl.textContent = String(qty);

    if (qty > 0) {
      const collectionSelected = basket.deliveryMethod === 'collection';
      productsEl.textContent = money(basket.productsTotal);
      deliveryEl.textContent = collectionSelected ? 'R0.00 Collection' : money(basket.deliveryPrice) + ' Delivery';
      totalEl.textContent = money(basket.grandTotal);
      noteEl.textContent = qty + ' item' + (qty === 1 ? '' : 's') + ' in your basket. Totals update automatically.';
      panel.classList.add('is-ready');
    } else {
      productsEl.textContent = '—';
      deliveryEl.textContent = '—';
      totalEl.textContent = '—';
      noteEl.textContent = 'Choose a flavour and quantity, then add it to your basket.';
      panel.classList.remove('is-ready');
    }

    // Highlight the existing primary checkout/continue button only when selection is complete.
    const possibleButtons = Array.from(form.querySelectorAll('button,input[type="submit"]'));
    const primary = possibleButtons.find(b => {
      const t = String(b.textContent || b.value || '').toLowerCase();
      return /(continue|checkout|order|payment|proceed|buy)/.test(t);
    });
    if (primary) primary.classList.toggle('vestige-primary-ready', qty > 0);
  }

  function wire() {
    const flavour = document.getElementById('flavourSelect');
    const quantity = document.getElementById('quantity');
    if (!flavour || !quantity) {
      setTimeout(wire,150);
      return;
    }

    ensurePanel();
    updateSummary();

    flavour.addEventListener('change', updateSummary);
    quantity.addEventListener('change', updateSummary);

    document.addEventListener('change', function (e) {
      if (e.target.matches('input[type="radio"],select')) updateSummary();
    });
    document.addEventListener('vestige:journey-ready', updateSummary);
    document.addEventListener('vestige:cart-updated', updateSummary);

    // Watch stock-driven option text/disabled changes so summary stays accurate.
    const observer = new MutationObserver(updateSummary);
    observer.observe(flavour, {attributes:true,childList:true,subtree:true,attributeFilter:['disabled']});

    // Lightweight first-party funnel event for completed product selection.
    let lastTracked = '';
    function trackSelection() {
      const f = String(flavour.value || '').trim();
      const q = Number(quantity.value || 0);
      const key = f + ':' + q;
      if (!f || !q || key === lastTracked) return;
      lastTracked = key;
      try {
        fetch('/api/analytics', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          keepalive:true,
          body:JSON.stringify({
            action:'track',
            event:'product_selection_completed',
            flavour:f,
            quantity:q,
            amount:(PRODUCT_PRICE*q)+DELIVERY_PRICE,
            path:location.pathname
          })
        }).catch(()=>{});
      } catch (_) {}
    }

    flavour.addEventListener('change', trackSelection);
    quantity.addEventListener('change', trackSelection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire, {once:true});
  } else {
    wire();
  }
})();
