import test from 'node:test';
import assert from 'node:assert/strict';
import { solveCircuit, MODEL } from '../solver.mjs';

const battery = (value = 6, a = 'p', b = 'n') => ({ id: 'battery', type: 'battery', a, b, value });
const resistor = (id, a, b, value) => ({ id, type: 'resistor', a, b, value });
const lamp = (id, a, b) => ({ id, type: 'lamp', a, b });
const meter = (id, type, a, b) => ({ id, type, a, b });
function circuit(components = [battery()], wires = [], extraNodes = []) {
  return { nodes: [...new Set([...extraNodes, ...components.flatMap(c => [c.a, c.b]), ...wires.flatMap(w => [w.a, w.b])])], wires, components };
}
const solve = (...args) => solveCircuit(circuit(...args));
function near(actual, expected, label = '', abs = 1e-8, rel = 1e-6) {
  assert.equal(typeof actual, 'number', `${label}: expected number, got ${actual}`);
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= abs + rel * Math.abs(expected), `${label}: ${actual} != ${expected}`);
}
function assertFiniteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), 'No NaN/Infinity may escape the solver');
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteTree);
}
function balances(result) {
  const active = result.beforeTrip ?? result;
  assert.ok(active.diagnostics, 'Raw calculation includes diagnostics');
  near(active.diagnostics.maxKclResidual, 0);
  near(active.diagnostics.powerResidual, 0);
  near(active.diagnostics.emfPower, active.diagnostics.passivePower + active.diagnostics.internalPower);
  for (const residual of Object.values(active.diagnostics.nodeResiduals)) near(residual, 0);
  assertFiniteTree(result);
}
function checkProtected(result, kind, faultCurrent) {
  assert.equal(result.status, 'tripped');
  assert.equal(result.ok, false);
  assert.equal(result.source.tripKind, kind);
  near(result.source.faultCurrent, faultCurrent);
  assert.equal(result.source.current, 0);
  assert.equal(result.source.terminalVoltage, null);
  for (const c of Object.values(result.components)) {
    assert.equal(c.current, 0); assert.equal(c.power, 0); assert.equal(c.voltage, null);
    assert.equal(c.measurementStatus, 'tripped');
  }
  for (const node of Object.values(result.nodes)) assert.equal(node.voltage, null);
  balances(result);
}

test('default battery is open with 6 V, negative probe order and exact same-node zero', () => {
  const result = solve([{ id: 'battery', type: 'battery', a: 'p', b: 'n' }, meter('forward', 'voltmeter', 'p', 'n'), meter('reverse', 'voltmeter', 'n', 'p'), meter('same', 'voltmeter', 'p', 'p')]);
  assert.equal(result.status, 'ok');
  near(result.source.emf, 6); near(result.source.current, 0); near(result.source.terminalVoltage, 6);
  near(result.components.forward.voltage, 6); near(result.components.reverse.voltage, -6);
  assert.equal(result.components.same.voltage, 0);
  balances(result);
});

test('one fixed 30 ohm lamp, source internal resistance and passive power signs', () => {
  const r = solve([battery(), lamp('l', 'p', 'n')]);
  near(r.source.current, 6 / 31); near(r.components.l.voltage, 180 / 31);
  near(r.components.l.current, 6 / 31); near(r.components.l.power, (6 / 31) ** 2 * 30);
  near(r.components.battery.current, -6 / 31);
  near(r.components.battery.power, -r.source.terminalVoltage * r.source.current);
  balances(r);
});

test('two series lamps carry the same current and half the load voltage', () => {
  const r = solve([battery(), lamp('a', 'p', 'x'), lamp('b', 'x', 'n')]);
  for (const id of ['a', 'b']) {
    near(r.components[id].current, 6 / 61); near(r.components[id].voltage, 180 / 61);
    near(r.components[id].power, (6 / 61) ** 2 * 30);
  }
  balances(r);
});

test('two parallel lamps have equal voltage and branch currents summing to source', () => {
  const r = solve([battery(), lamp('a', 'p', 'n'), lamp('b', 'p', 'n')]);
  near(r.source.current, 3 / 8);
  for (const id of ['a', 'b']) { near(r.components[id].voltage, 45 / 8); near(r.components[id].current, 3 / 16); near(r.components[id].power, 135 / 128); }
  balances(r);
});

