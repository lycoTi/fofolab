/**
 * Nascer e pôr do sol para a roupa do Fofo (fazendeiro de dia, explorador ao anoitecer, madrugada à noite).
 * Sem pedir localização: o fuso do computador aponta uma cidade de referência — dá uns 30 minutos de folga numa área
 * grande, o bastante para trocar de roupa. Funciona sem internet.
 */
export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

/** Uma cidade por fuso brasileiro (e o de Portugal); fuso fora da lista cai no horário padrão 06:00–18:00. */
const TIME_ZONE_COORDS: Record<string, { lat: number; lon: number }> = {
  'America/Sao_Paulo': { lat: -23.55, lon: -46.63 },
  'America/Bahia': { lat: -12.97, lon: -38.5 },
  'America/Fortaleza': { lat: -3.73, lon: -38.52 },
  'America/Recife': { lat: -8.05, lon: -34.88 },
  'America/Maceio': { lat: -9.67, lon: -35.73 },
  'America/Araguaina': { lat: -10.18, lon: -48.33 },
  'America/Belem': { lat: -1.46, lon: -48.49 },
  'America/Santarem': { lat: -2.44, lon: -54.71 },
  'America/Noronha': { lat: -3.85, lon: -32.42 },
  'America/Campo_Grande': { lat: -20.47, lon: -54.62 },
  'America/Cuiaba': { lat: -15.6, lon: -56.1 },
  'America/Porto_Velho': { lat: -8.76, lon: -63.9 },
  'America/Boa_Vista': { lat: 2.82, lon: -60.67 },
  'America/Manaus': { lat: -3.12, lon: -60.02 },
  'America/Eirunepe': { lat: -6.66, lon: -69.87 },
  'America/Rio_Branco': { lat: -9.97, lon: -67.81 },
  'Europe/Lisbon': { lat: 38.72, lon: -9.14 },
};

export function coordsForTimeZone(timeZone: string): { lat: number; lon: number } | null {
  return TIME_ZONE_COORDS[timeZone] ?? null;
}

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const toJulian = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (julian: number) => new Date((julian + 0.5 - J1970) * DAY_MS);

/**
 * Nascer e pôr do sol do dia de `date` (algoritmo do NOAA, o mesmo da biblioteca SunCalc), com a refração e o
 * tamanho do disco do sol (−0,833°). Null quando o sol não nasce ou não se põe (perto dos polos).
 */
export function sunTimes(date: Date, lat: number, lon: number): SunTimes | null {
  // 1) Dia solar (J2000) e o trânsito do sol pelo meridiano
  const lw = -lon * RAD;
  const phi = lat * RAD;
  const n = Math.round(toJulian(date) - J2000 - 0.0009 - lw / (2 * Math.PI));
  const approxTransit = 0.0009 + lw / (2 * Math.PI) + n;
  // 2) Posição do sol: anomalia média, equação do centro, longitude eclíptica e declinação
  const m = RAD * (357.5291 + 0.98560028 * approxTransit);
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const l = m + c + RAD * 102.9372 + Math.PI;
  const declination = Math.asin(Math.sin(l) * Math.sin(RAD * 23.4397));
  const transit = J2000 + approxTransit + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  // 3) Ângulo horário do sol no horizonte
  const cosHour = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(declination)) / (Math.cos(phi) * Math.cos(declination));
  if (cosHour < -1 || cosHour > 1) return null;
  const hour = Math.acos(cosHour);
  const set = J2000 + 0.0009 + (hour + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  return { sunrise: fromJulian(transit - (set - transit)), sunset: fromJulian(set) };
}
