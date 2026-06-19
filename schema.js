const VEHICLE_TYPES = ['plane', 'helicopter', 'car', 'boat', 'submarine', 'stationary'];
const SLOT_TYPES = [
  'seat', 'external', 'external_tough', 'mount_light', 'mount_med', 'mount_heavy',
  'mount_tech', 'pylon_light', 'pylon_med', 'pylon_heavy', 'internal', 'tech_internal',
  'high_tech_internal', 'internal_gun', 'spin_engine', 'push_engine', 'radial_engine'
];
const LOOP_SOUND_TYPES = ['basic', 'fighter_jet'];
const VOICE_PACKS = ['no_voice', 'eng_non_binary_goober', 'eng_male_1'];
const PHYSICS_INPUT_TYPES = ['NONE', 'LEFT_FLAP', 'RIGHT_FLAP', 'ELEVATOR', 'STABILIZER'];

const isPlane = d => d.presetType === 'plane';
const isHeli = d => d.presetType === 'helicopter';
const isCar = d => d.presetType === 'car';
const isStationary = d => d.presetType === 'stationary';

window.DSC_SLOT_TYPES = SLOT_TYPES;

window.PRESET_SCHEMA = [
  {
    group: 'Identity',
    description: 'Top-level fields that identify the preset and control loading order.',
    children: [
      { name: 'presetType', type: 'select', label: 'Preset Type', options: VEHICLE_TYPES, required: true, description: 'Determines what kind of stats the preset should have. Note: the type string for a helicopter is "helicopter", while its stats live under the "heli" object.' },
      { name: 'presetId', type: 'text', label: 'Preset Id', description: 'Must equal the JSON file name, or be left empty.', required: false },
      { name: 'displayName', type: 'text', label: 'Display Name', default: '', description: 'Optional custom translatable lang key. Defaults to preset.[namespace].[presetId].', required: false },
      { name: 'copyId', type: 'text', label: 'Copy Id (inherit)', default: '', description: 'Inherit all stats from the preset with this id, then override only the fields you set here.', required: false },
      { name: 'priority', type: 'number', label: 'Priority', description: 'If another preset with the same presetId is found, the highest priority wins. Default 0.', required: false },
      { name: 'sort_factor', type: 'number', label: 'Sort Factor', description: 'Lower sort factors are listed before higher ones in crafting workbenches. Default 0.', required: false },
    ]
  },
  {
    group: 'Basic Properties',
    children: [
      { name: 'is_craftable', type: 'checkbox', label: 'Is Craftable', default: false, description: 'This parameter lies and is only used by my automatic preset generator. It doesn\'t actually make a vehicle preset appear in the vehicle workbench. You need to add a recipe json file to the recipes data folder. See example preset recipe that comes with the mod' },
      { name: 'item', type: 'resource_location', label: 'Item', default: 'dscombat:vehicle', description: 'The vehicle item. Leave as dscombat:vehicle unless your mod adds an item that extends the ItemVehicle class. A root (non-copyId) preset should keep this set.', required: false },
      { name: 'display_name_base', type: 'text', label: 'Display Name Base', default: '', description: 'A translation key identifying this vehicle type without preset descriptors (e.g. "Alexis Plane"). Optional — defaults to item.dscombat.<assetId> when left blank.', required: false },
      { name: 'landing_gear', type: 'checkbox', label: 'Landing Gear', default: false, description: 'Enable retractable landing gear on spawn.' },
      { name: 'paintjob_color', type: 'number', label: 'Paintjob Color', description: 'Default base texture index. Default 0.', required: false },
      { name: 'health', type: 'number', label: 'Health', default: 0, description: 'The initial health a vehicle spawns with. Should be equal to max_health. Yes you need to define health and max_health separately. Must be positive!', required: true },
      { name: 'armor', type: 'number', label: 'Armor', default: 0, description: 'The initial armor a vehicle spawns with. Should be equal to base_armor. Yes you need to define armor and base_armor separately. Must be positive!', required: true },
    ]
  },
  {
    group: 'Common Stats',
    description: 'Basic stats applicable to all vehicle types',
    children: [
      { name: 'stats.assetId', type: 'text', label: 'Asset Id', description: 'Client-side asset identifier; must match the Vehicle Client json filename. Defaults to presetId.', required: false },
      { name: 'stats.max_health', type: 'number', label: 'Max Health', description: 'The maximum health this vehicle can have. Must be positive!', default: 10 },
      { name: 'stats.max_speed', type: 'number', label: 'Max Speed', description: 'The maximum horizontal speed in meters/tick with afterburner ON. Must be positive!', default: 0.1 },
      { name: 'stats.max_ground_speed', type: 'number', label: 'Max Ground Speed', description: 'Maximum speed while on the ground in meters/tick. Defaults to max_speed.', required: false },
      { name: 'stats.cruise_speed', type: 'number', label: 'Cruise Speed', description: 'Max speed with afterburner OFF. Used by planes. Defaults to max_speed.', required: false, showIf: isPlane },
      { name: 'stats.mass', type: 'number', label: 'Mass', description: 'Determined the vehicles weight. Must be positive!', default: 1000 },
      { name: 'stats.stealth', type: 'number', label: 'Stealth', description: 'A stealth value of 0 means the vehicle is invisible to radars. 1 means no stealth. Values greater than 1 make it easier for radars to see this vehicle. Values less than 1 make it harder for radars to see. Must be positive!', default: 1 },
      { name: 'stats.cross_sec_area', type: 'number', label: 'Cross Sectional Area', description: 'Larger values mean more air resistance and make it easier for a radar to detect. Must be positive!', default: 10 },
      { name: 'stats.drag_area', type: 'number', label: 'Drag Area', description: 'Surface area used for drag calculation in meters². Defaults to cross_sec_area.', required: false },
      { name: 'stats.idleheat', type: 'number', label: 'Idle Heat', description:'Heat determines how likely a heat seeking missile will target this vehicle. The larger the value, the more likely to be targeted. idleheat is the passive heat emission from the vehicle. Note the vehicle will get hotter when the engines are running. Must be positive!', default: 10 },
      { name: 'stats.use_horizontal_speed_scale', type: 'checkbox', label: 'Use Horizontal Speed Scale', description: 'If true, all horizontal speeds are scaled to 1/8th.', default: false },
      { name: 'stats.use_vertical_speed_scale', type: 'checkbox', label: 'Use Vertical Speed Scale', description: 'If true, all vertical speeds are scaled to 1/8th.', default: false },
    ]
  },
  {
    group: 'Armor Stats',
    description: 'Stats related to vehicle armor and damage handling',
    children: [
      { name: 'stats.base_armor', type: 'number', label: 'Base Armor', description: 'The maximum armor this vehicle can have. Must be positive!', default: 0 },
      { name: 'stats.armor_damage_threshold', type: 'number', label: 'Armor Damage Threshold', description:'The minimum damage that must be inflicted on a vehicle with armor, before it starts taking damage. Must be positive!', default: 0 },
      { name: 'stats.armor_damage_absorbtion', type: 'number', label: 'Armor Damage Absorption', description:'Must be a value between 0 and 1! The percentage of damage reduced from attacks when the vehicle has armor.', default: 0 },
    ]
  },
  {
    group: 'Movement Control',
    description: 'Stats related to movement and control',
    children: [
      { name: 'stats.max_altitude', type: 'number', label: 'Max Altitude', description: 'The maximum altitude a vehicle is allowed to reach. Note: altitude is distance from sea level. Sea level in the overworld is y = 70. So the default max y coordinate is 400.', default: 330 },
      { name: 'stats.throttleup', type: 'number', label: 'Throttle Up', description:'Throttle is a number that can be between 0 and 1. This is the amount throttle increases per tick when the player inputs Throttle Increase. Must be positive!', default: 0.01 },
      { name: 'stats.throttledown', type: 'number', label: 'Throttle Down', description:'Throttle is a number that can be between 0 and 1. This is the amount throttle decreases per tick when the player inputs Throttle Decrease. Must be positive!', default: 0.01 },
      { name: 'stats.negativeThrottle', type: 'checkbox', label: 'Negative Throttle', description: 'If true, throttle can be between -1 and 1 allowing for backwards thrust. Used in cars, boats, and submarines. Should be kept as false in planes and helicopters.', default: false, showIf: d => ['car','boat','submarine'].includes(d.presetType) },
      { name: 'stats.turn_radius', type: 'number', label: 'Turn Radius', description: 'The minimum turn radius when the vehicle drives on the ground. Must be positive!', default: 100 },
      { name: 'stats.break_deacc_ground', type: 'number', label: 'Brake Deaccel (Ground)', description: 'Deacceleration using brakes on the ground in meters/tick².', required: false },
      { name: 'stats.break_deacc_air', type: 'number', label: 'Brake Deaccel (Air)', description: 'Deacceleration using brakes in the air in meters/tick².', required: false },
      { name: 'stats.min_drive_acc', type: 'number', label: 'Min Drive Accel', description: 'Minimum ground acceleration at full throttle.', required: false },
    ]
  },
  {
    group: 'Rotation Controls',
    description: 'Stats related to rotation and turning',
    children: [
      { name: 'stats.maxroll', type: 'number', label: 'Max Roll', description: 'The maximum change in roll that the vehicle can perform when the player inputs roll left or right in degrees per tick. Must be positive!', default: 0 },
      { name: 'stats.maxpitch', type: 'number', label: 'Max Pitch', description:'The maximum change in pitch that the vehicle can perform when the player inputs pitch up or down in degrees per tick. Must be positive!', default: 0 },
      { name: 'stats.maxyaw', type: 'number', label: 'Max Yaw', description: 'The maximum change in yaw that the vehicle can perform when the player inputs yaw left or right in degrees per tick. Must be positive!', default: 0 },
      { name: 'stats.torqueroll', type: 'number', label: 'Torque Roll', description: 'Controls how quickly the vehicle can accelerate into its maximum roll rate. Must be positive! Leave blank to use the mod default (inertiaroll × 100).', required: false },
      { name: 'stats.torquepitch', type: 'number', label: 'Torque Pitch', description: 'Controls how quickly the vehicle can accelerate into its maximum pitch rate. Must be positive! Leave blank to use the mod default (inertiapitch × 10).', required: false },
      { name: 'stats.torqueyaw', type: 'number', label: 'Torque Yaw', description: 'Controls how quickly the vehicle can accelerate into its maximum yaw rate. Must be positive! Leave blank to use the mod default (inertiayaw × 10).', required: false },
      { name: 'stats.inertiaroll', type: 'number', label: 'Inertia Roll', description: 'Controls how much "resistance" there is to turning on the roll axis. Must be greater than zero! Leave blank to use the mod default (1000).', required: false },
      { name: 'stats.inertiapitch', type: 'number', label: 'Inertia Pitch', description: 'Controls how much "resistance" there is to turning on the pitch axis. Must be greater than zero! Leave blank to use the mod default (1000).', required: false },
      { name: 'stats.inertiayaw', type: 'number', label: 'Inertia Yaw', description: 'Controls how much "resistance" there is to turning on the yaw axis. Must be greater than zero! Leave blank to use the mod default (1000).', required: false },
      { name: 'stats.has_turn_assist', type: 'checkbox', label: 'Has Turn Assist', description: 'Enable the rate limiter used by modern fighter jets.', default: false },
      { name: 'stats.hard_coded_rot_acc', type: 'vec3', label: 'Hard Coded Rot Accel', description: 'Rotational acceleration override per axis (x=pitch, y=yaw, z=roll). Optional.', required: false },
      { name: 'stats.hard_coded_rot_decel', type: 'number', label: 'Hard Coded Rot Decel', description: 'Rotational deacceleration rate in degrees/tick². Optional.', required: false },
    ]
  },
  {
    group: 'Hitbox & Physics',
    description: 'Stats related to the root hitbox and collision',
    children: [
      { name: 'stats.crashExplosionRadius', type: 'number', label: 'Crash Explosion Radius', description:'The radius of an explosion if the vehicle crashes into an obstacle. If no explosion is wanted then keep it at zero.', default: 0 },
      { name: 'stats.cameraDistance', type: 'number', label: 'Camera Distance', description:'The distance the pilots third person camera is from the player head. The vanilla/default distance is 4. Must be greater than zero!', default: 4 },
      { name: 'stats.mastType', type: 'select', label: 'Mast Type', options: ['NONE', 'THIN', 'NORMAL', 'LARGE'], default: 'NONE', description: 'The kind of mast that external radars will sit on. Mostly used for boats', showIf: d => ['boat', 'submarine'].includes(d.presetType) },
      { name: 'stats.rootHitboxNoCollide', type: 'checkbox', label: 'Root Hitbox No Collide', description:'If true, entities no longer collide with the main hitbox of the vehicle and players cant damage or interact with it either. Entities will only collide with the rotable hitboxes within hitboxes instead. Players can interact/right click the first hitbox in the hitboxes list. The root hitbox will still handle block collisions regardless. When you enable hitboxes (F3+B) the root hitbox is the white box, and the rotable hitboxes are the orange boxes.', default: false },
      { name: 'stats.entity_size_xz', type: 'number', label: 'Entity Size XZ', description: 'The horizontal size of the root hitbox. Must be greater than zero!', default: 4 },
      { name: 'stats.entity_size_y', type: 'number', label: 'Entity Size Y', description:'The vertical size of the root hitbox. Must be greater than zero!', default: 4 },
      { name: 'stats.groundXTilt', type: 'number', label: 'Ground X Tilt', description: 'The angle in degrees that the vehicle should tilt up when on the ground. Used in WW2 style planes where the nose points up while on the ground.', default: 0 },
      { name: 'stats.hitboxes_control_pitch', type: 'array', label: 'Hitboxes Control Pitch', description: 'Hitbox names; if all are destroyed, pitch control is lost.', required: false, item: { type: 'text', label: 'Hitbox name' } },
      { name: 'stats.hitboxes_control_yaw', type: 'array', label: 'Hitboxes Control Yaw', description: 'Hitbox names; if all are destroyed, yaw control is lost.', required: false, item: { type: 'text', label: 'Hitbox name' } },
      { name: 'stats.hitboxes_control_roll', type: 'array', label: 'Hitboxes Control Roll', description: 'Hitbox names; if all are destroyed, roll control is lost.', required: false, item: { type: 'text', label: 'Hitbox name' } },
    ]
  },
  {
    group: 'Engine Overrides',
    description: 'Optional overrides for the installed engine part item stats',
    children: [
      { name: 'stats.max_push_thrust_per_engine', type: 'number', label: 'Max Push Thrust / Engine', description: 'Override engine item stats for push thrust.', required: false },
      { name: 'stats.max_afterburner_push_thrust_per_engine', type: 'number', label: 'Max Afterburner Push Thrust / Engine', description: 'Afterburner thrust per engine in Newtons. Defaults to max_push_thrust_per_engine.', required: false },
      { name: 'stats.max_spin_thrust_per_engine', type: 'number', label: 'Max Spin Thrust / Engine', description: 'Override engine item stats for spin thrust.', required: false },
      { name: 'stats.heat_per_engine', type: 'number', label: 'Heat / Engine', description: 'Override engine item stats for engine heat.', required: false },
      { name: 'stats.fuel_consume_per_engine', type: 'number', label: 'Fuel Consume / Engine', description: 'Override engine item stats for fuel consumption per tick.', required: false },
    ]
  },
  {
    group: 'Aircraft: Plane Stats',
    description: 'Stats specific to planes (stats.plane)',
    showIf: isPlane,
    children: [
      { name: 'stats.plane.flapsAOABias', type: 'number', label: 'Flaps AOA Bias', description: 'Angle of Attack increase in degrees when flaps are deployed. Higher values provide more lift at slower speeds.', default: 8 },
      { name: 'stats.plane.canAimDown', type: 'checkbox', label: 'Can Aim Down', description: 'If true, the Special 2 key points the nose gun down ~25°.', default: false },
      { name: 'stats.plane.wing_area', type: 'number', label: 'Wing Area', description: 'Wing surface area. Higher values mean more lift.', default: 10 },
      { name: 'stats.plane.fuselage_lift_area', type: 'number', label: 'Fuselage Lift Area', description: 'Fuselage surface area. Higher values mean more lift.', default: 0 },
      { name: 'stats.plane.wing_lift_k_graph', type: 'text', label: 'Wing Lift K Graph', description: 'Stat graph id (presetType: aoaliftk) for the wing lift coefficient. Default "fuselage".', required: false },
      { name: 'stats.plane.fuselage_lift_k_graph', type: 'text', label: 'Fuselage Lift K Graph', description: 'Stat graph id (presetType: aoaliftk) for the fuselage lift coefficient. Default "fuselage".', required: false },
      { name: 'stats.plane.turn_rates_graph', type: 'text', label: 'Turn Rates Graph', description: 'Stat graph id (presetType: turn_rates_speed) for max turn rates vs speed. Default "wooden_plane_turn_rates".', required: false },
      { name: 'stats.plane.drag_aoa_graph_key', type: 'text', label: 'Drag AOA Graph Key', description: 'Stat graph id for drag vs AOA. Default "default_drag_aoa".', required: false },
      { name: 'stats.plane.aoa_drag_factor', type: 'number', label: 'AOA Drag Factor', description: 'Scale for high AOA drag.', required: false },
      { name: 'stats.plane.centripetal_scale', type: 'number', label: 'Centripetal Scale', description: 'Scale for the horizontal wing-generated force.', required: false },
      { name: 'stats.plane.wing_lift_hitbox_names', type: 'array', label: 'Wing Lift Hitbox Names', description: 'Hitbox names; the alive percentage scales wing_area.', required: false, item: { type: 'text', label: 'Hitbox name' } },
    ]
  },
  {
    group: 'Aircraft: Helicopter Stats',
    description: 'Stats specific to helicopters (stats.heli)',
    showIf: isHeli,
    children: [
      { name: 'stats.heli.heliLiftFactor', type: 'number', label: 'Heli Lift Factor', description: 'Make this value bigger if you want the helicopter to support more weight. Must be positive!', default: 1 },
      { name: 'stats.heli.alwaysLandingGear', type: 'checkbox', label: 'Always Landing Gear', description: 'If true, the helicopters landing gear is always active.', default: false },
      { name: 'stats.heli.accForward', type: 'number', label: 'Acceleration Forward', description: 'Forward acceleration rate.', required: false },
      { name: 'stats.heli.accSide', type: 'number', label: 'Acceleration Side', description: 'Sideways acceleration rate.', required: false },
    ]
  },
  {
    group: 'Vehicle: Car Stats',
    description: 'Stats specific to cars (stats.car)',
    showIf: isCar,
    children: [
      { name: 'stats.car.isTank', type: 'checkbox', label: 'Is Tank', description: 'If true, the vehicle will use tank drive physics instead of car drive physics.', default: false },
    ]
  },
  {
    group: 'Vehicle: Stationary Stats',
    description: 'Stats specific to stationary emplacements (stats.stationary)',
    showIf: isStationary,
    children: [
      { name: 'stats.stationary.isStationaryRadar', type: 'checkbox', label: 'Is Stationary Radar', description: 'If true, this stationary emplacement acts as a radar.', default: false },
    ]
  },
  {
    group: 'Slots',
    description: 'All slots and their part items. Must include exactly ONE pilot_seat.',
    children: [
      {
        name: 'slots', type: 'array', label: 'Slots', addLabel: 'Add slot', required: false,
        item: {
          fields: [
            { name: 'name', type: 'text', label: 'Name', required: true, description: 'Unique slot identifier. Special names: pilot_seat (one required), copilot_seat.' },
            { name: 'slot_type', type: 'select', label: 'Slot Type', options: SLOT_TYPES, description: 'Compatible part type for this slot.' },
            { name: 'slot_posx', type: 'number', label: 'Pos X', required: false },
            { name: 'slot_posy', type: 'number', label: 'Pos Y', required: false },
            { name: 'slot_posz', type: 'number', label: 'Pos Z', required: false },
            { name: 'zRot', type: 'number', label: 'Z Rotation', required: false, description: 'Part rotation in degrees: 0=top, 180=bottom, 90=right, -90=left.' },
            { name: 'locked', type: 'checkbox', label: 'Locked', default: false, description: 'If true, the player cannot modify this slot\'s part.' },
            { name: 'onlyCompatPart', type: 'text', label: 'Only Compat Part', required: false, description: 'If set, only this part presetId is allowed.' },
            { name: 'linkedHitbox', type: 'text', label: 'Linked Hitbox', required: false, description: 'Hitbox name; if destroyed, damages the part in this slot.' },
            {
              name: 'data', type: 'object', label: 'Data', description: 'Part data. Supply either part (presetId) or itemid (resource location).',
              fields: [
                { name: 'part', type: 'text', label: 'Part (presetId)', required: false, description: 'e.g. "seat".' },
                { name: 'itemid', type: 'resource_location', label: 'Item Id', required: false, description: 'e.g. "dscombat:seat".' },
                { name: 'filled', type: 'checkbox', label: 'Filled', default: false, description: 'If true, the part is pre-filled in new vehicle instances.' },
                { name: 'param', type: 'text', label: 'Param', required: false, description: 'Extra parameter when filled; for weapons/turrets supply the Weapon presetId.' },
              ]
            },
          ]
        }
      },
    ]
  },
  {
    group: 'Hitboxes',
    description: 'Custom hitboxes with unique names.',
    children: [
      {
        name: 'hitboxes', type: 'array', label: 'Hitboxes', addLabel: 'Add hitbox', required: false,
        item: {
          fields: [
            { name: 'name', type: 'text', label: 'Name', required: true, description: 'Unique hitbox identifier.' },
            { name: 'size', type: 'vec3', label: 'Size', description: 'Hitbox dimensions.' },
            { name: 'rel_pos', type: 'vec3', label: 'Relative Position', description: 'Position relative to the vehicle origin.' },
            { name: 'max_health', type: 'number', label: 'Max Health', default: 0, description: 'If >0, the hitbox is destroyed when its health reaches zero.' },
            { name: 'max_armor', type: 'number', label: 'Max Armor', default: 0, description: 'Armor stat takes damage before health.' },
            { name: 'remove_on_destroy', type: 'checkbox', label: 'Remove On Destroy', default: false, description: 'If true, stops colliding with entities when destroyed.' },
            { name: 'damage_parts', type: 'checkbox', label: 'Damage Parts', default: false, description: 'If true, randomly damages linked parts at 50% health.' },
            { name: 'damage_root', type: 'checkbox', label: 'Damage Root', default: false, description: 'If true, this hitbox and the root share health damage.' },
          ]
        }
      },
    ]
  },
  {
    group: 'Crafting Ingredients',
    description: 'Ingredients needed for Vehicle Workbench crafting.',
    children: [
      {
        name: 'ingredients', type: 'array', label: 'Ingredients', addLabel: 'Add ingredient', required: false,
        item: {
          fields: [
            { name: 'num', type: 'number', label: 'Quantity', required: true, description: 'How many are needed.' },
            { name: 'item', type: 'resource_location', label: 'Item', required: false, description: 'Item id (use this OR tag).' },
            { name: 'tag', type: 'resource_location', label: 'Tag', required: false, description: 'Tag id (use this OR item).' },
          ]
        }
      },
    ]
  },
  {
    group: 'Sounds',
    description: 'Vehicle sounds. Keys vary by vehicle type — common ones are pre-filled; add more as needed (e.g. plane cockpit/external sounds).',
    children: [
      {
        name: 'sounds', type: 'kvlist', label: 'Sound Entries', addLabel: 'Add sound', required: false,
        keyPlaceholder: 'sound key (e.g. passengerEngine)', valuePlaceholder: 'value (e.g. dscombat:heli_1)',
        default: { loopSoundType: 'basic' },
        description: 'loopSoundType is the sound engine: "basic" (uses passengerEngine + nonPassengerEngine sound events) or "fighter_jet" (uses cockpit*/external* keys: externalAfterBurnerClose, externalAfterBurnerFar, externalRPM, externalWindClose, externalWindFar, cockpitRPM, cockpitAfterBurner, cockpitWindSlow, cockpitWindFast). All values are sound-event resource locations.'
      },
    ]
  },
  {
    group: 'Textures',
    description: 'Texture variants available for spray-can customization.',
    children: [
      {
        name: 'textures', type: 'object', label: 'Textures', required: false,
        fields: [
          { name: 'baseTextureVariants', type: 'number', label: 'Base Texture Variants', description: 'Number of base textures/skins available. Default 1.', required: false },
          { name: 'textureLayers', type: 'number', label: 'Texture Layers', description: 'Number of layer textures. Must be positive. Default 0.', required: false },
        ]
      },
    ]
  },
  {
    group: 'Afterburner Smoke',
    description: 'Positions for afterburner particle effects (planes).',
    showIf: isPlane,
    children: [
      {
        name: 'after_burner_smoke', type: 'array', label: 'Afterburner Smoke Positions', addLabel: 'Add position', required: false,
        item: {
          fields: [
            { name: 'pos', type: 'vec3', label: 'Position', description: 'Position relative to the vehicle origin.' },
          ]
        }
      },
    ]
  },
  {
    group: 'Physics Components (Advanced)',
    description: 'Simulated lift surfaces contributing to net forces (advanced; mostly planes).',
    showIf: isPlane,
    children: [
      {
        name: 'physics_components', type: 'array', label: 'Physics Components', addLabel: 'Add lift surface', required: false,
        item: {
          fields: [
            { name: 'id', type: 'select', label: 'Type', options: ['lift_surface'], default: 'lift_surface', description: 'Physics component type.' },
            { name: 'hitbox', type: 'text', label: 'Hitbox', default: 'NONE', required: false, description: 'NONE = active while operational; otherwise the hitbox name that activates it.' },
            { name: 'pos', type: 'vec3', label: 'Position', description: 'Position in meters relative to the vehicle origin.' },
            { name: 'rotation', type: 'vec3', label: 'Rotation', description: 'Default rotation in degrees relative to the vehicle.' },
            { name: 'area', type: 'number', label: 'Area', default: 10, description: 'Surface area in meters².' },
            { name: 'input_type', type: 'select', label: 'Input Type', options: PHYSICS_INPUT_TYPES, default: 'NONE', description: 'Control surface type.' },
            { name: 'input_rotation_max', type: 'number', label: 'Input Rotation Max', default: 4, description: 'Maximum rotation in degrees at maximum input.' },
            { name: 'ignore_roll', type: 'checkbox', label: 'Ignore Roll', default: false, description: 'If true, does not rotate on the roll axis.' },
            { name: 'lift_k_graph', type: 'text', label: 'Lift K Graph', default: 'fuselage', required: false, description: 'Lift vs AOA stat graph id.' },
            { name: 'zero_lift_drag', type: 'number', label: 'Zero Lift Drag', default: 0.5, description: 'Drag coefficient at 0° AOA.' },
            { name: 'drag_graph', type: 'text', label: 'Drag Graph', default: 'default_drag_aoa', required: false, description: 'Drag vs AOA stat graph id.' },
          ]
        }
      },
    ]
  },
];