test('unequal parallel resistance changes branch current, not branch voltage', () => {
  const r = solve([battery(), resistor('a', 'p', 'n', 30), resistor('b', 'p', 'n', 60)]);
  near(r.source.terminalVoltage, 40 / 7); near(r.source.current, 2 / 7);
  near(r.components.a.current, 4 / 21); near(r.components.b.current, 2 / 21);
  balances(r);
});

test('series lamp feeding two parallel lamps uses actual mixed topology', () => {
  const r = solve([battery(), lamp('series', 'p', 'x'), lamp('a', 'x', 'n'), lamp('b', 'x', 'n')]);
  near(r.source.current, 3 / 23); near(r.components.series.voltage, 90 / 23);
  near(r.components.a.voltage, 45 / 23); near(r.components.a.current, 3 / 46); near(r.components.b.current, 3 / 46);
  balances(r);
});

test('100 ohm resistor current is 6/101, not ideal-source 0.060 A', () => {
  const r = solve([battery(), resistor('r', 'p', 'n', 100)]);
  near(r.source.current, 6 / 101); near(r.components.r.voltage, 600 / 101);
  assert.notEqual(r.source.current, 0.06); balances(r);
});

test('series ammeter loads circuit by exactly 0.01 ohm and signed polarity reverses', () => {
  const r = solve([battery(), lamp('l', 'p', 'x'), meter('m', 'ammeter', 'n', 'x')]);
  near(r.source.current, 6 / 31.01); near(r.components.m.current, -6 / 31.01);
  near(r.components.m.voltage, -0.01 * 6 / 31.01); balances(r);
});

test('ideal voltmeter in series creates no current path, but its voltage can be defined', () => {
  const r = solve([battery(), lamp('l', 'p', 'x'), meter('v', 'voltmeter', 'x', 'n')]);
  near(r.source.current, 0); near(r.components.l.current, 0); near(r.components.l.voltage, 0);
  near(r.components.v.current, 0); near(r.components.v.voltage, 6); balances(r);
});

test('floating probe, two isolated islands and isolated same-node measurement are distinguished', () => {
  const r = solve([battery(), lamp('lit', 'p', 'n'), resistor('isolated', 'u', 'v', 200), meter('cross', 'voltmeter', 'p', 'u'), meter('free', 'voltmeter', 'x', 'y'), meter('same', 'voltmeter', 'z', 'z'), meter('within', 'voltmeter', 'u', 'v')]);
  assert.equal(r.status, 'ok'); near(r.components.lit.current, 6 / 31);
  for (const id of ['cross', 'free']) { assert.equal(r.components[id].voltage, null); assert.equal(r.components[id].measurementStatus, 'floating'); }
  for (const id of ['same', 'within']) { assert.equal(r.components[id].voltage, 0); assert.equal(r.components[id].measurementStatus, 'ok'); }
  assert.notEqual(r.nodes.u.island, r.nodes.p.island); assert.equal(r.nodes.u.island, r.nodes.v.island);
  balances(r);
});

test('direct source short is diagnosed before Norton-source contraction can erase it', () => {
  const r = solve([battery(), lamp('l', 'p', 'n')], [{ a: 'p', b: 'n' }]);
  checkProtected(r, 'short-circuit', 6); assert.equal(r.beforeTrip.source.terminalVoltage, 0);
  assert.equal(r.beforeTrip.components.l.current, 0);
});

test('identical battery ports also diagnose a direct source short', () => {
  checkProtected(solve([battery(6, 'p', 'p')]), 'short-circuit', 6);
});

test('ammeter across source and chain of ammeters are meter shorts, not ordinary overloads', () => {
  const r = solve([battery(), meter('a', 'ammeter', 'p', 'n')]);
  checkProtected(r, 'meter-short', 6 / 1.01); near(r.beforeTrip.components.a.current, 6 / 1.01);
  checkProtected(solve([battery(), meter('a', 'ammeter', 'p', 'x'), meter('b', 'ammeter', 'x', 'n')]), 'meter-short', 6 / 1.02);
});

test('ordinary aggregate overload is not labelled a short circuit or instrument fault', () => {
  const r = solve([battery(), ...Array.from({ length: 5 }, (_, i) => lamp(`l${i}`, 'p', 'n'))]);
  checkProtected(r, 'overload', 6 / 7);
});

