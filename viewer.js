import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const G = window.Generate;
const statusEl = document.getElementById('viewerStatus');
const setStatus = msg => { statusEl.textContent = msg; };

const mount = document.getElementById('viewerCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
camera.position.set(10, 8, 16);
const renderer = new THREE.WebGLRenderer({ antialias: true });
mount.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
scene.add(new THREE.GridHelper(40, 40, 0x334155, 0x1e293b));
scene.add(new THREE.AxesHelper(3));

function resize() {
  const w = mount.clientWidth || 800, h = mount.clientHeight || 540;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('tabchange', e => { if (e.detail === 'viewerTab') resize(); });
resize();

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();

if (!G) setStatus('Generation module not loaded.');

let modelGroup = null;
let parts = [];
const partState = new Map();
let offset = { x: 0, y: 0, z: 0 };
let generated = { hitboxes: [], stats: {} };
const boxGroup = new THREE.Group();
scene.add(boxGroup);

const placementGroup = new THREE.Group();
scene.add(placementGroup);
const smokes = [];
const slots = [];
let output = {};

const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', e => { controls.enabled = !e.value; });
transform.addEventListener('objectChange', onGizmoChange);
scene.add(transform);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null;

renderer.domElement.addEventListener('pointerdown', ev => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const targets = [...placementGroup.children];
  if (boxGroup.visible) targets.push(...boxGroup.children);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) selectObject(hits[0].object);
});

window.addEventListener('keydown', e => {
  if (!selected) return;
  if (e.key === 'g') transform.setMode('translate');
  if (e.key === 's' && selected.userData.kind === 'hitbox') transform.setMode('scale');
});

function selectObject(obj) {
  selected = obj;
  transform.attach(obj);
  transform.setMode('translate');
}
const selectMarker = selectObject;

const vpos = mesh => ({ x: G.round3(mesh.position.x), y: G.round3(mesh.position.y), z: G.round3(mesh.position.z) });

function onGizmoChange() {
  if (!selected) return;
  const u = selected.userData;
  if (u.kind === 'hitbox') {
    const hb = generated.hitboxes.find(h => h.name === u.hitboxName);
    if (hb) {
      hb.rel_pos = vpos(selected);
      hb.size = {
        x: G.round3(Math.abs(selected.scale.x) * selected.geometry.parameters.width),
        y: G.round3(Math.abs(selected.scale.y) * selected.geometry.parameters.height),
        z: G.round3(Math.abs(selected.scale.z) * selected.geometry.parameters.depth),
      };
    }
  } else if (u.kind === 'slot') {
    u.entry.inputs.x.value = G.round3(selected.position.x);
    u.entry.inputs.y.value = G.round3(selected.position.y);
    u.entry.inputs.z.value = G.round3(selected.position.z);
  }
  assembleOutput();
}

let pendingMaterials = null;
let pendingTextureURL = null;
let objText = null;

document.getElementById('objInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then(txt => { objText = txt; buildModel(false); });
});

document.getElementById('mtlInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then(txt => {
    const mtl = new MTLLoader().parse(txt, '');
    mtl.preload();
    pendingMaterials = mtl;
    if (objText) buildModel(true);
    else setStatus('Material ready — it will apply when you load the .obj.');
  });
});

document.getElementById('texInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  pendingTextureURL = URL.createObjectURL(file);
  if (modelGroup) { applyTexture(modelGroup, pendingTextureURL); setStatus('Texture applied.'); }
  else setStatus('Texture ready — it will apply when you load the .obj.');
});

function applyTexture(group, url) {
  const tex = new THREE.TextureLoader().load(url);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  group.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ map: tex }); });
}

