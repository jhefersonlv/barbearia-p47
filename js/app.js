'use strict';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = 'https://api-orbit.wordvirtua.com';
const API_KEY = 'wrd_bff57b50eed406c33fab45a0189726b1';
const API_SECRET = 'sk_f434ef95adbe1b10ec40c698074185452851896d880d45fff8f06373cfaf7e98';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  services: [],
  categories: [],
  employees: [],

  // step: 1=cats, 2=services, 3=employee, 4=datetime, 5=decision, 6=client, 7=confirm
  step: 1,

  // Seleções temporárias — resetadas ao salvar no carrinho
  tempCategoriaId: null,
  tempServicos: [],      // IDs dos serviços do item atual
  tempFuncionario: null,    // objeto employee
  tempData: null,    // 'YYYY-MM-DD'
  tempHora: null,    // 'HH:MM'

  // Calendário
  weekStart: null,
  allSlots: [],
  availSlots: [],
  slotsLoading: false,

  // Carrinho de agendamentos
  carrinho: [],

  // Dados do cliente
  clienteNome: '',
  clienteTelefone: '',
  clienteEmail: '',
  clienteObs: '',

  // Gerado a cada abertura do modal — garante email sintético único por sessão
  // Necessário porque a API usa prisma.customer.create() sem upsert
  sessionId: '',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(date) { return date.toISOString().split('T')[0]; }

function fmtCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(parseFloat(value || 0));
}

function generateAllSlots(emp, dayOfWeek, durationMin) {
  if (!emp?.workingHours?.workingDays) return [];
  const wd = emp.workingHours.workingDays.find(d => d.dayOfWeek === dayOfWeek);
  if (!wd || !wd.isWorkingDay || !wd.timeSlots?.length) return [];
  const slots = [];
  for (const ts of wd.timeSlots) {
    const [sh, sm] = ts.startTime.split(':').map(Number);
    const [eh, em] = ts.endTime.split(':').map(Number);
    const start = sh * 60 + sm, end = eh * 60 + em;
    for (let t = start; t + durationMin <= end; t += 30) {
      const s = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      const e2 = t + durationMin;
      const en = `${String(Math.floor(e2 / 60)).padStart(2, '0')}:${String(e2 % 60).padStart(2, '0')}`;
      slots.push({ startTime: s, endTime: en });
    }
  }
  return slots;
}

function getTotalDuration() {
  return state.tempServicos.reduce((sum, id) => {
    const s = state.services.find(s => s.id === id);
    return sum + (s?.durationMinutes || 60);
  }, 0) || 60;
}

function getPriceByIds(ids) {
  return ids.reduce((sum, id) => {
    const s = state.services.find(s => s.id === id);
    return sum + parseFloat(s?.unitPrice || 0);
  }, 0);
}

