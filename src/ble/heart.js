// Source cardio — capteur FC BLE standard (Polar Verity Sense). Service Heart
// Rate 0x180D, caractéristique Heart Rate Measurement 0x2A37. Pousse { hr }
// dans le bus normalisé. Validé par le spike Lot 0.
const HR_SERVICE = 0x180d;
const HR_MEASUREMENT = 0x2a37;
const MAX_RETRIES = 5;

export function createHeartSource(bus) {
  let device = null;
  let characteristic = null;
  let manualDisconnect = false;
  const statusListeners = new Set();
  const setStatus = (state, detail) => { for (const fn of statusListeners) fn(state, detail); };

  async function connect() {
    manualDisconnect = false;
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
      optionalServices: [0x180f, 0x180a],
    });
    device.addEventListener('gattserverdisconnected', onDisconnected);
    await openGatt();
  }

  async function openGatt() {
    setStatus('connecting');
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(HR_SERVICE);
    characteristic = await service.getCharacteristic(HR_MEASUREMENT);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', onValue);
    setStatus('connected', device.name || 'capteur FC');
  }

  function onValue(ev) {
    const { hr } = parseHeartRate(ev.target.value);
    if (hr != null) bus.update({ hr });
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

// Heart Rate Measurement (0x2A37) : flags 8 bits puis FC (uint8 ou uint16).
export function parseHeartRate(dv) {
  const flags = dv.getUint8(0);
  let o = 1;
  const hr = (flags & 0x01) ? dv.getUint16(o, true) : dv.getUint8(o);
  return { hr };
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
