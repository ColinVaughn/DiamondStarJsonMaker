(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Generate = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const round3 = n => Math.round(n * 1000) / 1000;

  function partAABB(positions) {
    let minx = Infinity, miny = Infinity, minz = Infinity;
    let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    return {
      min: { x: minx, y: miny, z: minz },
      max: { x: maxx, y: maxy, z: maxz },
      size: { x: maxx - minx, y: maxy - miny, z: maxz - minz },
      center: { x: (minx + maxx) / 2, y: (miny + maxy) / 2, z: (minz + maxz) / 2 },
    };
  }

  function project(x, y, z, plane) {
    if (plane === 'xy') return [x, y];
    if (plane === 'xz') return [x, z];
    return [y, z];
  }

  function sign(px, py, a, b) {
    return (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
  }
  function pointInTri(px, py, a, b, c) {
    const d1 = sign(px, py, a, b), d2 = sign(px, py, b, c), d3 = sign(px, py, c, a);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }

  function silhouetteArea(parts, plane, resolution) {
    resolution = resolution || 256;
    const tris = [];
    let minu = Infinity, minv = Infinity, maxu = -Infinity, maxv = -Infinity;
    for (const p of parts) {
      const pos = p.positions;
      const idx = p.indices && p.indices.length ? p.indices : null;
      const triCount = idx ? idx.length / 3 : pos.length / 9;
      for (let t = 0; t < triCount; t++) {
        const ia = idx ? idx[t * 3] : t * 3;
        const ib = idx ? idx[t * 3 + 1] : t * 3 + 1;
        const ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
        const A = project(pos[ia * 3], pos[ia * 3 + 1], pos[ia * 3 + 2], plane);
        const B = project(pos[ib * 3], pos[ib * 3 + 1], pos[ib * 3 + 2], plane);
        const C = project(pos[ic * 3], pos[ic * 3 + 1], pos[ic * 3 + 2], plane);
        tris.push([A, B, C]);
        for (const P of [A, B, C]) {
          if (P[0] < minu) minu = P[0]; if (P[0] > maxu) maxu = P[0];
          if (P[1] < minv) minv = P[1]; if (P[1] > maxv) maxv = P[1];
        }
      }
    }
    if (!tris.length) return 0;
    const w = maxu - minu, h = maxv - minv;
    if (w <= 0 || h <= 0) return 0;
    const cols = w >= h ? resolution : Math.max(1, Math.round(resolution * w / h));
    const rows = h >= w ? resolution : Math.max(1, Math.round(resolution * h / w));
    const cellW = w / cols, cellH = h / rows;
    const grid = new Uint8Array(cols * rows);
    for (const [A, B, C] of tris) {
      const tminU = Math.min(A[0], B[0], C[0]), tmaxU = Math.max(A[0], B[0], C[0]);
      const tminV = Math.min(A[1], B[1], C[1]), tmaxV = Math.max(A[1], B[1], C[1]);
      const c0 = Math.max(0, Math.floor((tminU - minu) / cellW));
      const c1 = Math.min(cols - 1, Math.floor((tmaxU - minu) / cellW));
      const r0 = Math.max(0, Math.floor((tminV - minv) / cellH));
      const r1 = Math.min(rows - 1, Math.floor((tmaxV - minv) / cellH));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (grid[r * cols + c]) continue;
          const u = minu + (c + 0.5) * cellW, v = minv + (r + 0.5) * cellH;
          if (pointInTri(u, v, A, B, C)) grid[r * cols + c] = 1;
        }
      }
    }
    let filled = 0;
    for (let i = 0; i < grid.length; i++) filled += grid[i];
    return filled * cellW * cellH;
  }

  function classifyVertical(size) {
    return size.y > size.x && size.y > size.z;
  }

  function inputTypeFromName(name) {
    const n = String(name).toLowerCase();
    if (n.includes('elevator')) return 'ELEVATOR';
    if (n.includes('stab')) return 'STABILIZER';
    if (n.includes('left')) return 'LEFT_FLAP';
    if (n.includes('right')) return 'RIGHT_FLAP';
    return 'NONE';
  }

  function isLiftSurfaceName(name) {
    return /wing|elevator|stabil|stab|flap|aileron|rudder|tail/i.test(String(name));
  }

  function offsetPoint(c, off) {
    return { x: round3(c.x + off.x), y: round3(c.y + off.y), z: round3(c.z + off.z) };
  }
  function roundSize(s) {
    return { x: round3(s.x), y: round3(s.y), z: round3(s.z) };
  }

  function boxToHitbox(name, box, offset) {
    return {
      name,
      size: roundSize(box.size),
      rel_pos: offsetPoint(box.center, offset),
      max_health: 0,
      max_armor: 0,
      remove_on_destroy: false,
      damage_parts: false,
      damage_root: false,
    };
  }

  function makeHitbox(part, offset) {
    const b = partAABB(part.positions);
    return boxToHitbox(part.name, { size: b.size, center: b.center }, offset);
  }

  function dominantAxis(size) {
    if (size.x >= size.y && size.x >= size.z) return 0;
    if (size.y >= size.x && size.y >= size.z) return 1;
    return 2;
  }

  function slicesForPart(part, maxSlices) {
    if (!maxSlices || maxSlices <= 1) return 1;
    const s = partAABB(part.positions).size;
    const ext = [s.x, s.y, s.z].sort((a, b) => a - b);
    const ratio = ext[2] / (ext[0] || 1e-6);
    return Math.max(1, Math.min(maxSlices, Math.round(ratio)));
  }

  function slicePart(part, slices) {
    const b = partAABB(part.positions);
    if (!slices || slices <= 1) return [{ size: b.size, center: b.center }];
    const ai = dominantAxis(b.size);
    const lo = ai === 0 ? b.min.x : ai === 1 ? b.min.y : b.min.z;
    const hi = ai === 0 ? b.max.x : ai === 1 ? b.max.y : b.max.z;
    const span = hi - lo;
    if (span <= 0) return [{ size: b.size, center: b.center }];
    const binW = span / slices;
    const bins = [];
    for (let i = 0; i < slices; i++) bins.push(null);

    const pos = part.positions;
    const idx = part.indices && part.indices.length ? part.indices : null;
    const triCount = idx ? idx.length / 3 : pos.length / 9;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const v = [
        [pos[i0 * 3], pos[i0 * 3 + 1], pos[i0 * 3 + 2]],
        [pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]],
        [pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]],
      ];
      const c = (v[0][ai] + v[1][ai] + v[2][ai]) / 3;
      let bin = Math.floor((c - lo) / binW);
      if (bin < 0) bin = 0;
      if (bin >= slices) bin = slices - 1;
      let bb = bins[bin];
      if (!bb) {
        bb = { minx: Infinity, miny: Infinity, minz: Infinity, maxx: -Infinity, maxy: -Infinity, maxz: -Infinity };
        bins[bin] = bb;
      }
      for (const p of v) {
        if (p[0] < bb.minx) bb.minx = p[0]; if (p[0] > bb.maxx) bb.maxx = p[0];
        if (p[1] < bb.miny) bb.miny = p[1]; if (p[1] > bb.maxy) bb.maxy = p[1];
        if (p[2] < bb.minz) bb.minz = p[2]; if (p[2] > bb.maxz) bb.maxz = p[2];
      }
    }
    const key = ai === 0 ? 'x' : ai === 1 ? 'y' : 'z';
    const out = [];
    for (let i = 0; i < slices; i++) {
      const bb = bins[i];
      if (!bb) continue;
      const size = { x: bb.maxx - bb.minx, y: bb.maxy - bb.miny, z: bb.maxz - bb.minz };
      const center = { x: (bb.minx + bb.maxx) / 2, y: (bb.miny + bb.maxy) / 2, z: (bb.minz + bb.maxz) / 2 };
      size[key] = binW;
      center[key] = lo + (i + 0.5) * binW;
      out.push({ size, center });
    }
    return out.length ? out : [{ size: b.size, center: b.center }];
  }

  function voxelizePart(part, res) {
    res = Math.max(1, res || 16);
    const b = partAABB(part.positions);
    const maxExt = Math.max(b.size.x, b.size.y, b.size.z) || 1;
    const cell = maxExt / res;
    const nx = Math.max(1, Math.ceil(b.size.x / cell));
    const ny = Math.max(1, Math.ceil(b.size.y / cell));
    const nz = Math.max(1, Math.ceil(b.size.z / cell));
    const origin = { x: b.min.x, y: b.min.y, z: b.min.z };
    const grid = new Uint8Array(nx * ny * nz);
    const colHits = new Array(nx * nz);

    const pos = part.positions;
    const idx = part.indices && part.indices.length ? part.indices : null;
    const triCount = idx ? idx.length / 3 : pos.length / 9;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
      const bx = pos[i1 * 3], by = pos[i1 * 3 + 1], bz = pos[i1 * 3 + 2];
      const cx = pos[i2 * 3], cy = pos[i2 * 3 + 1], cz = pos[i2 * 3 + 2];
      const denom = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denom) < 1e-12) continue;
      let i0c = Math.floor((Math.min(ax, bx, cx) - origin.x) / cell);
      let i1c = Math.floor((Math.max(ax, bx, cx) - origin.x) / cell);
      let k0c = Math.floor((Math.min(az, bz, cz) - origin.z) / cell);
      let k1c = Math.floor((Math.max(az, bz, cz) - origin.z) / cell);
      i0c = Math.max(0, i0c); i1c = Math.min(nx - 1, i1c);
      k0c = Math.max(0, k0c); k1c = Math.min(nz - 1, k1c);
      for (let k = k0c; k <= k1c; k++) {
        const pz = origin.z + (k + 0.5) * cell;
        for (let i = i0c; i <= i1c; i++) {
          const px = origin.x + (i + 0.5) * cell;
          const wa = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / denom;
          const wb = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / denom;
          const wc = 1 - wa - wb;
          if (wa < 0 || wb < 0 || wc < 0) continue;
          const y = wa * ay + wb * by + wc * cy;
          const ci = k * nx + i;
          (colHits[ci] || (colHits[ci] = [])).push(y);
        }
      }
    }
    for (let k = 0; k < nz; k++) {
      for (let i = 0; i < nx; i++) {
        const hits = colHits[k * nx + i];
        if (!hits || hits.length < 2) continue;
        hits.sort((a, b) => a - b);
        for (let h = 0; h + 1 < hits.length; h += 2) {
          let j0 = Math.floor((hits[h] - origin.y) / cell);
          let j1 = Math.floor((hits[h + 1] - origin.y) / cell);
          j0 = Math.max(0, j0); j1 = Math.min(ny - 1, j1);
          for (let j = j0; j <= j1; j++) grid[(k * ny + j) * nx + i] = 1;
        }
      }
    }
    return { grid, nx, ny, nz, cell, origin };
  }

  function greedyBoxes(grid, nx, ny, nz) {
    const covered = new Uint8Array(nx * ny * nz);
    const boxes = [];
    const free = (x0, x1, y0, y1, z0, z1) => {
      for (let k = z0; k <= z1; k++)
        for (let j = y0; j <= y1; j++)
          for (let i = x0; i <= x1; i++) {
            const o = (k * ny + j) * nx + i;
            if (!grid[o] || covered[o]) return false;
          }
      return true;
    };
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const o = (k * ny + j) * nx + i;
          if (!grid[o] || covered[o]) continue;
          let x1 = i, y1 = j, z1 = k;
          while (x1 + 1 < nx && free(x1 + 1, x1 + 1, j, y1, k, z1)) x1++;
          while (y1 + 1 < ny && free(i, x1, y1 + 1, y1 + 1, k, z1)) y1++;
          while (z1 + 1 < nz && free(i, x1, j, y1, z1 + 1, z1 + 1)) z1++;
          for (let kk = k; kk <= z1; kk++)
            for (let jj = j; jj <= y1; jj++)
              for (let ii = i; ii <= x1; ii++) covered[(kk * ny + jj) * nx + ii] = 1;
          boxes.push({ i0: i, j0: j, k0: k, i1: x1, j1: y1, k1: z1 });
        }
      }
    }
    return boxes;
  }

  function voxelDecompose(part, res) {
    const v = voxelizePart(part, res);
    return greedyBoxes(v.grid, v.nx, v.ny, v.nz).map(bx => {
      const x0 = v.origin.x + bx.i0 * v.cell, x1 = v.origin.x + (bx.i1 + 1) * v.cell;
      const y0 = v.origin.y + bx.j0 * v.cell, y1 = v.origin.y + (bx.j1 + 1) * v.cell;
      const z0 = v.origin.z + bx.k0 * v.cell, z1 = v.origin.z + (bx.k1 + 1) * v.cell;
      return {
        size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 },
        center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
      };
    });
  }

  function makeLiftSurface(part, offset, resolution) {
    const b = partAABB(part.positions);
    return {
      id: 'lift_surface',
      hitbox: part.name,
      pos: offsetPoint(b.center, offset),
      rotation: { x: 0, y: 0, z: classifyVertical(b.size) ? 90 : 0 },
      area: round3(silhouetteArea([part], 'xz', resolution)),
      input_type: inputTypeFromName(part.name),
      input_rotation_max: 4,
      ignore_roll: false,
      lift_k_graph: 'fuselage',
      zero_lift_drag: 0.5,
      drag_graph: 'default_drag_aoa',
    };
  }

  function estimateEntitySize(parts) {
    let body = null, bestVol = -1;
    for (const p of parts) {
      const b = partAABB(p.positions);
      if (/body|fuselage|hull|frame/i.test(p.name)) { body = b; break; }
      const vol = b.size.x * b.size.y * b.size.z;
      if (vol > bestVol) { bestVol = vol; body = b; }
    }
    if (!body) return { entity_size_xz: 4, entity_size_y: 4 };
    return {
      entity_size_xz: round3(body.size.x),
      entity_size_y: round3(body.size.y),
    };
  }

  function generateAll(parts, options) {
    options = options || {};
    const offset = options.offset || { x: 0, y: 0, z: 0 };
    const res = options.resolution || 256;
    const hitboxNames = options.hitboxParts
      ? new Set(options.hitboxParts)
      : new Set(parts.map(p => p.name));
    const result = { hitboxes: [], stats: {}, physics_components: [] };

    const maxSlices = options.maxSlices || 1;
    const method = options.method || 'slab';
    for (const p of parts) {
      if (!hitboxNames.has(p.name)) continue;
      const b = partAABB(p.positions);
      if (b.size.x <= 0 && b.size.y <= 0 && b.size.z <= 0) continue;
      let boxes = method === 'voxel'
        ? voxelDecompose(p, options.voxelRes || 16)
        : slicePart(p, slicesForPart(p, maxSlices));
      if (!boxes.length) boxes = [{ size: b.size, center: b.center }];
      boxes.forEach((box, i) => {
        const name = boxes.length > 1 ? `${p.name}_${i + 1}` : p.name;
        result.hitboxes.push(boxToHitbox(name, box, offset));
      });
    }

    const es = estimateEntitySize(parts);
    result.stats.entity_size_xz = es.entity_size_xz;
    result.stats.entity_size_y = es.entity_size_y;

    if (options.includeAero !== false) {
      const cross = round3(silhouetteArea(parts, 'xy', res));
      result.stats.cross_sec_area = cross;
      result.stats.drag_area = cross;
    }

    if (options.includeLift) {
      const byName = {};
      parts.forEach(p => { byName[p.name] = p; });
      const liftParts = options.liftParts && options.liftParts.length
        ? options.liftParts
        : parts.filter(p => isLiftSurfaceName(p.name)).map(p => ({ name: p.name }));
      const wingParts = [];
      for (const lp of liftParts) {
        const part = byName[lp.name];
        if (!part) continue;
        const ls = makeLiftSurface(part, offset, res);
        if (lp.input_type) ls.input_type = lp.input_type;
        result.physics_components.push(ls);
        wingParts.push(part);
      }
      if (wingParts.length) {
        result.stats.wing_area = round3(silhouetteArea(wingParts, 'xz', res));
      }
    }

    if (!result.physics_components.length) delete result.physics_components;
    return result;
  }

  return {
    round3, partAABB, silhouetteArea, pointInTri, classifyVertical,
    inputTypeFromName, isLiftSurfaceName, makeHitbox, boxToHitbox,
    dominantAxis, slicesForPart, slicePart,
    voxelizePart, greedyBoxes, voxelDecompose, makeLiftSurface,
    estimateEntitySize, generateAll,
  };
});