function stars(n) {
  return '★'.repeat(n);
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiCall(endpoint, options = {}) {
  const resp = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'X-API-Secret': API_SECRET,
      ...(options.headers || {}),
    },
  });
  let data = {};
  try { data = await resp.json(); } catch (_) { /* resposta não-JSON */ }
  if (!resp.ok) {
    const msg = data.message || data.error || data.errors?.[0]?.message || `Erro HTTP ${resp.status}`;
    console.error('[P47] API error', resp.status, endpoint, data);
    throw new Error(msg);
  }
  return data;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} toast-show`;
  setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ─── EXTRAIR CATEGORIAS ───────────────────────────────────────────────────────
function extractCategories(services) {
  const map = new Map();
  services.forEach(svc => {
    if (svc.categories?.length) {
      svc.categories.forEach(cat => {
        if (!map.has(cat.id)) map.set(cat.id, { id: cat.id, name: cat.name });
      });
    } else if (svc.category) {
      if (!map.has(svc.category)) map.set(svc.category, { id: svc.category, name: svc.category });
    }
  });
  return Array.from(map.values());
}

function getServicesInCategory(catId) {
  return state.services.filter(s => {
    if (s.isActive === false) return false;
    if (s.categories?.length) return s.categories.some(c => c.id === catId);
    return s.category === catId;
  });
}

// ─── SEÇÕES DO SITE (populadas pela API) ─────────────────────────────────────

function renderSiteServices() {
  const container = document.getElementById('site-services-grid');
  if (!container) return;

  if (!state.services.length) {
    container.innerHTML = '<p style="text-align:center;color:#555;padding:40px">Nenhum serviço encontrado</p>';
    return;
  }

  const cats = [...new Map(
    state.services
      .filter(s => s.category)
      .map(s => [s.category, s.category])
  ).values()];

  let activeCat = cats[0] || '';

  function render() {
    const filtered = activeCat
      ? state.services.filter(s => s.category === activeCat && s.isActive !== false)
      : state.services.filter(s => s.isActive !== false);

    let html = '';
    if (cats.length) {
      html += '<div class="svc-cat-tabs">';
      cats.forEach(c => {
        html += `<button class="svc-cat-tab${c === activeCat ? ' active' : ''}" data-cat="${c}">${c}</button>`;
      });
      html += '</div>';
    }

    html += '<div class="svc-grid-main">';
    filtered.forEach(s => {
      html += `
        <div class="svc-card">
          <div class="svc-card-photo">
            ${s.imageUrl
          ? `<img class="svc-img" src="${s.imageUrl}" alt="${s.name}">`
          : `<div class="svc-card-photo-placeholder">
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--gold)"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64z"/></svg>
                 </div>`
        }
            <div class="svc-card-price-badge">${fmtCurrency(s.unitPrice)}</div>
          </div>
          <div class="svc-card-body">
            <div class="svc-card-name">${s.name}</div>
            ${s.details ? `<p class="svc-card-desc">${s.details}</p>` : '<p class="svc-card-desc"></p>'}
            <div class="svc-card-footer">
              <span class="svc-card-duration">⏱ ${s.durationMinutes || 60} min</span>
              <button class="svc-card-book btn-agendar-site">Agendar →</button>
            </div>
          </div>
        </div>`;
    });
    html += '</div>';

    container.innerHTML = html;
    container.querySelectorAll('.svc-cat-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeCat = btn.dataset.cat; render(); });
    });
    container.querySelectorAll('.btn-agendar-site').forEach(btn => {
      btn.addEventListener('click', openBookingModal);
    });
  }

  render();
}

function renderSiteTeam() {
  const container = document.getElementById('site-team-grid');
  if (!container) return;

  if (!state.employees.length) {
    container.innerHTML = '<p style="text-align:center;color:#555;padding:40px">Equipe não disponível</p>';
    return;
  }

  const colors = ['#2a1f0a', '#0a1a2a', '#1a0a2a', '#0a2a1a', '#2a0a1a'];

  container.innerHTML = state.employees.map((emp, idx) => {
    const inits = (emp.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const position = emp.position?.name || emp.position || '';
    const avatarUrl = emp.avatarUrl || emp.user?.avatarUrl || null;
    const bg = colors[idx % colors.length];

    return `
      <div style="border:1px solid #1e1e1e;border-radius:4px;overflow:hidden;transition:border-color .3s"
           onmouseenter="this.style.borderColor='var(--gold-dark)'"
           onmouseleave="this.style.borderColor='#1e1e1e'">
        <div style="aspect-ratio:3/4;background:${bg};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
          ${avatarUrl
        ? `<img src="${avatarUrl}" alt="${emp.name}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
        : `<span style="font-family:'Playfair Display';font-size:52px;font-weight:700;color:rgba(201,168,76,.3)">${inits}</span>`
      }
          ${idx === 0 ? `<div style="position:absolute;top:12px;right:12px;background:var(--gold);color:var(--black);font-size:9px;font-weight:700;padding:4px 8px;letter-spacing:.1em;text-transform:uppercase">${position}</div>` : ''}
        </div>
        <div style="padding:20px 20px 24px">
          <div style="font-family:\'Playfair Display\';font-size:18px;font-weight:600;margin-bottom:4px">${emp.name}</div>
          <div style="font-size:12px;color:var(--gold);margin-bottom:10px;font-weight:500">${position}</div>
          <button class="btn-agendar-site" style="width:100%;background:none;border:1px solid #2a2a2a;color:#888;padding:9px;font-size:12px;cursor:pointer;border-radius:2px;font-family:Outfit;font-weight:500;transition:all .2s"
            onmouseenter="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'"
            onmouseleave="this.style.borderColor='#2a2a2a';this.style.color='#888'">
            Agendar com ${(emp.name || '').split(' ')[0]}
          </button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.btn-agendar-site').forEach(btn => {
    btn.addEventListener('click', openBookingModal);
  });
}

// ─── BOOKING MODAL — CONTROLE ─────────────────────────────────────────────────

function openBookingModal() {
  state.step = 1;
  state.weekStart = getWeekStart(new Date());
  // Novo sessionId a cada abertura do modal — garante email único por sessão
  state.sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  clearTempSelections();
  document.getElementById('booking-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  goToStep(1);
}

function closeBookingModal() {
  document.getElementById('booking-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function clearTempSelections() {
  state.tempCategoriaId = null;
  state.tempServicos = [];
  state.tempFuncionario = null;
  state.tempData = null;
  state.tempHora = null;
  state.allSlots = [];
  state.availSlots = [];
}

function resetFullBooking() {
  clearTempSelections();
  state.carrinho = [];
  state.clienteNome = '';
  state.clienteTelefone = '';
  state.clienteEmail = '';
  state.clienteObs = '';
}

// ─── STEP NAVIGATION ─────────────────────────────────────────────────────────

function goToStep(n) {
  state.step = n;
  document.querySelectorAll('.step-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(`step-${n}`);
  if (panel) panel.style.display = 'block';

  renderStepIndicator();
  renderCarrinhoResumo();

  if (n === 1) renderStep1();
  else if (n === 2) renderStep2();
  else if (n === 3) renderStep3();
  else if (n === 4) renderStep4();
  else if (n === 5) renderStep5();
  else if (n === 6) renderStep6();
  else if (n === 7) renderStep7();

  updateModalFooter();
}

const STEP_VISUAL = [
  { step: 1, label: 'Categoria' },
  { step: 2, label: 'Serviço' },
  { step: 3, label: 'Profissional' },
  { step: 4, label: 'Horário' },
  { step: 6, label: 'Seus dados' },
  { step: 7, label: 'Confirmar' },
];

function renderStepIndicator() {
  const container = document.getElementById('step-indicator');
  if (!container) return;

  const cur = state.step;
  const html = STEP_VISUAL.map((item, i) => {
    const done = cur > item.step || (cur === 5 && item.step <= 4);
    const active = cur === item.step;
    const after = i < STEP_VISUAL.length - 1;

    return `
      <div class="si-item">
        <div class="si-dot${done ? ' done' : active ? ' active' : ''}">${done ? '✓' : i + 1}</div>
        <div class="si-label${active ? ' active' : ''}">${item.label}</div>
        ${after ? `<div class="si-line${done ? ' done' : ''}"></div>` : ''}
      </div>`;
  }).join('');

  container.innerHTML = html;
}

function updateModalFooter() {
  const btnVoltar = document.getElementById('btn-voltar');
  const btnContinuar = document.getElementById('btn-continuar');
  const btnConfirmar = document.getElementById('btn-confirmar');

  btnVoltar.style.display = 'none';
  btnContinuar.style.display = 'none';
  btnConfirmar.style.display = 'none';

  const { step } = state;

  if (step === 5 || step === 7) {
    // Step 5 has inline decision buttons; step 7 shows confirm button
    if (step === 7) btnConfirmar.style.display = 'inline-flex';
    return;
  }

  if (step > 1) btnVoltar.style.display = 'inline-flex';
  btnContinuar.style.display = 'inline-flex';
  btnContinuar.disabled = !canAdvance();
  btnContinuar.style.opacity = canAdvance() ? '1' : '0.45';
  btnContinuar.style.cursor = canAdvance() ? 'pointer' : 'not-allowed';
}

function canAdvance() {
  const { step, tempCategoriaId, tempServicos, tempFuncionario, tempData, tempHora, clienteNome, clienteTelefone } = state;
  if (step === 1) return !!tempCategoriaId;
  if (step === 2) return tempServicos.length > 0;
  if (step === 3) return !!tempFuncionario;
  if (step === 4) return !!(tempData && tempHora);
  if (step === 6) return clienteNome.trim().length > 1 && clienteTelefone.replace(/\D/g, '').length >= 10;
  return false;
}

function handleContinuar() {
  if (!canAdvance()) return;
  const { step } = state;

  if (step === 3 && state.tempData && state.carrinho.length > 0) {
    // Data já definida em loop anterior: vai direto para os horários e carrega os slots
    goToStep(4);
    handleDateSelect(state.tempData);
    return;
  }
  if (step === 4) { goToStep(5); return; }
  if (step === 6) { goToStep(7); return; }
  goToStep(step + 1);
}

function handleVoltar() {
  const { step } = state;
  if (step === 2) {
    state.tempServicos = [];
    goToStep(1);
  } else if (step === 3) {
    state.tempFuncionario = null;
    goToStep(2);
  } else if (step === 4) {
    state.tempData = null; state.tempHora = null;
    state.allSlots = []; state.availSlots = [];
    goToStep(3);
  } else if (step === 6) {
    // Volta à decisão; seleções temporárias ainda estão no state
    goToStep(5);
  } else if (step === 7) {
    goToStep(6);
  } else if (step > 1) {
    goToStep(step - 1);
  }
}

// ─── STEP 1: CATEGORIAS ───────────────────────────────────────────────────────

function renderStep1() {
  const container = document.getElementById('step-1-content');
  if (!container) return;

  if (!state.categories.length) {
    container.innerHTML = '<div class="modal-spinner-wrap"><div class="spinner"></div><p>Carregando categorias...</p></div>';
    return;
  }

  container.innerHTML = `
    <p class="modal-section-label">Escolha uma categoria de serviço</p>
    <div class="cat-grid">
      ${state.categories.map(cat => {
    const count = getServicesInCategory(cat.id).length;
    const sel = state.tempCategoriaId === cat.id;
    return `
          <button class="cat-card${sel ? ' selected' : ''}" data-id="${cat.id}">
            <div class="cat-card-name">${cat.name}</div>
            <div class="cat-card-count">${count} serviço${count !== 1 ? 's' : ''}</div>
          </button>`;
  }).join('')}
    </div>`;

  container.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tempCategoriaId = btn.dataset.id;
      state.tempServicos = [];
      renderStep1();
      setTimeout(() => handleContinuar(), 220)
      updateModalFooter();
    });
  });
}

// ─── STEP 2: SERVIÇOS ────────────────────────────────────────────────────────

function renderStep2() {
  const container = document.getElementById('step-2-content');
  if (!container) return;

  const filtered = getServicesInCategory(state.tempCategoriaId);
  const cat = state.categories.find(c => c.id === state.tempCategoriaId);

  if (!filtered.length) {
    container.innerHTML = `<p class="modal-empty">Nenhum serviço nesta categoria</p>`;
    return;
  }

  container.innerHTML = `
    <p class="modal-section-label">${cat?.name || 'Serviços'} — toque para selecionar</p>
    <div class="svc-modal-list">
      ${filtered.map(s => {
    const sel = state.tempServicos[0] === s.id;
    return `
          <div class="svc-modal-card${sel ? ' selected' : ''}" data-id="${s.id}">
            ${s.imageUrl
        ? `<img src="${s.imageUrl}" alt="${s.name}" class="svc-modal-img" onerror="this.style.display='none'">`
        : '<div class="svc-modal-img-placeholder"></div>'
      }
            <div class="svc-modal-info">
              <div class="svc-modal-name">${s.name}</div>
              ${s.details ? `<div class="svc-modal-desc">${s.details}</div>` : ''}
              <div class="svc-modal-dur">⏱ ${s.durationMinutes || 60} min</div>
            </div>
            <div class="svc-modal-right">
              <div class="svc-modal-price">${fmtCurrency(s.unitPrice)}</div>
              <div class="svc-check-circle${sel ? ' checked' : ''}">${sel ? '✓' : ''}</div>
            </div>
          </div>`;
  }).join('')}
    </div>`;

  container.querySelectorAll('.svc-modal-card').forEach(card => {
    card.addEventListener('click', () => {
      // Seleção única — substitui qualquer seleção anterior
      state.tempServicos = [card.dataset.id];
      renderStep2();
      // Avança automaticamente após breve feedback visual
      setTimeout(() => handleContinuar(), 220);
    });
  });
}

// ─── STEP 3: FUNCIONÁRIOS ────────────────────────────────────────────────────

function employeeCanDoService(emp, serviceIds) {
  if (!serviceIds?.length) return true;
  // Se o funcionário não tem lista de serviços, considera habilitado
  if (!emp.services?.length) return true;
  const empSet = new Set(emp.services.map(s => s.id));
  return serviceIds.every(id => empSet.has(id));
}

function renderStep3() {
  const container = document.getElementById('step-3-content');
  if (!container) return;

  if (!state.employees.length) {
    container.innerHTML = '<div class="modal-spinner-wrap"><div class="spinner"></div></div>';
    return;
  }

  // Filtra apenas funcionários habilitados para o serviço selecionado
  const eligible = state.employees.filter(emp =>
    employeeCanDoService(emp, state.tempServicos)
  );

  // Se data já está definida (loop), exibir aviso
  const dataInfo = state.tempData && state.carrinho.length > 0
    ? `<div class="date-reuse-banner">📅 Data já definida: <strong>${state.tempData}</strong> — só escolha o profissional e o horário</div>`
    : '';

  if (!eligible.length) {
    container.innerHTML = `
      ${dataInfo}
      <p class="modal-empty">Nenhum profissional disponível para este serviço.</p>`;
    return;
  }

  container.innerHTML = `
    ${dataInfo}
    <p class="modal-section-label">Escolha o profissional</p>
    <div class="emp-list">
      ${eligible.map(emp => {
    const position = emp.position?.name || emp.position || '';
    const avatarUrl = emp.avatarUrl || emp.user?.avatarUrl || null;
    const inits = (emp.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const isSel = state.tempFuncionario?.id === emp.id;

    return `
          <div class="emp-item${isSel ? ' selected' : ''}" data-id="${emp.id}">
            <div class="emp-item-avatar-wrap">
              ${avatarUrl
        ? `<img src="${avatarUrl}" alt="${emp.name}" class="emp-item-avatar"
                       onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''
      }
              <div class="emp-item-initials"${avatarUrl ? ' style="display:none"' : ''}>${inits}</div>
            </div>
            <div class="emp-item-info">
              <div class="emp-item-name">${emp.name}</div>
              ${position ? `<div class="emp-item-position">${position}</div>` : ''}
            </div>
            <div class="emp-item-check">${isSel ? '✓' : ''}</div>
          </div>`;
  }).join('')}
    </div>`;

  container.querySelectorAll('.emp-item').forEach(item => {
    item.addEventListener('click', () => {
      state.tempFuncionario = state.employees.find(e => e.id === item.dataset.id);
      // Limpa hora mas preserva data (se estiver em loop)
      state.tempHora = null;
      state.allSlots = [];
      state.availSlots = [];
      renderStep3();
      setTimeout(() => handleContinuar(), 220)
      updateModalFooter();
    });
  });
}

// ─── STEP 4: DATA + HORA ─────────────────────────────────────────────────────

function renderStep4() {
  const container = document.getElementById('step-4-content');
  if (!container) return;

  const dateFixada = state.tempData && state.carrinho.length > 0;

  if (dateFixada) {
    // Data já definida — mostrar só os horários
    const d = new Date(state.tempData + 'T12:00:00');
    const label = `${DAY_FULL[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}`;
    container.innerHTML = `
      <div class="date-reuse-banner">
        📅 Data mantida: <strong>${label}</strong>
      </div>
      <p class="modal-section-label" style="margin-top:20px">
        Horários disponíveis — ${state.tempFuncionario?.name || ''}
      </p>
      <div id="slots-section">
        <div id="slots-list">
          ${state.slotsLoading
        ? '<div class="modal-spinner-wrap"><div class="spinner"></div></div>'
        : buildSlotsHTML()
      }
        </div>
      </div>`;
    bindSlotButtons();
    return;
  }

  // Fluxo normal — escolha de data
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(state.weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  container.innerHTML = `
    <p class="modal-section-label">Escolha o dia</p>
    <div class="week-nav-row">
      <button class="week-nav-btn" id="prev-week-btn">←</button>
      <div class="week-days-grid" id="week-days-grid">
        ${weekDays.map(d => {
    const isPast = d < today;
    const isSel = state.tempData === fmtDate(d);
    return `
            <button class="day-btn${isSel ? ' selected' : ''}${isPast ? ' past' : ''}"
                    data-date="${fmtDate(d)}"
                    ${isPast ? 'disabled' : ''}>
              <div class="day-short">${DAY_SHORT[d.getDay()]}</div>
              <div class="day-num">${d.getDate()}</div>
            </button>`;
  }).join('')}
      </div>
      <button class="week-nav-btn" id="next-week-btn">→</button>
    </div>

    <div id="slots-section" style="display:${state.tempData ? 'block' : 'none'}">
      <p class="modal-section-label" style="margin-top:24px">
        Horários disponíveis — ${state.tempFuncionario?.name || ''}
      </p>
      <div id="slots-list">
        ${state.slotsLoading
      ? '<div class="modal-spinner-wrap"><div class="spinner"></div></div>'
      : buildSlotsHTML()
    }
      </div>
    </div>`;

  container.querySelectorAll('.day-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => handleDateSelect(btn.dataset.date));
  });
  document.getElementById('prev-week-btn').addEventListener('click', () => navWeek(-1));
  document.getElementById('next-week-btn').addEventListener('click', () => navWeek(1));
  bindSlotButtons();
}

function getCartBlockedSlots() {
  // Horários já no carrinho para o mesmo funcionário+data (bloqueio local)
  const blocked = new Set();
  for (const item of state.carrinho) {
    if (item.funcionarioId === state.tempFuncionario?.id && item.data === state.tempData) {
      blocked.add(item.hora);
    }
  }
  return blocked;
}

function buildSlotsHTML() {
  if (!state.tempData) return '';

  const cartBlocked = getCartBlockedSlots();

  function slotBtn(slot, avail) {
    const isSel = state.tempHora === slot.startTime;
    const inCart = cartBlocked.has(slot.startTime);
    const enabled = avail && !inCart;
    const cls = `slot-btn${isSel ? ' selected' : ''}${!enabled ? ' occupied' : ''}`;
    const tip = inCart ? 'Já no carrinho' : 'Horário ocupado';
    return `<button class="${cls}"
                    data-start="${slot.startTime}" data-end="${slot.endTime}"
                    ${!enabled ? `disabled title="${tip}"` : ''}>
              ${slot.startTime}${inCart ? ' ✓' : ''}
            </button>`;
  }

  // Se há slots gerados via workingHours, mostrar todos (disponível/ocupado)
  if (state.allSlots.length) {
    const availSet = new Set(state.availSlots.map(s => s.startTime));
    return `<div class="slots-grid">
      ${state.allSlots.map(slot => slotBtn(slot, availSet.has(slot.startTime))).join('')}
    </div>`;
  }

  // Fallback: mostrar apenas os slots disponíveis da API
  if (state.availSlots.length) {
    return `<div class="slots-grid">
      ${state.availSlots.map(slot => slotBtn(slot, true)).join('')}
    </div>`;
  }

  return '<p class="modal-empty">Nenhum horário disponível para este dia</p>';
}

function bindSlotButtons() {
  document.querySelectorAll('#slots-list .slot-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tempHora = btn.dataset.start;
      document.querySelectorAll('#slots-list .slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateModalFooter();
    });
  });
}

async function handleDateSelect(dateStr) {
  state.tempData = dateStr;
  state.tempHora = null;
  state.allSlots = [];
  state.availSlots = [];
  state.slotsLoading = true;

  // Atualiza a UI: re-render o step com loading
  renderStep4();

  try {
    const d = new Date(dateStr + 'T12:00:00');
    const totalDuration = getTotalDuration();

    // Gera todos os slots a partir do horário de trabalho do funcionário
    state.allSlots = generateAllSlots(state.tempFuncionario, d.getDay(), totalDuration);

    // Busca slots REAIS disponíveis na API para este funcionário e data
    const svcIds = state.tempServicos.join(',');
    const data = await apiCall(
      `/external/v1/booking/slots?employeeId=${state.tempFuncionario.id}&date=${dateStr}&serviceIds=${svcIds}`
    );
    state.availSlots = data.availableSlots || [];
  } catch (err) {
    showToast('Erro ao carregar horários: ' + err.message, 'error');
  } finally {
    state.slotsLoading = false;
  }

  const slotsList = document.getElementById('slots-list');
  const slotsSection = document.getElementById('slots-section');
  if (slotsList) slotsList.innerHTML = buildSlotsHTML();
  if (slotsSection) slotsSection.style.display = 'block';
  bindSlotButtons();
  updateModalFooter();
}

function navWeek(dir) {
  const ns = new Date(state.weekStart);
  ns.setDate(ns.getDate() + dir * 7);
  const today = getWeekStart(new Date());
  if (ns >= today) {
    state.weekStart = ns;
    state.tempData = null;
    state.tempHora = null;
    renderStep4();
  }
}

// ─── STEP 5: DECISÃO ─────────────────────────────────────────────────────────

function renderStep5() {
  const preview = document.getElementById('step5-preview');
  if (!preview) return;

  const emp = state.tempFuncionario;
  const svcs = state.tempServicos.map(id => state.services.find(s => s.id === id)).filter(Boolean);
  const tot = getPriceByIds(state.tempServicos);

  preview.innerHTML = `
    <div class="decision-preview-card">
      <div class="dp-services">${svcs.map(s => s.name).join(' + ')}</div>
      <div class="dp-meta">
        com <strong>${emp?.name || ''}</strong> · ${state.tempData} às
        <strong style="color:var(--gold)">${state.tempHora}</strong>
      </div>
      <div class="dp-price">${fmtCurrency(tot)}</div>
    </div>`;
}

function addCurrentToCart() {
  state.carrinho.push({
    servicos: [...state.tempServicos],
    funcionarioId: state.tempFuncionario.id,
    funcionarioNome: state.tempFuncionario.name,
    data: state.tempData,
    hora: state.tempHora,
  });
}

function handleDecisionSim() {
  addCurrentToCart();
  const dataAnterior = state.tempData; // preserva a data para reutilizar
  clearTempSelections();
  state.tempData = dataAnterior;       // reutiliza sem pedir de novo
  renderCarrinhoResumo();
  goToStep(1);
}

function handleDecisionNao() {
  // Não adiciona ao carrinho aqui — as seleções temporárias permanecem
  // e serão submetidas junto ao carrinho no handleConfirmar
  goToStep(6);
}

// ─── STEP 6: DADOS DO CLIENTE ────────────────────────────────────────────────

function renderStep6() {
  const nomeInput = document.getElementById('cliente-nome');
  const foneInput = document.getElementById('cliente-telefone');
  const emailInput = document.getElementById('cliente-email');
  if (!nomeInput || !foneInput) return;

  nomeInput.value = state.clienteNome;
  foneInput.value = state.clienteTelefone;
  if (emailInput) emailInput.value = state.clienteEmail;

  // Remover listeners antigos clonando os inputs
  const nome2 = nomeInput.cloneNode(true);
  const fone2 = foneInput.cloneNode(true);
  nomeInput.replaceWith(nome2);
  foneInput.replaceWith(fone2);

  nome2.addEventListener('input', () => { state.clienteNome = nome2.value; updateModalFooter(); });
  fone2.addEventListener('input', () => { state.clienteTelefone = fone2.value; updateModalFooter(); });

  if (emailInput) {
    const email2 = emailInput.cloneNode(true);
    emailInput.replaceWith(email2);
    email2.addEventListener('input', () => { state.clienteEmail = email2.value; });
  }

  const obsInput = document.getElementById('cliente-obs');
  if (obsInput) {
    obsInput.value = state.clienteObs;
    const obs2 = obsInput.cloneNode(true);
    obsInput.replaceWith(obs2);
    obs2.addEventListener('input', () => { state.clienteObs = obs2.value; });
  }
}

// ─── STEP 7: CONFIRMAÇÃO ─────────────────────────────────────────────────────

function getAllBookingItems() {
  // Itens do carrinho (adicionados via "Sim, mais um serviço") + item atual (temp)
  const items = [...state.carrinho];
  if (state.tempServicos.length && state.tempFuncionario && state.tempData && state.tempHora) {
    items.push({
      servicos: state.tempServicos,
      funcionarioId: state.tempFuncionario.id,
      funcionarioNome: state.tempFuncionario.name,
      data: state.tempData,
      hora: state.tempHora,
    });
  }
  return items;
}

function renderStep7() {
  const container = document.getElementById('step-7-content');
  if (!container) return;

  const allItems = getAllBookingItems();
  const grandTotal = allItems.reduce((sum, item) => sum + getPriceByIds(item.servicos), 0);
  const carrinhoLen = state.carrinho.length;

  container.innerHTML = `
    <p class="modal-section-label">Revise e confirme seu agendamento</p>

    <div class="confirm-client-box">
      <div class="confirm-row"><span>Nome</span><strong>${state.clienteNome}</strong></div>
      <div class="confirm-row"><span>WhatsApp</span><strong>${state.clienteTelefone}</strong></div>
    </div>

    ${allItems.map((item, i) => {
    const svcs = item.servicos.map(id => state.services.find(s => s.id === id)).filter(Boolean);
    const itemTotal = getPriceByIds(item.servicos);
    const isFromCart = i < carrinhoLen;
    return `
        <div class="confirm-item-box">
          <div class="confirm-item-header">
            <span>Agendamento ${i + 1} · ${item.funcionarioNome}</span>
            ${isFromCart
        ? `<button class="confirm-remove-btn" data-cart-index="${i}" title="Remover">✕ Remover</button>`
        : '<span class="confirm-current-badge">atual</span>'
      }
          </div>
          <div class="confirm-row"><span>Data &amp; Hora</span><span>${item.data} às ${item.hora}</span></div>
          ${svcs.map(s => `
            <div class="confirm-row svc-row">
              <span>${s.name}</span>
              <span>${fmtCurrency(s.unitPrice)}</span>
            </div>`).join('')}
          <div class="confirm-row subtotal-row">
            <span>Subtotal</span><strong>${fmtCurrency(itemTotal)}</strong>
          </div>
        </div>`;
  }).join('')}

    <div class="confirm-grand-total">
      <span>Total Geral</span>
      <strong>${fmtCurrency(grandTotal)}</strong>
    </div>`;

  container.querySelectorAll('.confirm-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.carrinho.splice(parseInt(btn.dataset.cartIndex, 10), 1);
      renderCarrinhoResumo();
      renderStep7();
    });
  });
}

