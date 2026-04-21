// ─── MOCK: HORÁRIOS ──────────────────────────────────────────────────────────

const MOCK_WORKING_DAYS = [
  { dayOfWeek: 0, isWorkingDay: false, timeSlots: [] },
  { dayOfWeek: 1, isWorkingDay: true, timeSlots: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '20:00' }] },
  { dayOfWeek: 2, isWorkingDay: true, timeSlots: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '20:00' }] },
  { dayOfWeek: 3, isWorkingDay: true, timeSlots: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '20:00' }] },
  { dayOfWeek: 4, isWorkingDay: true, timeSlots: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '20:00' }] },
  { dayOfWeek: 5, isWorkingDay: true, timeSlots: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '20:00' }] },
  { dayOfWeek: 6, isWorkingDay: true, timeSlots: [{ startTime: '09:00', endTime: '18:00' }] },
];

const MOCK_WORKING_DAYS_SAT_OFF = MOCK_WORKING_DAYS.map(d =>
  d.dayOfWeek === 6 ? { ...d, isWorkingDay: false, timeSlots: [] } : d
);

// ─── MOCK: SERVIÇOS ───────────────────────────────────────────────────────────

const MOCK_SERVICES = [
  // Cabelo & Barba
  { id: 'svc-001', category: 'Cabelo & Barba', name: 'Corte Masculino Premium',  details: 'Corte exclusivo com técnica Geometria do Corte',                           unitPrice: '65.00',  durationMinutes: 45, position: 1,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-002', category: 'Cabelo & Barba', name: 'Barboterapia',             details: 'Tratamento completo para barba com produtos premium',                      unitPrice: '55.00',  durationMinutes: 40, position: 2,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-003', category: 'Cabelo & Barba', name: 'Coloração ou Tonalização', details: 'Cabelo e barba com produtos de alta qualidade e técnica especializada',    unitPrice: '90.00',  durationMinutes: 90, position: 3,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=600&h=400&fit=crop&q=80' },
  // Estilo
  { id: 'svc-004', category: 'Estilo',         name: 'Visagismo',                details: 'Consultoria de estilo personalizada de acordo com seu rosto',              unitPrice: '120.00', durationMinutes: 60, position: 4,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-005', category: 'Estilo',         name: 'Sobrancelha',              details: 'Design e alinhamento de sobrancelha masculina',                            unitPrice: '30.00',  durationMinutes: 20, position: 5,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1541516160071-4bb0c5af65ba?w=600&h=400&fit=crop&q=80' },
  // Tratamentos
  { id: 'svc-006', category: 'Tratamentos',    name: 'Alinhamento Térmico',      details: 'Progressiva para cabelo com técnica especializada e produtos premium',     unitPrice: '110.00', durationMinutes: 90, position: 6,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-007', category: 'Tratamentos',    name: 'Tratamento Antiqueda',     details: 'Protocolo tricológico para fortalecimento capilar',                        unitPrice: '95.00',  durationMinutes: 60, position: 7,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-008', category: 'Tratamentos',    name: 'Terapia Capilar',          details: 'Hidratação profunda e nutrição dos fios',                                  unitPrice: '80.00',  durationMinutes: 50, position: 8,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1582095133179-bfd08e2fb6b8?w=600&h=400&fit=crop&q=80' },
  // Bem-estar
  { id: 'svc-009', category: 'Bem-estar',      name: 'Massagem Relaxante',       details: 'Alívio de tensões com técnicas de relaxamento profundo',                   unitPrice: '85.00',  durationMinutes: 50, position: 9,  isActive: true, imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-010', category: 'Bem-estar',      name: 'Massagem Desportiva',      details: 'Para recuperação muscular pós-treino e performance esportiva',             unitPrice: '95.00',  durationMinutes: 50, position: 10, isActive: true, imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-011', category: 'Bem-estar',      name: 'Reflexologia',             details: 'Técnica terapêutica que estimula pontos reflexos para bem-estar geral',    unitPrice: '75.00',  durationMinutes: 50, position: 11, isActive: true, imageUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-012', category: 'Bem-estar',      name: 'Liberação Miofascial',     details: 'Técnica manual para aliviar tensões profundas e restaurar mobilidade',     unitPrice: '90.00',  durationMinutes: 50, position: 12, isActive: true, imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-013', category: 'Bem-estar',      name: 'Depilação',                details: 'Depilação profissional com técnicas modernas e produtos hipoalergênicos',  unitPrice: '45.00',  durationMinutes: 30, position: 13, isActive: true, imageUrl: 'https://images.unsplash.com/photo-1607008829749-c0f284a49fc4?w=600&h=400&fit=crop&q=80' },
  { id: 'svc-014', category: 'Bem-estar',      name: 'Limpeza de Pele',          details: 'Protocolo profissional de cuidado facial masculino',                       unitPrice: '70.00',  durationMinutes: 45, position: 14, isActive: true, imageUrl: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&h=400&fit=crop&q=80' },
];

// ─── MOCK: EQUIPE ─────────────────────────────────────────────────────────────

const MOCK_EMPLOYEES = [
  { id: 'emp-001', name: 'Júlio Castro', position: 'Fundador & Mestre Barbeiro', specialty: 'Geometria do Corte · Visagismo · Tricologia',  initials: 'JC', bgColor: '#2a1f0a', isFounder: true,  workingHours: { enabled: true, timezone: 'America/Sao_Paulo', workingDays: MOCK_WORKING_DAYS } },
  { id: 'emp-002', name: 'César',        position: 'Barbeiro Sênior',            specialty: 'Cortes Clássicos · Navalhação',                initials: 'CS', bgColor: '#0a1a2a', isFounder: false, workingHours: { enabled: true, timezone: 'America/Sao_Paulo', workingDays: MOCK_WORKING_DAYS } },
  { id: 'emp-003', name: 'Yago',         position: 'Barbeiro',                   specialty: 'Cortes Modernos · Degradê',                    initials: 'YG', bgColor: '#1a0a2a', isFounder: false, workingHours: { enabled: true, timezone: 'America/Sao_Paulo', workingDays: MOCK_WORKING_DAYS } },
  { id: 'emp-004', name: 'Rafael',       position: 'Barbeiro',                   specialty: 'Barba & Bigode · Coloração',                   initials: 'RF', bgColor: '#0a2a1a', isFounder: false, workingHours: { enabled: true, timezone: 'America/Sao_Paulo', workingDays: MOCK_WORKING_DAYS } },
  { id: 'emp-005', name: 'Yasmin',       position: 'Barbeira & Visagista',       specialty: 'Visagismo · Sobrancelha · Limpeza de Pele',    initials: 'YS', bgColor: '#2a0a1a', isFounder: false, workingHours: { enabled: true, timezone: 'America/Sao_Paulo', workingDays: MOCK_WORKING_DAYS_SAT_OFF } },
];

// ─── MOCK: DEPOIMENTOS ────────────────────────────────────────────────────────

const MOCK_TESTIMONIALS = [
  { name: 'Lucas Cavalieri',  text: 'Cabelo muito bem tratado pelo profissional César! Recomendo a barbearia e o barbeiro!', stars: 5 },
  { name: 'Gabriel Marques',  text: 'Excelente atendimento do Profissional Yago! Atencioso com o cliente e suas preferências. Com certeza ganhou um cliente!', stars: 5 },
  { name: 'Guilherme Mores',  text: 'Fui atendido pelo Rafael e fiquei muito satisfeito. Ele é um profissional atencioso, cuidadoso e deu ótimas dicas.', stars: 5 },
  { name: 'Andre Moreira',    text: 'Atendimento excelente! A Yasmin foi muito simpática e mostrou conhecimento sobre visagismo. Ela dá sugestões para criar um visual harmônico.', stars: 5 },
  { name: 'Dani Moura',       text: 'Que experiência incrível! Eu e meu filho fomos muito bem atendidos. Os profissionais são extremamente capacitados!', stars: 5 },
  { name: 'Marcos Nogueira',  text: 'A Yasmim é sensacional. Atendimento top, corte e barba perfeitos, papo muito agradável. Veste a camisa da barbearia!', stars: 5 },
];

// ─── GALERIA ──────────────────────────────────────────────────────────────────

const GALLERY_ITEMS = [
  { label: 'Corte Masculino', img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&h=600&fit=crop&q=80' },
  { label: 'Barboterapia',    img: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&h=400&fit=crop&q=80' },
  { label: 'Visagismo',       img: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&h=400&fit=crop&q=80' },
  { label: 'Coloração',       img: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=600&h=400&fit=crop&q=80' },
  { label: 'Ambiente P47',    img: 'https://images.unsplash.com/photo-1521490533707-fc6e72e1bce4?w=900&h=400&fit=crop&q=80' },
  { label: 'Resultado Final', img: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&h=400&fit=crop&q=80' },
];
