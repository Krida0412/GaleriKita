const API = '/api/properties';
const paths = {
  home:'M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  bed:'M3 18v3M21 18v3M3 18h18v-7H3V6M7 11V7h6v4M21 11V9h-8',
  bath:'M3 12h18M5 12V5a3 3 0 0 1 6 0M4 12v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4M7 20v2M17 20v2',
  building:'M4 22V3h12v19M16 9h5v13M8 7h4M8 11h4M8 15h4M8 19h4M2 22h21',
  tree:'M12 2 5 11h4l-5 7h7v4h2v-4h7l-5-7h4L12 2Z',
  filter:'M3 4h18l-7 8v8l-4-2v-6L3 4Z',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  close:'M6 6l12 12M6 18 18 6',
  'arrow-up':'M12 20V4m-6 6 6-6 6 6',
  share:'M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9',
  area:'M4 3h16v18H4ZM4 8h5M4 13h3M4 18h5',
  phone:'M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z',
  message:'M21 11a9 9 0 0 1-13 8l-5 2 2-5a9 9 0 1 1 16-5Z',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name] || paths.home).split(/(?=M)/).map(d => `<path d="${d}"/>`).join('')}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const $ = s => document.querySelector(s);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories = [['Semua Properti','filter'],['Rumah Baru','home'],['Rumah Second','building'],['Rumah > 1 M','home'],['Kost','bed'],['Komersial','building'],['Tanah','tree']];
