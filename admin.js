const $=id=>document.getElementById(id);
async function api(url,opts={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});const d=await r.json();if(!r.ok)throw Error(d.error||"Request failed");return d}
function show(){ $("login").classList.add("hidden");$("dashboard").classList.remove("hidden");refresh() }
$("loginForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});show()}catch(x){$("loginMsg").textContent=x.message}};
async function refresh(){
  try{
    const [orders,pkgs]=await Promise.all([api("/api/admin/orders"),api("/api/admin/packages")]);
    $("orders").innerHTML=orders.length?orders.map(o=>`<div class="order"><b>${o.order_code}</b><br>UID: ${o.player_uid} • ${o.package_name} • ₹${(o.amount_paise/100).toFixed(2)}<br><span class="muted">${o.created_at}</span><br><select data-id="${o.id}" class="status"><option ${o.status==="Pending"?"selected":""}>Pending</option><option ${o.status==="Reviewing"?"selected":""}>Reviewing</option><option ${o.status==="Completed"?"selected":""}>Completed</option><option ${o.status==="Cancelled"?"selected":""}>Cancelled</option></select></div>`).join(""):"No orders yet.";
    document.querySelectorAll(".status").forEach(s=>s.onchange=async()=>{await api("/api/admin/orders/"+s.dataset.id,{method:"PATCH",body:JSON.stringify({status:s.value})})});
    $("pkgList").innerHTML="<h3>Packages</h3>"+pkgs.map(p=>`<div class="order">${p.name} — ₹${(p.price_paise/100).toFixed(2)} ${p.active?"":"(hidden)"} <button data-id="${p.id}" data-active="${p.active?0:1}" class="toggle"> ${p.active?"Hide":"Enable"} </button></div>`).join("");
    document.querySelectorAll(".toggle").forEach(b=>b.onclick=async()=>{await api("/api/admin/packages/"+b.dataset.id,{method:"PATCH",body:JSON.stringify({active:Number(b.dataset.active)})});refresh()});
  }catch(e){$("orders").textContent=e.message}
}
$("packageForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/packages",{method:"POST",body:JSON.stringify({name:$("pname").value,diamonds:Number($("diamonds").value),priceRupees:Number($("price").value)})});$("pkgMsg").textContent="Package added.";e.target.reset();refresh()}catch(x){$("pkgMsg").textContent=x.message}};
$("logout").onclick=async()=>{await api("/api/admin/logout",{method:"POST"});location.reload()};