test('bypassing one series lamp need not short the source', () => {
  const r = solve([battery(), lamp('bypass', 'p', 'x'), lamp('load', 'x', 'n')], [{ a: 'p', b: 'x' }]);
  assert.equal(r.status, 'ok'); near(r.source.current, 6 / 31);
  assert.equal(r.components.bypass.bypassed, true);
  assert.equal(r.components.bypass.voltage, 0); assert.equal(r.components.bypass.current, 0); assert.equal(r.components.bypass.power, 0);
  near(r.components.load.current, 6 / 31); balances(r);
});

test('removing a parallel branch slightly increases surviving lamp current', () => {
  const before = solve([battery(), lamp('a', 'p', 'n'), lamp('b', 'p', 'n')]);
  const after = solve([battery(), lamp('a', 'p', 'n')]);
  near(before.components.a.current, 3 / 16); near(after.components.a.current, 6 / 31);
  assert.ok(after.components.a.current > before.components.a.current);
});

test('0.750 A exact equality does not trip; 6.1 V gives 0.7625 A and trips again on reset', () => {
  const loads = [resistor('a', 'p', 'n', 14), resistor('b', 'p', 'n', 14)];
  const at = solve([battery(), ...loads]);
  assert.equal(at.status, 'ok'); near(at.source.current, 0.75);
  const above = circuit([battery(6.1), ...loads]);
  checkProtected(solveCircuit(above), 'overload', 0.7625);
  checkProtected(solveCircuit({ ...above, tripped: false }), 'overload', 0.7625);
});

test('cutoff epsilon absorbs rounding noise but not material threshold exceedance', () => {
  function atCurrent(current) {
    const resistance = 2 * (6 / current - 1);
    return solve([battery(), resistor('a', 'p', 'n', resistance), resistor('b', 'p', 'n', resistance)]);
  }
  assert.equal(atCurrent(0.75 - 2 * MODEL.tripEpsilon).status, 'ok');
  assert.equal(atCurrent(0.75 + MODEL.tripEpsilon / 4).status, 'ok');
  checkProtected(atCurrent(0.75 + 4 * MODEL.tripEpsilon), 'overload', 0.75 + 4 * MODEL.tripEpsilon);
});

test('latched state stays inactive after repair and does not fabricate old diagnostics', () => {
  const repaired = circuit([battery(), lamp('l', 'p', 'n'), meter('v', 'voltmeter', 'p', 'n')]);
  const latched = solveCircuit({ ...repaired, tripped: true });
  assert.equal(latched.status, 'tripped'); assert.equal(latched.source.tripKind, 'latched');
  assert.equal(latched.source.faultCurrent, null); assert.equal(latched.beforeTrip, null);
  for (const c of Object.values(latched.components)) { assert.equal(c.voltage, null); assert.equal(c.current, 0); assert.equal(c.power, 0); }
  assert.equal(latched.source.emf, 6); assert.equal(latched.source.terminalVoltage, null);
  assert.equal(solveCircuit({ ...repaired, tripped: false }).status, 'ok');
});

test('independently derived unbalanced bridge fractions satisfy nodal and power balances', () => {
  const r = solve([battery(), resistor('pa', 'p', 'a', 30), resistor('an', 'a', 'n', 60), resistor('pb', 'p', 'b', 60), resistor('bn', 'b', 'n', 30), resistor('ab', 'a', 'b', 100)]);
  near(r.nodes.p.voltage, 7560 / 1289); near(r.nodes.a.voltage, 4680 / 1289); near(r.nodes.b.voltage, 2880 / 1289);
  near(r.source.current, 174 / 1289); near(r.components.ab.current, 18 / 1289);
  balances(r);
});

test('source reversed relative to external labels reverses signed load current', () => {
  const r = solve([battery(6, 'n', 'p'), resistor('r', 'p', 'n', 100), meter('v', 'voltmeter', 'p', 'n')]);
  near(r.components.r.current, -6 / 101); near(r.components.v.voltage, -600 / 101);
  near(r.source.current, 6 / 101); near(r.source.terminalVoltage, 600 / 101); balances(r);
});