const PAGE_SIZE = 45;
let properties = [], category = 'Semua Properti', page = 1, savedOnly = false, loaded = false, toastTimer;
let listScroll=0, activeProperty=null, activePhotos=[], photoIndex=0, previousFocus=null;
const filterIds=['min-building','min-land','min-beds','min-baths'];
const storageRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const storageWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
function numericFilters(){return Object.fromEntries(['building','land','beds','baths'].map((key,i)=>[key,Math.max(0,Number($('#'+filterIds[i]).value)||0)]));}
function persistState(){storageWrite('gp-list-state-v2',{category,page,savedOnly,search:$('#search').value,sort:$('#sort').value,filters:filterIds.map(id=>$('#'+id).value),scroll:listScroll});}
function restoreState(){const s=storageRead('gp-list-state-v2',{});category=categories.some(c=>c[0]===s.category)?s.category:'Semua Properti';page=Math.max(1,Number(s.page)||1);savedOnly=!!s.savedOnly;$('#search').value=typeof s.search==='string'?s.search:'';$('#sort').value=['newest','price-low','price-high'].includes(s.sort)?s.sort:'newest';filterIds.forEach((id,i)=>{$('#'+id).value=String(s.filters?.[i]??(i>1?'0':''));});listScroll=Math.max(0,Number(s.scroll)||0);$('#saved-toggle').classList.toggle('active',savedOnly);$('#saved-toggle').setAttribute('aria-pressed',String(savedOnly));}
function resetFilters(){category='Semua Properti';savedOnly=false;page=1;listScroll=0;$('#search').value='';$('#sort').value='newest';filterIds.forEach((id,i)=>$('#'+id).value=i>1?'0':'');$('#saved-toggle').classList.remove('active');$('#saved-toggle').setAttribute('aria-pressed','false');drawCategories();render();}
let saved;
try { saved = new Set(JSON.parse(localStorage.getItem('gp-favorites') || '[]')); } catch { saved = new Set(); }
$('#saved-count').textContent = saved.size;
const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f1f3f6"/><path d="m250 195 50-40 50 40v65H250z" fill="none" stroke="#c3c8d1" stroke-width="5"/><text x="300" y="305" text-anchor="middle" font-family="Arial" font-size="16" fill="#8a919d">Foto belum tersedia</text></svg>');
function safeImage(value) { try { const u = new URL(value); return u.protocol==='https:'&&!u.username&&!u.password ? u.href : placeholder; } catch { return placeholder; } }
function assetImage(value,width=800){const src=safeImage(value);try{const u=new URL(src);if(u.hostname==='res.cloudinary.com'&&/\/image\/upload\/v\d+\//.test(u.pathname))u.pathname=u.pathname.replace('/image/upload/',`/image/upload/f_auto,q_auto,c_limit,w_${width}/`);return u.href;}catch{return src;}}
function getDetails(p) { let d=p.details; if(typeof d==='string'){try{d=JSON.parse(d);}catch{d=null;}} return d&&typeof d==='object'&&!Array.isArray(d)?d:{}; }
function area(value) { if (!value) return '—'; const str = String(value).trim(); return /m|²/i.test(str) ? str : `${str} m²`; }
function priceValue(p) {
  const str = String(p.price || '').toLowerCase().replace(/rp\.?\s*/,'');
  const match = str.match(/[\d.,]+/); if (!match) return Infinity;
  const hasUnit = /miliar|milyar|juta|ribu/.test(str);
  const raw = match[0];
  const n = Number(raw.includes(',') ? raw.replace(/\./g,'').replace(',','.') : hasUnit ? raw : raw.replace(/\./g,''));
  return n * (/miliar|milyar/.test(str) ? 1e9 : /juta/.test(str) ? 1e6 : /ribu/.test(str) ? 1e3 : 1);
}
function categoryIcon(type) { return (categories.find(c => c[0] === type) || ['','home'])[1]; }
function drawCategories() {
  $('#categories').innerHTML = categories.map(([name,i]) => `<button class="category ${category===name?'active':''}" aria-pressed="${category===name}" data-category="${escapeHtml(name)}">${icon(i)}${escapeHtml(name)}</button>`).join('');
}
function toggleSave(id) {
  saved.has(id) ? saved.delete(id) : saved.add(id);
  try { localStorage.setItem('gp-favorites', JSON.stringify([...saved])); } catch { showToast('Penyimpanan browser tidak tersedia. Favorit berlaku selama sesi ini.'); }
  $('#saved-count').textContent = saved.size;
  render();
}
function card(p) {
  const d = getDetails(p), specs = [];
  if (Number(d.beds)) specs.push(`${icon('bed')}${escapeHtml(d.beds)} KT`);
  if (Number(d.baths)) specs.push(`${icon('bath')}${escapeHtml(d.baths)} KM`);
  if (d.buildingArea || d.area) specs.push(`${icon('building')}${escapeHtml(area(d.buildingArea || d.area))}`);
  if (d.landArea) specs.push(`${icon('tree')}${escapeHtml(area(d.landArea))}`);
  const id = escapeHtml(p.id), isSaved = saved.has(p.id);
  return `<article class="property-card"><div class="photo-wrap"><img class="property-photo" width="640" height="430" src="${escapeHtml(assetImage(p.image,800))}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async"><span class="type-badge ${['Kost','Tanah','Komersial'].includes(p.type)?p.type.toLowerCase():''}">${icon(categoryIcon(p.type))}${escapeHtml(p.type || 'Properti')}</span><button class="save-button ${isSaved?'saved':''}" data-save="${id}" aria-pressed="${isSaved}" aria-label="${isSaved?'Hapus dari':'Tambahkan ke'} tersimpan: ${escapeHtml(p.title)}">${icon('heart')}</button></div><div class="card-body"><h2 class="card-title">${escapeHtml(p.title)}</h2><p class="location">${icon('pin')}${escapeHtml(p.location || 'Lokasi belum tersedia')}</p><div class="specs">${specs.map(s=>`<span>${s}</span>`).join('')}</div><div class="price-block"><p class="price">${escapeHtml(p.price || 'Hubungi agen')}</p><p class="price-note">${escapeHtml(p.price_note)}</p><button class="detail-button" data-detail="${id}">${icon('eye')}Lihat Detail</button></div></div></article>`;
}
function filteredProperties() {
  const words = $('#search').value.trim().toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const filters=numericFilters();
  const result = properties.filter(p => (category === 'Semua Properti' || p.type === category) && (!savedOnly || saved.has(p.id)) && words.every(w => `${p.title} ${p.location}`.toLocaleLowerCase('id').includes(w)) && matchesSpecs(getDetails(p),filters));
  const sort = $('#sort').value;
  if (sort !== 'newest') result.sort((a,b) => {
    const av=priceValue(a), bv=priceValue(b);
    if (!Number.isFinite(av)) return Number.isFinite(bv) ? 1 : 0;
    if (!Number.isFinite(bv)) return -1;
    return sort==='price-low' ? av-bv : bv-av;
  });
  return result;
}
function emptyState(title, text, retry = false) {
  $('#empty').hidden = false;
  $('#empty').innerHTML = `${icon('search')}<h2>${title}</h2><p>${text}</p><button id="reset-filters">${retry?'Coba lagi':'Tampilkan semua properti'}</button>`;
  $('#reset-filters').onclick = retry ? loadProperties : resetFilters;
}
function render() {
  syncDropdowns();updateFilterBadge();
  if (!loaded) return;
  const result=filteredProperties(), totalPages=Math.max(1,Math.ceil(result.length/PAGE_SIZE));page=Math.min(page,totalPages);
  const visible=result.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  $('#result-count').innerHTML = `${savedOnly?'Properti tersimpan · ':''}Menampilkan <strong>${visible.length}</strong> dari <strong>${result.length}</strong> properti`;
  $('#page-info').textContent = `Halaman ${page} dari ${totalPages}`;
  $('#property-grid').innerHTML = visible.map(card).join('');
  $('#empty').hidden=true;
  if (!visible.length) emptyState(savedOnly?'Belum ada properti tersimpan':'Properti belum ditemukan',savedOnly?'Ketuk ikon hati pada properti yang menarik untuk menyimpannya.':'Coba kata kunci lain atau pilih kategori properti yang berbeda.');
  $('#pagination').innerHTML = result.length>PAGE_SIZE ? `<button data-page="${page-1}" ${page===1?'disabled':''}>← Sebelumnya</button>${Array.from({length:totalPages},(_,i)=>i+1).filter(n=>n===1||n===totalPages||Math.abs(n-page)<=1).map((n,i,arr)=>(i&&n-arr[i-1]>1?'<span class="ellipsis">…</span>':'')+`<button data-page="${n}" class="${n===page?'current':''}" ${n===page?'aria-current="page"':''}>${n}</button>`).join('')}<button data-page="${page+1}" ${page===totalPages?'disabled':''}>Berikutnya →</button>` : '';
  document.querySelectorAll('.property-photo').forEach(img=>img.onerror=()=>{img.onerror=null;img.src=placeholder;});
  persistState();
}
async function loadProperties() {
  const cache=storageRead('gp-properties-v2',null);
  if(cache && Array.isArray(cache.rows)){
    properties=cache.rows;loaded=true;render();route();$('#property-grid').setAttribute('aria-busy','false');
    if(!activeProperty)requestAnimationFrame(()=>window.scrollTo({top:listScroll,behavior:'instant'}));
    if(Date.now()-cache.time<5*60*1000)return;
  }
  if(!loaded){
  loaded=false;$('#empty').hidden=true;$('#pagination').innerHTML='';$('#property-grid').setAttribute('aria-busy','true');
  $('#result-count').textContent='Sedang memuat properti pilihan…';$('#page-info').textContent='Menghubungkan ke GaleriKita';
  $('#property-grid').innerHTML=Array.from({length:6},()=>'<div class="skeleton" aria-hidden="true"></div>').join('');
  }
  try {
    const response=await fetch(API,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Listing sementara belum tersedia');
    const all=await response.json();
    if(!Array.isArray(all))throw new Error('Format listing tidak valid');
    properties=all.filter(p=>!p.status||p.status==='active');loaded=true;storageWrite('gp-properties-v2',{time:Date.now(),rows:properties});render();
    if(!activeProperty){route();if(!activeProperty)requestAnimationFrame(()=>window.scrollTo({top:listScroll,behavior:'instant'}));}
  } catch(error) {
    console.error('Gagal memuat listing:', error.message);
    if(loaded){showToast('Data tersimpan ditampilkan. Pembaruan belum tersambung.');return;}
    $('#property-grid').innerHTML='';$('#result-count').textContent='Listing belum dapat dimuat';$('#page-info').textContent='Periksa koneksi dan coba kembali';
    emptyState('Koneksi belum tersambung','Data properti belum bisa diambil. Silakan coba lagi dalam beberapa saat.',true);
  } finally { $('#property-grid').setAttribute('aria-busy','false'); }
}
function textDescription(value) {
  const doc=new DOMParser().parseFromString(String(value || '')
    .replace(/<div\b[^>]*>/gi,'\n').replace(/<\/div>/gi,'')
    .replace(/<p\b[^>]*>/gi,'\n\n').replace(/<\/p>/gi,'')
    .replace(/<li\b[^>]*>/gi,'\n- ').replace(/<\/li>/gi,'')
    .replace(/<br\s*\/?>/gi,'\n'),'text/html');
  doc.querySelectorAll('script,style').forEach(n=>n.remove());
  return doc.body.textContent.replace(/\u200b/g,'').replace(/[\t ]+\n/g,'\n').trim().replace(/\n[\t ]*\n(?:[\t ]*\n)+/g,'\n\n') || 'Deskripsi lengkap belum tersedia. Hubungi GaleriKita untuk informasi lebih lanjut.';
}
function specRows(rows){return `<dl>${rows.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v===undefined||v===null||v===''?'Belum tersedia':v)}</dd></div>`).join('')}</dl>`;}
function showDetail(id) {
  const p=properties.find(p=>p.id===id);
  $('#properti').hidden=true;$('.site-header').hidden=true;$('footer').hidden=true;$('#detail-page').hidden=false;
  activeProperty=p || {id};
  if(!p){$('#detail-content').innerHTML='<div class="empty"><h2>Properti tidak ditemukan</h2><p>Listing ini mungkin sudah tidak tersedia. Kembali ke daftar untuk melihat pilihan lainnya.</p></div>';window.scrollTo({top:0,behavior:'instant'});return;}
  const d=getDetails(p);activePhotos=[...new Set([p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean))];
  const specs=[['bed','Kamar tidur',d.beds],['bath','Kamar mandi',d.baths],['building','Luas bangunan',area(d.buildingArea||d.area)],['tree','Luas tanah',area(d.landArea)]].filter(([, ,v])=>v&&v!=='—'&&v!=='0');
  const features=Array.isArray(p.features)?p.features:[];
  const photos=activePhotos.length?activePhotos:[null];
  $('#detail-content').innerHTML=`<section class="detail-gallery" aria-label="Foto properti">${photos.map((src,i)=>`<button class="gallery-tile" data-open-photo="${i}" aria-label="Perbesar foto ${i+1}"><img src="${escapeHtml(assetImage(src,800))}" alt="${escapeHtml(p.title)} — foto ${i+1}" ${i>2?'loading="lazy"':''}><span>${icon('eye')} Lihat foto penuh</span></button>`).join('')}</section><article class="detail-panel"><div class="detail-badges"><span class="detail-type">${escapeHtml(p.type||'Properti')}</span><span class="status-badge">${p.status==='active'?'Aktif':escapeHtml(p.status||'Status belum tersedia')}</span></div><h1 id="detail-title" tabindex="-1">${escapeHtml(p.title)}</h1><p class="location">${icon('pin')}${escapeHtml(p.location)}</p><p class="price">${escapeHtml(p.price||'Hubungi agen')}</p><p class="price-note">${escapeHtml(p.price_note)}</p>${specs.length?`<div class="overview-specs">${specs.map(([i,k,v])=>`<div>${icon(i)}<span>${k}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>`:''}<h2>Deskripsi Properti</h2><p class="description">${escapeHtml(textDescription(p.description))}</p>${features.length?`<h2>Fasilitas</h2><ul class="detail-features">${features.map(f=>`<li><span>✓</span>${escapeHtml(f)}</li>`).join('')}</ul>`:''}<div class="detail-actions"><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location||'Purwokerto')}">${icon('pin')}Cari area di peta</a><button id="share-property">${icon('share')}Bagikan properti</button></div><aside class="important-info"><h3>Informasi Penting</h3><p>Konfirmasi harga, ketersediaan, legalitas, pilihan pembayaran, dan jadwal survei langsung kepada agen. Peta menunjukkan area listing, bukan titik alamat rumah.</p></aside></article><section class="detail-panel specification-section" aria-labelledby="specification-title"><h2 id="specification-title">Spesifikasi Detail</h2><div class="specification-grid"><section><h3>Informasi Umum</h3>${specRows([['Tipe Properti',p.type],['Status',p.status==='active'?'Aktif':p.status],['Lokasi',p.location]])}</section><section><h3>Spesifikasi Bangunan</h3>${specRows([['Kamar Tidur',Number(d.beds)||'Belum tersedia'],['Kamar Mandi',Number(d.baths)||'Belum tersedia'],['Luas Bangunan',area(d.buildingArea||d.area)],['Luas Tanah',area(d.landArea)],...(d.floors?[['Jumlah Lantai',d.floors]]:[]),...(Number(d.carport)?[['Carport',d.carport]]:[])])}</section><section><h3>Informasi Harga</h3>${specRows([['Harga',p.price],['Keterangan',p.price_note],['Sistem Pembayaran',p.payment_system||d.paymentSystem||'Konfirmasi ke agen'],['Konsultasi','Hubungi agen']])}</section></div></section>`;
  $('#detail-content').querySelectorAll('img').forEach(img=>img.onerror=()=>{img.onerror=null;img.src=placeholder;});
  $('#share-property').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);showToast('Tautan properti berhasil disalin');}catch{showToast('Salin tautan properti dari bilah alamat browser.');}};
  document.title=`${p.title} — GaleriKita`;
  window.scrollTo({top:0,behavior:'instant'});
  $('#detail-title').focus({preventScroll:true});
}
function navigateToDetail(id){listScroll=window.scrollY;persistState();history.pushState({fromList:true},'',`#properti/${encodeURIComponent(id)}`);showDetail(id);}
function route(){
  if(!loaded)return;
  const match=location.hash.match(/^#properti\/(.+)$/);
  if(match){try{showDetail(decodeURIComponent(match[1]));}catch{showToast('Tautan properti tidak valid.');}return;}
  const wasDetail=!!activeProperty;
  if($('#photo-viewer').open)$('#photo-viewer').close();
  activeProperty=null;$('#properti').hidden=false;$('.site-header').hidden=false;$('footer').hidden=false;$('#detail-page').hidden=true;document.title='Properti Unggulan — GaleriKita';
  if(wasDetail){render();requestAnimationFrame(()=>window.scrollTo({top:listScroll,behavior:'instant'}));}
}
function closeDetail(){if(history.state?.fromList)history.back();else{history.replaceState(null,'',location.pathname+location.search);route();}}
function drawPhoto(){
  $('#full-photo').src=assetImage(activePhotos[photoIndex],1920);$('#full-photo').alt=`${activeProperty.title} — foto ${photoIndex+1}`;
  $('#photo-counter').textContent=`${photoIndex+1} / ${activePhotos.length}`;
  $('#viewer-thumbs').innerHTML=activePhotos.map((src,i)=>`<button data-viewer-photo="${i}" class="${photoIndex===i?'selected':''}" aria-label="Tampilkan foto ${i+1}" aria-pressed="${photoIndex===i}"><img src="${escapeHtml(assetImage(src,160))}" alt="Foto ${i+1}" loading="lazy"></button>`).join('');
  $('#previous-photo').hidden=$('#next-photo').hidden=activePhotos.length<2;
  $('#viewer-thumbs').querySelector('.selected')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function openPhoto(index){if(!activePhotos.length)return;photoIndex=index;previousFocus=document.activeElement;drawPhoto();$('#photo-viewer').showModal();document.body.style.overflow='hidden';}
function changePhoto(delta){photoIndex=(photoIndex+delta+activePhotos.length)%activePhotos.length;drawPhoto();}
function showToast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
$('#categories').onclick=e=>{const btn=e.target.closest('[data-category]');if(!btn)return;category=btn.dataset.category;page=1;drawCategories();render();};
let searchTimer;$('#search').oninput=()=>{page=1;clearTimeout(searchTimer);searchTimer=setTimeout(render,120);};
$('#sort').onchange=()=>{page=1;render();};
filterIds.forEach(id=>$('#'+id).addEventListener('input',()=>{page=1;render();}));
$('#clear-filters').onclick=resetFilters;
$('#saved-toggle').setAttribute('aria-label','Lihat properti tersimpan');
$('#saved-toggle').onclick=()=>{savedOnly=!savedOnly;page=1;$('#saved-toggle').classList.toggle('active',savedOnly);$('#saved-toggle').setAttribute('aria-pressed',String(savedOnly));render();};
$('#property-grid').onclick=e=>{const save=e.target.closest('[data-save]'),detail=e.target.closest('[data-detail]');if(save)toggleSave(save.dataset.save);if(detail)navigateToDetail(detail.dataset.detail);};
$('#pagination').onclick=e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;page=Number(b.dataset.page);render();$('.results-bar').scrollIntoView({behavior:'instant',block:'start'});listScroll=window.scrollY;persistState();};
$('#back-to-list').onclick=closeDetail;
$('#detail-content').onclick=e=>{const b=e.target.closest('[data-open-photo]');if(b)openPhoto(Number(b.dataset.openPhoto));};
$('#close-viewer').onclick=()=>$('#photo-viewer').close();
$('#previous-photo').onclick=()=>changePhoto(-1);$('#next-photo').onclick=()=>changePhoto(1);
$('#viewer-thumbs').onclick=e=>{const b=e.target.closest('[data-viewer-photo]');if(b){photoIndex=Number(b.dataset.viewerPhoto);drawPhoto();}};
$('#full-photo').onerror=()=>{if($('#full-photo').src!==placeholder)$('#full-photo').src=placeholder;};
$('#photo-viewer').addEventListener('close',()=>{document.body.style.overflow='';previousFocus?.focus({preventScroll:true});});
let touchStart=null;
$('#photo-stage').addEventListener('touchstart',e=>{touchStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
$('#photo-stage').addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)changePhoto(dx<0?1:-1);touchStart=null;},{passive:true});
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',()=>{if(!activeProperty)listScroll=window.scrollY;persistState();});
let scrollSave;
window.addEventListener('scroll',()=>{if(activeProperty)return;clearTimeout(scrollSave);scrollSave=setTimeout(()=>{listScroll=window.scrollY;persistState();},150);},{passive:true});
document.addEventListener('keydown',e=>{if($('#photo-viewer').open){if(e.key==='ArrowLeft'){e.preventDefault();changePhoto(-1);}if(e.key==='ArrowRight'){e.preventDefault();changePhoto(1);}return;}if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!activeProperty){e.preventDefault();$('#search').focus();}});
function closeDropdowns(except=null){document.querySelectorAll('.select-trigger').forEach(trigger=>{if(trigger===except)return;trigger.setAttribute('aria-expanded','false');document.getElementById(trigger.getAttribute('aria-controls')).hidden=true;});}
function syncDropdowns(){document.querySelectorAll('.custom-select').forEach(wrapper=>{const select=wrapper.querySelector('select'),trigger=wrapper.querySelector('.select-trigger');trigger.querySelector('.selected-label').textContent=select.selectedOptions[0]?.textContent||'Semua';wrapper.querySelectorAll('[role="option"]').forEach(option=>option.setAttribute('aria-selected',String(option.dataset.value===select.value)));});}
function initDropdowns(){
  const names={'min-beds':'Kamar tidur minimal','min-baths':'Kamar mandi minimal',sort:'Urutkan properti'};
  Object.entries(names).forEach(([id,name])=>{
    const select=$('#'+id),wrapper=document.createElement('div');wrapper.className='custom-select';select.before(wrapper);wrapper.append(select);select.hidden=true;
    wrapper.insertAdjacentHTML('beforeend',`<button type="button" class="select-trigger" id="${id}-trigger" role="combobox" aria-label="${name}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-options"><span class="selected-label"></span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="custom-menu" role="listbox" id="${id}-options" aria-label="${name}" hidden>${[...select.options].map(option=>`<button type="button" role="option" tabindex="-1" data-value="${escapeHtml(option.value)}" aria-selected="false"><span>${escapeHtml(option.textContent)}</span><span class="option-check" aria-hidden="true">✓</span></button>`).join('')}</div>`);
    const trigger=wrapper.querySelector('.select-trigger'),menu=wrapper.querySelector('.custom-menu');
    function open(){closeDropdowns(trigger);menu.hidden=false;trigger.setAttribute('aria-expanded','true');const rect=trigger.getBoundingClientRect();menu.classList.toggle('opens-up',window.innerHeight-rect.bottom<Math.min(250,select.options.length*38+12)&&rect.top>250);}
    trigger.onclick=()=>{if(menu.hidden)open();else closeDropdowns();};
    trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open();const opts=[...menu.querySelectorAll('[role="option"]')];(e.key==='End'?opts.at(-1):e.key==='Home'?opts[0]:menu.querySelector('[aria-selected="true"]')||opts[0]).focus();}if(e.key==='Escape'){closeDropdowns();}};
    menu.onclick=e=>{const option=e.target.closest('[role="option"]');if(!option)return;select.value=option.dataset.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));syncDropdowns();closeDropdowns();trigger.focus();};
    menu.onkeydown=e=>{const options=[...menu.querySelectorAll('[role="option"]')],index=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}if(e.key==='Escape'){e.preventDefault();closeDropdowns();trigger.focus();}if(e.key==='Tab')closeDropdowns();};
  });syncDropdowns();
}
function updateFilterBadge(){const count=Object.values(numericFilters()).filter(Boolean).length;$('#filter-badge').hidden=!count;$('#filter-badge').textContent=count;$('#filter-toggle').classList.toggle('has-filters',count>0);}
$('#filter-toggle').onclick=()=>{const panel=$('#advanced-filters'),open=panel.hidden;closeDropdowns();panel.hidden=!open;$('#filter-toggle').setAttribute('aria-expanded',String(open));};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.custom-select'))closeDropdowns();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDropdowns();});
if('scrollRestoration' in history)history.scrollRestoration='manual';
restoreState();initDropdowns();drawCategories();loadProperties();
