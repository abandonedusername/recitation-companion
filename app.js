/* The Recitation Companion v1 — dependency-free family memory app. Everything stays on this device. */
(() => {
'use strict';
const KEY = 'memory-garden-family-v1';
const TRACKS = ['scripture', 'poetry'];
const TRACK_LABELS = {scripture:'Scriptures',poetry:'Poetry'};
const EMOJI = {scripture:'✦',poetry:'❧'};
const $ = (selector,root=document) => root.querySelector(selector);
const $$ = (selector,root=document) => [...root.querySelectorAll(selector)];
const uid = () => 'mg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr = esc;
const labelSlot = key => key==='daily'?'Daily':key==='odd'?'Odd':key==='even'?'Even':key?.startsWith('w')?'Weekly '+key.slice(1):key?.startsWith('m')?'Monthly '+key.slice(1):key||'';
const emptyState = () => ({version:1,settings:{weekly:4,monthly:16,autoFill:false},works:[],cards:[],slots:{scripture:{},poetry:{}},queues:{scripture:[],poetry:[]},archived:{scripture:[],poetry:[]},nextSession:1,session:null,history:[]});
let state = load();
let ui = {page:'today',track:'scripture',modal:null,librarySearch:'',practiceMode:'full',selection:new Set()};
let toastTimer;
function load(){try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(data.version===1&&data.works&&data.cards&&data.slots&&data.queues){return data;}}}catch(error){console.warn('Unable to load saved library',error);}return emptyState();}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(error){alert('Unable to save. Your browser may have run out of storage. Please export a backup.');}}
function notify(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300);}
function keys(){return ['daily','odd','even',...Array.from({length:state.settings.weekly},(_,i)=>'w'+(i+1)),...Array.from({length:state.settings.monthly},(_,i)=>'m'+(i+1))];}
function reviewKeys(number){return ['daily',number%2?'odd':'even','w'+(1+(number-1)%state.settings.weekly),'m'+(1+(number-1)%state.settings.monthly)];}
function work(id){return state.works.find(w=>w.id===id);}
function card(id){return state.cards.find(c=>c.id===id);}
function workParts(w,ids){return (w?.parts||[]).filter(p=>ids.includes(p.id));}
function cardText(c){const w=work(c.workId);if(!w)return '';return workParts(w,c.partIds).map(p=>p.text).join('\n\n');}
function cardTitle(c){const w=work(c.workId);return c.label || w?.title || 'Untitled';}
function cardDetail(c){const w=work(c.workId);return [w?.reference, c.partIds?.length && w?.parts?.length>1 ? `${c.partIds.length} of ${w.parts.length} sections`:null].filter(Boolean).join(' · ');}
function cardStatus(c){if(c.status==='library')return 'Waiting list';if(c.status==='archive')return 'Completed';if(c.status==='slot')return labelSlot(c.slot);return 'Unassigned';}
function clearPlacement(id){const c=card(id);if(!c)return;for(const kind of TRACKS){for(const key of Object.keys(state.slots[kind])){if(state.slots[kind][key]===id)delete state.slots[kind][key];}state.queues[kind]=state.queues[kind].filter(x=>x!==id);state.archived[kind]=state.archived[kind].filter(x=>x!==id);}c.status='unassigned';c.slot=null;}
function queueCard(id,atStart=false){const c=card(id);if(!c)return;clearPlacement(id);c.status='library';if(atStart)state.queues[c.track].unshift(id);else state.queues[c.track].push(id);}
function archiveCard(id){const c=card(id);if(!c)return;clearPlacement(id);c.status='archive';state.archived[c.track].unshift(id);}
// Insert into a slot and push every displaced card forward. The final displaced card graduates to Completed.
function cascadePlace(id,target){const c=card(id);if(!c)return;const chain=keys();if(!chain.includes(target))throw new Error('Unknown slot '+target);const track=c.track;clearPlacement(id);let moving=id;let index=chain.indexOf(target);while(moving){if(index>=chain.length){archiveCard(moving);break;}const pos=chain[index];const displaced=state.slots[track][pos]||null;state.slots[track][pos]=moving;const movingCard=card(moving);if(movingCard){movingCard.status='slot';movingCard.slot=pos;}moving=displaced;index++;}}
function promote(id){const c=card(id);if(!c||c.status!=='slot')return;const chain=keys();const i=chain.indexOf(c.slot);if(i<0)return;if(i===chain.length-1){archiveCard(id);return;}cascadePlace(id,chain[i+1]);}
function stage(action){if(state.session){const s=state.session;if(action.type==='promote'&&s.pending.some(x=>x.type==='promote'&&x.id===action.id)){notify('Already scheduled to move after this session');return;}s.pending=s.pending.filter(x=>x.id!==action.id && !(action.type==='place'&&x.type==='place'&&x.target===action.target&&card(x.id)?.track===card(action.id)?.track));s.pending.push(action);save();notify('Saved for next session — current reviews stay unchanged');}else{applyAction(action);save();notify('Rotation updated');}render();}
function applyAction(a){if(a.type==='promote')promote(a.id);if(a.type==='place')cascadePlace(a.id,a.target);if(a.type==='archive')archiveCard(a.id);if(a.type==='queue')queueCard(a.id);}
function startSession(){if(state.session)return;
  if(state.settings.autoFill){for(const kind of TRACKS){if(!state.slots[kind].daily&&state.queues[kind].length)cascadePlace(state.queues[kind][0],'daily');}}
  const number=state.nextSession;
  const snapshot=[];
  for(const slot of reviewKeys(number)){for(const kind of TRACKS){const id=state.slots[kind][slot];const c=card(id);if(c){snapshot.push({id:uid(),cardId:id,track:kind,slot,title:cardTitle(c),detail:cardDetail(c),text:cardText(c)});}else{snapshot.push({id:uid(),cardId:null,track:kind,slot});}}}
  state.session={number,startedAt:new Date().toISOString(),snapshot,checked:{},pending:[]};save();render();notify('Session '+number+' started');}