function buildModel(preserveState) {
  if (!objText) return;
  const prevState = preserveState ? new Map(partState) : null;
  const prevOffset = preserveState ? offset : null;

  let group;
  try {
    const loader = new OBJLoader();
    if (pendingMaterials) loader.setMaterials(pendingMaterials);
    group = loader.parse(objText);
  } catch (err) {
    setStatus('Could not parse OBJ: ' + err.message);
    return;
  }
  if (modelGroup) scene.remove(modelGroup);
  modelGroup = group;
  if (pendingTextureURL && !pendingMaterials) applyTexture(group, pendingTextureURL);
  scene.add(group);

  parts = extractParts(group);
  if (!parts.length) {
    setStatus('No geometry found in the OBJ.');
  } else if (parts.length === 1 && /^part_\d+$/.test(parts[0].name)) {
    parts[0].name = 'body';
    setStatus('No named groups — generated a single whole-model box. Add o/g groups in your model for per-part boxes.');
  } else {
    setStatus(`Loaded ${parts.length} parts.`);
  }

  partState.clear();
  parts.forEach(p => {
    const prev = prevState && prevState.get(p.name);
    partState.set(p.name, prev || {
      hitbox: true,
      lift: G.isLiftSurfaceName(p.name),
      input_type: G.inputTypeFromName(p.name),
    });
  });
  offset = prevOffset || { x: 0, y: 0, z: 0 };
  if (!preserveState) frameCamera();
  renderPartsList();
  regenerate();
}

function extractParts(group) {
  const raw = [];
  group.traverse(obj => {
    if (!obj.isMesh) return;
    const posAttr = obj.geometry.getAttribute('position');
    if (!posAttr) return;
    const positions = Array.from(posAttr.array);
    let indices;
    if (obj.geometry.index) indices = Array.from(obj.geometry.index.array);
    else { indices = []; for (let i = 0; i < posAttr.count; i++) indices.push(i); }
    raw.push({ name: obj.name || `part_${raw.length}`, positions, indices });
  });
  const byName = new Map();
  for (const p of raw) {
    if (!byName.has(p.name)) byName.set(p.name, { name: p.name, positions: [], indices: [] });
    const tgt = byName.get(p.name);
    const base = tgt.positions.length / 3;
    for (let i = 0; i < p.positions.length; i++) tgt.positions.push(p.positions[i]);
    for (let i = 0; i < p.indices.length; i++) tgt.indices.push(p.indices[i] + base);
  }
  return [...byName.values()];
}

function frameCamera() {
  const box = new THREE.Box3().setFromObject(modelGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 5;
  controls.target.copy(center);
  camera.position.set(center.x + maxDim, center.y + maxDim * 0.7, center.z + maxDim * 1.4);
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
}

function currentOptions() {
  const hitboxParts = parts.filter(p => partState.get(p.name).hitbox).map(p => p.name);
  const liftParts = parts.filter(p => partState.get(p.name).lift)
    .map(p => ({ name: p.name, input_type: partState.get(p.name).input_type }));
  const method = document.getElementById('methodSelect').value;
  const detail = parseInt(document.getElementById('detailSlider').value, 10) || 1;
  return {
    offset,
    includeAero: document.getElementById('includeAero').checked,
    includeLift: document.getElementById('includeLift').checked,
    hitboxParts,
    liftParts,
    method,
    maxSlices: method === 'slab' ? detail : 1,
    voxelRes: detail,
    resolution: 256,
  };
}

function regenerate() {
  if (!parts.length) return;
  generated = G.generateAll(parts, currentOptions());
  if (modelGroup) modelGroup.position.set(offset.x, offset.y, offset.z);
  drawBoxes(generated.hitboxes);
  renderAeroSummary(generated);
  assembleOutput();
}

function drawBoxes(hitboxes) {
  transform.detach();
  selected = null;
  boxGroup.clear();
  for (const hb of hitboxes) {
    const geom = new THREE.BoxGeometry(hb.size.x, hb.size.y, hb.size.z);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(hb.rel_pos.x, hb.rel_pos.y, hb.rel_pos.z);
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({ color: 0x60a5fa })));
    mesh.userData = { kind: 'hitbox', hitboxName: hb.name };
    boxGroup.add(mesh);
  }
}

