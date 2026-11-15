/**
 * Ellabbets stationära likströmsmodell, version 1. No DOM, storage or network.
 * Voltages and passive component currents use a -> b. source.current is the
 * delivered current, opposite the battery component's passive-sign current.
 * node.group identifies an ideal electrical node; node.island identifies a
 * connected subnetwork. Potentials in different islands are not comparable.
 */
export const MODEL = Object.freeze({
  emfDefault: 6, emfMin: 1.5, emfMax: 9, emfStep: 0.1,
  internalResistance: 1, lampResistance: 30, ammeterResistance: 0.01,
  resistorMin: 10, resistorMax: 1000, tripCurrent: 0.75, tripEpsilon: 1e-9,
  maxPassiveComponents: 24, maxWires: 60, maxNodes: 256,
});

const TYPES = new Set(['battery', 'resistor', 'lamp', 'switch', 'ammeter', 'voltmeter']);
const dictionary = () => Object.create(null);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const tidy = value => Math.abs(value) < 1e-12 ? 0 : value;

class UnionFind {
  constructor(ids) { this.parents = new Map(ids.map(id => [id, id])); }
  find(id) {
    const parent = this.parents.get(id);
    if (parent !== id) this.parents.set(id, this.find(parent));
    return this.parents.get(id);
  }
  join(a, b) {
    a = this.find(a); b = this.find(b);
    if (a !== b) this.parents.set(compare(a, b) < 0 ? b : a, compare(a, b) < 0 ? a : b);
  }
}

function validate(input) {
  const errors = [];
  if (!isRecord(input)) return { errors: ['Kretsen måste vara ett objekt.'] };
  for (const key of ['nodes', 'wires', 'components']) {
    if (!Array.isArray(input[key])) errors.push(`${key} måste vara en lista.`);
  }
  if (input.tripped !== undefined && typeof input.tripped !== 'boolean') errors.push('Skyddstillståndet måste vara sant eller falskt.');
  if (errors.length) return { errors };
  if (input.nodes.length > MODEL.maxNodes) errors.push(`Högst ${MODEL.maxNodes} anslutningspunkter stöds.`);
  if (input.wires.length > MODEL.maxWires) errors.push(`Högst ${MODEL.maxWires} ledningar stöds.`);
  if (input.components.length > MODEL.maxPassiveComponents + 1) errors.push('För många komponenter.');
  if (errors.length) return { errors };
  const ids = new Set();
  for (const node of input.nodes) {
    const id = typeof node === 'string' ? node : isRecord(node) ? node.id : undefined;
    if (!validId(id)) errors.push('Varje anslutningspunkt behöver ett giltigt, unikt id.');
    else if (ids.has(id)) errors.push(`Anslutningspunkten ${id} förekommer flera gånger.`);
    else ids.add(id);
  }
  function checkPorts(item, label) {
    if (!ids.has(item.a) || !ids.has(item.b)) errors.push(`${label} måste ha två befintliga anslutningspunkter.`);
  }
  const wires = [];
  for (const wire of input.wires) {
    if (!isRecord(wire)) { errors.push('En ledning har fel format.'); continue; }
    checkPorts(wire, 'Ledningen');
    wires.push({ a: wire.a, b: wire.b });
  }
  const componentIds = new Set(), components = [];
  let sources = 0, passives = 0;
  for (const raw of input.components) {
    if (!isRecord(raw)) { errors.push('En komponent har fel format.'); continue; }
    const c = { id: raw.id, type: raw.type, a: raw.a, b: raw.b };
    if (!validId(c.id) || componentIds.has(c.id)) errors.push('Varje komponent behöver ett giltigt, unikt id.');
    else componentIds.add(c.id);
    checkPorts(c, `Komponenten ${c.id ?? ''}`);
    if (!TYPES.has(c.type)) { errors.push(`Komponenttypen ${String(c.type)} stöds inte.`); continue; }
    if (raw.closed !== undefined && (c.type !== 'switch' || typeof raw.closed !== 'boolean')) errors.push(`Ogiltigt brytarläge för ${c.id}.`);
    if (c.type === 'battery') {
      sources++;
      c.value = raw.value === undefined ? MODEL.emfDefault : raw.value;
      if (!finite(c.value) || c.value < MODEL.emfMin || c.value > MODEL.emfMax || Math.abs(c.value / MODEL.emfStep - Math.round(c.value / MODEL.emfStep)) > 1e-8) errors.push(`Batteriet ska ha ${MODEL.emfMin}–${MODEL.emfMax} V i steg om ${MODEL.emfStep} V.`);
    } else {
      passives++;
      if (c.type === 'resistor') {
        c.value = raw.value;
        if (!finite(c.value) || c.value < MODEL.resistorMin || c.value > MODEL.resistorMax) errors.push(`Motståndet ${c.id} ska vara mellan ${MODEL.resistorMin} och ${MODEL.resistorMax} Ω.`);
      } else if (c.type === 'lamp' || c.type === 'ammeter') {
        c.value = c.type === 'lamp' ? MODEL.lampResistance : MODEL.ammeterResistance;
        if (raw.value !== undefined && raw.value !== c.value) errors.push(`${c.id} har fast resistans ${c.value} Ω i denna modell.`);
      } else {
        if (raw.value !== undefined) errors.push(`${c.id} har inget inställbart komponentvärde.`);
        if (c.type === 'switch') c.closed = raw.closed ?? false;
      }
    }
    components.push(c);
  }
  if (sources > 1) errors.push('Version 1 stöder bara ett batteri åt gången.');
  if (passives > MODEL.maxPassiveComponents) errors.push(`Högst ${MODEL.maxPassiveComponents} passiva komponenter stöds.`);
  return {
    errors, nodes: [...ids].sort(compare),
    wires: wires.sort((a, b) => compare(a.a, b.a) || compare(a.b, b.b)),
    components: components.sort((a, b) => compare(a.id, b.id)), tripped: input.tripped ?? false,
  };
}