function finishSession(){const s=state.session;if(!s)return;const total=s.snapshot.filter(x=>x.cardId).length;const checked=s.snapshot.filter(x=>x.cardId&&s.checked[x.id]).length;
  if(total>checked&&!confirm(`${total-checked} review(s) are unchecked. Finish this session anyway?`))return;
  const chain=keys();
  const pending=[...s.pending].sort((a,b)=>{if(a.type==='promote'&&b.type!=='promote')return -1;if(b.type==='promote'&&a.type!=='promote')return 1;if(a.type==='promote'&&b.type==='promote')return chain.indexOf(card(b.id)?.slot)-chain.indexOf(card(a.id)?.slot);return 0;});
  for(const action of pending){try{applyAction(action);}catch(error){console.error(error);}}
  state.history.unshift({number:s.number,when:new Date().toISOString(),total,checked,changes:pending.length});
  state.history=state.history.slice(0,150);
  state.nextSession=s.number+1;state.session=null;
  save();render();notify('Session '+s.number+' complete — next rotation is ready');}
function moveQueue(id,direction){const c=card(id);if(!c||c.status!=='library')return;const q=state.queues[c.track];const from=q.indexOf(id),to=from+direction;if(from<0||to<0||to>=q.length)return;[q[from],q[to]]=[q[to],q[from]];save();render();}
function splitParts(text,mode){const cleaned=String(text||'').replace(/\r\n/g,'\n').trim();if(!cleaned)return [];if(mode==='lines')return cleaned.split('\n').map(s=>s.trim()).filter(Boolean);if(mode==='whole')return [cleaned];return cleaned.split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);}
function addWork({track,title,reference,text,mode='paragraphs',addToQueue=true,notes=''}){
  const parts=splitParts(text,mode);if(!parts.length)throw new Error('Please enter the scripture or poem text.');
  const w={id:uid(),track:track==='poetry'?'poetry':'scripture',title:title.trim()||reference.trim()||'Untitled',reference:reference.trim(),notes:notes.trim(),parts:parts.map(text=>({id:uid(),text})),createdAt:new Date().toISOString()};state.works.push(w);
  if(addToQueue){const c={id:uid(),workId:w.id,track:w.track,partIds:w.parts.map(p=>p.id),label:'',status:'unassigned',slot:null,createdAt:new Date().toISOString()};state.cards.push(c);queueCard(c.id);}
  save();return w;
}
function createGroup(workId,partIds,label){const w=work(workId);if(!w)return;const sorted=w.parts.filter(x=>partIds.includes(x.id)).map(x=>x.id);if(!sorted.length){notify('Select at least one section');return;}const c={id:uid(),workId:w.id,track:w.track,partIds:sorted,label:label.trim(),status:'unassigned',slot:null,createdAt:new Date().toISOString()};state.cards.push(c);queueCard(c.id);save();return c;}
function updateSettings(weekly,monthly,autoFill){weekly=Number(weekly);monthly=Number(monthly);if(![4,5,7].includes(weekly)||![16,20,31].includes(monthly))return;
  const old={...state.settings};
  if(weekly<old.weekly){for(const track of TRACKS)for(let n=weekly+1;n<=old.weekly;n++){const id=state.slots[track]['w'+n];if(id)queueCard(id,true);}}
  if(monthly<old.monthly){for(const track of TRACKS)for(let n=monthly+1;n<=old.monthly;n++){const id=state.slots[track]['m'+n];if(id)queueCard(id,true);}}
  state.settings={weekly,monthly,autoFill:!!autoFill};save();render();notify('Settings saved; current session remains unchanged');}
