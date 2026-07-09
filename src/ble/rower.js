// Source rameur — Merach / ChangYow via FTMS standard (service 0x1826,
// caractéristique Rower Data 0x2AD1). Le décodage a été validé par le spike
// Lot 0 (cf. tools/ble-spike.html). Pousse les métriques dans le bus normalisé.
//
// États émis à l'abonné de statut : 'connecting' | 'connected' | 'reconnecting'
//   | 'disconnected' | 'failed'.
const FTMS_SERVICE = 0x1826;
const ROWER_DATA = 0x2ad1;
const MAX_RETRIES = 5;

export function createRowerSource(bus) {
  let device = null;
  let characteristic = null;
  let manualDisconnect = false;
  const statusListeners = new Set();
  const setStatus = (state, detail) => { for (const fn of statusListeners) fn(state, detail); };

  async function connect() {
    manualDisconnect = false;
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS_SERVICE] }],
      optionalServices: [0x180a, 0x180f],
    });
    device.addEventListener('gattserverdisconnected', onDisconnected);
    await openGatt();
  }

  async function openGatt() {
    setStatus('connecting');
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(FTMS_SERVICE);
    characteristic = await service.getCharacteristic(ROWER_DATA);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', onValue);
    setStatus('connected', device.name || 'rameur');
  }

  function onValue(ev) {
    const r = parseRowerData(ev.target.value);
    const update = {};
    for (const k of ['spm', 'strokes', 'dist', 'pace', 'power']) {
      if (k in r) update[k] = r[k];
    }
    // La FC du rameur (champ hr) est à 0 sur ce matériel → on l'ignore,
    // la FC vient du Polar (heart.js).
    bus.update(update);
  }

  async function onDisconnected() {
    setStatus('disconnected');
    if (manualDisconnect || !device) return;
    for (let i = 0; i < MAX_RETRIES && !manualDisconnect; i += 1) {
      setStatus('reconnecting', i + 1);
      try { await openGatt(); return; }
      catch { await delay(1000 * (i + 1)); }
    }
    if (!manualDisconnect) setStatus('failed');
  }

  function disconnect() {
    manualDisconnect = true;
    if (device && device.gatt.connected) device.gatt.disconnect();
  }

  return {
    connect,
    disconnect,
    onStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
    get connected() { return !!(device && device.gatt.connected); },
  };
}

// FTMS Rower Data (0x2AD1) : flags 16 bits LE puis champs conditionnels.
export function parseRowerData(dv) {
  let o = 0;
  const flags = dv.getUint16(o, true); o += 2;
  const has = (b) => (flags & (1 << b)) !== 0;
  const r = {};
  if (!has(0)) { r.spm = dv.getUint8(o) / 2; o += 1; r.strokes = dv.getUint16(o, true); o += 2; }
  if (has(1)) { r.spmAvg = dv.getUint8(o) / 2; o += 1; }
  if (has(2)) { r.dist = dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getUint8(o + 2) << 16); o += 3; }
  if (has(3)) { r.pace = dv.getUint16(o, true); o += 2; }
  if (has(4)) { r.paceAvg = dv.getUint16(o, true); o += 2; }
  if (has(5)) { r.power = dv.getInt16(o, true); o += 2; }
  if (has(6)) { r.powerAvg = dv.getInt16(o, true); o += 2; }
  if (has(7)) { r.resistance = dv.getInt16(o, true); o += 2; }
  if (has(8)) { r.energyTotal = dv.getUint16(o, true); o += 2; r.energyHour = dv.getUint16(o, true); o += 2; r.energyMin = dv.getUint8(o); o += 1; }
  if (has(9)) { r.hr = dv.getUint8(o); o += 1; }
  if (has(10)) { o += 1; }
  if (has(11)) { r.elapsed = dv.getUint16(o, true); o += 2; }
  if (has(12)) { r.remaining = dv.getUint16(o, true); o += 2; }
  return r;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
