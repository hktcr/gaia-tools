/* FlockLab: individual motion and optional local rules. No drawing or DOM. */
(function (root, factory) {
  const Engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = Engine;
  else root.FlockEngine = Engine;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const PI = Math.PI, TAU = 2 * PI, MAX = 350;
  const defaults = Object.freeze({
    count: 120, speed: 72, turnNoise: 1.7,
    seek: false, seekMode: 'nearest', seekStrength: 1.35,
    align: false, alignMode: 'nearest', alignStrength: 1.4,
    predatorRadius: 95, repelStrength: 5.5,
    falconSpeed: 320, hawkSpeed: 105, hawkSeconds: 12
  });
  const finite = (v, d) => Number.isFinite(+v) ? +v : d;
  const range = (v, d, min, max) => Math.max(min, Math.min(max, finite(v, d)));
  const wrap = (v, size) => ((v % size) + size) % size;
  const angle = v => wrap(v + PI, TAU) - PI;
  function offset(v, size) {
    if (v > size / 2) return v - size;
    if (v < -size / 2) return v + size;
    return v;
  }
  function normal(rng) {
    const u = Math.max(1e-12, rng());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng());
  }
  class FlockEngine {
    constructor(w, h, config = {}) {
      this.w = Math.max(1, finite(w, 600));
      this.h = Math.max(1, finite(h, 600));
      this.scale = Math.min(this.w, this.h) / 600;
      this.config = Object.assign({}, defaults, config);
      this.rng = typeof config.rng === 'function' ? config.rng : Math.random;
      this.birds = [];
      this.predators = [];
      this._turns = new Float64Array(MAX);
      this._speeds = new Float64Array(MAX);
      this._neighborDistances = new Float64Array(MAX);
      this._statDistances = new Float64Array(MAX);
      this._stats = {};
      this.reset();
    }
    reset() {
      this.birds.length = 0;
      this.predators.length = 0;
      const n = this._count();
      while (this.birds.length < n) this._addBird();
      this._nearestAt = 0;
      this._ruleSignature = -1;
      return this;
    }
    _count() {
      return Math.round(range(this.config.count, defaults.count, 0, MAX));
    }
    _addBird() {
      const r = this.rng;
      const b = {
        x: this.w * r(), y: this.h * r(), a: TAU * r() - PI, turn: 0,
        nearest: -1, seekTarget: -1, alignTarget: -1,
        seekAt: 0, alignAt: 0, speedFactor: 0.83 + 0.34 * r()
      };
      b.motionFactor = b.speedFactor;
      this.birds.push(b);
    }
    resize(w, h) {
      w = Math.max(1, finite(w, this.w));
      h = Math.max(1, finite(h, this.h));
      const sx = w / this.w, sy = h / this.h;
      for (const p of this.birds) { p.x *= sx; p.y *= sy; }
      for (const p of this.predators) { p.x *= sx; p.y *= sy; }
      this.w = w; this.h = h; this.scale = Math.min(w, h) / 600;
      this._nearestAt = 0;
      return this;
    }
    spawn(type, x = this.w / 2, y = this.h / 2, a = 0) {
      if (type !== 'falcon' && type !== 'hawk') return null;
      if (this.predators.length >= 16) this.predators.shift();
      const p = {
        type, x: finite(x, this.w / 2), y: finite(y, this.h / 2),
        a: angle(finite(a, 0)), age: 0, turn: 0, prey: -1, chooseAt: 0,
        duration: type === 'hawk' ? range(this.config.hawkSeconds, 12, 0.25, 120) : 15
      };
      this.predators.push(p);
      return p;
    }
    _pick(self, n) {
      if (n < 2) return -1;
      const j = Math.min(n - 2, Math.floor(this.rng() * (n - 1)));
      return j < self ? j : j + 1;
    }
    _nearest(dist, writeTargets) {
      // Reuse fixed buffers; statistics never overwrite behavioral targets.
      const b = this.birds, n = b.length;
      dist.fill(Infinity, 0, n);
      if (writeTargets) for (let i = 0; i < n; i++) b[i].nearest = -1;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = offset(b[j].x - b[i].x, this.w);
        const dy = offset(b[j].y - b[i].y, this.h);
        const d = dx * dx + dy * dy;
        if (d < dist[i]) { dist[i] = d; if (writeTargets) b[i].nearest = j; }
        if (d < dist[j]) { dist[j] = d; if (writeTargets) b[j].nearest = i; }
      }
    }
    getStats(target = this._stats) {
      const b = this.birds, p = this.predators, n = b.length;
      const radius = range(this.config.predatorRadius, 95, 0, 1600) * this.scale;
      const r2 = radius * radius;
      let x = 0, y = 0, speed = 0, affected = 0, nearest = 0;
      if (n > 1) this._nearest(this._statDistances, false);
      for (let i = 0; i < n; i++) {
        const bird = b[i];
        x += Math.cos(bird.a); y += Math.sin(bird.a); speed += bird.motionFactor;
        if (n > 1) nearest += Math.sqrt(this._statDistances[i]);
        for (let j = 0; j < p.length; j++) {
          const dx = bird.x - p[j].x, dy = bird.y - p[j].y;
          if (dx * dx + dy * dy < r2) { affected++; break; }
        }
      }
      target.count = n;
      target.predators = p.length;
      target.polarization = n ? Math.min(1, Math.hypot(x, y) / n) : 0;
      target.nearestPct = n > 1 ? 100 * nearest / (n * Math.min(this.w, this.h)) : null;
      target.affectedPct = n ? 100 * affected / n : 0;
      target.speed = n ? range(this.config.speed, 72, 0, 500) * (speed / n) : 0;
      return target;
    }
    step(dt) {
      dt = Math.max(0, Math.min(0.12, finite(dt, 0)));
      const wanted = this._count();
      if (wanted !== this.birds.length) {
        if (wanted < this.birds.length) this.birds.length = wanted;
        else while (this.birds.length < wanted) this._addBird();
        this._nearestAt = 0;
        for (let i = 0; i < this.birds.length; i++) this.birds[i].seekAt = this.birds[i].alignAt = 0;
      }
      if (!dt) return this;
      const steps = Math.ceil(dt / (1 / 45));
      for (let k = 0; k < steps; k++) this._step(dt / steps);
      return this;
    }
    _step(dt) {
      const c = this.config, w = this.w, h = this.h, s = this.scale, rng = this.rng;
      const seek = !!c.seek, align = !!c.align;
      const sr = c.seekMode === 'random', ar = c.alignMode === 'random';
      const signature = (seek ? 1 : 0) | (align ? 2 : 0) | (sr ? 4 : 0) | (ar ? 8 : 0);
      if (this._ruleSignature !== signature) {
        this._ruleSignature = signature;
        this._nearestAt = 0;
        for (let i = 0; i < this.birds.length; i++) this.birds[i].seekAt = this.birds[i].alignAt = 0;
      }
      if ((seek && !sr) || (align && !ar)) {
        this._nearestAt -= dt;
        if (this._nearestAt <= 0) { this._nearest(this._neighborDistances, true); this._nearestAt = 0.14; }
      }
      const birds = this.birds, n = birds.length;
      const baseSpeed = range(c.speed, 72, 0, 500) * s;
      const noise = range(c.turnNoise, 1.7, 0, 12);
      const seekK = range(c.seekStrength, 1.35, 0, 18);
      const alignK = range(c.alignStrength, 1.4, 0, 18);
      const repelK = range(c.repelStrength, 5.5, 0, 24);
      const radius = range(c.predatorRadius, 95, 0, 1600) * s;
      const turns = this._turns, speeds = this._speeds;
      const recovery = 1 - Math.exp(-dt / 0.8);
      const sync = 1 - Math.exp(-alignK * dt);
      const decay = Math.exp(-dt / 0.32), shock = Math.sqrt(1 - decay * decay);
      for (let i = 0; i < n; i++) {
        const b = birds[i];
        b.turn = b.turn * decay + (noise ? noise * shock * normal(rng) : 0);
        let omega = noise ? b.turn : 0;
        speeds[i] = b.motionFactor + recovery * (b.speedFactor - b.motionFactor);
        if (seek) {
          if (sr && (b.seekAt -= dt) <= 1e-9) { b.seekAt += 0.6; b.seekTarget = this._pick(i, n); }
          const t = birds[sr ? b.seekTarget : b.nearest];
          if (t) {
            const dx = offset(t.x - b.x, w), dy = offset(t.y - b.y, h);
            if (dx * dx + dy * dy > 1e-6) omega += seekK * angle(Math.atan2(dy, dx) - b.a);
          }
        }
        if (align) {
          if (ar && (b.alignAt -= dt) <= 1e-9) { b.alignAt += 0.6; b.alignTarget = this._pick(i, n); }
          const t = birds[ar ? b.alignTarget : b.nearest];
          if (t && alignK) {
            omega += alignK * angle(t.a - b.a);
            speeds[i] = b.motionFactor + sync * (t.motionFactor - b.motionFactor);
          }
        }
        if (radius && repelK) for (let j = 0; j < this.predators.length; j++) {
          const p = this.predators[j];
          // Predators are not toroidal: a falcon leaving one edge does not appear at the other.
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
          if (d < radius) {
            const f = 1 - d / radius;
            const bearing = d > 1e-8 ? Math.atan2(dy, dx) : b.a + PI / 2;
            omega += repelK * f * f * angle(bearing - b.a);
          }
        }
        turns[i] = angle(b.a + dt * Math.max(-14, Math.min(14, omega)));
      }
      for (let i = 0; i < n; i++) {
        const b = birds[i];
        b.motionFactor = speeds[i];
        const v = baseSpeed * b.motionFactor;
        b.a = turns[i];
        b.x = wrap(b.x + Math.cos(b.a) * v * dt, w);
        b.y = wrap(b.y + Math.sin(b.a) * v * dt, h);
      }
      const fast = range(c.falconSpeed, 320, 1, 1600) * s;
      const slow = range(c.hawkSpeed, 105, 1, 800) * s;
      const inset = Math.min(50 * s, w * 0.25, h * 0.25);
      const margin = 26 * s;
      for (let i = this.predators.length - 1; i >= 0; i--) {
        const p = this.predators[i];
        p.age += dt;
        if (p.age >= p.duration) { this.predators.splice(i, 1); continue; }
        if (p.type === 'hawk') {
          p.turn = p.turn * decay + 1.3 * shock * normal(rng);
          const fx = Math.max(0, 1 - p.x / inset) - Math.max(0, 1 - (w - p.x) / inset);
          const fy = Math.max(0, 1 - p.y / inset) - Math.max(0, 1 - (h - p.y) / inset);
          const edge = Math.min(1, Math.hypot(fx, fy));
          const inward = edge > 0 ? edge * 3 * angle(Math.atan2(fy, fx) - p.a) : 0;
          // An individual target persists briefly; choice and dwell time are random.
          // Attraction is mild so noise and edge steering can take over.
          if ((p.chooseAt -= dt) <= 0 || p.prey >= n) {
            p.prey = n ? Math.min(n - 1, Math.floor(rng() * n)) : -1;
            p.chooseAt = 0.65 + 1.65 * rng();
          }
          const prey = birds[p.prey];
          let chase = 0;
          if (prey) {
            const dx = prey.x - p.x, dy = prey.y - p.y;
            if (dx * dx + dy * dy > 1e-6) chase = 0.85 * (1 - 0.8 * edge) * angle(Math.atan2(dy, dx) - p.a);
          }
          p.a = angle(p.a + dt * (p.turn + inward + chase));
          p.x += Math.cos(p.a) * slow * dt; p.y += Math.sin(p.a) * slow * dt;
          if (p.x < 0 || p.x > w) { p.x = Math.min(w, Math.max(0, p.x)); p.a = angle(PI - p.a); }
          if (p.y < 0 || p.y > h) { p.y = Math.min(h, Math.max(0, p.y)); p.a = angle(-p.a); }
        } else {
          p.x += Math.cos(p.a) * fast * dt; p.y += Math.sin(p.a) * fast * dt;
          if (p.x < -margin || p.x > w + margin || p.y < -margin || p.y > h + margin) {
            this.predators.splice(i, 1);
          }
        }
      }
    }
  }
  FlockEngine.defaults = defaults;
  FlockEngine.maxBirds = MAX;
  return FlockEngine;
});