function nav(page){ui.page=page;ui.modal=null;ui.librarySearch='';render();window.scrollTo({top:0,behavior:'smooth'});}
function button(label,action,extra='',klass='btn secondary small'){return `<button type="button" class="${klass}" data-action="${action}" ${extra}>${label}</button>`;}
function navItem(page,icon,label){return `<button type="button" class="nav-btn ${ui.page===page?'active':''}" data-action="nav" data-page="${page}">${icon} ${label}</button>`;}
function render(){const app=$('#app');const primary=`<header class="app-header"><div class="topbar"><a href="#" class="brand" data-action="home"><span class="brand-icon">❧</span><span class="brand-words"><strong>The Recitation Companion</strong><small>Scripture &amp; Poetry</small></span></a><nav class="navigation" aria-label="Main navigation">${navItem('today','⌂','Today')}${navItem('library','▤','Library')}${navItem('rotation','↻','Rotation')}${navItem('settings','⚙','Settings')}</nav></div></header>`;
  const mobile=`<nav class="mobile-nav" aria-label="Mobile navigation">${[['today','⌂','Today'],['library','▤','Library'],['rotation','↻','Rotation'],['settings','⚙','Settings']].map(([p,i,t])=>`<button data-action="nav" data-page="${p}" class="${ui.page===p?'active':''}"><span>${i}</span>${t}</button>`).join('')}</nav>`;
  let content=ui.page==='today'?todayPage():ui.page==='library'?libraryPage():ui.page==='rotation'?rotationPage():settingsPage();
  app.innerHTML=`<div class="shell">${primary}<main class="main">${content}<div class="footer-note">Made for gentle, consistent family memory work · Saved on this device</div></main>${mobile}${ui.modal?renderModal():''}</div>`;
  if(ui.modal?.type==='practice')$('#practice-text')?.focus();
}
function hero(kicker,title,desc){return `<div class="hero"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div><div class="hero-art" aria-hidden="true">❧</div></div>`;}
function empty(title,text,buttonHtml='',symbol='✧'){return `<div class="empty"><div class="drawing">${symbol}</div><h3>${title}</h3><p>${text}</p>${buttonHtml}</div>`;}
function todayPage(){const s=state.session;const n=s?.number||state.nextSession;const next=s?[...new Set(s.snapshot.map(x=>x.slot))]:reviewKeys(n);const hasContent=state.cards.length>0;
 const top=hero('Family Memory Time',s?'Session '+n:'Ready for Session '+n,'One school session at a time. Missed days never skip a review.');
 let intro='';if(!hasContent)intro=`<div class="dash-intro"><h3>Let’s plant your first memory.</h3><p>Add a scripture and a poem to your waiting lists, then choose what you want to practice first.</p><div class="actions">${button('+ Add scripture','add','data-track="scripture"','btn')}${button('+ Add poem','add','data-track="poetry"','btn outline')}</div></div>`;
 const sessionBar=`<div class="stat-band"><div><div class="caps" style="color:#bad0bb">${s?'In progress':'Next school session'}</div><h2>Session ${n} <span style="opacity:.55">·</span> ${s?'Review time':'Ready when you are'}</h2><p>Daily · ${labelSlot(next[1])} · ${labelSlot(next[2])} · ${labelSlot(next[3])}</p></div>${s?button('✓ Finish session','finish','', 'btn'):button('▶ Start session','start','', 'btn')}</div>`;
 const banner=s?`<div class="inset-note" style="margin-bottom:18px">This session is frozen. Mark reviews complete and schedule promotions; any shifts happen <strong>only after you finish</strong>. ${s.pending.length?`<strong>${s.pending.length} change(s) pending.</strong> ${button('Review changes','pending','','btn outline small')}`:''}</div>`:'';
 const tracks=TRACKS.map(t=>todayTrack(t,n,s)).join('');
 const last=state.history[0];
 const lastInfo=!s&&last?`<div class="card pad" style="margin-top:18px"><div class="flex between"><div><div class="caps muted">Last completed</div><strong>Session ${last.number}</strong><span class="muted small-text"> · ${last.checked} of ${last.total} reviewed</span></div>${button('View history','history')}</div></div>`:'';
 return top+intro+sessionBar+banner+`<div class="panel-grid">${tracks}</div>`+lastInfo;
}
function todayTrack(track,n,s){const slots=reviewKeys(n);const queue=state.queues[track]||[];const items=s?s.snapshot.filter(x=>x.track===track):slots.map(slot=>{const c=card(state.slots[track][slot]);return {slot,cardId:c?.id,title:c?cardTitle(c):'',detail:c?cardDetail(c):'',text:c?cardText(c):''};});
 const rows=items.map(x=>{const checked=!!s?.checked[x.id];const pending=!!s?.pending.find(p=>p.type==='promote'&&p.id===x.cardId);return `<div class="review-card ${checked?'done':''}">${x.cardId&&s?`<input type="checkbox" class="check-input" aria-label="Mark ${esc(x.title)} reviewed" data-check="${x.id}" ${checked?'checked':''} />`:`<div style="width:19px;color:#bed1bd">${x.cardId?'◦':'·'}</div>`}<div class="review-content"><div class="slot-tag">${labelSlot(x.slot)}</div>${x.cardId?`<div class="review-title">${esc(x.title)}</div>${x.detail?`<div class="review-ref">${esc(x.detail)}</div>`:''}<div class="review-actions">${button('Read / practice','practice',`data-card="${x.cardId}" ${s?`data-snapshot="${x.id}"`:''}`)}${button(pending?'✓ Moves next time':'Advance →','promote',`data-card="${x.cardId}" ${pending?'disabled':''}`,'btn outline small')}</div>`:`<div class="empty-slot">Nothing assigned yet.</div>${x.slot==='daily'?`<div class="review-actions">${button(queue.length?'Choose from waiting list':'Add first passage','choose-daily',`data-track="${track}"`)}</div>`:''}`}</div></div>`;}).join('');
 const filled=items.filter(x=>x.cardId).length;
 return `<section class="card"><div class="track-header"><div><h2 class="track-name">${EMOJI[track]} ${TRACK_LABELS[track]}</h2><div class="track-sub">${filled} of 4 review positions filled</div></div><span class="track-symbol" aria-hidden="true">${track==='scripture'?'☼':'❁'}</span></div>${rows}<div class="card-foot flex between"><span class="muted small-text">Next waiting: ${queue.length?esc(cardTitle(card(queue[0]))):'None yet'}</span>${button('Manage list','nav',`data-page="library"`,'btn ghost small')}</div></section>`;}
