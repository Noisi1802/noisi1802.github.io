// Markdown → objet Session. Parsing volontairement tolérant (cf. PROJET.md §4).
//
// Session = frontmatter (métadonnées) + liste de sections.
// Chaque section a une cible de fin : durée, distance, ou manuelle.

const DISPLAY_MODES = ['perf', 'cardio', 'complet', 'zen'];

export function parseSession(md, slug = '') {
  const { data, body } = extractFrontmatter(md);
  const sections = parseSections(body);
  return {
    slug: slug || slugify(data.title || 'seance'),
    title: data.title || 'Séance sans titre',
    type: data.type || '',
    description: data.description || '',
    targetHrZone: parseZone(data.target_hr_zone),
    display: DISPLAY_MODES.includes(data.display) ? data.display : 'perf',
    sections,
    raw: md,
  };
}

function extractFrontmatter(md) {
  const m = md.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kv) data[kv[1].trim()] = kv[2].replace(/\s*#.*$/, '').trim();
  }
  return { data, body: m[2] };
}

function parseZone(v) {
  if (!v) return null;
  const nums = String(v).match(/\d+/g);
  return nums && nums.length >= 2 ? [Number(nums[0]), Number(nums[1])] : null;
}

function parseSections(body) {
  // Chaque `##` démarre une section ; le fragment avant le premier `##` est ignoré.
  const blocks = body.split(/^##\s+/m).slice(1);
  return blocks.map((block) => {
    const [head, ...rest] = block.split(/\r?\n/);
    const props = {};
    for (const line of rest) {
      const kv = line.match(/^\s*-\s*([\w-]+)\s*:\s*(.+?)\s*$/);
      if (kv) props[kv[1].toLowerCase()] = kv[2].trim();
    }
    const duree = parseDuration(props.duree);
    const distance = parseDistance(props.distance);
    let target;
    if (duree != null) target = { type: 'duration', value: duree };
    else if (distance != null) target = { type: 'distance', value: distance };
    else target = { type: 'manual', value: null };
    return {
      name: head.trim(),
      duree,
      distance,
      cadence: props.cadence || null,
      intensite: props.intensite || null,
      note: props.note || null,
      target,
    };
  });
}

// "m:ss" / "mm:ss" → secondes ; "Nmin" / "Ns" tolérés.
function parseDuration(v) {
  if (!v) return null;
  const clock = v.match(/^(\d+):(\d{1,2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const unit = v.match(/^(\d+)\s*(min|s)?$/i);
  if (unit) return unit[2] && unit[2].toLowerCase() === 'min' ? Number(unit[1]) * 60 : Number(unit[1]);
  return null;
}

// "500m" / "1.5km" → mètres.
function parseDistance(v) {
  if (!v) return null;
  const km = v.match(/^([\d.]+)\s*km$/i);
  if (km) return Math.round(parseFloat(km[1]) * 1000);
  const m = v.match(/^([\d.]+)\s*m$/i);
  if (m) return Math.round(parseFloat(m[1]));
  return null;
}

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
