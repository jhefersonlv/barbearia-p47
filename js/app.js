const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Dados mock carregados de data/mock.js (window.MOCK_SERVICES, etc.)

// ─── API CONFIG ──────────────────────────────────────────────────────

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

// ─── HELPERS ─────────────────────────────────────────────────────────

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_FULL  = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(date) {
  return date.toISOString().split('T')[0];
}

function fmtCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value || 0));
}

function fmtPhone(phone) {
  const c = phone.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;
  return phone;
}

function employeeWorksOnDay(emp, dayOfWeek) {
  if (!emp?.workingHours?.workingDays) return true;
  const wd = emp.workingHours.workingDays.find(d => d.dayOfWeek === dayOfWeek);
  return !!(wd && wd.isWorkingDay && wd.timeSlots?.length > 0);
}

// generateAllSlots, seededRandom, dateToSeed e mockApiCall
// estão definidos em data/mock.js e disponíveis via window.*

// ─── API CALLER (real → mock fallback) ───────────────────────────────

async function apiCall(endpoint, options = {}) {
  const { apiUrl, apiKey, apiSecret } = apiConfig;
  if (apiUrl && apiKey && apiSecret) {
    try {
      const resp = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key':    apiKey,
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

// ─── UI COMPONENTS ───────────────────────────────────────────────────

function GoldLine() {
  return <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,var(--gold),transparent)' }}/>;
}

function GoldDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,var(--gold-dark))' }}/>
      <div style={{ width: 6, height: 6, border: '1px solid var(--gold)', transform: 'rotate(45deg)' }}/>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--gold-dark),transparent)' }}/>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 32, height: 1, background: 'var(--gold)' }}/>
      <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );
}