function libraryPage(){const t=ui.track;const q=state.queues[t]||[];const filtered=q.filter(id=>card(id)&&[cardTitle(card(id)),cardDetail(card(id))].join(' ').toLowerCase().includes(ui.librarySearch.toLowerCase()));const works=state.works.filter(w=>w.track===t&&[w.title,w.reference].join(' ').toLowerCase().includes(ui.librarySearch.toLowerCase()));
return hero('Your Collection','Want to Memorize','Save passages now, put them in your preferred order, and choose a new Daily piece whenever you are ready.')+trackTabs()+`<div class="queue-panel"><section><div class="list-head"><h2 class="section-title" style="margin:0">Waiting list <span class="badge">${q.length}</span></h2>${button('+ Add '+(t==='scripture'?'scripture':'poem'),'add',`data-track="${t}"`,'btn small')}</div><div class="field" style="margin-bottom:13px"><label class="screen-reader" for="library-search">Search</label><input id="library-search" class="search" value="${attr(ui.librarySearch)}" placeholder="Find a title or reference…" /></div>${filtered.length?filtered.map((id)=>{const c=card(id);const index=q.indexOf(id);return `<div class="item-row" draggable="true" data-drag="${id}"><div class="number">${index+1}</div><div class="item-copy"><strong>${esc(cardTitle(c))}</strong><p>${esc(cardDetail(c))}${index===0?' · Next in line':''}</p></div><div class="controls">${button('↑','move-queue',`data-card="${id}" data-dir="-1" ${index===0?'disabled':''}`,'btn ghost icon small')}${button('↓','move-queue',`data-card="${id}" data-dir="1" ${index===q.length-1?'disabled':''}`,'btn ghost icon small')}${button('⋯','card-menu',`data-card="${id}"`,'btn ghost icon small')}</div></div>`;}).join(''):empty('Nothing waiting','Add passages here to start your collection.',button('+ Add passage','add',`data-track="${t}"`,'btn small'))}<p class="small-hint">Drag rows to reorder on a computer, or use the ↑ ↓ buttons on any device. The top item is suggested first, never forced.</p></section><section><div class="list-head"><h2 class="section-title" style="margin:0">Saved works <span class="badge gold">${works.length}</span></h2>${button('Import file','import-file','','btn outline small')}</div>${works.length?`<div class="work-list">${works.map(w=>`<div class="item-row"><span style="font-size:21px;color:#90a38b">${EMOJI[t]}</span><div class="item-copy"><strong>${esc(w.title)}</strong><p>${esc(w.reference||'Original text')} · ${w.parts.length} section${w.parts.length===1?'':'s'}</p></div>${button('Open','manage-work',`data-work="${w.id}"`,'btn outline small')}</div>`).join('')}</div>`:empty('Your collection is empty','Scriptures and poems you add will be saved here.',button('Add a passage','add',`data-track="${t}"`,'btn small'))}<div class="inset-note" style="margin-top:16px"><strong>Long poems or scripture passages?</strong><br/>Open any saved work to create separate review groups from selected sections. Combine them later without copying the text again.</div><div class="actions" style="margin-top:15px">${button('Upload TXT / CSV','import-file','','btn outline small')}${button('Review completed','archive-list',`data-track="${t}"`,'btn ghost small')}</div></section></div>`;}
function trackTabs(){return `<div class="tabbar" role="tablist">${TRACKS.map(t=>`<button type="button" role="tab" aria-selected="${ui.track===t}" class="${ui.track===t?'active':''}" data-action="track" data-track="${t}">${EMOJI[t]} ${TRACK_LABELS[t]}</button>`).join('')}</div>`;}
function rotationPage(){const t=ui.track;const n=state.session?.number||state.nextSession;const reviewing=state.session?[...new Set(state.session.snapshot.map(x=>x.slot))]:reviewKeys(n);const slots=keys();const pending=state.session?.pending.length||0;
return hero('The Rotation','Every memory has a place','Move a passage when you decide it is ready. Occupied slots shift forward automatically, beginning with the next session.')+trackTabs()+`<div class="card pad" style="margin-bottom:17px"><div class="flex between" style="flex-wrap:wrap"><div><strong>${TRACK_LABELS[t]} rotation</strong><p class="muted small-text" style="margin:3px 0 0">Daily → Odd → Even → Weekly 1–${state.settings.weekly} → Monthly 1–${state.settings.monthly} → Completed</p></div>${pending?`<span class="badge gold">${pending} changes pending</span>`:''}</div><p class="small-hint">Highlighted slots are scheduled for Session ${n}. Assignments and promotions during an active session appear in the following session, not this one.</p></div><div class="slot-grid">${slots.map(key=>{const c=card(state.slots[t][key]);const pendingFor=c?state.session?.pending.some(p=>p.id===c.id):false;return `<div class="slot-box ${reviewing.includes(key)?'tonight':''}"><div class="flex between"><strong>${labelSlot(key)}</strong>${reviewing.includes(key)?'<span class="badge">This session</span>':''}</div><p>${c?esc(cardTitle(c)):'<span class="muted">Empty</span>'}</p><div class="actions">${c?`${button('Read','practice',`data-card="${c.id}"`)}${button(pendingFor?'Queued ✓':'Advance →','promote',`data-card="${c.id}" ${pendingFor?'disabled':''}`,'btn outline small')}`:`${button('+ Choose passage','choose-slot',`data-track="${t}" data-slot="${key}"`,'btn outline small')}`}</div></div>`;}).join('')}</div>`;}
function settingsPage(){const s=state.settings;return hero('Make It Yours','Settings & backup','The rotation follows completed school sessions, not weekdays on the calendar.')+`<div class="settings-grid"><div class="card pad"><h2 class="section-title">Review schedule</h2><form id="settings-form" class="stack"><div class="field"><label for="weekly">Weekly rotation slots</label><select name="weekly" id="weekly"><option value="4" ${s.weekly===4?'selected':''}>4 school sessions (your default)</option><option value="5" ${s.weekly===5?'selected':''}>5 school sessions</option><option value="7" ${s.weekly===7?'selected':''}>7 sessions (daily)</option></select></div><div class="field"><label for="monthly">Monthly rotation slots</label><select name="monthly" id="monthly"><option value="16" ${s.monthly===16?'selected':''}>16 sessions (your default)</option><option value="20" ${s.monthly===20?'selected':''}>20 sessions</option><option value="31" ${s.monthly===31?'selected':''}>31 sessions</option></select></div><label class="switchline"><input type="checkbox" name="autofill" ${s.autoFill?'checked':''}/><span><strong>Automatically fill an empty Daily slot</strong><br/><span class="muted small-text">On session start, use the first waiting-list item. Turn off to choose each new piece yourself (recommended).</span></span></label><button type="submit" class="btn">Save settings</button></form><p class="small-hint">Shortening a rotation safely returns passages in removed slots to the waiting list. An in-progress session never changes.</p></div><div class="card pad"><h2 class="section-title">Your data</h2><p class="muted" style="margin-top:-8px">Everything is saved in this browser on this device. There is no account or cloud sync in this version.</p><div class="stack">${button('↓ Export complete backup (.json)','export','','btn outline')}${button('↑ Restore a backup','import-backup','','btn outline')}${button('View session history','history','','btn secondary')}<div class="warning"><strong>Important:</strong> Export a backup periodically, especially before clearing browser data or changing devices. A different browser or device will not automatically have your work.</div></div></div></div><div class="card pad" style="margin-top:18px"><h2 class="section-title">How advancing works</h2><div class="preview-rows"><div class="preview-cell"><strong>1 · Daily</strong><div>Learn a new passage at each session.</div></div><div class="preview-cell"><strong>2 · Odd & Even</strong><div>Review alternate sessions.</div></div><div class="preview-cell"><strong>3 · Weekly</strong><div>One of ${s.weekly} slots each session.</div></div><div class="preview-cell"><strong>4 · Monthly</strong><div>One of ${s.monthly} slots each session.</div></div></div><p class="small-hint">Promotion is always your choice. Moving into an occupied slot shifts that passage to the next slot, and so on. The final Monthly item moves into Completed.</p></div>`;}
function renderModal(){const m=ui.modal;if(!m)return '';let title='',body='',footer='',wide=false;
if(m.type==='add'){
  const t=m.track||ui.track;title=t==='scripture'?'Add a scripture':'Add a poem';wide=true;
  body=`<form id="add-form" class="stack"><input type="hidden" name="track" value="${t}"/><div class="form-grid"><div class="field"><label>Title *</label><input name="title" required placeholder="${t==='scripture'?'The small and simple things':'The Village Blacksmith'}" value="${attr(m.title||'')}" /></div><div class="field"><label>${t==='scripture'?'Scripture reference':'Author (optional)'}</label><input name="reference" placeholder="${t==='scripture'?'Alma 37:6–7':'Henry W. Longfellow'}" value="${attr(m.reference||'')}" /></div></div><div class="field"><label>Full passage text *</label><textarea name="text" required rows="10" placeholder="Paste the passage or poem here…">${esc(m.text||'')}</textarea><span class="small-hint">Copy from Gospel Library or another permitted source. Automatic scripture lookup is not included yet.</span></div><div class="form-grid"><div class="field"><label>Split the text into sections</label><select name="mode"><option value="paragraphs">By blank lines / stanzas</option><option value="lines">Every line / verse</option><option value="whole">Keep as one section</option></select></div><div class="field"><label>Notes (optional)</label><input name="notes" placeholder="Theme, occasion, or reminder"/></div></div><label class="switchline"><input type="checkbox" name="queue" checked/><span>Add the complete passage to my waiting list</span></label><div class="actions">${button('Upload TXT / CSV instead','import-file','','btn outline small')}</div></form>`;
  footer=`${button('Cancel','close','','btn outline') }<button class="btn" type="submit" form="add-form">Save to library</button>`;
}
else if(m.type==='manage-work'){
  const w=work(m.id);if(!w){ui.modal=null;return '';}title=w.title;wide=true;
  const groups=state.cards.filter(c=>c.workId===w.id);
  body=`<div class="flex between" style="margin-bottom:15px;flex-wrap:wrap"><div class="muted small-text">${esc(w.reference||'Saved passage')} · ${w.parts.length} section${w.parts.length===1?'':'s'}</div>${button('✎ Edit full text','edit-work',`data-work="${w.id}"`,'btn outline small')}</div><div class="inset-note">Select one or more sections below to create a new review card. You can make several groups from the same original work, including overlapping groups.</div><div style="margin-top:17px">${w.parts.map((p,i)=>`<label class="part-row"><input type="checkbox" data-part="${p.id}" ${ui.selection.has(p.id)?'checked':''} /><span class="part-content"><strong style="font:600 12px system-ui;color:#627d63">Section ${i+1}</strong><br/>${esc(p.text)}</span></label>`).join('')}</div><div class="field" style="margin-top:16px"><label>New review card title (optional)</label><input id="group-label" placeholder="e.g., Stanzas 1–3" /></div><div class="actions" style="margin-top:11px">${button('+ Save selected sections to waiting list','make-group',`data-work="${w.id}"`,'btn')}</div><div class="divider"></div><h3 class="section-title">Review cards from this work <span class="badge">${groups.length}</span></h3>${groups.length?groups.map(c=>`<div class="item-row"><div class="item-copy"><strong>${esc(cardTitle(c))}</strong><p>${esc(cardDetail(c))} · ${cardStatus(c)}</p></div>${button('Edit group','edit-card',`data-card="${c.id}"`,'btn outline small')}</div>`).join(''):`<p class="muted small-text">No review cards yet. Select sections above to create one.</p>`}`;
  footer=`${button('Close','close','','btn outline')}`;
}
else if(m.type==='edit-work'){
  const w=work(m.id);if(!w){ui.modal=null;return '';}title='Edit passage';wide=true;
  body=`<form id="edit-work-form" class="stack"><input name="id" value="${w.id}" type="hidden"/><div class="form-grid"><div class="field"><label>Title</label><input name="title" required value="${attr(w.title)}"/></div><div class="field"><label>Reference / author</label><input name="reference" value="${attr(w.reference||'')}"/></div></div><div class="field"><label>Full text — separate sections with blank lines</label><textarea name="text" rows="14" required>${esc(w.parts.map(p=>p.text).join('\n\n'))}</textarea></div><div class="field"><label>Notes</label><input name="notes" value="${attr(w.notes||'')}"/></div><div class="warning">Editing section boundaries may affect saved review groups. If the number of sections stays the same, their groups remain linked automatically.</div></form>`;
  footer=`${button('Cancel','manage-work',`data-work="${w.id}"`,'btn outline')}<button type="submit" form="edit-work-form" class="btn">Save changes</button>`;
}
else if(m.type==='edit-card'){
 const c=card(m.id);const w=c&&work(c.workId);if(!c||!w){ui.modal=null;return '';}title='Edit review group';wide=true;
 body=`<form id="edit-card-form" class="stack"><input type="hidden" name="id" value="${c.id}"/><div class="field"><label>Review card title (leave blank to use passage title)</label><input name="label" value="${attr(c.label)}" placeholder="${attr(w.title)}" /></div><div><strong class="small-text">Included sections</strong><p class="small-hint">Choose the paragraphs or stanzas that should be reviewed together.</p>${w.parts.map((p,i)=>`<label class="part-row"><input type="checkbox" name="section" value="${p.id}" ${c.partIds.includes(p.id)?'checked':''}/><span class="part-content"><strong style="font:600 12px system-ui;color:#627d63">Section ${i+1}</strong><br/>${esc(p.text)}</span></label>`).join('')}</div></form>`;
 footer=`${button('Back','manage-work',`data-work="${w.id}"`,'btn outline')}<button type="submit" form="edit-card-form" class="btn">Save group</button>`;
}
else if(m.type==='card-menu'){
  const c=card(m.id);if(!c){ui.modal=null;return '';}title=cardTitle(c);const w=work(c.workId);
  body=`<div class="muted small-text">${esc(cardDetail(c))} · ${esc(cardStatus(c))}</div><p class="text-preview" style="max-height:190px;overflow:auto;margin:18px 0">${esc(cardText(c))}</p><div class="stack"><div class="actions">${button('▶ Practice','practice',`data-card="${c.id}"`,'btn')}${button('Choose for Daily','place',`data-card="${c.id}" data-target="daily"`,'btn outline')}</div><div class="actions">${button('Assign another slot…','choose-destination',`data-card="${c.id}"`,'btn outline small')}${button('Edit sections','edit-card',`data-card="${c.id}"`,'btn secondary small')}${button('Edit original text','edit-work',`data-work="${w.id}"`,'btn secondary small')}</div><div class="actions">${c.status!=='library'?button('Return to waiting list','queue',`data-card="${c.id}"`,'btn ghost small'):''}${button('Move to completed','archive',`data-card="${c.id}"`,'btn ghost small')}${button('Delete this review card','delete-card',`data-card="${c.id}"`,'btn ghost small')}</div></div>`;
  footer=button('Close','close','','btn outline');
}
else if(m.type==='choose-daily'||m.type==='choose-slot'){
  const t=m.track||ui.track;const target=m.type==='choose-daily'?'daily':m.slot;title=`Choose for ${labelSlot(target)}`;
  const q=state.queues[t].map(id=>card(id)).filter(Boolean);
  body=`<p class="muted small-text" style="margin-top:0">Choose any waiting ${t==='scripture'?'scripture':'poem'}. Your first item is suggested, but the choice is yours.</p>${q.length?q.map((c,i)=>`<div class="item-row"><div class="number">${i+1}</div><div class="item-copy"><strong>${esc(cardTitle(c))}</strong><p>${esc(cardDetail(c))}</p></div>${button('Select','place',`data-card="${c.id}" data-target="${target}"`,'btn small')}</div>`).join(''):empty('Nothing waiting','Add your first passage now.',button('+ Add passage','add',`data-track="${t}"`,'btn small'))}`;
  footer=`${button('Add new passage','add',`data-track="${t}"`,'btn outline')}${button('Cancel','close','','btn ghost')}`;
}
else if(m.type==='choose-destination'){
  const c=card(m.id);if(!c){ui.modal=null;return '';}title='Move to a review slot';
  body=`<p class="muted small-text">${esc(cardTitle(c))}</p><form class="stack" id="destination-form"><input name="id" type="hidden" value="${c.id}"/><div class="field"><label>Destination</label><select name="target">${keys().map(k=>`<option value="${k}">${labelSlot(k)}</option>`).join('')}</select></div><div class="inset-note">If this slot is occupied, its passage shifts forward, along with any others it displaces.</div></form>`;
  footer=`${button('Cancel','close','','btn outline')}<button type="submit" form="destination-form" class="btn">Move passage</button>`;
}
else if(m.type==='practice'){
  const c=card(m.id);const item=m.snapshotId?state.session?.snapshot.find(s=>s.id===m.snapshotId):null;
  const titleVal=item?.title|| (c&&cardTitle(c)) || 'Practice';
  const passage=item?.text ?? (c&&cardText(c)) ?? '';
  title=titleVal;wide=true;
  const mode=ui.practiceMode;const letters=passage.replace(/[\p{L}\p{N}]+/gu, word=>word.charAt(0)+'·'.repeat(Math.min(3,word.length-1)));
  body=`<div class="pill-row">${[['full','Full text'],['first','First letters'],['hidden','Hide text']].map(([id,l])=>`<button type="button" class="btn ${mode===id?'':'outline'} small" data-action="practice-mode" data-mode="${id}">${l}</button>`).join('')}</div><p class="practice-text ${mode==='first'?'first-letters':mode==='hidden'?'hidden-words':''}" id="practice-text" tabindex="-1">${esc(mode==='first'?letters:passage)}</p><div class="help">The first-letter and hidden-text modes let your family practice recall without editing the original passage. Use Full text to reveal it again.</div>`;
  footer=`${button('Close practice','close','','btn outline')}`;
}
else if(m.type==='pending'){
  title='Changes for next session';const p=state.session?.pending||[];
  body=p.length?p.map((a,i)=>`<div class="item-row"><div class="item-copy"><strong>${a.type==='promote'?'Advance':a.type==='place'?'Assign to '+labelSlot(a.target):'Change'} · ${esc(card(a.id)?cardTitle(card(a.id)):'Passage')}</strong><p>Applies after you finish Session ${state.session.number}</p></div>${button('Undo','undo-pending',`data-index="${i}"`,'btn outline small')}</div>`).join(''):`<p class="muted">No changes are waiting.</p>`;
  footer=button('Close','close','','btn outline');
}
else if(m.type==='archive-list'){
 title=TRACK_LABELS[m.track]+' · Completed';const list=state.archived[m.track].map(id=>card(id)).filter(Boolean);
 body=list.length?list.map(c=>`<div class="item-row"><div class="item-copy"><strong>${esc(cardTitle(c))}</strong><p>${esc(cardDetail(c))}</p></div>${button('Practice','practice',`data-card="${c.id}"`,'btn secondary small')}${button('Review again','queue',`data-card="${c.id}"`,'btn outline small')}</div>`).join(''):empty('No completed passages yet','Items that leave the last monthly slot will appear here.');
 footer=button('Close','close','','btn outline');
}
else if(m.type==='history'){
 title='Session history';body=state.history.length?state.history.slice(0,30).map(h=>`<div class="item-row"><div class="number">${h.number}</div><div class="item-copy"><strong>Session ${h.number}</strong><p>${new Date(h.when).toLocaleDateString()} · ${h.checked}/${h.total} reviews · ${h.changes} changes applied</p></div></div>`).join(''):`<p class="muted">Your finished school sessions will appear here.</p>`;
 footer=button('Close','close','','btn outline');
}
else{return '';}
return `<div class="modal-bg" data-dismiss="true"><section class="modal ${wide?'wide-modal':''}" role="dialog" aria-modal="true" aria-label="${attr(title)}"><div class="modal-head"><h2>${esc(title)}</h2>${button('✕','close','','btn ghost icon small')}</div><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></section></div>`;}
function openModal(type,options={}){ui.modal={type,...options};ui.selection=new Set();ui.practiceMode='full';render();}
function removeCard(id){const c=card(id);if(!c)return;if(!confirm('Delete this review card? The saved original work will remain available.'))return;clearPlacement(id);state.cards=state.cards.filter(x=>x.id!==id);if(state.session)state.session.pending=state.session.pending.filter(x=>x.id!==id);save();ui.modal=null;render();notify('Review card deleted; original text kept');}
function editWorkFrom(form){const data=new FormData(form);const w=work(data.get('id'));if(!w)return;const title=String(data.get('title')||'').trim();const text=String(data.get('text')||'');const sections=splitParts(text,'paragraphs');if(!title||!sections.length){notify('Please enter a title and some text');return;}
 const oldIds=w.parts.map(x=>x.id);const updated=sections.map((x,i)=>({id:oldIds[i]||uid(),text:x}));
 if(oldIds.length!==updated.length&&!confirm('You changed the number of sections. Saved review groups will retain matching sections by position; please check those groups afterward. Continue?'))return;
 const valid=new Set(updated.map(x=>x.id));for(const c of state.cards.filter(x=>x.workId===w.id)){c.partIds=c.partIds.filter(id=>valid.has(id));if(!c.partIds.length)c.partIds=[updated[0].id];}
 Object.assign(w,{title,reference:String(data.get('reference')||'').trim(),notes:String(data.get('notes')||'').trim(),parts:updated});save();ui.modal=null;render();notify('Original passage updated');}
