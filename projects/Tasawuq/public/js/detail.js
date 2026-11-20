/* Detail Page JS */
const id = new URLSearchParams(location.search).get('id');
let listing = null, media = [], attrs = [], idx = 0;

async function load() {
  if(!id) { location.href='/'; return; }
  try {
    const res = await fetch('/api/listings/'+id);
    const data = await res.json();
    if(!res.ok) { alert(data.error); location.href='/'; return; }
    listing = data.listing; media = data.media||[]; attrs = data.attrs||[];
    
    document.title = listing.title + ' - تسوق';
    document.getElementById('crumbTitle').textContent = listing.title;
    document.getElementById('detailTitle').textContent = listing.title;
    document.getElementById('detailCity').textContent = listing.city||'غير محدد';
    document.getElementById('detailViews').textContent = listing.views||0;
    document.getElementById('detailDate').textContent = new Date(listing.created_at).toLocaleDateString('ar-EG');
    document.getElementById('detailDesc').textContent = listing.description||'لا يوجد وصف';
    document.getElementById('detailPrice').textContent = Number(listing.price).toLocaleString('ar-EG') + ' ' + (listing.currency||'ج.م');
    document.getElementById('priceNote').textContent = listing.negotiable ? 'قابل للتفاوض' : 'غير قابل للتفاوض';
    document.getElementById('sellerName').textContent = listing.seller_name;
    document.getElementById('sellerSince').textContent = listing.seller_since ? new Date(listing.seller_since).toLocaleDateString('ar-EG') : '-';
    
    const tb = document.getElementById('typeBadge');
    tb.textContent = listing.type==='cars'?'🚗 سيارات':listing.type==='real_estate'?'🏠 عقارات':'🌍 أراضي';
    
    document.getElementById('callBtn').href = 'tel:'+listing.phone;
    document.getElementById('whatsappBtn').href = 'https://wa.me/'+(listing.whatsapp||listing.phone).replace(/\D/g,'')+'?text='+encodeURIComponent('السلام عليكم، أريد الاستفسار عن: '+listing.title);
    
    // gallery (images + videos)
    if(media.length) {
      showMedia(0);
      document.getElementById('thumbs').innerHTML = media.map((m,i)=>`
        ${m.type==='video'
          ? `<div class="thumb thumb-video ${i===0?'active':''}" onclick="goImg(${i})"><video src="${m.url}" muted preload="metadata"></video><span class="thumb-play"><i class="bi bi-play-fill"></i></span></div>`
          : `<img src="${m.url}" class="thumb ${i===0?'active':''}" onclick="goImg(${i})" onerror="this.onerror=null;this.src='assets/placeholder.svg'">`}
      `).join('');
    } else {
      document.getElementById('mainImg').src = 'assets/placeholder.svg';
    }
    
    // attrs
    if(attrs.length) {
      document.getElementById('attrsGrid').innerHTML = attrs.map(a=>`<div class="attr-item"><span class="attr-label">${getLabel(a.attr_key)}</span><span class="attr-value">${a.attr_value}</span></div>`).join('');
    } else {
      document.getElementById('attrsSection').classList.add('hidden');
    }
  } catch(e) { console.error(e); }
}

function getLabel(k){
  const map = {brand:'الماركة',model:'الموديل',year:'سنة الصنع',km:'الكيلو متر',fuel:'نوع الوقود',transmission:'ناقل الحركة',color:'اللون',condition:'الحالة',rooms:'عدد الغرف',bathrooms:'عدد الحمامات',area_m2:'المساحة م²',floor:'الدور',furnished:'مفروش',land_type:'نوع الأرض',purpose:'الغرض'};
  return map[k]||k;
}

function showMedia(i){
  const im = document.getElementById('mainImg');
  const m = media[i];
  const parent = im.parentElement;
  let vid = parent.querySelector('video.main-video');
  if(!m){ im.style.display='block'; im.src='assets/placeholder.svg'; if(vid) vid.remove(); return; }
  if(m.type === 'video'){
    im.style.display = 'none';
    im.removeAttribute('src');
    if(!vid){
      vid = document.createElement('video');
      vid.className = 'main-video';
      vid.controls = true; vid.playsInline = true; vid.preload = 'metadata';
      parent.insertBefore(vid, im);
    }
    vid.src = m.url;
  } else {
    if(vid) vid.remove();
    im.style.display = 'block';
    im.src = m.url;
    im.onerror = function(){ this.onerror=null; this.src='assets/placeholder.svg'; };
  }
}

window.goImg = function(i){ idx=i; showMedia(i); document.querySelectorAll('.thumb, .thumb-video').forEach((t,j)=>t.classList.toggle('active',j===i)); }
document.getElementById('prevImg')?.addEventListener('click',()=>{ if(!media.length)return; idx=(idx-1+media.length)%media.length; goImg(idx); });
document.getElementById('nextImg')?.addEventListener('click',()=>{ if(!media.length)return; idx=(idx+1)%media.length; goImg(idx); });

// messages
const modal = document.getElementById('msgModal');
document.getElementById('msgBtn')?.addEventListener('click',()=>{
  if(!token){ location.href='/login.html'; return; }
  if(user && user.id === listing.user_id){ alert('هذا إعلانك'); return; }
  modal.classList.remove('hidden');
});
document.getElementById('msgClose').addEventListener('click',()=>modal.classList.add('hidden'));
document.getElementById('msgBackdrop').addEventListener('click',()=>modal.classList.add('hidden'));
document.getElementById('sendMsg').addEventListener('click',async()=>{
  const msg = document.getElementById('msgText').value.trim();
  if(!msg){ alert('يرجى كتابة الرسالة'); return; }
  try {
    const res = await fetch('/api/messages/send',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({to_user:listing.user_id, listing_id:listing.id, message:msg})});
    const d = await res.json();
    if(res.ok){ alert('تم إرسال الرسالة بنجاح'); modal.classList.add('hidden'); document.getElementById('msgText').value=''; }
    else alert(d.error);
  } catch(e){ alert('خطأ'); }
});

// share
window.share = function(p){
  const url = location.href, title = listing.title;
  if(p==='whatsapp') window.open('https://wa.me/?text='+encodeURIComponent(title+' '+url));
  if(p==='facebook') window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url));
  if(p==='twitter') window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(title)+'&url='+encodeURIComponent(url));
}
window.copyLink = function(){ navigator.clipboard.writeText(location.href); alert('تم نسخ الرابط'); }

load();