function emptySource() {
  return { id: null, emf: null, terminalVoltage: null, current: null, faultCurrent: null, tripKind: null };
}

function errorResult(errors, model) {
  const components = dictionary(), nodes = dictionary();
  for (const c of model?.components ?? []) if (validId(c.id)) {
    components[c.id] = { voltage: null, current: null, power: null, measurementStatus: 'error' };
  }
  for (const id of model?.nodes ?? []) nodes[id] = { group: null, island: null, voltage: null };
  return { ok: false, status: 'error', warning: 'Kretsen kunde inte beräknas.', errors, components, nodes, source: emptySource(), beforeTrip: null, diagnostics: null };
}

/** Gaussian elimination with partial pivoting; never add fictitious conductance. */
function solveLinear(matrix, rhs) {
  const n = rhs.length;
  if (!n) return [];
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  const scale = Math.max(...matrix.map(row => Math.max(...row.map(Math.abs))));
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let row = k + 1; row < n; row++) if (Math.abs(a[row][k]) > Math.abs(a[pivot][k])) pivot = row;
    if (!Number.isFinite(a[pivot][k]) || Math.abs(a[pivot][k]) <= Number.EPSILON * scale * n * 16) throw new Error('Nodsystemet är numeriskt obestämt.');
    [a[k], a[pivot]] = [a[pivot], a[k]];
    for (let row = k + 1; row < n; row++) {
      const factor = a[row][k] / a[k][k];
      a[row][k] = 0;
      for (let col = k + 1; col <= n; col++) a[row][col] -= factor * a[k][col];
    }
  }
  const x = Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let value = a[row][n];
    for (let col = row + 1; col < n; col++) value -= a[row][col] * x[col];
    x[row] = value / a[row][row];
    if (!Number.isFinite(x[row])) throw new Error('Beräkningen gav ett ogiltigt mätvärde.');
  }
  return x;
}

function topology(model, active) {
  const ideal = new UnionFind(model.nodes);
  const links = model.wires.map((w, i) => ({ ...w, key: `wire:${i}` }));
  for (const c of model.components) if (c.type === 'switch' && c.closed) links.push({ a: c.a, b: c.b, key: `switch:${c.id}` });
  for (const link of links) ideal.join(link.a, link.b);
  const groups = [...new Set(model.nodes.map(id => ideal.find(id)))].sort(compare);
  const islands = new UnionFind(groups), branches = [];
  for (const c of model.components) {
    if (['resistor', 'lamp', 'ammeter'].includes(c.type) || (active && c.type === 'battery')) {
      const branch = { id: c.id, a: ideal.find(c.a), b: ideal.find(c.b), resistance: c.type === 'battery' ? MODEL.internalResistance : c.value, type: c.type };
      branches.push(branch);
      islands.join(branch.a, branch.b);
    }
  }
  return { ideal, links, groups, islands, branches };
}