test('independent switches open only their own branch; their series current is derivable', () => {
  const base = [battery(), { id: 'sa', type: 'switch', a: 'p', b: 'a', closed: true }, lamp('a', 'a', 'n'), { id: 'sb', type: 'switch', a: 'p', b: 'b', closed: false }, lamp('b', 'b', 'n')];
  const r = solve(base);
  near(r.components.a.current, 6 / 31); near(r.components.b.current, 0);
  near(r.components.sa.current, 6 / 31); near(r.components.sa.voltage, 0);
  near(r.components.sb.current, 0); near(r.components.sb.voltage, 180 / 31);
  const both = solve(base.map(c => c.type === 'switch' ? { ...c, closed: true } : c));
  near(both.components.a.current, 3 / 16); near(both.components.b.current, 3 / 16);
  near(both.components.sa.current, 3 / 16); near(both.components.sb.current, 3 / 16); balances(both);
});

test('redundant ideal links never acquire invented numeric wire or switch currents', () => {
  const r = solve([battery(), { id: 's', type: 'switch', a: 'p', b: 'x', closed: true }, lamp('l', 'x', 'n')], [{ a: 'p', b: 'x' }, { a: 'p', b: 'x' }]);
  near(r.source.current, 6 / 31); near(r.components.l.current, 6 / 31);
  assert.equal(r.components.s.current, null); assert.equal(r.components.s.currentStatus, 'indeterminate');
  assert.equal(r.components.s.voltage, 0); assert.equal(r.components.s.power, 0);
  assert.equal(Object.hasOwn(r, 'wires'), false); balances(r);
});

test('crossing geometry adds no electrical junction and node objects are accepted', () => {
  const input = circuit([battery(), lamp('l', 'x', 'y')], [{ a: 'p', b: 'x' }, { a: 'n', b: 'y' }]);
  input.nodes = input.nodes.map((id, i) => ({ id, x: i * 10, y: -i * 10 }));
  const r = solveCircuit(input);
  near(r.source.current, 6 / 31); assert.notEqual(r.nodes.p.group, r.nodes.n.group); balances(r);
});

test('empty construction and source-free islands are valid, with undefined cross-island voltage', () => {
  const empty = solveCircuit({ nodes: [], components: [], wires: [] });
  assert.equal(empty.status, 'ok'); assert.equal(empty.source.id, null); assert.equal(empty.source.current, null);
  const r = solve([resistor('r', 'a', 'b', 100), meter('v', 'voltmeter', 'a', 'z')]);
  assert.equal(r.status, 'ok'); assert.equal(r.components.r.voltage, 0); assert.equal(r.components.r.current, 0);
  assert.equal(r.components.v.voltage, null); balances(r);
});

test('valid model endpoints and full component/wire limits are supported', () => {
  for (const value of [1.5, 6.1, 9]) assert.notEqual(solve([battery(value)]).status, 'error');
  for (const value of [10, 1000]) assert.notEqual(solve([battery(), resistor('r', 'p', 'n', value)]).status, 'error');
  const input = circuit([battery(), ...Array.from({ length: 24 }, (_, i) => resistor(`r${i}`, `x${i}`, `y${i}`, 100))], Array.from({ length: 60 }, () => ({ a: 'p', b: 'x0' })));
  assert.equal(solveCircuit(input).status, 'ok');
});

test('invalid shapes, unknown ports, duplicate ids, unsupported sources/types and values fail closed', async t => {
  const good = () => circuit([battery(), resistor('r', 'p', 'n', 100)]);
  const cases = [
    null, [], {}, { nodes: [], wires: null, components: [] },
    { ...good(), tripped: 'false' }, { ...good(), nodes: ['p', 'p', 'n'] },
    { ...good(), nodes: ['p'] }, { ...good(), wires: [null] },
    { ...good(), components: [null] }, { ...good(), nodes: [null, 'p', 'n'] },
    circuit([battery(), { ...battery(), id: 'second' }]),
    circuit([battery(), { ...battery(), type: 'capacitor', id: 'c' }]),
    circuit([battery(), resistor('battery', 'p', 'n', 100)]),
    ...[0, -1, 9.9, 1000.01, NaN, Infinity, '30', undefined].map(value => circuit([battery(), resistor('r', 'p', 'n', value)])),
    ...[0, 1.4, 9.1, 6.01, NaN, Infinity, '6'].map(value => circuit([battery(value)])),
    circuit([battery(), { ...lamp('l', 'p', 'n'), value: 60 }]),
    circuit([battery(), { ...meter('a', 'ammeter', 'p', 'n'), value: 0 }]),
    circuit([battery(), { ...meter('v', 'voltmeter', 'p', 'n'), value: Infinity }]),
    circuit([battery(), { id: 's', type: 'switch', a: 'p', b: 'n', closed: 'true' }]),
    circuit([battery(), { id: 's', type: 'switch', a: 'p', b: 'n', closed: true, value: 0 }]),
    circuit([battery(), { ...resistor('r', 'p', 'n', 100), closed: true }]),
    { ...good(), wires: Array.from({ length: 61 }, () => ({ a: 'p', b: 'n' })) },
    circuit([battery(), ...Array.from({ length: 25 }, (_, i) => resistor(`r${i}`, 'p', 'n', 100))]),
    { nodes: Array.from({ length: 257 }, (_, i) => `${i}`), wires: [], components: [] },
  ];
  for (const [i, input] of cases.entries()) await t.test(`invalid input ${i + 1}`, () => {
    const result = solveCircuit(input);
    assert.equal(result.status, 'error'); assert.equal(result.ok, false); assert.ok(result.errors.length);
    assert.equal(result.source.current, null); assert.equal(result.source.terminalVoltage, null);
    assertFiniteTree(result);
  });
});