function renderAeroSummary(gen) {
  const s = gen.stats || {};
  const lines = [`hitboxes: ${gen.hitboxes.length}`];
  if ('entity_size_xz' in s) lines.push(`entity_size: ${s.entity_size_xz} x ${s.entity_size_y}`);
  if ('cross_sec_area' in s) lines.push(`cross_sec_area: ${s.cross_sec_area}`);
  if ('drag_area' in s) lines.push(`drag_area: ${s.drag_area}`);
  if ('wing_area' in s) lines.push(`wing_area: ${s.wing_area}`);
  if (gen.physics_components) lines.push(`lift surfaces: ${gen.physics_components.length}`);
  document.getElementById('aeroSummary').textContent = lines.join('\n');
}

function renderPartsList() {
  const list = document.getElementById('partsList');
  list.innerHTML = '';
  for (const p of parts) {
    const st = partState.get(p.name);
    const row = document.createElement('div');
    row.className = 'part-row';

    const hb = document.createElement('input');
    hb.type = 'checkbox'; hb.checked = st.hitbox; hb.title = 'Make hitbox';
    hb.addEventListener('change', () => { st.hitbox = hb.checked; regenerate(); });

    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = p.name;
    nameInput.addEventListener('input', () => {
      const newName = nameInput.value.trim() || p.name;
      partState.set(newName, partState.get(p.name));
      p.name = newName;
      regenerate();
    });

    const lift = document.createElement('input');
    lift.type = 'checkbox'; lift.checked = st.lift; lift.title = 'Lift surface';
    lift.addEventListener('change', () => { st.lift = lift.checked; regenerate(); });

    row.append(hb, nameInput, lift);
    list.appendChild(row);
  }
}

document.getElementById('includeAero').addEventListener('change', regenerate);
document.getElementById('includeLift').addEventListener('change', regenerate);
document.getElementById('detailSlider').addEventListener('input', e => {
  document.getElementById('detailValue').textContent = e.target.value;
  regenerate();
});
document.getElementById('methodSelect').addEventListener('change', e => {
  const slider = document.getElementById('detailSlider');
  if (e.target.value === 'voxel') {
    slider.min = 4; slider.max = 20; slider.value = 8;
    document.getElementById('detailLabel').textContent = 'Voxel quality';
    document.getElementById('detailHint').textContent =
      'Low = blocky, few boxes. High = tighter fit, more boxes. Untick parts you don’t need as hitboxes.';
  } else {
    slider.min = 1; slider.max = 12; slider.value = 4;
    document.getElementById('detailLabel').textContent = 'Box detail per part';
    document.getElementById('detailHint').textContent =
      '1 = one box per part. Higher slices elongated parts into more boxes that hug the shape.';
  }
  document.getElementById('detailValue').textContent = slider.value;
  regenerate();
});
document.getElementById('centerXZ').addEventListener('click', () => {
  if (!parts.length) return;
  const b = G.partAABB(parts.flatMap(p => p.positions));
  offset = { x: -b.center.x, y: offset.y, z: -b.center.z };
  regenerate();
});
document.getElementById('dropFloor').addEventListener('click', () => {
  if (!parts.length) return;
  const b = G.partAABB(parts.flatMap(p => p.positions));
  offset = { x: offset.x, y: -b.min.y, z: offset.z };
  regenerate();
});

const SLOT_TYPES = window.DSC_SLOT_TYPES || ['seat'];

function modelSpot(atRear) {
  if (!modelGroup) return new THREE.Vector3(0, 0, 0);
  const b = new THREE.Box3().setFromObject(modelGroup);
  const c = b.getCenter(new THREE.Vector3());
  return atRear ? new THREE.Vector3(0, c.y, b.min.z) : c;
}

