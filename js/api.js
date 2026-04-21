// ─── API CONFIG ───────────────────────────────────────────────────────────────

let apiConfig = {
  apiUrl:    localStorage.getItem('p47_apiUrl')    || '',
  apiKey:    localStorage.getItem('p47_apiKey')    || '',
  apiSecret: localStorage.getItem('p47_apiSecret') || '',
};

function saveApiConfig(url, key, secret) {
  apiConfig = { apiUrl: url, apiKey: key, apiSecret: secret };
  localStorage.setItem('p47_apiUrl',    url);
  localStorage.setItem('p47_apiKey',    key);
  localStorage.setItem('p47_apiSecret', secret);
}

// ─── HELPERS DE DATA / HORA ───────────────────────────────────────────────────

const DAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAY_FULL  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(date) {
  return date.toISOString().split('T')[0];
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v || 0));
}

function fmtPhone(phone) {
  const c = phone.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;
  return phone;
}

function employeeWorksOnDay(emp, dayOfWeek) {
  if (!emp || !emp.workingHours || !emp.workingHours.workingDays) return true;
  const wd = emp.workingHours.workingDays.find(d => d.dayOfWeek === dayOfWeek);
  return !!(wd && wd.isWorkingDay && wd.timeSlots && wd.timeSlots.length > 0);
}

// ─── HELPERS DE SLOT ──────────────────────────────────────────────────────────

function seededRandom(seed) {
  let s = Math.abs(seed) % 2147483647;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dateToSeed(dateStr, empId) {
  const str = dateStr + empId;
  return str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function generateAllSlots(emp, dayOfWeek, durationMin) {
  if (!emp || !emp.workingHours || !emp.workingHours.workingDays) return [];
  const wd = emp.workingHours.workingDays.find(d => d.dayOfWeek === dayOfWeek);
  if (!wd || !wd.isWorkingDay) return [];
  const slots = [];
  for (const ts of (wd.timeSlots || [])) {
    const [sh, sm] = ts.startTime.split(':').map(Number);
    const [eh, em] = ts.endTime.split(':').map(Number);
    const start = sh * 60 + sm;
    const end   = eh * 60 + em;
    for (let t = start; t + durationMin <= end; t += 30) {
      const s  = `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`;
      const e2 = t + durationMin;
      const en = `${String(Math.floor(e2 / 60)).padStart(2,'0')}:${String(e2 % 60).padStart(2,'0')}`;
      slots.push({ startTime: s, endTime: en });
    }
  }
  return slots;
}

// ─── MOCK API ─────────────────────────────────────────────────────────────────

async function mockApiCall(endpoint, options = {}) {
  await new Promise(r => setTimeout(r, 250));

  if (endpoint === '/external/v1/services')
    return { services: MOCK_SERVICES, cachedAt: new Date().toISOString() };

  if (endpoint === '/external/v1/booking/employees')
    return { employees: MOCK_EMPLOYEES };

  if (endpoint.startsWith('/external/v1/booking/slots')) {
    const params     = new URLSearchParams(endpoint.split('?')[1] || '');
    const empId      = params.get('employeeId') || '';
    const dateStr    = params.get('date') || '';
    const serviceIds = (params.get('serviceIds') || '').split(',').filter(Boolean);
    const emp        = MOCK_EMPLOYEES.find(e => e.id === empId);
    const services   = serviceIds.map(id => MOCK_SERVICES.find(s => s.id === id)).filter(Boolean);
    const total      = services.reduce((sum, s) => sum + (s.durationMinutes || 60), 0) || 60;
    const d          = new Date(dateStr + 'T12:00:00');
    const allSlots   = generateAllSlots(emp, d.getDay(), total);
    const rand       = seededRandom(dateToSeed(dateStr, empId));
    return {
      date: dateStr,
      employeeId: empId,
      employeeName: emp ? emp.name : '',
      totalDurationMinutes: total,
      availableSlots: allSlots.filter(() => rand() > 0.3),
      timezone: 'America/Sao_Paulo',
    };
  }

  if (endpoint === '/external/v1/booking' && options.method === 'POST') {
    const body          = JSON.parse(options.body || '{}');
    const emp           = MOCK_EMPLOYEES.find(e => e.id === body.employeeId);
    const svcs          = (body.serviceIds || []).map(id => MOCK_SERVICES.find(s => s.id === id)).filter(Boolean);
    const totalPrice    = svcs.reduce((sum, s) => sum + parseFloat(s.unitPrice), 0);
    const totalDuration = svcs.reduce((sum, s) => sum + (s.durationMinutes || 60), 0);
    const [bh, bm]      = (body.time || '09:00').split(':').map(Number);
    const endMin        = bh * 60 + bm + totalDuration;
    const endTime       = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
    return {
      id: `bk-${Date.now()}`,
      scheduledAt: `${body.date}T${body.time}:00.000-03:00`,
      endAt:       `${body.date}T${endTime}:00.000-03:00`,
      employeeName: emp ? emp.name : 'Profissional',
      totalPrice: totalPrice.toFixed(2),
      orderDisplayNumber: Math.floor(Math.random() * 9000) + 1000,
    };
  }

  throw new Error('Endpoint mock não encontrado');
}

// ─── API CALLER (real → mock fallback) ────────────────────────────────────────

async function apiCall(endpoint, options = {}) {
  const { apiUrl, apiKey, apiSecret } = apiConfig;
  if (apiUrl && apiKey && apiSecret) {
    try {
      const resp = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-Secret': apiSecret,
          ...(options.headers || {}),
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.warn('[P47] API indisponível, usando mock:', err.message);
      return mockApiCall(endpoint, options);
    }
  }
  return mockApiCall(endpoint, options);
}