function inactive(model, sourceComponent, tripKind, beforeTrip = null) {
  const t = topology(model, false), components = dictionary(), nodes = dictionary();
  for (const c of model.components) components[c.id] = {
    voltage: null, current: 0, power: 0, measurementStatus: 'tripped',
    ...(c.type === 'battery' ? { emf: c.value } : {}),
  };
  for (const id of model.nodes) {
    const group = t.ideal.find(id);
    nodes[id] = { group, island: t.islands.find(group), voltage: null };
  }
  const source = sourceComponent ? {
    id: sourceComponent.id, emf: sourceComponent.value, terminalVoltage: null, current: 0,
    faultCurrent: beforeTrip?.source.current ?? null, tripKind,
  } : { ...emptySource(), current: 0, tripKind };
  const reasons = {
    'short-circuit': 'Batteripolerna är direkt kortslutna.',
    'meter-short': 'En lågohmig strömväg genom amperemetern förbinder batteripolerna.',
    overload: 'Kretsens sammanlagda belastning ger för hög ström i modellen.',
    latched: 'Skyddet är fortfarande frånslaget. Ändra kretsen och återställ skyddet med knappen.',
  };
  return { ok: false, status: 'tripped', warning: `${reasons[tripKind]} Källan frånkopplad.`, errors: [], components, nodes, source, beforeTrip, diagnostics: null };
}

function meterOnlyPath(source, t) {
  const meter = new UnionFind(t.groups);
  for (const branch of t.branches) if (branch.type === 'ammeter') meter.join(branch.a, branch.b);
  return meter.find(t.ideal.find(source.a)) === meter.find(t.ideal.find(source.b));
}

// A closed ideal switch has a unique current only when its edge is a bridge
// within its ideal-node graph. Parallel zero-ohm paths must not acquire invented
// individual currents. Wires deliberately have no returned current field.
function idealSwitchCurrent(c, t, outwardAtPort) {
  const adjacency = new Map([...t.ideal.parents.keys()].map(id => [id, []]));
  for (const link of t.links) {
    if (link.key === `switch:${c.id}`) continue;
    adjacency.get(link.a).push(link.b); adjacency.get(link.b).push(link.a);
  }
  const seen = new Set([c.a]), queue = [c.a];
  for (let i = 0; i < queue.length; i++) for (const id of adjacency.get(queue[i])) {
    if (!seen.has(id)) { seen.add(id); queue.push(id); }
  }
  if (seen.has(c.b)) return null;
  return tidy(-[...seen].sort(compare).reduce((sum, id) => sum + outwardAtPort.get(id), 0));
}

