/* Add Listing JS */
let selectedType = null;
let files = [];

if(typeof token === 'undefined' || !token){ alert('يجب تسجيل الدخول أولاً لإضافة إعلان'); location.href='/login.html'; }

// Type selection
document.querySelectorAll('.type-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.type-card').forEach(c=>c.classList.remove('active'));
    card.classList.add('active');
    selectedType = card.dataset.type;
    buildDynamicFields(selectedType);
    setTimeout(()=>goStep(2), 400);
  });
});

function goStep(n){
  document.querySelectorAll('.step-content').forEach(s=>s.classList.remove('active'));
  document.getElementById('step'+n).classList.add('active');
  document.querySelectorAll('.progress-step').forEach((st,i)=>{
    st.classList.toggle('active', i < n);
  });
  window.scrollTo({top:0,behavior:'smooth'});
}

function buildDynamicFields(type){
  const box = document.getElementById('dynamicFields');
  let html = '<div class="form-row">';
  if(type==='cars'){
    html += field('الماركة','brand','text','مثال: تويوتا');
    html += field('الموديل','model','text','مثال: كورولا');
    html += field('سنة الصنع','year','number','2020');
    html += field('الكيلو متر','km','number','مثال: 50000');
    html += field('نوع الوقود','fuel','select',['بنزين','ديزل','غاز','كهرباء','هايبرد']);
    html += field('ناقل الحركة','transmission','select',['أوتوماتيك','مانيوال']);
    html += field('اللون','color','text','أبيض');
    html += field('الحالة','condition','select',['جديد','مستعمل','كسر زيرو']);
  } else if(type==='real_estate'){
    html += field('عدد الغرف','rooms','number','3');
    html += field('عدد الحمامات','bathrooms','number','2');
    html += field('المساحة م²','area_m2','number','120');
    html += field('الدور','floor','text','الثالث');
    html += field('مفروش','furnished','select',['نعم','لا','جزئي']);
  } else if(type==='lands'){
    html += field('المساحة م²','area_m2','number','500');
    html += field('نوع الأرض','land_type','select',['زراعية','بناء','سكنية','تجارية']);
    html += field('الغرض','purpose','select',['للبيع','للإيجار']);
  }
  html += '</div>';
  box.innerHTML = html;
}
function field(label,name,type,opts){
  if(type==='select'){
    let o = `<option value="">اختر</option>`+opts.map(x=>`<option value="${x}">${x}</option>`).join('');
    return `<div class="form-group"><label class="form-label">${label}</label><select class="form-input" data-attr="${name}">${o}</select></div>`;
  }
  return `<div class="form-group"><label class="form-label">${label}</label><input type="${type}" class="form-input" data-attr="${name}" placeholder="${opts||''}"></div>`;
}

// Upload
const zone = document.getElementById('uploadZone');
const input = document.getElementById('fileInput');
const preview = document.getElementById('previewGrid');
zone.addEventListener('click',()=>input.click());
zone.addEventListener('dragover',e=>{e.preventDefault(); zone.style.borderColor='var(--primary)';});
zone.addEventListener('dragleave',()=>{zone.style.borderColor='var(--border)';});
zone.addEventListener('drop',e=>{e.preventDefault(); zone.style.borderColor='var(--border)'; handleFiles(e.dataTransfer.files);});
input.addEventListener('change',e=>handleFiles(e.target.files));
function handleFiles(list){
  for(let f of list){
    if(f.type.startsWith('image/') || f.type.startsWith('video/')){
      if(f.size > 60*1024*1024){ alert('حجم الملف ' + f.name + ' أكبر من 60 ميجابايت'); continue; }
      files.push(f);
    }
  }
  renderPreviews();
}
function renderPreviews(){
  preview.innerHTML = files.map((f,i)=>{
    const isVid = f.type.startsWith('video/');
    return `<div class="preview-item ${isVid?'is-video':''}">
      ${isVid ? `<video src="${URL.createObjectURL(f)}" muted preload="metadata"></video><span class="preview-play"><i class="bi bi-play-fill"></i></span>` : `<img src="${URL.createObjectURL(f)}" alt="">`}
      <button type="button" class="preview-remove" onclick="removeFile(${i})"><i class="bi bi-x"></i></button>
    </div>`;
  }).join('');
}
window.removeFile = function(i){ files.splice(i,1); renderPreviews(); }

// Submit
document.getElementById('submitBtn').addEventListener('click', async ()=>{
  if(!selectedType){ alert('يرجى اختيار نوع الإعلان'); goStep(1); return; }
  const title = document.getElementById('f_title').value.trim();
  const price = document.getElementById('f_price').value;
  const city = document.getElementById('f_city').value.trim();
  const phone = document.getElementById('f_phone').value.trim();
  if(!title || !price || !city || !phone){ alert('يرجى ملء جميع الحقول المطلوبة'); goStep(2); return; }
  
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الإرسال...';
  
  const fd = new FormData();
  fd.append('title', title);
  fd.append('type', selectedType);
  fd.append('price', price);
  fd.append('currency', document.getElementById('f_currency').value);
  fd.append('negotiable', document.getElementById('f_negotiable').value);
  fd.append('description', document.getElementById('f_desc').value);
  fd.append('city', city);
  fd.append('phone', phone);
  fd.append('whatsapp', document.getElementById('f_whatsapp').value);
  fd.append('address', document.getElementById('f_address').value);
  document.querySelectorAll('[data-attr]').forEach(el=>{ if(el.value) fd.append(el.dataset.attr, el.value); });
  files.forEach(f=>{ if(f.type.startsWith('video/')) fd.append('videos', f); else fd.append('images', f); });
  
  try {
    const res = await fetch('/api/my/listings',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});
    const d = await res.json();
    if(res.ok){ alert(d.message||'تم إرسال الإعلان بنجاح'); location.href='/my-listings.html'; }
    else alert(d.error||'حدث خطأ');
  } catch(e){ alert('خطأ في الاتصال'); }
  btn.disabled = false; btn.innerHTML = '<i class="bi bi-send"></i> إرسال الإعلان للموافقة';
});