function importCSV(text){const records=parseCSV(text.replace(/^\uFEFF/,''));if(!records.length)throw new Error('CSV is empty');const header=records[0].map(x=>x.trim().toLowerCase());const col=(...opts)=>header.findIndex(h=>opts.includes(h));const idxText=col('text','passage','poem','content');const idxTitle=col('title','name');const idxTrack=col('track','type','category');const idxRef=col('reference','author','source');if(idxText<0)throw new Error('CSV must include a Text column');let count=0;for(const row of records.slice(1)){const body=row[idxText]||'';if(!body.trim())continue;const track=((row[idxTrack]||'scripture').toLowerCase().includes('poe')?'poetry':'scripture');addWork({track,title:row[idxTitle]||`Imported passage ${count+1}`,reference:row[idxRef]||'',text:body,mode:'paragraphs',addToQueue:true});count++;}return count;}
function parseCSV(source){const output=[];let row=[],cell='',quoted=false;for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))output.push(row);row=[];cell='';}else cell+=ch;}row.push(cell);if(row.some(x=>x.trim()))output.push(row);return output;}
function download(name,contents,mime){const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function importBackup(text){let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('That file is not valid JSON');}
 if(parsed.version!==1||!Array.isArray(parsed.works)||!Array.isArray(parsed.cards)||!parsed.slots||!parsed.queues||!parsed.settings||!parsed.archived||!Number.isInteger(parsed.nextSession))throw new Error('This is not a supported The Recitation Companion backup');
 if(!confirm('Restoring a backup will replace all current work on this device. Continue?'))return;
 state=parsed;ui.modal=null;save();render();notify('Backup restored');}
