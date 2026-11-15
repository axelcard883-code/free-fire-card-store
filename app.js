let selected = null;
const money = p => "₹" + (p/100).toLocaleString("en-IN",{maximumFractionDigits:2});
async function loadPackages(){
  const r=await fetch("/api/packages"); const items=await r.json();
  const root=document.getElementById("packages"); root.innerHTML="";
  items.forEach(p=>{
    const b=document.createElement("button"); b.type="button"; b.className="pkg";
    b.innerHTML=`<b>${p.diamonds.toLocaleString("en-IN")}</b><small>Diamonds</small><strong>${money(p.price_paise)}</strong>`;
    b.onclick=()=>{selected=p.id;document.querySelectorAll(".pkg").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")};
    root.appendChild(b);
  });
}
document.getElementById("orderForm").addEventListener("submit",async e=>{
  e.preventDefault(); const result=document.getElementById("result");
  if(!selected){result.textContent="Please choose a diamond package.";return}
  const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uid:document.getElementById("uid").value,packageId:selected})});
  const data=await r.json(); result.textContent=r.ok?`${data.message} Order ID: ${data.orderCode}`:(data.error||"Could not create order.");
});
loadPackages().catch(()=>document.getElementById("packages").textContent="Could not load packages.");
