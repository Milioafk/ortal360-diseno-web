// Turnos de trabajo de los empleados. Se guardan en la base como: 'manana', 'tarde' o 'noche'.
// La jornada va de 06:00 a 22:00 y se reparte en 3 turnos seguidos.
// "inicio" y "fin" son el horario por defecto del turno (hora de Lima, 0-23; el fin no se incluye).
// Cada empleado puede tener su propio horario en usuarios.hora_inicio / usuarios.hora_fin.
export const TURNOS = {
  manana: { nombre: 'Mañana', inicio: 6,  fin: 12, icono: '☀️', saludo: 'Buenos días' },
  tarde:  { nombre: 'Tarde',  inicio: 12, fin: 17, icono: '🌇', saludo: 'Buenas tardes' },
  noche:  { nombre: 'Noche',  inicio: 17, fin: 22, icono: '🌙', saludo: 'Buenas noches' }
};

const dosDigitos = (n) => String(n).padStart(2, '0');

// Horario real de un empleado: el suyo si lo tiene, o el del turno por defecto.
export function horarioDe(clave, usuario) {
  const base = TURNOS[clave];
  if (!base) return null;
  const propio = usuario && usuario.hora_inicio != null && usuario.hora_fin != null;
  return {
    inicio: propio ? Number(usuario.hora_inicio) : base.inicio,
    fin: propio ? Number(usuario.hora_fin) : base.fin
  };
}

// Devuelve los datos del turno (con el horario del empleado si se pasa "usuario")
// o null si la clave no existe (por ejemplo, empleado sin turno).
export function infoTurno(clave, usuario) {
  const base = TURNOS[clave];
  if (!base) return null;
  const h = horarioDe(clave, usuario);
  return { ...base, ...h, horario: `${dosDigitos(h.inicio)}:00 – ${dosDigitos(h.fin)}:00` };
}

// Hora actual en Lima (0-23), sin importar la zona horaria del computador.
export function horaLima() {
  const hora = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  return Number(hora);
}

// true si la hora actual cae dentro del horario del empleado. Sin turno => false.
// Si el fin es menor que el inicio (ej. 22 → 6) el horario cruza la medianoche.
export function enTurno(clave, usuario, hora = horaLima()) {
  const h = horarioDe(clave, usuario);
  if (!h) return false;
  if (h.inicio === h.fin) return false;
  return h.inicio < h.fin ? (hora >= h.inicio && hora < h.fin) : (hora >= h.inicio || hora < h.fin);
}

// Turno al que pertenece una recarga según la hora en que se registra (horario por defecto de cada turno).
// Fuera de la jornada (antes de las 06:00 o desde las 22:00) pasa al turno mañana, el siguiente en atender.
export function turnoDeHora(hora = horaLima()) {
  for (const [clave, t] of Object.entries(TURNOS)) {
    if (hora >= t.inicio && hora < t.fin) return clave;
  }
  return 'manana';
}