document.addEventListener('click', e=>{
 if(e.target.classList?.contains('modal-bg')){ui.modal=null;render();return;}
 const b=e.target.closest('[data-action]');if(!b)return;
 e.preventDefault();const a=b.dataset.action,id=b.dataset.card,track=b.dataset.track,workId=b.dataset.work;
 if(a==='home')return nav('today');
 if(a==='nav')return nav(b.dataset.page);
 if(a==='track'){ui.track=track;ui.librarySearch='';return render();}
 if(a==='close'){ui.modal=null;return render();}
 if(a==='add')return openModal('add',{track:track||ui.track});
 if(a==='start')return startSession();
 if(a==='finish')return finishSession();
 if(a==='move-queue')return moveQueue(id,Number(b.dataset.dir));
 if(a==='promote'){const c=card(id);if(!c||c.status!=='slot')return notify('This passage is no longer assigned.');if(!state.session&&!confirm(`Advance "${cardTitle(c)}" now? Other occupied slots will shift forward.`))return;stage({type:'promote',id});return;}
 if(a==='choose-daily')return openModal('choose-daily',{track});
 if(a==='choose-slot')return openModal('choose-slot',{track,slot:b.dataset.slot});
 if(a==='place'){
  const c=card(id);if(!c)return;const target=b.dataset.target;
  if(!state.session&&state.slots[c.track][target]&&state.slots[c.track][target]!==id&&!confirm(`This slot already has a passage. Assigning this one will shift the existing passage and following passages forward. Continue?`))return;
  ui.modal=null;stage({type:'place',id,target});return;
 }
 if(a==='queue'){ui.modal=null;stage({type:'queue',id});return;}
 if(a==='archive'){if(!confirm('Move this review card to Completed?'))return;ui.modal=null;stage({type:'archive',id});return;}
 if(a==='delete-card')return removeCard(id);
 if(a==='card-menu')return openModal('card-menu',{id});
 if(a==='manage-work')return openModal('manage-work',{id:workId});
 if(a==='edit-work')return openModal('edit-work',{id:workId});
 if(a==='edit-card')return openModal('edit-card',{id});
 if(a==='make-group'){
   const partIds=[...ui.selection];const label=$('#group-label')?.value||'';
   const c=createGroup(workId,partIds,label);
   if(c){openModal('manage-work',{id:workId});notify('Review group saved to waiting list');}
   return;
 }
 if(a==='choose-destination')return openModal('choose-destination',{id});
 if(a==='practice')return openModal('practice',{id,snapshotId:b.dataset.snapshot});
 if(a==='practice-mode'){ui.practiceMode=b.dataset.mode;return render();}
 if(a==='pending')return openModal('pending');
 if(a==='undo-pending'){state.session?.pending.splice(Number(b.dataset.index),1);save();return openModal('pending');}
 if(a==='history')return openModal('history');
 if(a==='archive-list')return openModal('archive-list',{track});
 if(a==='import-file')return $('#file-import')?.click();
 if(a==='import-backup')return $('#backup-import')?.click();
 if(a==='export'){
  const today=new Date().toISOString().slice(0,10);
  download(`recitation-companion-backup-${today}.json`,JSON.stringify(state,null,2),'application/json');notify('Backup saved');return;
 }
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.matches('[data-check]')&&state.session){state.session.checked[el.dataset.check]=el.checked;save();render();return;}
 if(el.matches('[data-part]')){if(el.checked)ui.selection.add(el.dataset.part);else ui.selection.delete(el.dataset.part);return;}
 if(el.id==='file-import'){
   const file=el.files?.[0];if(!file)return;
   file.text().then(text=>{
     if(file.name.toLowerCase().endsWith('.csv')){
       const count=importCSV(text);ui.modal=null;render();notify(`${count} passage${count===1?'':'s'} imported`);
     }else{openModal('add',{track:ui.track,title:file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' '),text});notify('File loaded — confirm the details and save');}
   }).catch(err=>{alert('Import failed: '+err.message);});el.value='';return;
 }
 if(el.id==='backup-import'){
   const file=el.files?.[0];if(!file)return;
   file.text().then(importBackup).catch(err=>alert('Restore failed: '+err.message));el.value='';return;
 }
});
document.addEventListener('input',e=>{
 if(e.target.id==='library-search'){
  const old=e.target.selectionStart;ui.librarySearch=e.target.value;
  // Update queue and work search in place; keep focus and typing position.
  render();const search=$('#library-search');if(search){search.focus();search.setSelectionRange(old,old);}
 }
});
document.addEventListener('submit',e=>{
 const form=e.target;
 if(!['add-form','edit-work-form','edit-card-form','destination-form','settings-form'].includes(form.id))return;
 e.preventDefault();const data=new FormData(form);
 if(form.id==='add-form'){
  try{const w=addWork({track:data.get('track'),title:String(data.get('title')||''),reference:String(data.get('reference')||''),text:String(data.get('text')||''),mode:String(data.get('mode')),notes:String(data.get('notes')||''),addToQueue:data.has('queue')});ui.modal=null;ui.track=w.track;ui.page='library';render();notify('Passage added to library');}
  catch(err){alert(err.message);}return;
 }
 if(form.id==='edit-work-form')return editWorkFrom(form);
 if(form.id==='edit-card-form'){
  const c=card(data.get('id'));if(!c)return;const choices=data.getAll('section');if(!choices.length){notify('Choose at least one section');return;}
  const w=work(c.workId);c.partIds=w.parts.filter(x=>choices.includes(x.id)).map(x=>x.id);c.label=String(data.get('label')||'').trim();save();openModal('manage-work',{id:w.id});notify('Review group updated');return;
 }
 if(form.id==='destination-form'){
  const id=data.get('id'),target=data.get('target');ui.modal=null;stage({type:'place',id,target});return;
 }
 if(form.id==='settings-form'){
  const weekly=data.get('weekly'),monthly=data.get('monthly');if((Number(weekly)<state.settings.weekly||Number(monthly)<state.settings.monthly)&&!confirm('Passages in removed slots will return to your waiting list. Continue?'))return;
  updateSettings(weekly,monthly,data.has('autofill'));return;
 }
});
let dragging=null;
document.addEventListener('dragstart',e=>{const row=e.target.closest('[data-drag]');if(!row)return;dragging=row.dataset.drag;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragging);});
document.addEventListener('dragend',()=>{dragging=null;$$('.dragging').forEach(x=>x.classList.remove('dragging'));});
document.addEventListener('dragover',e=>{if(dragging&&e.target.closest('[data-drag]'))e.preventDefault();});
document.addEventListener('drop',e=>{
 const row=e.target.closest('[data-drag]');if(!row||!dragging)return;e.preventDefault();const target=row.dataset.drag;const c=card(dragging);if(c&&c.status==='library'){
  const q=state.queues[c.track];const from=q.indexOf(dragging),to=q.indexOf(target);if(from>=0&&to>=0&&from!==to){q.splice(from,1);q.splice(to,0,dragging);save();render();notify('Waiting list reordered');}}
 dragging=null;
});
// Register offline support when served over HTTPS or localhost (not when opened as a file).
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Offline setup unavailable',err)));
}
render();
})();