// ─── CONFIRMAR (POST para cada item do carrinho) ──────────────────────────────

async function handleConfirmar() {
  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Aguardando...';

  try {
    const results = [];
    const phone = state.clienteTelefone.replace(/\D/g, '') || undefined;

    const emailRaw = state.clienteEmail.trim();
    const obs = state.clienteObs.trim() || undefined;

    for (const item of getAllBookingItems()) {
      // Email real do cliente OU sintético único por chamada.
      // Deve ser único por POST porque a API usa prisma.customer.create()
      // (sem upsert) com unique constraint em (tenantId, email).
      // Cada chamada gera um sufixo diferente para não colidir.
      const emailSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const email = emailRaw || `bk.${emailSuffix}@agendamento.com.br`;

      const payload = {
        employeeId: item.funcionarioId,
        date: item.data,
        time: item.hora,
        serviceIds: item.servicos,
        customerName: state.clienteNome.trim(),
        customerEmail: email,
        customerPhone: phone,
        observation: obs,
        createOrder: false,
      };
      console.log('[P47] POST /external/v1/booking', payload);
      const result = await apiCall('/external/v1/booking', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      results.push(result);
    }
    showSuccessScreen(results);
  } catch (err) {
    showToast('Erro ao confirmar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Agendamento';
  }
}

function showSuccessScreen(results) {
  document.querySelectorAll('.step-panel').forEach(p => p.style.display = 'none');
  document.getElementById('step-success').style.display = 'block';
  document.getElementById('btn-confirmar').style.display = 'none';

  const details = document.getElementById('success-details');
  details.innerHTML = results.map((r, i) => `
    <div class="success-item">
      <div>Agendamento ${i + 1} — ${r.employeeName || state.carrinho[i]?.funcionarioNome || ''}</div>
      ${r.scheduledAt
      ? `<div style="color:var(--gold);font-weight:600">${r.scheduledAt.slice(0, 10)} às ${r.scheduledAt.slice(11, 16)}</div>`
      : ''}
    </div>`).join('');
}

// ─── CARRINHO RESUMO (visível durante todo o fluxo) ───────────────────────────

function renderCarrinhoResumo() {
  const container = document.getElementById('carrinho-resumo');
  const lista = document.getElementById('carrinho-lista');
  if (!container || !lista) return;

  if (!state.carrinho.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  lista.innerHTML = state.carrinho.map((item, i) => {
    const svcs = item.servicos.map(id => state.services.find(s => s.id === id)).filter(Boolean);
    const itemTotal = getPriceByIds(item.servicos);
    return `
      <div class="cart-item">
        <div class="cart-item-num">${i + 1}</div>
        <div class="cart-item-info">
          <div class="cart-item-svcs">${svcs.map(s => s.name).join(' + ')}</div>
          <div class="cart-item-meta">${item.funcionarioNome} · ${item.data} ${item.hora}</div>
        </div>
        <div class="cart-item-price">${fmtCurrency(itemTotal)}</div>
      </div>`;
  }).join('');
}

// ─── TESTIMONIALS CAROUSEL ────────────────────────────────────────────────────

const TESTIMONIALS = [
  { name: 'Lucas Cavalieri', text: 'Cabelo muito bem tratado pelo profissional César! Recomendo a barbearia e o barbeiro!', stars: 5 },
  { name: 'Gabriel Marques', text: 'Excelente atendimento do Profissional Yago! Atencioso com o cliente e suas preferências. Com certeza ganhou um cliente!', stars: 5 },
  { name: 'Guilherme Mores', text: 'Fui atendido pelo Rafael e fiquei muito satisfeito. Ele é um profissional atencioso, cuidadoso e deu ótimas dicas.', stars: 5 },
  { name: 'Andre Moreira', text: 'Atendimento excelente! A Yasmin foi muito simpática e mostrou conhecimento sobre visagismo. Ela dá sugestões para criar um visual harmônico.', stars: 5 },
  { name: 'Dani Moura', text: 'Que experiência incrível! Eu e meu filho fomos muito bem atendidos. Os profissionais são extremamente capacitados!', stars: 5 },
  { name: 'Marcos Nogueira', text: 'A Yasmim é sensacional. Atendimento top, corte e barba perfeitos, papo muito agradável. Veste a camisa da barbearia!', stars: 5 },
];

function initTestimonials() {
  let active = 0;

  const textEl = document.getElementById('testem-text');
  const nameEl = document.getElementById('testem-name');
  const starsEl = document.getElementById('testem-stars');
  const initEl = document.getElementById('testem-initial');
  const dotsEl = document.getElementById('testem-dots');

  if (!textEl) return;

  function renderDots() {
    dotsEl.innerHTML = TESTIMONIALS.map((_, i) => `
      <button class="testem-dot${i === active ? ' active' : ''}" data-i="${i}"></button>
    `).join('');
    dotsEl.querySelectorAll('.testem-dot').forEach(btn => {
      btn.addEventListener('click', () => { active = +btn.dataset.i; update(); });
    });
  }

  function update() {
    const t = TESTIMONIALS[active];
    textEl.textContent = t.text;
    nameEl.textContent = t.name;
    starsEl.textContent = '★'.repeat(t.stars);
    initEl.textContent = t.name[0];
    renderDots();
  }

  update();
  setInterval(() => { active = (active + 1) % TESTIMONIALS.length; update(); }, 4500);

  // Grid
  const grid = document.getElementById('testem-grid');
  if (grid) {
    grid.innerHTML = TESTIMONIALS.map(t => `
      <div class="testem-card">
        <div style="color:var(--gold);font-size:14px;margin-bottom:8px">${'★'.repeat(t.stars)}</div>
        <p style="font-size:13px;color:#888;line-height:1.7;margin:0 0 12px">${t.text}</p>
        <div style="font-weight:600;font-size:13px;color:#bbb">${t.name}</div>
      </div>`).join('');
  }
}

// ─── NAV SCROLL ───────────────────────────────────────────────────────────────

function initNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // Mobile menu
  const hamburger = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }
}

// ─── HERO VIDEO (YouTube IFrame API) ─────────────────────────────────────────

function initHeroVideo() {
  // Injeta o script da API do YouTube
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = function () {
    const START = 5;
    const END = 35;
    let loopTimer = null;

    const player = new YT.Player('hero-yt-player', {
      videoId: 'lbokP8ITOaE',
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        start: START,
        playsinline: 1,   // essencial para iOS
      },
      events: {
        onReady(e) {
          e.target.playVideo();

          // Verifica a posição a cada 300ms e volta ao segundo 5 quando passa do 35
          loopTimer = setInterval(() => {
            try {
              const t = player.getCurrentTime();
              if (t >= END) player.seekTo(START, true);
            } catch (_) { }
          }, 300);
        },

        onStateChange(e) {
          // Se o vídeo pausar ou terminar, retoma a partir do segundo 5
          if (e.data === YT.PlayerState.ENDED || e.data === YT.PlayerState.PAUSED) {
            player.seekTo(START, true);
            player.playVideo();
          }
        },
      },
    });
  };
}