test('invalid tripped input is still rejected, rather than masking errors with inactive zeros', () => {
  const result = solveCircuit({ ...circuit([battery(), resistor('r', 'p', 'n', -10)]), tripped: true });
  assert.equal(result.status, 'error'); assert.equal(result.components.r.current, null);
});

test('hostile-looking ids are safe dictionary keys rather than prototype operations', () => {
  const r = solve([{ id: '__proto__', type: 'battery', a: '__proto__', b: 'constructor' }, resistor('constructor', '__proto__', 'constructor', 100)]);
  near(r.components.constructor.current, 6 / 101); near(r.source.current, 6 / 101);
  assert.equal(Object.getPrototypeOf(r.components), null); assert.equal(Object.getPrototypeOf(r.nodes), null);
  balances(r);
});

test('input is unchanged and repeat/list-order/geometric changes produce the same full result', () => {
  const input = circuit([battery(), resistor('r2', 'x', 'n', 60), resistor('r1', 'p', 'x', 30), meter('v', 'voltmeter', 'p', 'n')], [{ a: 'p', b: 'z' }]);
  const before = structuredClone(input), expected = solveCircuit(input);
  const reordered = { nodes: [...input.nodes].reverse().map((id, i) => ({ id, x: i * 998, y: 500 - i, rotation: 270 })), wires: [...input.wires].reverse(), components: [...input.components].reverse().map(c => ({ ...c, x: 999, y: 3, rotation: 180 })) };
  assert.deepEqual(input, before); assert.deepEqual(solveCircuit(reordered), expected); assert.deepEqual(solveCircuit(input), expected);
});

test('300 deterministic random positive networks obey balances and permutation invariance', () => {
  let state = 0xabc123;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 2 ** 32; };
  for (let iteration = 0; iteration < 300; iteration++) {
    const size = 2 + Math.floor(random() * 9), ids = Array.from({ length: size }, (_, i) => `n${i}`);
    const components = [battery(6, ids[0], ids[1])];
    // Connected trees plus random chords exercise chains, bridges, asymmetric
    // branches and bypassed resistors, without a series/parallel recognizer.
    for (let i = 1; i < size; i++) components.push(resistor(`tree${i}`, ids[i], ids[Math.floor(random() * i)], 10 + random() * 990));
    const extra = Math.floor(random() * (24 - (size - 1)));
    for (let i = 0; i < extra; i++) components.push(resistor(`chord${i}`, ids[Math.floor(random() * size)], ids[Math.floor(random() * size)], 10 + random() * 990));
    const input = circuit(components), result = solveCircuit(input);
    assert.notEqual(result.status, 'error', `random graph ${iteration}: ${result.errors.join(', ')}`);
    balances(result);
    const active = result.beforeTrip ?? result;
    for (const c of components.filter(c => c.type === 'resistor')) {
      const value = active.components[c.id];
      near(value.current, value.voltage / c.value); near(value.power, value.current ** 2 * c.value);
      assert.ok(value.power >= 0);
    }
    assert.deepEqual(solveCircuit({ ...input, nodes: [...input.nodes].reverse(), components: [...components].reverse() }), result);
  }
});
