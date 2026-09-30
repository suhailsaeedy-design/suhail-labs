(async () => {
  'use strict';
  const bundled = window.SUHAIL_LABS_DATA;
  const LIVE_CACHE = 'suhailLabsPublicCacheV1';
  let data = bundled;
  const readLiveCache = () => {
    try {
      const cached = JSON.parse(localStorage.getItem(LIVE_CACHE) || 'null');
      return cached?.data && typeof cached.data === 'object' ? cached : null;
    } catch { return null; }
  };
  const writeLiveCache = payload => {
    if (!payload?.data || typeof payload.data !== 'object') return;
    try {
      localStorage.setItem(LIVE_CACHE, JSON.stringify({
        data: payload.data,
        revision: Number(payload.revision || 0),
        updated_at: String(payload.updated_at || ''),
        cached_at: Date.now()
      }));
    } catch (error) {
      console.warn('Suhail Labs live cache unavailable.', error);
    }
  };
  const previewDraft = new URLSearchParams(location.search).get('preview') === 'draft';
  if (previewDraft) {
    try { data = JSON.parse(localStorage.getItem('suhailLabsDraftDataV2')) || bundled; } catch { data = bundled; }
  } else {
    const cached = readLiveCache();
    if (cached?.data) data = cached.data;
    try {
      const response = await fetch('https://qdfylefkkkyjwtqqiuye.supabase.co/functions/v1/suhail-labs-public', {
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.data) {
        data = payload.data;
        writeLiveCache(payload);
      } else if (!cached) {
        console.warn('Suhail Labs live content unavailable; using bundled fallback.');
      }
    } catch (error) {
      console.warn(cached
        ? 'Suhail Labs live content unavailable; using last successful live snapshot.'
        : 'Suhail Labs live content unavailable; using bundled fallback.', error);
    }
  }
  if (!data) return;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const publicProjects = (data.projects || []).filter(p => p.enabled !== false);

  const savedTheme = localStorage.getItem('suhailLabsTheme');
  document.documentElement.dataset.theme = savedTheme || 'light';
  const themeToggle = $('#themeToggle');
  const syncThemeLabel = () => { if (themeToggle) themeToggle.textContent = document.documentElement.dataset.theme === 'dark' ? '☼' : '◐'; const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.setAttribute('content',document.documentElement.dataset.theme==='dark'?'#07111f':'#f5f8fc'); };
  syncThemeLabel();
  themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('suhailLabsTheme', next);
    syncThemeLabel();
  });

  const navToggle = $('#navToggle');
  const mainNav = $('#mainNav');
  const setNavOpen = open => {
    mainNav?.classList.toggle('open', open);
    navToggle?.setAttribute('aria-expanded', String(open));
    navToggle?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  navToggle?.addEventListener('click', () => setNavOpen(!mainNav?.classList.contains('open')));
  $$('#mainNav a').forEach(a => a.addEventListener('click', () => setNavOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mainNav?.classList.contains('open')) {
      setNavOpen(false);
      navToggle?.focus();
    }
  });

  $$('[data-name]').forEach(el => el.textContent = data.profile.name);
  const bio = $('[data-bio]'); if (bio) bio.textContent = data.profile.bio;
  const portrait = $('#profilePortrait');
  if (portrait) {
    portrait.innerHTML = `<img src="assets/images/suhail-saeedy-about-v2.webp" alt="${esc(data.profile.name)}" loading="lazy" />`;
    portrait.classList.add('has-photo');
  }
  const heroCount = $('#projectCountHero'); if (heroCount) heroCount.textContent = String(publicProjects.length).padStart(2,'0');
  const aboutPoints = $('#aboutPoints');
  if (aboutPoints) aboutPoints.innerHTML = data.profile.aboutPoints.map(p => `<div class="about-point"><i>✓</i><span>${esc(p)}</span></div>`).join('');
  const focusTags = $('#focusTags');
  if (focusTags) focusTags.innerHTML = (data.profile.focusAreas || []).map(t => `<span class="stack-tag">${esc(t)}</span>`).join('');

  const capabilityGrid = $('#capabilityGrid');
  if (capabilityGrid) capabilityGrid.innerHTML = data.capabilities.map(c => `<article class="capability-card reveal"><div class="capability-icon">${esc(c.icon)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></article>`).join('');

  const processList = $('#processList');
  if (processList) processList.innerHTML = data.process.map(p => `<li class="process-item"><span class="step">${esc(p.step)}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div></li>`).join('');

  const grid = $('#projectGrid');
  const filters = $('#projectFilters');
  const search = $('#projectSearch');
  const empty = $('#emptyState');
  let activeCategory = 'All';
  const categories = [
    {key:'All',label:'All'},
    {key:'WEB',label:'Websites'},
    {key:'SOFTWARE',label:'Software'},
    {key:'DATABASE',label:'Databases'},
    {key:'AI',label:'AI'},
    {key:'BUSINESS',label:'Business Systems'},
    {key:'ADMIN',label:'Admin'},
    {key:'TOOLS',label:'Tools'},
    {key:'3D',label:'3D'}
  ];
  if (filters) filters.innerHTML = categories.map(c => `<button type="button" class="filter-button${c.key === 'All' ? ' active' : ''}" data-filter="${esc(c.key)}" aria-pressed="${c.key === 'All'}">${esc(c.label)}</button>`).join('');

  function renderProjects(){
    if (!grid) return;
    const q = (search?.value || '').trim().toLowerCase();
    const items = publicProjects.filter(p => {
      const cat = activeCategory === 'All' || p.category === activeCategory || (p.focusAreas || []).includes(activeCategory);
      const hay = [p.title,p.categoryLabel,p.summary,...(p.focusAreas || [])].join(' ').toLowerCase();
      return cat && (!q || hay.includes(q));
    });
    grid.innerHTML = items.map(p => `
      <article class="project-card reveal visible">
        <div class="project-cover"><strong>${esc(p.category==='3D'?'3D':p.category==='WEB'?'WEB':p.category==='TOOLS'?'TOOL':p.category==='AI'?'AI':p.category==='DATABASE'?'DB':'APP')}</strong></div>
        <div class="project-body">
          <div class="project-meta"><span>PROJECT ${esc(p.id)}${p.featured === true ? ' • FEATURED' : ''}</span><span>${esc(p.status)}</span></div>
          <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p>
          <div class="tag-row">${(p.focusAreas || [p.category]).slice(0,3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="card-actions">
            ${p.live ? `<a class="button button-primary" href="${esc(p.live)}"${/^https?:\/\//.test(p.live)?' target="_blank" rel="noopener"':''}>${esc(p.liveLabel || 'Open live demo')} ↗</a>` : ''}
            ${p.download ? `<a class="button button-secondary" href="${esc(p.download)}"${/^https?:\/\//.test(p.download)?' target="_blank" rel="noopener"':''}>Download ↓</a>` : ''}
            <a class="button button-secondary" href="${esc(p.detailsUrl)}">Details</a>
          </div>
        </div>
      </article>`).join('');
    if (empty) empty.hidden = items.length > 0;
  }
  renderProjects();
  filters?.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]'); if (!btn) return;
    activeCategory = btn.dataset.filter;
    $$('.filter-button', filters).forEach(b => {
      const selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    renderProjects();
  });
  search?.addEventListener('input', renderProjects);

  const profilesGrid = $('#profilesGrid');
  if (profilesGrid) {
    const activeProfiles = data.profile.profiles.filter(p => /^https?:\/\//.test(p.url || ''));
    profilesGrid.innerHTML = activeProfiles.length
      ? activeProfiles.map(p => `<article class="profile-card"><strong>${esc(p.name)}</strong><small>${esc(p.group)} • ${esc(p.handle)}</small><p>${esc(p.note)}</p><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a></article>`).join('')
      : '<article class="profile-card"><strong>Official profiles coming soon</strong><p>Verified public links will appear here after they are configured.</p></article>';
  }

  const contact = $('#contactActions');
  if (contact) {
    const email = (data.profile.email || '').trim();
    contact.innerHTML = email
      ? `<a class="button button-primary" href="mailto:${esc(email)}">Email Suhail</a><a class="button button-secondary" href="links.html">Official links</a><a class="button button-secondary" href="work-with-me.html">Project brief</a>`
      : `<a class="button button-primary" href="links.html">Official links</a><a class="button button-secondary" href="work-with-me.html">Project brief</a>`;
  }

  const assistantPanel = $('#publicAssistant');
  const assistantLauncher = $('#assistantLauncher');
  const assistantClose = $('#assistantClose');
  const publicMessages = $('#publicAssistantMessages');
  const addPublicMessage = (role, message) => {
    if (!publicMessages) return;
    const el = document.createElement('div');
    el.className = `public-msg ${role}`;
    el.textContent = message;
    publicMessages.appendChild(el);
    publicMessages.scrollTop = publicMessages.scrollHeight;
  };
  const publicAnswer = raw => {
    const q = String(raw || '').toLowerCase().trim();
    const idMatch = q.match(/(?:project\s*#?\s*|#)(\d{1,3})/i);
    if (idMatch) {
      const p=publicProjects.find(x=>x.id===idMatch[1].padStart(3,'0'));
      if(p) return `Project ${p.id}: ${p.title}\n${p.summary}\nFocus: ${(p.focusAreas || [p.category]).join(', ')}.`;
    }
    if (/speed|wifi|wi-fi|download|upload|latency|jitter/.test(q)) { const x=publicProjects.find(p=>p.id==='004'); return x?`${x.title}: ${x.summary}`:'The network diagnostics project is not published yet.'; }
    if (/inventory|barcode|stock|sku/.test(q)) { const x=publicProjects.find(p=>p.id==='005'); return x?`${x.title}: ${x.summary}`:'The inventory project is not published yet.'; }
    if (/3d|network|topology/.test(q)) { const x=publicProjects.find(p=>p.category==='3D'); return x?`${x.title}: ${x.summary}`:'No 3D project is published yet.'; }
    if (/medical|dictionary|anatomy|pwa/.test(q)) { const x=publicProjects.find(p=>/medical dictionary/i.test(p.title)); return x?`${x.title}: ${x.summary}`:'The medical dictionary project is not listed yet.'; }
    if (/download|source|code/.test(q)) return `Projects with downloads: ${publicProjects.filter(p=>p.download).map(p=>`Project ${p.id} — ${p.title}`).join('; ')}.`;
    if (/what.*build|skills|service|special|capabil|technolog/.test(q)) return `${data.profile.name} focuses on websites, software, databases, AI integration, business systems, admin/analytics, automation tools and interactive 3D experiences.`;
    if (/freelanc|hire|work with|client/.test(q)) return 'Open “Work with me” from the navigation for the client project process and project brief.';
    if (/github/.test(q)) {
      const github=(data.profile.profiles||[]).find(p=>/github/i.test(p.name||'')&&/^https?:\/\//.test(p.url||''));
      return github
        ? `GitHub is listed in the public Profiles section as ${github.handle||github.url}. Open the Profiles section to use the published link.`
        : 'A public GitHub profile link is not configured yet.';
    }
    if (/project|portfolio|latest/.test(q)) return `Suhail Labs currently publishes ${publicProjects.length} projects: ${publicProjects.map(p=>`${p.id} ${p.title}`).join('; ')}.`;
    if (/who|about|suhail/.test(q)) return `${data.profile.name} — ${data.profile.title}. ${data.profile.bio}`;
    return 'Ask me about Suhail’s projects, skills, downloads, GitHub profile or client work.';
  };
  const openAssistant=()=>{if(!assistantPanel)return;assistantPanel.hidden=false;assistantLauncher?.setAttribute('aria-expanded','true');if(publicMessages&&!publicMessages.children.length)addPublicMessage('assistant','Hi — I’m the Suhail Labs portfolio assistant. Ask me about projects, skills, downloads or client work.');};
  const closeAssistant=()=>{if(assistantPanel)assistantPanel.hidden=true;assistantLauncher?.setAttribute('aria-expanded','false');};
  assistantLauncher?.addEventListener('click',()=>assistantPanel?.hidden?openAssistant():closeAssistant());
  assistantClose?.addEventListener('click',closeAssistant);
  $('#publicAssistantForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('#publicAssistantInput');const q=input?.value?.trim();if(!q)return;addPublicMessage('user',q);input.value='';setTimeout(()=>addPublicMessage('assistant',publicAnswer(q)),80);});
  $$('[data-public-prompt]').forEach(b=>b.addEventListener('click',()=>{const q=b.dataset.publicPrompt;openAssistant();addPublicMessage('user',q);setTimeout(()=>addPublicMessage('assistant',publicAnswer(q)),80);}));

  const year=$('#year'); if(year) year.textContent=new Date().getFullYear();
})();