function solveActive(model, sourceComponent) {
  const t = topology(model, true), potentials = new Map(), domains = new Map();
  for (const group of t.groups) {
    const island = t.islands.find(group);
    if (!domains.has(island)) domains.set(island, []);
    domains.get(island).push(group);
  }
  const sourceA = sourceComponent ? t.ideal.find(sourceComponent.a) : null;
  const sourceB = sourceComponent ? t.ideal.find(sourceComponent.b) : null;
  for (const [island, groups] of domains) {
    const containsSource = sourceComponent && t.islands.find(sourceB) === island;
    const reference = containsSource ? sourceB : groups[0];
    const unknown = groups.filter(id => id !== reference), index = new Map(unknown.map((id, i) => [id, i]));
    const matrix = unknown.map(() => Array(unknown.length).fill(0)), rhs = Array(unknown.length).fill(0);
    function stamp(a, b, conductance) {
      if (a === b) return;
      const i = index.get(a), j = index.get(b);
      if (i !== undefined) matrix[i][i] += conductance;
      if (j !== undefined) matrix[j][j] += conductance;
      if (i !== undefined && j !== undefined) { matrix[i][j] -= conductance; matrix[j][i] -= conductance; }
    }
    for (const branch of t.branches) if (t.islands.find(branch.a) === island) stamp(branch.a, branch.b, 1 / branch.resistance);
    if (containsSource && sourceA !== sourceB) {
      const norton = sourceComponent.value / MODEL.internalResistance;
      if (index.has(sourceA)) rhs[index.get(sourceA)] += norton;
      if (index.has(sourceB)) rhs[index.get(sourceB)] -= norton;
    }
    const solution = solveLinear(matrix, rhs);
    potentials.set(reference, 0);
    unknown.forEach((id, i) => potentials.set(id, tidy(solution[i])));
  }
  const nodes = dictionary();
  for (const id of model.nodes) {
    const group = t.ideal.find(id);
    nodes[id] = { group, island: t.islands.find(group), voltage: potentials.get(group) };
  }
  const voltage = c => {
    const a = nodes[c.a], b = nodes[c.b];
    return a.island === b.island ? tidy(a.voltage - b.voltage) : null;
  };
  const terminalVoltage = sourceComponent ? voltage(sourceComponent) : null;
  const sourceCurrent = sourceComponent ? tidy((sourceComponent.value - terminalVoltage) / MODEL.internalResistance) : 0;
  const source = sourceComponent ? {
    id: sourceComponent.id, emf: sourceComponent.value, terminalVoltage, current: sourceCurrent,
    faultCurrent: null, tripKind: null,
  } : emptySource();
  const components = dictionary(), outwardAtPort = new Map(model.nodes.map(id => [id, 0]));
  const residuals = new Map(t.groups.map(id => [id, 0])), warnings = [];
  let passivePower = 0;
  for (const c of model.components) {
    const u = voltage(c);
    let current = 0, power = 0;
    if (c.type === 'battery') { current = -sourceCurrent; power = -terminalVoltage * sourceCurrent; }
    else if (['resistor', 'lamp', 'ammeter'].includes(c.type)) {
      current = tidy(u / c.value); power = u * current; passivePower += power;
    }
    components[c.id] = {
      voltage: u, current, power: tidy(power), measurementStatus: u === null ? 'floating' : 'ok',
      ...(c.type === 'battery' ? { emf: c.value } : {}),
      ...(['resistor', 'lamp', 'ammeter'].includes(c.type) ? { resistance: c.value, bypassed: t.ideal.find(c.a) === t.ideal.find(c.b) } : {}),
    };
    outwardAtPort.set(c.a, outwardAtPort.get(c.a) + current);
    outwardAtPort.set(c.b, outwardAtPort.get(c.b) - current);
    const a = t.ideal.find(c.a), b = t.ideal.find(c.b);
    residuals.set(a, residuals.get(a) + current);
    residuals.set(b, residuals.get(b) - current);
    if (u === null && c.type === 'voltmeter') warnings.push('Voltmätning: ej bestämt mellan dessa delar. Anslut båda proberna till samma krets.');
    if (c.type === 'lamp' && components[c.id].bypassed) warnings.push('En modellampa är förbikopplad och får 0 V. Det är inte i sig en direkt kortslutning av batteriet.');
  }
  for (const c of model.components) if (c.type === 'switch' && c.closed) {
    const current = idealSwitchCurrent(c, t, outwardAtPort);
    components[c.id].current = current;
    components[c.id].currentStatus = current === null ? 'indeterminate' : 'ok';
  }
  const internalPower = sourceCurrent ** 2 * MODEL.internalResistance;
  const emfPower = (sourceComponent?.value ?? 0) * sourceCurrent;
  const powerResidual = emfPower - passivePower - internalPower;
  const maxKclResidual = Math.max(0, ...[...residuals.values()].map(Math.abs));
  const diagnostics = {
    maxKclResidual, nodeResiduals: Object.fromEntries(residuals), powerResidual,
    emfPower, passivePower, internalPower,
  };
  if (maxKclResidual > 1e-9 + 1e-8 * Math.abs(sourceCurrent) || Math.abs(powerResidual) > 1e-9 + 1e-8 * Math.abs(emfPower)) throw new Error('Kontrollen av ström- eller effektbalansen misslyckades.');
  const result = { ok: true, status: 'ok', warning: [...new Set(warnings)].join(' ') || null, errors: [], components, nodes, source, beforeTrip: null, diagnostics };
  if (sourceComponent && sourceCurrent > MODEL.tripCurrent + MODEL.tripEpsilon) {
    const tripKind = sourceA === sourceB ? 'short-circuit' : meterOnlyPath(sourceComponent, t) ? 'meter-short' : 'overload';
    return inactive(model, sourceComponent, tripKind, { source, components, nodes, diagnostics });
  }
  return result;
}

/**
 * Solve a validated single-source resistive circuit without modifying its input.
 * A latched tripped:true keeps the source disconnected. To reset, call again
 * with false; a remaining fault immediately trips again. Preserve beforeTrip in
 * the application if it needs the original fault after later circuit edits.
 */
export function solveCircuit(input) {
  let model;
  try {
    model = validate(input);
    if (model.errors.length) return errorResult(model.errors, model);
    const sourceComponent = model.components.find(c => c.type === 'battery');
    if (model.tripped) return inactive(model, sourceComponent, 'latched');
    return solveActive(model, sourceComponent);
  } catch (error) {
    return errorResult([error instanceof Error ? error.message : 'Okänt beräkningsfel.'], model);
  }
}