// ─── SEÇÃO LOJA (produtos da API) ────────────────────────────────────────────

async function renderSiteProducts() {
  const container = document.getElementById('site-products-grid');
  if (!container) return;

  try {
    const data = await apiCall('/external/v1/products');
    const products = (data.products || []).filter(p => p.isActive !== false);

    if (!products.length) {
      container.innerHTML = '<p style="text-align:center;color:#555;padding:40px">Nenhum produto disponível no momento.</p>';
      return;
    }

    container.innerHTML = `<div class="prod-grid">${products.map(prod => buildProductCard(prod)).join('')}</div>`;
  } catch (err) {
    console.error('[P47] Erro ao carregar produtos:', err.message);
    container.innerHTML = '<p style="text-align:center;color:#555;padding:40px">Não foi possível carregar os produtos.</p>';
  }
}

function getMainImage(prod) {
  const imgs = prod.images || [];
  const main = imgs.find(i => i.isMain) || imgs.sort((a, b) => a.position - b.position)[0];
  return main?.url || null;
}

function getFirstVariant(prod) {
  return (prod.variants || []).find(v => v.isActive !== false) || prod.variants?.[0] || null;
}

function buildProductCard(prod) {
  const imgUrl = getMainImage(prod);
  const variant = getFirstVariant(prod);
  const sku = variant?.sku || '';
  const sale = parseFloat(variant?.price?.salePrice || 0);
  const list = parseFloat(variant?.price?.listPrice || 0);
  const hasDisc = sale > 0 && list > 0 && sale < list;
  const price = sale > 0 ? sale : list;

  const waText = encodeURIComponent(`Olá! Tenho interesse no produto: *${prod.name}*${sku ? ` (SKU: ${sku})` : ''}`);
  const waUrl = `https://wa.me/5512981365015?text=${waText}`;

  const badge = prod.isFeatured
    ? '<div class="prod-badge">Destaque</div>'
    : '';

  return `
    <div class="prod-card">
      <div class="prod-photo">
        ${imgUrl
      ? `<img src="${imgUrl}" alt="${prod.name}" class="prod-img">`
      : `<div class="prod-photo-placeholder">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".4">
                 <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                 <polyline points="21 15 16 10 5 21"/>
               </svg>
             </div>`
    }
        ${badge}
        ${price > 0 ? `<div class="prod-price-badge">${fmtCurrency(price)}</div>` : ''}
      </div>
      <div class="prod-body">
        <div class="prod-name">${prod.name}</div>
        ${prod.description ? `<p class="prod-desc">${prod.description}</p>` : ''}
        <div class="prod-footer">
          <div class="prod-price-wrap">
            ${hasDisc ? `<span class="prod-list-price">${fmtCurrency(list)}</span>` : ''}
            ${price > 0 ? `<span class="prod-sale-price">${fmtCurrency(price)}</span>` : ''}
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener" class="prod-buy-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Comprar
          </a>
        </div>
      </div>
    </div>`;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  state.weekStart = getWeekStart(new Date());

  initNav();
  initTestimonials();
  initHeroVideo();

  // Botões "Agendar" estáticos no HTML
  document.querySelectorAll('.btn-agendar').forEach(btn => {
    btn.addEventListener('click', openBookingModal);
  });

  // Fechar modal
  document.getElementById('modal-close').addEventListener('click', closeBookingModal);
  document.getElementById('booking-overlay').addEventListener('click', e => {
    if (e.target.id === 'booking-overlay') closeBookingModal();
  });

  // Navegação do modal
  document.getElementById('btn-voltar').addEventListener('click', handleVoltar);
  document.getElementById('btn-continuar').addEventListener('click', handleContinuar);
  document.getElementById('btn-confirmar').addEventListener('click', handleConfirmar);

  // Step 5 — decisão
  document.getElementById('btn-decision-sim').addEventListener('click', handleDecisionSim);
  document.getElementById('btn-decision-nao').addEventListener('click', handleDecisionNao);

  // Fechar tela de sucesso
  const successClose = document.getElementById('btn-success-close');
  if (successClose) {
    successClose.addEventListener('click', () => {
      resetFullBooking();
      closeBookingModal();
    });
  }

  // Carregar dados da API em paralelo
  try {
    const [svcData, empData] = await Promise.all([
      apiCall('/external/v1/services'),
      apiCall('/external/v1/booking/employees'),
    ]);
    state.services = svcData.services || [];
    state.categories = extractCategories(state.services);
    state.employees = empData.employees || [];

    renderSiteServices();
    renderSiteTeam();
  } catch (err) {
    console.error('[P47] Erro ao carregar dados:', err.message);
    document.getElementById('site-services-grid').innerHTML =
      '<p style="text-align:center;color:#666;padding:40px">Erro ao carregar serviços. Agende pelo WhatsApp.</p>';
    document.getElementById('site-team-grid').innerHTML = '';
  }

  // Produtos — carregado independentemente para não bloquear o resto
  renderSiteProducts();
}

document.addEventListener('DOMContentLoaded', init);
