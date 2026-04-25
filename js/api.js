// ─── API CONFIG ───────────────────────────────────────────────────────────────

const apiConfig = {
  apiUrl:    'https://api-orbit.wordvirtua.com',
  apiKey:    'wrd_bff57b50eed406c33fab45a0189726b1',
  apiSecret: 'sk_f434ef95adbe1b10ec40c698074185452851896d880d45fff8f06373cfaf7e98',
};

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

// ─── API CALLER ──────────────────────────────────────────────────────────────

async function apiCall(endpoint, options = {}) {
  const { apiUrl, apiKey, apiSecret } = apiConfig;
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
}