function elm(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
function iconBtn(txt, title, on) {
  const b = elm('button', 'icon-btn'); b.type = 'button'; b.textContent = txt; b.title = title;
  b.addEventListener('click', on); return b;
}
function fieldRow(label, input) {
  const w = elm('label', 'slot-field'); w.appendChild(document.createTextNode(label)); w.appendChild(input); return w;
}
function txtField(val, on) { const i = elm('input'); i.type = 'text'; i.value = val || ''; i.addEventListener('input', () => on(i.value)); return i; }
function numField(val, on) { const i = elm('input'); i.type = 'number'; i.step = 'any'; i.value = val; i.addEventListener('input', () => on(i.value === '' ? 0 : Number(i.value))); return i; }
function selField(opts, val, on) {
  const s = elm('select');
  opts.forEach(o => { const op = elm('option'); op.value = o; op.textContent = o; if (o === val) op.selected = true; s.appendChild(op); });
  s.addEventListener('change', () => on(s.value)); return s;
}
function chkField(label, val, on) {
  const w = elm('label', 'slot-flag'); const i = elm('input'); i.type = 'checkbox'; i.checked = !!val;
  i.addEventListener('change', () => on(i.checked)); w.appendChild(i); w.appendChild(document.createTextNode(' ' + label)); return w;
}

function addSmoke() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: 0xf2882f }));
  mesh.position.copy(modelSpot(true));
  const entry = { mesh };
  mesh.userData = { kind: 'smoke', entry };
  placementGroup.add(mesh);
  smokes.push(entry);

  const row = elm('div', 'smoke-row');
  row.appendChild(document.createTextNode(`Point ${smokes.length}`));
  const actions = elm('div', 'row-actions');
  actions.appendChild(iconBtn('⌖', 'Select / move', () => selectMarker(mesh)));
  actions.appendChild(iconBtn('✕', 'Remove', () => {
    placementGroup.remove(mesh);
    smokes.splice(smokes.indexOf(entry), 1);
    row.remove();
    if (selected === mesh) { transform.detach(); selected = null; }
    assembleOutput();
  }));
  row.appendChild(actions);
  document.getElementById('smokeList').appendChild(row);
  selectMarker(mesh);
  assembleOutput();
}

function addSlot() {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), new THREE.MeshBasicMaterial({ color: 0x46cfe0 }));
  mesh.position.copy(modelSpot(false));
  const item = { name: '', slot_type: SLOT_TYPES[0], zRot: 0, part: '', itemid: '', param: '', filled: false, linkedHitbox: '', onlyCompatPart: '', locked: false };
  const entry = { mesh, item, inputs: {} };
  mesh.userData = { kind: 'slot', entry };
  placementGroup.add(mesh);
  slots.push(entry);

  const card = elm('div', 'slot-card');
  const head = elm('div', 'slot-head');
  head.appendChild(document.createTextNode(`Slot ${slots.length}`));
  const actions = elm('div', 'row-actions');
  actions.appendChild(iconBtn('⌖', 'Select / move', () => selectMarker(mesh)));
  actions.appendChild(iconBtn('✕', 'Remove', () => {
    placementGroup.remove(mesh);
    slots.splice(slots.indexOf(entry), 1);
    card.remove();
    if (selected === mesh) { transform.detach(); selected = null; }
    assembleOutput();
  }));
  head.appendChild(actions);
  card.appendChild(head);

  card.appendChild(fieldRow('Name', txtField(item.name, v => { item.name = v; assembleOutput(); })));
  card.appendChild(fieldRow('Type', selField(SLOT_TYPES, item.slot_type, v => { item.slot_type = v; assembleOutput(); })));

  const xi = numField(G.round3(mesh.position.x), v => { mesh.position.x = v; assembleOutput(); });
  const yi = numField(G.round3(mesh.position.y), v => { mesh.position.y = v; assembleOutput(); });
  const zi = numField(G.round3(mesh.position.z), v => { mesh.position.z = v; assembleOutput(); });
  entry.inputs = { x: xi, y: yi, z: zi };
  const pos = elm('div', 'slot-pos');
  pos.append(fieldRow('X', xi), fieldRow('Y', yi), fieldRow('Z', zi));
  card.appendChild(pos);

  card.appendChild(fieldRow('zRot', numField(item.zRot, v => { item.zRot = v; assembleOutput(); })));
  card.appendChild(fieldRow('Part', txtField(item.part, v => { item.part = v; assembleOutput(); })));
  card.appendChild(fieldRow('Item id', txtField(item.itemid, v => { item.itemid = v; assembleOutput(); })));
  card.appendChild(fieldRow('Param', txtField(item.param, v => { item.param = v; assembleOutput(); })));
  card.appendChild(fieldRow('Linked hitbox', txtField(item.linkedHitbox, v => { item.linkedHitbox = v; assembleOutput(); })));
  card.appendChild(fieldRow('Only compat part', txtField(item.onlyCompatPart, v => { item.onlyCompatPart = v; assembleOutput(); })));
  const flags = elm('div', 'slot-flags');
  flags.append(
    chkField('Filled', item.filled, v => { item.filled = v; assembleOutput(); }),
    chkField('Locked', item.locked, v => { item.locked = v; assembleOutput(); }));
  card.appendChild(flags);

  document.getElementById('slotList').appendChild(card);
  selectMarker(mesh);
  assembleOutput();
}

