(function(){
'use strict';

var priceNodes=Array.prototype.slice.call(document.querySelectorAll('[data-product-price-family]'));
var stockNodes=Array.prototype.slice.call(document.querySelectorAll('[data-stock-product-key]'));
if(!priceNodes.length&&!stockNodes.length)return;

var endpoint='/api/zoho';
function money(value){return 'R'+Number(value).toFixed(2);}
function updateFamilyPrices(catalogue){
  ['ELFA MASTER','ELFA PRO'].forEach(function(family){
    var expected=family==='ELFA MASTER'?3:5;
    var rows=Object.keys(catalogue||{}).map(function(key){return catalogue[key];}).filter(function(item){return item&&item.productFamily===family;});
    if(rows.length!==expected)return;
    var prices=rows.map(function(item){return Number(item.unitPrice);});
    if(prices.some(function(price){return !Number.isFinite(price)||price<=0;}))return;
    var price=prices[0];
    if(!prices.every(function(value){return Math.abs(value-price)<0.001;}))return;
    priceNodes.forEach(function(node){
      if(node.getAttribute('data-product-price-family')===family)node.textContent=money(price);
    });
  });
}
function updateStock(catalogue){
  stockNodes.forEach(function(node){
    var key=node.getAttribute('data-stock-product-key');
    var item=catalogue&&catalogue[key];
    node.classList.remove('in-stock','out-of-stock','unavailable');
    if(!item||item.checkoutEnabled!==true){
      node.textContent=item&&String(item.reason||'').toLowerCase().indexOf('price')!==-1?'Price verification pending':'Availability could not be verified';
      node.classList.add('unavailable');
      return;
    }
    var stock=Math.max(0,Math.floor(Number(item.stock||0)));
    if(item.available===true&&stock>0){
      node.textContent=stock+' in stock';
      node.classList.add('in-stock');
    }else if(String(item.reason||'').toLowerCase().indexOf('price does not match')!==-1){
      node.textContent='Price verification pending';
      node.classList.add('unavailable');
    }else if(stock<=0){
      node.textContent='Out of stock';
      node.classList.add('out-of-stock');
    }else{
      node.textContent='Currently unavailable';
      node.classList.add('unavailable');
    }
  });
}
async function refreshProductStatus(){
  var response=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    cache:'no-store',
    body:JSON.stringify({action:'availability'})
  });
  if(!response.ok)throw new Error('Availability service returned '+response.status);
  var result=await response.json();
  var catalogue=result&&result.catalogue?result.catalogue:{};
  updateFamilyPrices(catalogue);
  updateStock(catalogue);
}
function markAvailabilityUnverified(){
  stockNodes.forEach(function(node){
    node.textContent='Availability could not be verified';
    node.classList.remove('in-stock','out-of-stock');
    node.classList.add('unavailable');
  });
}
refreshProductStatus().catch(markAvailabilityUnverified);
window.setInterval(function(){refreshProductStatus().catch(markAvailabilityUnverified);},30000);
})();