function StarRating({ stars }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: stars }).map((_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="var(--gold)">
          <polygon points="6,1 7.5,4.5 11,4.8 8.5,7 9.2,10.5 6,8.7 2.8,10.5 3.5,7 1,4.8 4.5,4.5"/>
        </svg>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <div style={{ width: 28, height: 28, border: '2px solid #2a2a2a', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
    </div>
  );
}

function ServiceImage({ service, size = 64 }) {
  const [imgError, setImgError] = useState(false);
  const iconSize = Math.round(size * 0.45);
  if (service.imageUrl && !imgError) {
    return (
      <img
        src={service.imageUrl}
        alt={service.name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="var(--gold-dark)" opacity="0.6">
        <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>
      </svg>
    </div>
  );
}

// ─── CONFIG MODAL ────────────────────────────────────────────────────

function ConfigModal({ onClose, onSave }) {
  const [url,    setUrl]    = useState(apiConfig.apiUrl);
  const [key,    setKey]    = useState(apiConfig.apiKey);
  const [secret, setSecret] = useState(apiConfig.apiSecret);

  const handleSave = () => {
    saveApiConfig(url.trim().replace(/\/$/, ''), key.trim(), secret.trim());
    onSave();
    onClose();
  };

  const inputStyle = {
    width: '100%', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 2,
    padding: '10px 12px', color: 'var(--white)', fontSize: 13, fontFamily: 'Outfit',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--dark)', border: '1px solid #2a2a2a', borderRadius: 4, width: '100%', maxWidth: 440, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Playfair Display', fontSize: 18, fontWeight: 700 }}>Configurar API</div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #333', color: '#888', width: 32, height: 32, borderRadius: 2, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
          Configure as credenciais da API para usar dados reais. Sem configuração, o sistema usa dados de demonstração.
        </p>
        {[
          { label: 'URL da API',  value: url,    set: setUrl,    type: 'text',     ph: 'https://api.seusite.com' },
          { label: 'API Key',     value: key,    set: setKey,    type: 'text',     ph: 'wrd_...' },
          { label: 'API Secret',  value: secret, set: setSecret, type: 'password', ph: 'sk_...' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</label>
            <input
              type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--gold)'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1px solid #333', color: '#888', padding: '11px', cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} style={{ flex: 2, background: 'var(--gold)', color: 'var(--black)', border: 'none', padding: '11px', cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>Salvar & Conectar</button>
        </div>
      </div>
    </div>
  );
}

// ─── BOOKING MODAL ────────────────────────────────────────────────────

function BookingModal({ onClose, initialServices, initialEmployees }) {
  const [step, setStep]                 = useState(1);
  const [services, setServices]         = useState(initialServices || []);
  const [employees, setEmployees]       = useState(initialEmployees || []);
  const [catFilter, setCatFilter]       = useState('Todos');
  const [selectedSvcs, setSelectedSvcs] = useState([]);
  const [selectedEmp, setSelectedEmp]   = useState(null);
  const [weekStart, setWeekStart]       = useState(getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(null);
  const [allSlots, setAllSlots]         = useState([]);
  const [availSlots, setAvailSlots]     = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [obs, setObs]       = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [booked, setBooked]               = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [toast, setToast]                 = useState(null);

  useEffect(() => {
    if (!services.length)  apiCall('/external/v1/services').then(d => setServices(d.services || []));
    if (!employees.length) apiCall('/external/v1/booking/employees').then(d => setEmployees(d.employees || []));
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const cats = useMemo(() => {
    const hasCat = services.some(s => s.category);
    if (!hasCat) return [];
    return ['Todos', ...new Set(services.map(s => s.category).filter(Boolean))];
  }, [services]);

  const filteredSvcs = useMemo(() => {
    if (!cats.length || catFilter === 'Todos') return services.filter(s => s.isActive !== false);
    return services.filter(s => s.category === catFilter && s.isActive !== false);
  }, [services, cats, catFilter]);

  const selectedSvcsData = useMemo(() =>
    selectedSvcs.map(id => services.find(s => s.id === id)).filter(Boolean),
    [selectedSvcs, services]
  );
  const totalPrice    = selectedSvcsData.reduce((sum, s) => sum + parseFloat(s.unitPrice || 0), 0);
  const totalDuration = selectedSvcsData.reduce((sum, s) => sum + (s.durationMinutes || 60), 0);

  const toggleSvc = id => {
    setSelectedSvcs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const loadSlots = async (emp, date) => {
    if (!emp || !date) return;
    setSlotsLoading(true);
    setAllSlots([]);
    setAvailSlots([]);
    setSelectedSlot(null);
    try {
      const generated = generateAllSlots(emp, date.getDay(), totalDuration || 60);
      setAllSlots(generated);
      const svcIds = selectedSvcs.join(',');
      const data = await apiCall(`/external/v1/booking/slots?employeeId=${emp.id}&date=${fmtDate(date)}&serviceIds=${svcIds}`);
      setAvailSlots(data.availableSlots || []);
    } catch (err) {
      showToast('Erro ao carregar horários', 'error');
    } finally {
      setSlotsLoading(false);
    }
  };

  const selectDate = dateStr => {
    const d = new Date(dateStr + 'T12:00:00');
    setSelectedDate(d);
    setSelectedSlot(null);
    if (selectedEmp) loadSlots(selectedEmp, d);
  };

  const selectEmployee = emp => {
    setSelectedEmp(emp);
    setSelectedSlot(null);
    if (selectedDate) loadSlots(emp, selectedDate);
  };

  const navWeek = dir => {
    const ns    = new Date(weekStart);
    ns.setDate(ns.getDate() + dir * 7);
    const today = getWeekStart(new Date());
    if (ns >= today) {
      setWeekStart(ns);
      setSelectedDate(null);
      setSelectedSlot(null);
      setAllSlots([]);
      setAvailSlots([]);
    }
  };

  const canNext = () => {
    if (step === 1) return selectedSvcs.length > 0;
    if (step === 2) return !!(selectedEmp && selectedDate && selectedSlot);
    if (step === 3) return name.trim().length > 1 && phone.trim().replace(/\D/g, '').length >= 10;
    return false;
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await apiCall('/external/v1/booking', {
        method: 'POST',
        body: JSON.stringify({
          employeeId:    selectedEmp.id,
          date:          fmtDate(selectedDate),
          time:          selectedSlot.startTime,
          serviceIds:    selectedSvcs,
          customerName:  name.trim(),
          customerEmail: email.trim() || undefined,
          customerPhone: phone.replace(/\D/g, '') || undefined,
          observation:   obs.trim() || undefined,
          createOrder:   false,
        }),
      });
      setBookingResult(result);
      setBooked(true);
    } catch (err) {
      showToast(err.message || 'Erro ao confirmar agendamento', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const inputSt = {
    width: '100%', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 2,
    padding: '11px 13px', color: 'var(--white)', fontSize: 14, fontFamily: 'Outfit',
  };

  const stepLabels = ['Serviços', 'Agendamento', 'Seus dados', 'Confirmar'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--dark)', border: '1px solid #2a2a2a', borderRadius: 4, width: '100%', maxWidth: 740, maxHeight: '92vh', display: 'flex', flexDirection: 'column', position: 'relative', animation: 'fadeIn 0.2s ease' }}>

        {/* Header */}
        <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--gold)', fontSize: 11, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Barbearia P47</div>
              <div style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700 }}>Agendar Horário</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #333', color: '#888', width: 36, height: 36, borderRadius: 2, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          {!booked && (
            <div style={{ display: 'flex', gap: 0, marginTop: 24 }}>
              {stepLabels.map((label, i) => {
                const n      = i + 1;
                const active = step === n;
                const done   = step > n;
                return (
                  <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {i < stepLabels.length - 1 && (
                      <div style={{ position: 'absolute', top: 14, left: '50%', right: '-50%', height: 1, background: done ? 'var(--gold)' : '#2a2a2a', transition: 'background 0.3s' }}/>
                    )}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'var(--gold)' : active ? 'transparent' : '#1a1a1a', border: `1.5px solid ${done || active ? 'var(--gold)' : '#333'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: done ? 'var(--black)' : active ? 'var(--gold)' : '#555', zIndex: 1, transition: 'all 0.3s' }}>
                      {done ? '✓' : n}
                    </div>
                    <div style={{ fontSize: 10, color: active ? 'var(--gold)' : done ? '#888' : '#555', marginTop: 6, fontWeight: active ? 600 : 400 }}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

          {/* SUCCESS */}
          {booked ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 64, height: 64, border: '2px solid var(--gold)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28, color: 'var(--gold)' }}>✓</div>
              <div style={{ fontFamily: 'Playfair Display', fontSize: 26, marginBottom: 8 }}>Agendamento Confirmado!</div>
              {bookingResult && (
                <div style={{ color: '#888', fontSize: 14, lineHeight: 2, marginBottom: 28 }}>
                  <div>{selectedSvcsData.map(s => s.name).join(' + ')}</div>
                  <div>com <strong style={{ color: 'var(--white)' }}>{bookingResult.employeeName}</strong></div>
                  <div>{DAY_FULL[selectedDate?.getDay()]}, {selectedDate?.toLocaleDateString('pt-BR')} às <strong style={{ color: 'var(--gold)' }}>{selectedSlot?.startTime}</strong></div>
                  <div style={{ marginTop: 4 }}>Total: <strong style={{ color: 'var(--gold)' }}>{fmtCurrency(bookingResult.totalPrice)}</strong></div>
                  {bookingResult.orderDisplayNumber && <div>Pedido: <strong style={{ color: 'var(--white)' }}>#{bookingResult.orderDisplayNumber}</strong></div>}
                </div>
              )}
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3, padding: 20, fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 1.7 }}>
                Você receberá confirmação via WhatsApp em breve.<br/>
                Dúvidas? <a href="https://wa.me/5512981365015" style={{ color: 'var(--gold)', textDecoration: 'none' }}>(12) 98136-5015</a>
              </div>
              <button onClick={onClose} style={{ background: 'var(--gold)', color: 'var(--black)', border: 'none', padding: '12px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit' }}>Fechar</button>
            </div>

          /* STEP 1 — Serviços */
          ) : step === 1 ? (
            <div>
              {cats.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {cats.map(c => (
                    <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '6px 14px', borderRadius: 2, border: '1px solid', borderColor: catFilter === c ? 'var(--gold)' : '#2a2a2a', background: catFilter === c ? 'rgba(201,168,76,0.1)' : 'transparent', color: catFilter === c ? 'var(--gold)' : '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: catFilter === c ? 600 : 400 }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {filteredSvcs.map(s => {
                  const sel = selectedSvcs.includes(s.id);
                  return (
                    <div key={s.id} onClick={() => toggleSvc(s.id)} style={{ padding: '14px 16px', border: '1px solid', borderColor: sel ? 'var(--gold)' : '#2a2a2a', borderRadius: 3, cursor: 'pointer', background: sel ? 'rgba(201,168,76,0.06)' : '#161616', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s' }}>
                      <ServiceImage service={s} size={72}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2, color: sel ? 'var(--white)' : '#ccc' }}>{s.name}</div>
                        {s.details && <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>{s.details}</div>}
                        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>⏱ {s.durationMinutes || 60} min</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 16, fontFamily: 'Playfair Display' }}>{fmtCurrency(s.unitPrice)}</div>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? 'var(--gold)' : '#333'}`, background: sel ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginTop: 6, fontSize: 11, color: 'var(--black)', fontWeight: 700, transition: 'all 0.2s' }}>
                          {sel ? '✓' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedSvcs.length > 0 && (
                <div style={{ marginTop: 20, padding: '14px 16px', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#888' }}>{selectedSvcs.length} serviço{selectedSvcs.length > 1 ? 's' : ''} selecionado{selectedSvcs.length > 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fmtCurrency(totalPrice)} · {totalDuration} min</span>
                  </div>
                </div>
              )}
            </div>

          /* STEP 2 — Data + Profissional + Horário */
          ) : step === 2 ? (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Escolha o dia</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => navWeek(-1)} style={{ width: 36, height: 36, background: 'none', border: '1px solid #2a2a2a', borderRadius: 2, color: '#888', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
                  <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto' }}>
                    {weekDays.map((d, i) => {
                      const past = d < today;
                      const sel  = selectedDate && fmtDate(d) === fmtDate(selectedDate);
                      return (
                        <button key={i} disabled={past} onClick={() => selectDate(fmtDate(d))} style={{ flexShrink: 0, flex: 1, minWidth: 52, padding: '10px 6px', border: '1px solid', borderColor: sel ? 'var(--gold)' : '#2a2a2a', background: sel ? 'rgba(201,168,76,0.1)' : '#161616', borderRadius: 2, cursor: past ? 'not-allowed' : 'pointer', textAlign: 'center', opacity: past ? 0.35 : 1, transition: 'all 0.2s' }}>
                          <div style={{ fontSize: 10, color: sel ? 'var(--gold)' : '#666', textTransform: 'uppercase', marginBottom: 4 }}>{DAY_SHORT[d.getDay()]}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Playfair Display', color: sel ? 'var(--gold)' : '#aaa', lineHeight: 1 }}>{d.getDate()}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => navWeek(1)} style={{ width: 36, height: 36, background: 'none', border: '1px solid #2a2a2a', borderRadius: 2, color: '#888', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>→</button>
                </div>
              </div>

              {selectedDate && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Escolha o profissional</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                    {employees.map(emp => {
                      const works = employeeWorksOnDay(emp, selectedDate.getDay());
                      const isSel = selectedEmp?.id === emp.id;
                      const bg    = emp.bgColor || '#1a1a1a';
                      const inits = emp.initials || emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div key={emp.id} onClick={() => works && selectEmployee(emp)} style={{ padding: 16, border: '1px solid', borderColor: isSel ? 'var(--gold)' : '#2a2a2a', borderRadius: 3, cursor: works ? 'pointer' : 'not-allowed', background: isSel ? 'rgba(201,168,76,0.06)' : '#161616', textAlign: 'center', opacity: works ? 1 : 0.45, transition: 'all 0.2s' }}>
                          <div style={{ width: 52, height: 52, borderRadius: '50%', background: bg, border: `2px solid ${isSel ? 'var(--gold)' : '#2a2a2a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontFamily: 'Playfair Display', fontSize: 17, fontWeight: 700, color: 'rgba(201,168,76,0.7)' }}>{inits}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isSel ? 'var(--white)' : '#ccc', marginBottom: 3 }}>{emp.name}</div>
                          <div style={{ fontSize: 11, color: '#666' }}>{emp.position}</div>
                          {!works && <div style={{ fontSize: 10, color: '#c44', marginTop: 4 }}>Não disponível</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDate && selectedEmp && (
                <div>
                  <div style={{ fontSize: 12, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Horários disponíveis</div>
                  {slotsLoading ? <Spinner/> : allSlots.length === 0 ? (
                    <div style={{ color: '#555', fontSize: 13, padding: 16, textAlign: 'center' }}>Nenhum horário configurado para este dia</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(() => {
                        const availSet = new Set(availSlots.map(s => s.startTime));
                        return allSlots.map(slot => {
                          const avail = availSet.has(slot.startTime);
                          const isSel = selectedSlot?.startTime === slot.startTime;
                          return (
                            <button key={slot.startTime} disabled={!avail} onClick={() => setSelectedSlot(slot)} style={{ padding: '10px 16px', border: '1px solid', borderColor: isSel ? 'var(--gold)' : avail ? '#2a2a2a' : '#1e1e1e', borderRadius: 2, background: isSel ? 'rgba(201,168,76,0.12)' : avail ? '#161616' : '#111', color: isSel ? 'var(--gold)' : avail ? '#aaa' : '#333', fontSize: 13, cursor: avail ? 'pointer' : 'not-allowed', fontFamily: 'Outfit', fontWeight: isSel ? 600 : 400, textDecoration: !avail ? 'line-through' : 'none', transition: 'all 0.2s' }}>
                              {slot.startTime}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              )}

              {!selectedDate && (
                <div style={{ textAlign: 'center', padding: 24, color: '#555', fontSize: 13 }}>Selecione um dia para ver os profissionais disponíveis</div>
              )}
            </div>

          /* STEP 3 — Dados do cliente */
          ) : step === 3 ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 3, padding: '12px 16px', fontSize: 13, color: '#888', marginBottom: 4 }}>
                {selectedSvcsData.map(s => s.name).join(' + ')} · com <strong style={{ color: 'var(--white)' }}>{selectedEmp?.name}</strong> · {selectedDate?.toLocaleDateString('pt-BR')} às <strong style={{ color: 'var(--gold)' }}>{selectedSlot?.startTime}</strong>
              </div>
              {[
                { label: 'Seu nome *',  value: name,  set: setName,  type: 'text',  ph: 'Nome completo' },
                { label: 'WhatsApp *',  value: phone, set: setPhone, type: 'tel',   ph: '(12) 9XXXX-XXXX' },
                { label: 'E-mail',      value: email, set: setEmail, type: 'email', ph: 'seu@email.com' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontSize: 11, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputSt}
                    onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={e => e.target.style.borderColor = '#2a2a2a'}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Observação</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Alguma preferência ou observação?" rows={3}
                  style={{ ...inputSt, resize: 'vertical' }}
                  onFocus={e => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={e => e.target.style.borderColor = '#2a2a2a'}
                />
              </div>
            </div>

          /* STEP 4 — Confirmação */
          ) : (
            <div>
              <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 3, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Resumo do agendamento</div>
                {[
                  { label: 'Data',         value: selectedDate && `${DAY_FULL[selectedDate.getDay()]}, ${selectedDate.toLocaleDateString('pt-BR')}` },
                  { label: 'Horário',      value: selectedSlot && `${selectedSlot.startTime} — ${selectedSlot.endTime}`, gold: true },
                  { label: 'Profissional', value: selectedEmp?.name },
                  { label: 'Cliente',      value: name },
                  { label: 'WhatsApp',     value: fmtPhone(phone) },
                  email && { label: 'E-mail', value: email },
                ].filter(Boolean).map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #2a2a2a' }}>
                    <span style={{ fontSize: 13, color: '#888' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: row.gold ? 'var(--gold)' : 'var(--white)' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Serviços</div>
                  {selectedSvcsData.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                      <span style={{ color: '#ccc' }}>{s.name}</span>
                      <span style={{ color: 'var(--gold)' }}>{fmtCurrency(s.unitPrice)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2a2a' }}>
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 18, fontFamily: 'Playfair Display' }}>{fmtCurrency(totalPrice)}</span>
                </div>
              </div>
              {obs && (
                <div style={{ fontSize: 13, color: '#666', background: '#111', border: '1px solid #1e1e1e', borderRadius: 3, padding: '10px 14px' }}>
                  <span style={{ color: '#555' }}>Obs.: </span>{obs}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!booked && (
          <div style={{ padding: '16px 32px 24px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: '1px solid #2a2a2a', color: '#888', padding: '10px 20px', cursor: 'pointer', fontSize: 13, borderRadius: 2, fontFamily: 'Outfit' }}>← Voltar</button>
            ) : <div/>}
            {step < 4 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{ background: canNext() ? 'var(--gold)' : '#1e1e1e', color: canNext() ? 'var(--black)' : '#444', border: 'none', padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: canNext() ? 'pointer' : 'not-allowed', borderRadius: 2, fontFamily: 'Outfit', letterSpacing: '0.05em', transition: 'all 0.2s' }}>
                Continuar →
              </button>
            ) : (
              <button onClick={handleConfirm} disabled={submitting} style={{ background: submitting ? '#333' : 'var(--gold)', color: submitting ? '#888' : 'var(--black)', border: 'none', padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', borderRadius: 2, fontFamily: 'Outfit', letterSpacing: '0.05em', transition: 'all 0.2s' }}>
                {submitting ? 'Aguarde...' : 'Confirmar Agendamento'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#c0392b' : '#1e1e1e', color: 'var(--white)', border: '1px solid #333', padding: '12px 24px', borderRadius: 3, fontSize: 13, zIndex: 3000, animation: 'fadeIn 0.2s ease', maxWidth: 320, textAlign: 'center' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────

function Nav({ onBook, onConfig }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  const links = [['Sobre','#sobre'],['Serviços','#servicos'],['Equipe','#equipe'],['Galeria','#galeria'],['Depoimentos','#depoimentos'],['Localização','#localiza']];
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? 'rgba(8,8,8,0.97)' : 'transparent', borderBottom: scrolled ? '1px solid #1e1e1e' : '1px solid transparent', padding: '0 40px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.4s', backdropFilter: scrolled ? 'blur(12px)' : 'none' }}>
      <div style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em' }}>
        <span style={{ color: 'var(--white)' }}>P</span><span style={{ color: 'var(--gold)' }}>47</span>
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {links.map(([l, h]) => (
          <a key={l} href={h} style={{ color: '#aaa', textDecoration: 'none', fontSize: 13, fontWeight: 400, letterSpacing: '0.05em', transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color = 'var(--gold)'} onMouseLeave={e => e.target.style.color = '#aaa'}>{l}</a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={onConfig} title="Configurar API" style={{ background: 'none', border: '1px solid #2a2a2a', color: '#666', width: 36, height: 36, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dark)'; e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666'; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button onClick={onBook} style={{ background: 'var(--gold)', color: 'var(--black)', border: 'none', padding: '10px 22px', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', transition: 'background 0.2s' }}
          onMouseEnter={e => e.target.style.background = 'var(--gold-light)'} onMouseLeave={e => e.target.style.background = 'var(--gold)'}>
          AGENDAR
        </button>
      </div>
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────

function Hero({ onBook }) {
  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: 'var(--black)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(201,168,76,0.04) 80px),repeating-linear-gradient(90deg,transparent,transparent 79px,rgba(201,168,76,0.04) 80px)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '30vh', background: 'linear-gradient(180deg,var(--gold),transparent)' }}/>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 40px 80px', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ width: 40, height: 1, background: 'var(--gold)' }}/>
            <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase' }}>Barbearia P47 · Vila Ema · SJC</span>
          </div>
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(42px,5vw,68px)', fontWeight: 700, lineHeight: 1.1, marginBottom: 24 }}>
            Seu estilo,<br/><em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>nossa missão.</em>
          </h1>
          <p style={{ color: '#888', fontSize: 17, lineHeight: 1.8, marginBottom: 40, maxWidth: 440 }}>
            Corte, barba, visagismo e tricologia em um ambiente moderno e sofisticado. O cuidado que o homem contemporâneo merece.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onBook} style={{ background: 'var(--gold)', color: 'var(--black)', border: 'none', padding: '16px 32px', fontWeight: 700, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', transition: 'all 0.2s' }}
              onMouseEnter={e => e.target.style.background = 'var(--gold-light)'} onMouseLeave={e => e.target.style.background = 'var(--gold)'}>
              Agendar Agora
            </button>
            <a href="https://wa.me/5512981365015" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--white)'} onMouseLeave={e => e.currentTarget.style.color = '#888'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              (12) 98136-5015
            </a>
          </div>
          <div style={{ display: 'flex', gap: 40, marginTop: 56, paddingTop: 40, borderTop: '1px solid #1e1e1e' }}>
            {[['20+', 'Anos de experiência'], ['5', 'Profissionais'], ['12', 'Serviços']].map(([n, l]) => (
              <div key={n}>
                <div style={{ fontFamily: 'Playfair Display', fontSize: 32, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ aspectRatio: '3/4', background: 'var(--dark2)', border: '1px solid #2a2a2a', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <img
              src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&h=1067&fit=crop&q=80"
              alt="Júlio Castro — Fundador & Mestre Barbeiro"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', top: 16, left: 16, width: 32, height: 32, borderTop: '2px solid var(--gold)', borderLeft: '2px solid var(--gold)' }}/>
            <div style={{ position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderBottom: '2px solid var(--gold)', borderRight: '2px solid var(--gold)' }}/>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 24px 28px', background: 'linear-gradient(0deg,rgba(0,0,0,0.9) 70%,transparent)' }}>
              <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Júlio Castro</div>
              <div style={{ fontSize: 12, color: 'var(--gold)' }}>Fundador & Mestre Barbeiro</div>
            </div>
          </div>
          <div style={{ position: 'absolute', top: -20, right: -20, background: 'var(--gold)', color: 'var(--black)', borderRadius: '50%', width: 88, height: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 10, fontWeight: 700, lineHeight: 1.3, letterSpacing: '0.05em' }}>
            <div style={{ fontSize: 18, fontFamily: 'Playfair Display', fontWeight: 700 }}>20+</div>
            <div style={{ textTransform: 'uppercase' }}>anos de mercado</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.5 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#888', textTransform: 'uppercase' }}>scroll</div>
        <div style={{ width: 1, height: 40, background: 'linear-gradient(180deg,var(--gold),transparent)', animation: 'pulse 2s infinite' }}/>
      </div>
    </section>
  );
}

// ─── ABOUT ────────────────────────────────────────────────────────────

function About() {
  return (
    <section id="sobre" style={{ padding: '100px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <div>
          <SectionLabel>Sobre a P47</SectionLabel>
          <h2 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(32px,3.5vw,48px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 24 }}>
            Tradição e modernidade em um ambiente sofisticado
          </h2>
          <p style={{ color: '#888', lineHeight: 1.9, marginBottom: 20 }}>
            A P47 nasceu da visão de Júlio Castro: criar um espaço onde o cuidado masculino vai além da estética. Aqui, cada visita é uma experiência completa — de um ambiente cuidado a profissionais apaixonados pelo que fazem.
          </p>
          <p style={{ color: '#888', lineHeight: 1.9, marginBottom: 32 }}>
            Com o método exclusivo <strong style={{ color: 'var(--white)' }}>Geometria do Corte e Geometria da Barba</strong>, desenvolvemos estilos que respeitam a harmonia de cada rosto — porque beleza masculina é ciência e arte.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {['Profissionais especializados', 'Ambiente moderno', 'Atendimento personalizado', 'Localização privilegiada'].map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#aaa' }}>
                <div style={{ width: 6, height: 6, background: 'var(--gold)', flexShrink: 0 }}/>{d}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 12 }}>
          {/* Item grande: ocupa col 1, linhas 1–2 */}
          {[
            { label: 'Júlio Castro', img: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&h=900&fit=crop&q=80',  style: { gridRow: '1/3', gridColumn: '1' } },
            { label: 'Equipe',       img: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=400&fit=crop&q=80',  style: { gridRow: '1',   gridColumn: '2' } },
            { label: 'Ambiente',     img: 'https://images.unsplash.com/photo-1521490533707-fc6e72e1bce4?w=400&h=400&fit=crop&q=80',  style: { gridRow: '2',   gridColumn: '2' } },
          ].map((item, i) => (
            <div key={i} style={{ aspectRatio: i === 0 ? '3/4' : '1', background: 'var(--dark2)', border: '1px solid #2a2a2a', borderRadius: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 12, position: 'relative', overflow: 'hidden', ...item.style }}>
              <img src={item.img} alt={item.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
              {i === 0 && <div style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, border: '1px solid rgba(201,168,76,0.3)', borderRadius: 2 }}/>}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,0.75) 0%,transparent 50%)' }}/>
              <span style={{ position: 'relative', fontSize: 11, color: '#ccc', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SERVICES SECTION ─────────────────────────────────────────────────

function Services({ services, onBook }) {
  const cats = useMemo(() => {
    const hasCat = services.some(s => s.category);
    if (!hasCat) return [];
    return [...new Set(services.map(s => s.category).filter(Boolean))];
  }, [services]);

  const [activeCat, setActiveCat] = useState('');
  useEffect(() => { if (cats.length) setActiveCat(cats[0]); }, [cats]);

  const filtered = useMemo(() => {
    const active = services.filter(s => s.isActive !== false);
    if (!cats.length || !activeCat) return active;
    return active.filter(s => s.category === activeCat);
  }, [services, cats, activeCat]);

  return (
    <section id="servicos" style={{ background: 'var(--dark)', padding: '100px 0' }}>
      <GoldLine/>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <SectionLabel>Nossos Serviços</SectionLabel>
          <h2 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(32px,3.5vw,48px)', fontWeight: 700, marginBottom: 16 }}>Tabela de Serviços</h2>
          <p style={{ color: '#888', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>Escolha entre nossos serviços premium. Todos realizados por profissionais certificados.</p>
        </div>
        {cats.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 48, flexWrap: 'wrap' }}>
            {cats.map(c => (
              <button key={c} onClick={() => setActiveCat(c)} style={{ padding: '10px 22px', border: '1px solid', borderColor: activeCat === c ? 'var(--gold)' : '#2a2a2a', background: activeCat === c ? 'rgba(201,168,76,0.08)' : 'transparent', color: activeCat === c ? 'var(--gold)' : '#888', fontSize: 13, cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', fontWeight: activeCat === c ? 600 : 400, transition: 'all 0.2s' }}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
          {filtered.map(s => (
            <div key={s.id} className="svc-card" style={{ background: 'var(--dark)', border: '1px solid #1e1e1e', borderRadius: 4, overflow: 'hidden', transition: 'border-color 0.3s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold-dark)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e1e'}>
              <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#111' }}>
                {s.imageUrl
                  ? <img className="svc-img" src={s.imageUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}/>
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--gold)"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64z"/></svg>
                    </div>
                }
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(201,168,76,0.5)', color: 'var(--gold)', padding: '4px 10px', fontSize: 14, fontWeight: 700, fontFamily: 'Playfair Display', borderRadius: 2 }}>
                  {fmtCurrency(s.unitPrice)}
                </div>
              </div>
              <div style={{ padding: '20px 22px 22px' }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--white)' }}>{s.name}</div>
                {s.details && <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 }}>{s.details}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#555', background: '#1a1a1a', padding: '4px 8px', borderRadius: 2 }}>⏱ {s.durationMinutes || 60} min</span>
                  <button onClick={onBook} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600, padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>Agendar →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={onBook} style={{ background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold)', padding: '14px 36px', fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', textTransform: 'uppercase', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.target.style.background = 'var(--gold)'; e.target.style.color = 'var(--black)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--gold)'; }}>
            Agendar um Serviço
          </button>
        </div>
      </div>
      <GoldLine/>
    </section>
  );
}

// ─── TEAM SECTION ─────────────────────────────────────────────────────

function Team({ employees, onBook }) {
  return (
    <section id="equipe" style={{ padding: '100px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <SectionLabel>Nossa Equipe</SectionLabel>
        <h2 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(32px,3.5vw,48px)', fontWeight: 700, marginBottom: 16 }}>Profissionais Especializados</h2>
        <p style={{ color: '#888', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>Cada profissional da P47 é treinado e certificado, apaixonado pelo cuidado masculino.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 20 }}>
        {employees.map((t, idx) => {
          const inits = t.initials || t.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          const bg    = t.bgColor || ['#2a1f0a', '#0a1a2a', '#1a0a2a', '#0a2a1a', '#2a0a1a'][idx % 5];
          const spec  = t.specialty || t.position || '';
          return (
            <div key={t.id} style={{ border: '1px solid #1e1e1e', borderRadius: 4, overflow: 'hidden', transition: 'border-color 0.3s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold-dark)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e1e'}>
              <div style={{ aspectRatio: '3/4', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ fontFamily: 'Playfair Display', fontSize: 52, fontWeight: 700, color: 'rgba(201,168,76,0.3)' }}>{inits}</span>
                {(t.isFounder || idx === 0) && <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--gold)', color: 'var(--black)', fontSize: 9, fontWeight: 700, padding: '4px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Fundador</div>}
              </div>
              <div style={{ padding: '20px 20px 24px' }}>
                <div style={{ fontFamily: 'Playfair Display', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 10, fontWeight: 500 }}>{t.position || t.role}</div>
                {spec && <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>{spec}</div>}
                <button onClick={onBook} style={{ width: '100%', background: 'none', border: '1px solid #2a2a2a', color: '#888', padding: '9px', fontSize: 12, cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', fontWeight: 500, transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.target.style.borderColor = 'var(--gold)'; e.target.style.color = 'var(--gold)'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.color = '#888'; }}>
                  Agendar com {t.name.split(' ')[0]}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── GALLERY ─────────────────────────────────────────────────────────

// GALLERY_ITEMS está definido em data/mock.js

function Gallery() {
  return (
    <section id="galeria" style={{ background: 'var(--dark)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 60 }}>
          <SectionLabel>Galeria</SectionLabel>
          <h2 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(32px,3.5vw,48px)', fontWeight: 700 }}>Nosso Trabalho</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,220px)', gap: 12 }}>
          {GALLERY_ITEMS.map((item, i) => (
            <div key={i} className="gallery-item" style={{ background: 'var(--dark2)', border: '1px solid #2a2a2a', borderRadius: 3, display: 'flex', alignItems: 'flex-end', padding: 16, position: 'relative', overflow: 'hidden' }}>
              <img className="gallery-img" src={item.img} alt={item.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}/>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,0.75) 0%,transparent 55%)' }}/>
              <span style={{ position: 'relative', fontSize: 12, color: '#ccc', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────

function Testimonials() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % MOCK_TESTIMONIALS.length), 4500);
    return () => clearInterval(t);
  }, []);
  return (
    <section id="depoimentos" style={{ padding: '100px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <SectionLabel>Depoimentos</SectionLabel>
        <h2 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(32px,3.5vw,48px)', fontWeight: 700 }}>O que dizem nossos clientes</h2>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--gold)', opacity: 0.3, fontFamily: 'Georgia', lineHeight: 1, marginBottom: 16 }}>"</div>
        <p style={{ fontFamily: 'Playfair Display', fontSize: 20, fontStyle: 'italic', lineHeight: 1.7, color: '#ddd', marginBottom: 24, minHeight: 80 }}>{MOCK_TESTIMONIALS[active].text}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--dark3)', border: '1px solid var(--gold-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
            {MOCK_TESTIMONIALS[active].name[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{MOCK_TESTIMONIALS[active].name}</div>
            <StarRating stars={MOCK_TESTIMONIALS[active].stars}/>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 48 }}>
        {MOCK_TESTIMONIALS.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} style={{ width: i === active ? 24 : 8, height: 8, borderRadius: 4, background: i === active ? 'var(--gold)' : '#2a2a2a', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }}/>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {MOCK_TESTIMONIALS.map((t, i) => (
          <div key={i} style={{ background: 'var(--dark)', border: '1px solid #1e1e1e', borderRadius: 3, padding: 24, transition: 'border-color 0.3s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e1e'}>
            <StarRating stars={t.stars}/>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.7, margin: '12px 0' }}>{t.text}</p>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#bbb' }}>{t.name}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── LOCATION ─────────────────────────────────────────────────────────

function Location() {
  return (
    <section id="localiza" style={{ background: 'var(--dark)', padding: '100px 40px' }}>
      <GoldLine/>
      <div style={{ maxWidth: 1200, margin: '60px auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <SectionLabel>Localização</SectionLabel>
            <h2 style={{ fontFamily: 'Playfair Display', fontSize: 'clamp(28px,3vw,42px)', fontWeight: 700, marginBottom: 32 }}>Como nos encontrar</h2>
            <div style={{ display: 'grid', gap: 24 }}>
              {[
                { icon: '📍', title: 'Endereço',  info: 'R. Comendador Remo Cesaroni, 301\nVila Ema, São José dos Campos – SP\nCEP 12243-020' },
                { icon: '📱', title: 'WhatsApp',  info: '(12) 98136-5015' },
                { icon: '🕐', title: 'Horário',   info: 'Seg–Sex: 9h às 20h\nSábado: 9h às 18h' },
                { icon: '📸', title: 'Instagram', info: '@barbershopp47' },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, border: '1px solid #2a2a2a', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: '#161616' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{item.info}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 36 }}>
              <a href="https://wa.me/5512981365015" style={{ display: 'inline-block', background: 'var(--gold)', color: 'var(--black)', textDecoration: 'none', padding: '14px 28px', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 2 }}>Falar no WhatsApp</a>
            </div>
          </div>
          <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 4, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,#1e1e1e 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#1e1e1e 40px)', opacity: 0.5 }}/>
            <div style={{ position: 'relative', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>Vila Ema, São José dos Campos</div>
              <div style={{ fontSize: 12, color: '#555' }}>R. Comendador Remo Cesaroni, 301</div>
              <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4515.632529445664!2d-45.9093907751725!3d-23.205426973360147!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cc4a7772dab253%3A0x5c50ee87825188ee!2sBarbearia%20P47!5e0!3m2!1spt-BR!2sus!4v1776720201329!5m2!1spt-BR!2sus" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
              <a href="https://maps.google.com/?q=Barbearia+P47+São+José+dos+Campos" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 16, color: 'var(--gold)', fontSize: 12, textDecoration: 'none', border: '1px solid var(--gold-dark)', padding: '8px 16px', borderRadius: 2, fontWeight: 500 }}>Ver no Google Maps →</a>
            </div>
          </div>
        </div>
      </div>
      <GoldLine/>
    </section>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────────────

function Footer({ onBook }) {
  return (
    <footer style={{ background: 'var(--black)', padding: '60px 40px 30px', borderTop: '1px solid #1a1a1a' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 60, marginBottom: 60 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
              <span style={{ color: 'var(--white)' }}>P</span><span style={{ color: 'var(--gold)' }}>47</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>Barbearia P47 · Vila Ema</div>
            <p style={{ color: '#666', fontSize: 13, lineHeight: 1.8, maxWidth: 300, marginTop: 16 }}>Corte, barba, visagismo e tricologia em São José dos Campos. Estilo com propósito.</p>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Serviços</div>
            {['Corte Premium', 'Barboterapia', 'Visagismo', 'Coloração', 'Massagem'].map(l => (
              <div key={l} style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>{l}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Contato</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>Seg–Sex: 9h–20h</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>Sábado: 9h–18h</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>(12) 98136-5015</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>@barbershopp47</div>
            <button onClick={onBook} style={{ background: 'var(--gold)', color: 'var(--black)', border: 'none', padding: '10px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 2, fontFamily: 'Outfit', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Agendar</button>
          </div>
        </div>
        <GoldLine/>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#444' }}>
          <span>© 2025 Barbearia P47 · São José dos Campos</span>
          <span>Todos os direitos reservados</span>
        </div>
      </div>
    </footer>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────

function App() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [configOpen, setConfigOpen]   = useState(false);
  const [services, setServices]       = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [usingMock, setUsingMock]     = useState(false);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const noApi = !apiConfig.apiUrl || !apiConfig.apiKey || !apiConfig.apiSecret;
    if (noApi) setUsingMock(true);
    try {
      const [svcData, empData] = await Promise.all([
        apiCall('/external/v1/services'),
        apiCall('/external/v1/booking/employees'),
      ]);
      setServices(svcData.services || []);
      setEmployees(empData.employees || []);
    } catch {
      setServices(MOCK_SERVICES);
      setEmployees(MOCK_EMPLOYEES);
      setUsingMock(true);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBook = useCallback(() => setBookingOpen(true), []);

  return (
    <>
      {usingMock && !dataLoading && (
        <div style={{ position: 'fixed', bottom: 80, right: 24, zIndex: 200, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3, padding: '8px 14px', fontSize: 11, color: '#666', letterSpacing: '0.05em' }}>
          ✦ Modo demonstração
        </div>
      )}

      <Nav onBook={handleBook} onConfig={() => setConfigOpen(true)}/>
      <Hero onBook={handleBook}/>
      <About/>

      {dataLoading
        ? <div style={{ background: 'var(--dark)', padding: '80px 40px', textAlign: 'center' }}><Spinner/></div>
        : <Services services={services} onBook={handleBook}/>
      }

      {!dataLoading && <Team employees={employees} onBook={handleBook}/>}

      <Gallery/>
      <Testimonials/>
      <Location/>
      <Footer onBook={handleBook}/>

      {bookingOpen && (
        <BookingModal
          onClose={() => setBookingOpen(false)}
          initialServices={services}
          initialEmployees={employees}
        />
      )}

      {configOpen && (
        <ConfigModal
          onClose={() => setConfigOpen(false)}
          onSave={() => loadData()}
        />
      )}

      {/* WhatsApp FAB */}
      <a href="https://wa.me/5512981365015" style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 200, background: '#25D366', color: 'white', width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,211,102,0.4)', transition: 'transform 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
