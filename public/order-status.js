
(function(){
'use strict';
var form=document.getElementById('statusForm');
var message=document.getElementById('statusMessage');
var result=document.getElementById('statusResult');
var checkAgain=document.getElementById('checkAgain');
var submitButton=form.querySelector('button[type="submit"]');

function money(v){return 'R'+Number(v||0).toFixed(2);}
function dateTime(v){var n=Number(v||0),d=new Date(n);return !n||isNaN(d.getTime())?'—':d.toLocaleString();}
function setMessage(text,error){message.textContent=text||'';message.className='status-message'+(error?' error':'');}
function setBusy(busy){if(submitButton){submitButton.disabled=busy;submitButton.textContent=busy?'Checking…':'Check order status';}}

async function checkStatus(){
  var ref=String(document.getElementById('statusReference').value||'').trim().toUpperCase();
  var email=String(document.getElementById('statusEmail').value||'').trim().toLowerCase();
  document.getElementById('statusReference').value=ref;
  document.getElementById('statusEmail').value=email;

  if(!/^V\d{4,8}$/.test(ref)){setMessage('Enter a valid Vestige reference such as V0001.',true);document.getElementById('statusReference').focus();return;}
  if(!email||email.indexOf('@')<1){setMessage('Enter the email address used for this order.',true);document.getElementById('statusEmail').focus();return;}

  setBusy(true);setMessage('Checking your order…',false);result.hidden=true;
  try{
    var response=await fetch('/api/zoho',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      cache:'no-store',
      body:JSON.stringify({action:'public_order_status',paymentReference:ref,email:email})
    });
    var data=await response.json();
    if(!response.ok)throw new Error(data&&data.message?data.message:'Unable to check the order.');
    var o=data.order||{};
    document.getElementById('resultReference').textContent=o.paymentReference||ref;
    document.getElementById('resultTitle').textContent=o.title||'Order status';
    document.getElementById('resultMessage').textContent=o.message||'';
    document.getElementById('resultAmount').textContent=money(o.amount);
    document.getElementById('resultQuantity').textContent=String(o.totalQuantity||0)+' item(s)';
    document.getElementById('resultFulfilment').textContent=o.fulfilment||'—';
    document.getElementById('resultUpdated').textContent=dateTime(o.updatedAt);
    var pill=document.getElementById('resultPill');
    pill.textContent=o.status||'status';
    pill.className='status-pill '+String(o.status||'');
    result.hidden=false;
    result.setAttribute('tabindex','-1');
    result.focus({preventScroll:true});
    result.scrollIntoView({behavior:'smooth',block:'start'});
    setMessage('',false);
  }catch(err){setMessage(err.message||'Unable to check the order.',true);}
  finally{setBusy(false);}
}
form.addEventListener('submit',function(e){e.preventDefault();checkStatus();});
if(checkAgain)checkAgain.addEventListener('click',checkStatus);
})();