function slotToJson(entry) {
  const it = entry.item;
  const p = vpos(entry.mesh);
  const o = { name: it.name || 'slot', slot_type: it.slot_type, slot_posx: p.x, slot_posy: p.y, slot_posz: p.z, zRot: Number(it.zRot) || 0 };
  if (it.locked) o.locked = true;
  if (it.onlyCompatPart) o.onlyCompatPart = it.onlyCompatPart;
  if (it.linkedHitbox) o.linkedHitbox = it.linkedHitbox;
  const data = {};
  if (it.part) data.part = it.part;
  if (it.itemid) data.itemid = it.itemid;
  if (it.filled) data.filled = true;
  if (it.param) data.param = it.param;
  if (Object.keys(data).length) o.data = data;
  return o;
}

function assembleOutput() {
  output = {};
  if (generated.hitboxes && generated.hitboxes.length) output.hitboxes = generated.hitboxes;
  if (generated.stats && Object.keys(generated.stats).length) output.stats = generated.stats;
  if (generated.physics_components && generated.physics_components.length) output.physics_components = generated.physics_components;
  if (smokes.length) output.after_burner_smoke = smokes.map(e => ({ pos: vpos(e.mesh) }));
  if (slots.length) output.slots = slots.map(slotToJson);
  document.getElementById('genPreview').textContent = JSON.stringify(output, null, 2);
}

function refreshPlacementVisibility() {
  const pt = window.PresetForm ? window.PresetForm.getData().presetType : null;
  document.getElementById('smokeTool').classList.toggle('hidden', pt !== 'plane');
}

document.getElementById('showHitboxes').addEventListener('change', e => {
  boxGroup.visible = e.target.checked;
  if (!e.target.checked && selected && selected.userData.kind === 'hitbox') {
    transform.detach();
    selected = null;
  }
});
document.getElementById('addSmoke').addEventListener('click', addSmoke);
document.getElementById('addSlot').addEventListener('click', addSlot);
window.addEventListener('tabchange', e => { if (e.detail === 'viewerTab') refreshPlacementVisibility(); });
refreshPlacementVisibility();
assembleOutput();

document.getElementById('applyBtn').addEventListener('click', () => {
  if (!window.PresetForm) { setStatus('Form not ready.'); return; }
  if (!Object.keys(output).length) { setStatus('Nothing to apply yet — load a model or add slots / smoke.'); return; }
  window.PresetForm.applyPartial(output);
  setStatus('Applied to preset. Switch to the Form tab to review.');
});
