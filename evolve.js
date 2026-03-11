#!/usr/bin/env node
// ============================================================
// STARCLASH Evolutionary AI Trainer
// Runs thousands of self-play games using genetic algorithms
// to discover optimal AI parameters through natural selection.
// ============================================================

// ---- Mirror all game constants from simulate.js ----
const GAME_W = 400;
const GAME_H = 1400;
const VIEWPORT_H = 700;
const PANEL_W = 90;
const ARENA_W = GAME_W - PANEL_W;
const RIVER_Y = GAME_H / 2;
const RIVER_H = 18;
const LANE_X = [ARENA_W * 0.30, ARENA_W * 0.70];
const TOWER_R = 22;
const BASE_R = 28;
const MINE_TIME = 1.5;
const CARRY_AMOUNT = 5;
const GAS_PER_WORKER_PER_SEC = 0.63;

const FACTIONS = ['terran', 'protoss', 'zerg'];

const BUILDING_DEFS = {
  _base:     { faction:'all', cost:0, buildTime:0, name:'Base', unlocks:[], r:BASE_R, supplyCap:10 },
  commandcenter: { faction:'terran', cost:400, buildTime:15, name:'CC', unlocks:['scv'], r:20, supplyCap:11, isExpansion:true },
  nexus:         { faction:'protoss', cost:400, buildTime:15, name:'Nexus', unlocks:['probe'], r:20, supplyCap:11, isExpansion:true },
  hatchery:      { faction:'zerg', cost:300, buildTime:15, name:'Hatchery', unlocks:['drone'], r:20, supplyCap:11, isExpansion:true },
  supplydepot: { faction:'terran', cost:100, buildTime:5, name:'Depot', unlocks:[], r:14, supplyCap:10 },
  pylon:       { faction:'protoss', cost:100, buildTime:5, name:'Pylon', unlocks:[], r:14, supplyCap:10 },
  overlord:    { faction:'zerg', cost:100, buildTime:5, name:'Overlord', unlocks:[], r:14, supplyCap:10 },
  refinery:    { faction:'terran', cost:75, buildTime:5, name:'Refinery', unlocks:[], r:14, gasBuilding:true },
  assimilator: { faction:'protoss', cost:75, buildTime:5, name:'Assimilator', unlocks:[], r:14, gasBuilding:true },
  extractor:   { faction:'zerg', cost:75, buildTime:5, name:'Extractor', unlocks:[], r:14, gasBuilding:true },
  barracks:  { faction:'terran', cost:150, buildTime:8, name:'Barracks', unlocks:['marine','marauder','medic'], r:18 },
  factory:   { faction:'terran', cost:200, buildTime:12, name:'Factory', unlocks:['siegetank','ghost'], requires:'barracks', r:18 },
  starport:  { faction:'terran', cost:150, gasCost:100, buildTime:10, name:'Starport', unlocks:['viking','medivac','battlecruiser'], requires:'factory', r:18 },
  gateway:   { faction:'protoss', cost:150, buildTime:8, name:'Gateway', unlocks:['zealot','stalker','sentry'], r:18 },
  robo:      { faction:'protoss', cost:200, buildTime:12, name:'Robo Bay', unlocks:['immortal','hightemplar'], requires:'gateway', r:18 },
  fleetbeacon: { faction:'protoss', cost:150, gasCost:100, buildTime:10, name:'Fleet Beacon', unlocks:['phoenix','voidray','carrier'], requires:'robo', r:18 },
  pool:      { faction:'zerg', cost:200, buildTime:8, name:'Spawn Pool', unlocks:['zergling','roach','baneling'], r:18 },
  den:       { faction:'zerg', cost:100, gasCost:100, buildTime:12, name:'Hydra Den', unlocks:['hydralisk','ultralisk'], requires:'pool', r:18 },
  spire:     { faction:'zerg', cost:200, gasCost:200, buildTime:10, name:'Spire', unlocks:['mutalisk','corruptor','broodlord'], requires:'den', r:18 },
};

const FACTION_SUPPLY = { terran:'supplydepot', protoss:'pylon', zerg:'overlord' };
const FACTION_GAS = { terran:'refinery', protoss:'assimilator', zerg:'extractor' };
const FACTION_EXPANSION = { terran:'commandcenter', protoss:'nexus', zerg:'hatchery' };
const FACTION_BUILDINGS = {
  terran: ['supplydepot','refinery','commandcenter','barracks','factory','starport'],
  protoss: ['pylon','assimilator','nexus','gateway','robo','fleetbeacon'],
  zerg: ['overlord','extractor','hatchery','pool','den','spire'],
};

const UNIT_DEFS = {
  marine:       { faction:'terran', cost:50,  gasCost:0,   supply:1, hp:195, dmg:31, speed:1.3, range:120, atkSpeed:0.8, count:3, r:8,  name:'Marine', buildTime:3 },
  marauder:     { faction:'terran', cost:100, gasCost:25,  supply:2, hp:450, dmg:55, speed:1.0, range:90,  atkSpeed:1.0, count:2, r:10, name:'Marauder', buildTime:4 },
  medic:        { faction:'terran', cost:100, gasCost:100, supply:2, hp:200, dmg:0,  speed:1.2, range:100, atkSpeed:1.5, count:2, r:8,  name:'Medic', healer:true, healAmt:40, buildTime:3 },
  siegetank:    { faction:'terran', cost:150, gasCost:125, supply:3, hp:600, dmg:120,speed:0.5, range:160, atkSpeed:2.0, count:1, r:14, name:'Siege Tank', splash:30, buildTime:6 },
  ghost:        { faction:'terran', cost:150, gasCost:125, supply:2, hp:350, dmg:80, speed:1.1, range:140, atkSpeed:1.2, count:1, r:9,  name:'Ghost', buildTime:5 },
  scv:          { faction:'terran', cost:50,  gasCost:0,   supply:1, hp:200, dmg:0,  speed:1.0, range:0,   atkSpeed:0,   count:1, r:8,  name:'SCV', worker:true, mineRate:0.3, buildTime:2 },
  viking:       { faction:'terran', cost:150, gasCost:75,  supply:2, hp:280, dmg:40, speed:1.3, range:120, atkSpeed:0.9, count:1, r:10, name:'Viking', buildTime:5, isAir:true },
  medivac:      { faction:'terran', cost:100, gasCost:100, supply:2, hp:200, dmg:0,  speed:1.4, range:100, atkSpeed:1.5, count:1, r:10, name:'Medivac', healer:true, healAmt:30, buildTime:5, isAir:true },
  battlecruiser:{ faction:'terran', cost:400, gasCost:300, supply:6, hp:800, dmg:70, speed:0.6, range:130, atkSpeed:1.0, count:1, r:16, name:'Battlecruiser', splash:20, buildTime:10, isAir:true },
  zealot:       { faction:'protoss', cost:100, gasCost:0,   supply:2, hp:530, dmg:56, speed:1.4, range:20,  atkSpeed:0.7, count:2, r:10, name:'Zealot', buildTime:3 },
  stalker:      { faction:'protoss', cost:125, gasCost:50,  supply:2, hp:390, dmg:53, speed:1.2, range:130, atkSpeed:0.9, count:2, r:9,  name:'Stalker', buildTime:4 },
  sentry:       { faction:'protoss', cost:50,  gasCost:100, supply:2, hp:250, dmg:25, speed:1.0, range:110, atkSpeed:1.0, count:2, r:8,  name:'Sentry', shield:true, shieldAmt:140, buildTime:3 },
  hightemplar:  { faction:'protoss', cost:50,  gasCost:150, supply:2, hp:280, dmg:180,speed:0.7, range:130, atkSpeed:2.5, count:1, r:9,  name:'High Templar', splash:55, buildTime:6 },
  immortal:     { faction:'protoss', cost:275, gasCost:100, supply:4, hp:650, dmg:85, speed:0.8, range:100, atkSpeed:1.2, count:1, r:13, name:'Immortal', buildTime:5 },
  probe:        { faction:'protoss', cost:50,  gasCost:0,   supply:1, hp:180, dmg:0,  speed:1.0, range:0,   atkSpeed:0,   count:1, r:8,  name:'Probe', worker:true, mineRate:0.3, buildTime:2 },
  phoenix:      { faction:'protoss', cost:150, gasCost:100, supply:2, hp:250, dmg:35, speed:1.6, range:110, atkSpeed:0.8, count:1, r:9,  name:'Phoenix', buildTime:5, isAir:true },
  voidray:      { faction:'protoss', cost:250, gasCost:150, supply:4, hp:300, dmg:50, speed:0.9, range:130, atkSpeed:1.2, count:1, r:11, name:'Void Ray', buildTime:7, isAir:true },
  carrier:      { faction:'protoss', cost:350, gasCost:250, supply:6, hp:600, dmg:40, speed:0.7, range:150, atkSpeed:0.5, count:1, r:15, name:'Carrier', buildTime:10, isAir:true },
  zergling:     { faction:'zerg', cost:50,  gasCost:0,   supply:1, hp:165, dmg:27, speed:2.0, range:18,  atkSpeed:0.5, count:7, r:6,  name:'Zergling', buildTime:2 },
  roach:        { faction:'zerg', cost:75,  gasCost:25,  supply:2, hp:540, dmg:37, speed:1.0, range:80,  atkSpeed:0.8, count:2, r:10, name:'Roach', buildTime:3 },
  hydralisk:    { faction:'zerg', cost:100, gasCost:50,  supply:2, hp:350, dmg:50, speed:1.1, range:130, atkSpeed:0.8, count:2, r:9,  name:'Hydralisk', buildTime:4 },
  baneling:     { faction:'zerg', cost:25,  gasCost:25,  supply:1, hp:120, dmg:200,speed:1.8, range:15,  atkSpeed:0.1, count:4, r:7,  name:'Baneling', suicide:true, splash:35, buildTime:3 },
  ultralisk:    { faction:'zerg', cost:300, gasCost:200, supply:6, hp:900, dmg:80, speed:0.9, range:22,  atkSpeed:1.0, count:1, r:16, name:'Ultralisk', splash:25, buildTime:8 },
  drone:        { faction:'zerg', cost:50,  gasCost:0,   supply:1, hp:160, dmg:0,  speed:1.0, range:0,   atkSpeed:0,   count:1, r:8,  name:'Drone', worker:true, mineRate:0.3, buildTime:2 },
  mutalisk:     { faction:'zerg', cost:100, gasCost:100, supply:2, hp:200, dmg:30, speed:1.8, range:90,  atkSpeed:0.7, count:1, r:9,  name:'Mutalisk', splash:15, buildTime:5, isAir:true },
  corruptor:    { faction:'zerg', cost:150, gasCost:100, supply:2, hp:350, dmg:50, speed:1.1, range:120, atkSpeed:1.0, count:1, r:11, name:'Corruptor', buildTime:5, isAir:true },
  broodlord:    { faction:'zerg', cost:150, gasCost:150, supply:4, hp:500, dmg:60, speed:0.5, range:160, atkSpeed:2.0, count:1, r:14, name:'Brood Lord', splash:25, buildTime:8, isAir:true },
};

const WORKER_TYPE = { terran:'scv', protoss:'probe', zerg:'drone' };

// ============================================================
// Evolvable AI Parameters (the "genome")
// ============================================================
// Each individual has these tunable parameters that control
// the AI's macro decision-making priorities.

function createDefaultGenome() {
  return {
    // Phase weights control priority of each action type
    workerW: 1.3,
    armyW: 1.2,
    techW: 1.0,
    expandW: 0.9,
    defenseW: 1.0,
    // Timing parameters
    attackThreshold: 0.8,   // army ratio needed to attack
    workerCap: 24,          // max workers to build
    gasTime: 4,             // when to build first gas (seconds)
    supplyBuffer: 8,        // how much supply headroom to maintain
    counterWeight: 6,       // how much to weight counter-composition
    // Unit preference weights per phase (early, mid, late)
    earlyUnitCostCap: 100,  // prefer units cheaper than this in early game
    midUnitMinCost: 150,    // prefer units at least this expensive mid game
    lateUnitMinCost: 200,   // prefer expensive units late
    // Army grouping behavior
    groupRatioThreshold: 0.55, // % of army that must be grouped before attacking
    retreatHPRatio: 0.35,   // retreat when army HP drops below this % of max
    // Expansion timing
    expandWorkerThreshold: 8,  // min workers before first expansion
    expandArmyRatio: 1.2,     // army ratio bonus for expanding
    // Worker saturation per base
    workersPerBase: 10,
  };
}

// Mutation: randomly perturb genome values
function mutateGenome(genome, mutationRate = 0.3, mutationStrength = 0.2) {
  const g = { ...genome };
  const keys = Object.keys(g);
  for (const key of keys) {
    if (Math.random() < mutationRate) {
      const val = g[key];
      const delta = val * mutationStrength * (Math.random() * 2 - 1);
      g[key] = Math.max(0.01, val + delta);
    }
  }
  return g;
}

// Crossover: blend two parent genomes
function crossover(parent1, parent2) {
  const child = {};
  const keys = Object.keys(parent1);
  for (const key of keys) {
    if (Math.random() < 0.5) {
      child[key] = parent1[key];
    } else {
      child[key] = parent2[key];
    }
  }
  return child;
}

// Random genome for initial population diversity
function randomGenome() {
  const g = createDefaultGenome();
  const keys = Object.keys(g);
  for (const key of keys) {
    const val = g[key];
    // Randomize within 50-200% of default
    g[key] = val * (0.5 + Math.random() * 1.5);
  }
  return g;
}

// ============================================================
// Evolvable Game Simulation
// ============================================================
// Modified simulator where AI decisions are parameterized by genome

class EvoGameSim {
  constructor(faction1, faction2, genome1, genome2) {
    this.playerFaction = faction1;
    this.enemyFaction = faction2;
    this.genome1 = genome1; // player AI genome
    this.genome2 = genome2; // enemy AI genome
    this.gameTime = 0;
    this.units = [];
    this.forceFields = [];
    this.playerMinerals = 50;
    this.enemyMinerals = 50;
    this.playerGas = 0;
    this.enemyGas = 0;
    this.playerSupply = 0;
    this.playerSupplyMax = 10;
    this.enemySupply = 0;
    this.enemySupplyMax = 10;
    this.playerStance = 'attack';
    this.enemyStance = 'attack';
    this.aiTimerPlayer = 0;
    this.aiTimerEnemy = 0;
    this.result = null;

    // Per-team AI state
    this.aiPhase = { player: 'opening', enemy: 'opening' };

    this.towers = {
      player: { base: { x: ARENA_W / 2, y: GAME_H - 90, hp: 2400, maxHp: 2400, r: BASE_R } },
      enemy:  { base: { x: ARENA_W / 2, y: 90, hp: 2400, maxHp: 2400, r: BASE_R } }
    };

    this.mineralPatches = {
      player: [
        { x: 35, y: GAME_H - 110, minerals: 1800, maxMinerals: 1800 },
        { x: 70, y: GAME_H - 100, minerals: 1800, maxMinerals: 1800 },
        { x: 110, y: GAME_H - 105, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 - 20, y: GAME_H - 95, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 + 30, y: GAME_H - 100, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W - 50, y: GAME_H - 105, minerals: 1800, maxMinerals: 1800 },
      ],
      enemy: [
        { x: 35, y: 110, minerals: 1800, maxMinerals: 1800 },
        { x: 70, y: 100, minerals: 1800, maxMinerals: 1800 },
        { x: 110, y: 105, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 - 20, y: 95, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 + 30, y: 100, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W - 50, y: 105, minerals: 1800, maxMinerals: 1800 },
      ],
      expansion: [
        { x: 60, y: RIVER_Y - 120, minerals: 1500, maxMinerals: 1500 },
        { x: ARENA_W - 60, y: RIVER_Y - 120, minerals: 1500, maxMinerals: 1500 },
        { x: 60, y: RIVER_Y + RIVER_H + 120, minerals: 1500, maxMinerals: 1500 },
        { x: ARENA_W - 60, y: RIVER_Y + RIVER_H + 120, minerals: 1500, maxMinerals: 1500 },
      ]
    };

    this.gasGeysers = {
      player: [
        { x: ARENA_W - 40, y: GAME_H - 65, gas: 2250, maxGas: 2250, workers: 0 },
        { x: ARENA_W - 70, y: GAME_H - 50, gas: 2250, maxGas: 2250, workers: 0 },
      ],
      enemy: [
        { x: ARENA_W - 40, y: 65, gas: 2250, maxGas: 2250, workers: 0 },
        { x: ARENA_W - 70, y: 50, gas: 2250, maxGas: 2250, workers: 0 },
      ],
    };

    this.playerBuildings = [{ type: '_base', x: ARENA_W/2, y: GAME_H - 90, hp: 2400, maxHp: 2400, built: true, buildProgress: 99, buildTime: 1, queue: [] }];
    this.enemyBuildings = [{ type: '_base', x: ARENA_W/2, y: 90, hp: 2400, maxHp: 2400, built: true, buildProgress: 99, buildTime: 1, queue: [] }];

    // Start with 4 workers each
    const pw = WORKER_TYPE[faction1];
    const ew = WORKER_TYPE[faction2];
    for (let i = 0; i < 4; i++) {
      this.spawnUnit(pw, ARENA_W/2 + (Math.random()-0.5)*30, GAME_H - 110 + (Math.random()-0.5)*15, 'player');
      this.spawnUnit(ew, ARENA_W/2 + (Math.random()-0.5)*30, 110 + (Math.random()-0.5)*15, 'enemy');
    }
  }

  dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

  spawnUnit(defName, x, y, team) {
    const def = UNIT_DEFS[defName];
    const totalSupply = (def.supply || 1) * def.count;
    if (team === 'player') this.playerSupply += totalSupply;
    else this.enemySupply += totalSupply;
    const spreadR = def.count > 1 ? 15 : 0;
    for (let i = 0; i < def.count; i++) {
      const ox = (Math.random() - 0.5) * spreadR * 2;
      const oy = (Math.random() - 0.5) * spreadR * 2;
      const shield = def.shield ? def.shieldAmt : 0;
      this.units.push({
        type: defName, team,
        x: x + ox, y: y + oy,
        hp: def.hp, maxHp: def.hp,
        shield, maxShield: shield,
        dmg: def.dmg, speed: def.speed, range: def.range,
        atkSpeed: def.atkSpeed, atkTimer: 0, r: def.r,
        dead: false,
        healer: def.healer || false, healAmt: def.healAmt || 0,
        suicide: def.suicide || false, splash: def.splash || 0,
        worker: def.worker || false, isAir: def.isAir || false,
        supply: def.supply || 1,
        miningState: 'idle', miningTimer: 0, assignedPatch: null, carrying: 0,
        siegeMode: false, siegeTimer: 0,
        chargeTimer: 0, blinkTimer: 0, empTimer: 0, forcefieldTimer: 0,
        voidrayAttackTime: 0, lastTarget: null,
        animFrame: 0,
      });
    }
  }

  getTeamSupply(team) { return team === 'player' ? this.playerSupply : this.enemySupply; }
  getTeamSupplyMax(team) { return team === 'player' ? this.playerSupplyMax : this.enemySupplyMax; }

  canAffordUnit(defName, team) {
    const def = UNIT_DEFS[defName];
    const minerals = team === 'player' ? this.playerMinerals : this.enemyMinerals;
    const gas = team === 'player' ? this.playerGas : this.enemyGas;
    return minerals >= def.cost && gas >= (def.gasCost || 0) &&
           this.getTeamSupply(team) + (def.supply || 1) * def.count <= this.getTeamSupplyMax(team);
  }

  getAvailableUnits(team) {
    const faction = team === 'player' ? this.playerFaction : this.enemyFaction;
    const buildings = team === 'player' ? this.playerBuildings : this.enemyBuildings;
    const workerType = WORKER_TYPE[faction];
    const available = [workerType];
    for (const b of buildings) {
      if (!b.built) continue;
      const bdef = BUILDING_DEFS[b.type];
      if (bdef && bdef.unlocks) {
        for (const u of bdef.unlocks) available.push(u);
      }
    }
    return available;
  }

  getAvailableBuildings(team) {
    const faction = team === 'player' ? this.playerFaction : this.enemyFaction;
    const buildings = team === 'player' ? this.playerBuildings : this.enemyBuildings;
    const all = FACTION_BUILDINGS[faction];
    const available = [];
    for (const btype of all) {
      const bdef = BUILDING_DEFS[btype];
      if (bdef.supplyCap && !bdef.isExpansion) { available.push(btype); continue; }
      if (bdef.isExpansion) {
        if (buildings.some(b => b.type === btype)) continue;
        available.push(btype); continue;
      }
      if (bdef.gasBuilding) {
        if (buildings.filter(b => b.type === btype).length >= 2) continue;
        available.push(btype); continue;
      }
      if (buildings.some(b => b.type === btype)) continue;
      if (bdef.requires) {
        if (!buildings.some(b => b.type === bdef.requires && b.built)) continue;
      }
      available.push(btype);
    }
    return available;
  }

  getBuildingForUnit(unitType, buildings) {
    const def = UNIT_DEFS[unitType];
    if (def.worker) {
      const base = buildings.find(b => b.type === '_base' && b.built);
      if (base && base.queue.length < 2) return base;
      for (const b of buildings) {
        if (!b.built) continue;
        const bdef = BUILDING_DEFS[b.type];
        if (bdef && bdef.isExpansion && bdef.unlocks && bdef.unlocks.includes(unitType)) return b;
      }
      return base;
    }
    for (const b of buildings) {
      if (!b.built) continue;
      const bdef = BUILDING_DEFS[b.type];
      if (bdef && bdef.unlocks && bdef.unlocks.includes(unitType)) return b;
    }
    return null;
  }

  findNearestPatch(unit) {
    const teamPatches = unit.team === 'player' ? this.mineralPatches.player : this.mineralPatches.enemy;
    const patches = [...teamPatches, ...(this.mineralPatches.expansion || [])];
    let best = null, bestD = Infinity;
    for (const p of patches) {
      if (p.minerals <= 0) continue;
      const d = this.dist(unit, p);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  findTarget(unit) {
    const isPlayer = unit.team === 'player';
    const stance = isPlayer ? this.playerStance : this.enemyStance;
    const maxRange = (!unit.worker && stance === 'defend') ? 150 : Infinity;
    let best = null, bestDist = Infinity;
    for (const u of this.units) {
      if (u.dead || u.team === unit.team) continue;
      if (unit.healer) continue;
      const d = this.dist(unit, u);
      if (d < bestDist && d < maxRange) { bestDist = d; best = u; }
    }
    if (unit.healer) {
      bestDist = Infinity;
      for (const u of this.units) {
        if (u.dead || u.team !== unit.team || u === unit || u.healer) continue;
        if (u.hp >= u.maxHp) continue;
        const d = this.dist(unit, u);
        if (d < bestDist) { bestDist = d; best = u; }
      }
      return best;
    }
    if (stance !== 'defend') {
      const enemyTowers = isPlayer ? this.towers.enemy : this.towers.player;
      const t = enemyTowers.base;
      if (t.hp > 0) {
        const d = this.dist(unit, t);
        if (d < bestDist) { bestDist = d; best = t; }
      }
    }
    return best;
  }

  dealDamage(target, dmg) {
    if (target.type === 'ghost') dmg = Math.floor(dmg * 0.5);
    if (target.shield && target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    target.hp -= dmg;
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.dead !== undefined) target.dead = true;
    }
  }

  dealSplash(x, y, radius, dmg, attackerTeam) {
    for (const u of this.units) {
      if (u.dead || u.team === attackerTeam) continue;
      if (this.dist(u, { x, y }) <= radius) this.dealDamage(u, dmg);
    }
    const enemyTowers = attackerTeam === 'player' ? this.towers.enemy : this.towers.player;
    const t = enemyTowers.base;
    if (t.hp > 0 && this.dist(t, { x, y }) <= radius + t.r) {
      t.hp -= dmg;
      if (t.hp < 0) t.hp = 0;
    }
  }

  updateWorker(unit, dt) {
    const baseX = ARENA_W / 2;
    const baseY = unit.team === 'player' ? GAME_H - 90 : 90;
    const moveSpeed = unit.speed * 60;
    switch (unit.miningState) {
      case 'idle': {
        const patch = this.findNearestPatch(unit);
        if (patch) { unit.assignedPatch = patch; unit.miningState = 'toMineral'; }
        break;
      }
      case 'toMineral': {
        if (!unit.assignedPatch || unit.assignedPatch.minerals <= 0) { unit.miningState = 'idle'; break; }
        const d = this.dist(unit, unit.assignedPatch);
        if (d < 12) { unit.miningState = 'mining'; unit.miningTimer = MINE_TIME; }
        else {
          const angle = Math.atan2(unit.assignedPatch.y - unit.y, unit.assignedPatch.x - unit.x);
          unit.x += Math.cos(angle) * moveSpeed * dt;
          unit.y += Math.sin(angle) * moveSpeed * dt;
        }
        break;
      }
      case 'mining': {
        unit.miningTimer -= dt;
        if (unit.miningTimer <= 0) {
          const amount = Math.min(CARRY_AMOUNT, unit.assignedPatch.minerals);
          unit.assignedPatch.minerals -= amount;
          unit.carrying = amount;
          unit.miningState = 'toBase';
        }
        break;
      }
      case 'toBase': {
        const d = this.dist(unit, { x: baseX, y: baseY });
        if (d < 20) {
          if (unit.team === 'player') this.playerMinerals += unit.carrying;
          else this.enemyMinerals += unit.carrying;
          unit.carrying = 0;
          unit.miningState = 'idle';
        } else {
          const angle = Math.atan2(baseY - unit.y, baseX - unit.x);
          unit.x += Math.cos(angle) * moveSpeed * dt;
          unit.y += Math.sin(angle) * moveSpeed * dt;
        }
        break;
      }
    }
  }

  updateUnitAbilities(unit, dt) {
    if (unit.chargeTimer > 0) unit.chargeTimer -= dt;
    if (unit.blinkTimer > 0) unit.blinkTimer -= dt;
    if (unit.empTimer > 0) unit.empTimer -= dt;
    if (unit.forcefieldTimer > 0) unit.forcefieldTimer -= dt;
    if (unit.type === 'stalker' && unit.hp < unit.maxHp * 0.5 && unit.blinkTimer <= 0) {
      const blinkDir = unit.team === 'player' ? 1 : -1;
      unit.y += 60 * blinkDir;
      unit.y = Math.max(30, Math.min(GAME_H - 30, unit.y));
      unit.blinkTimer = 10;
    }
    if (unit.type === 'ghost' && unit.empTimer <= 0) {
      let fired = false;
      for (const u of this.units) {
        if (u.dead || u.team === unit.team) continue;
        if (u.maxShield > 0 && u.shield > 0 && this.dist(unit, u) < 140) {
          for (const t of this.units) {
            if (t.dead || t.team === unit.team) continue;
            if (t.maxShield > 0 && this.dist(u, t) < 40) t.shield = 0;
          }
          fired = true; break;
        }
      }
      if (fired) unit.empTimer = 20;
    }
    if (unit.type === 'sentry' && unit.forcefieldTimer <= 0) {
      let nearbyEnemies = 0;
      for (const u of this.units) {
        if (u.dead || u.team === unit.team || u.isAir) continue;
        if (this.dist(unit, u) < 100) nearbyEnemies++;
      }
      if (nearbyEnemies >= 2) {
        let bestBridge = null, bestD = Infinity;
        for (const lx of LANE_X) {
          const d = this.dist(unit, { x: lx, y: RIVER_Y });
          if (d < bestD) { bestD = d; bestBridge = { x: lx, y: RIVER_Y }; }
        }
        if (bestBridge && bestD < 200) {
          this.forceFields.push({ x: bestBridge.x, y: bestBridge.y, r: 20, life: 4, maxLife: 4, team: unit.team });
          unit.forcefieldTimer = 15;
        }
      }
    }
  }

  getArmyValue(team) {
    let value = 0;
    for (const u of this.units) {
      if (u.dead || u.team !== team || u.worker) continue;
      const def = UNIT_DEFS[u.type];
      value += def.cost + (def.gasCost || 0);
    }
    return value;
  }

  getComposition(team) {
    const comp = { air: 0, ground: 0, ranged: 0, melee: 0, total: 0 };
    for (const u of this.units) {
      if (u.dead || u.team !== team || u.worker) continue;
      comp.total++;
      if (u.isAir) comp.air++; else comp.ground++;
      if (u.range > 40) comp.ranged++; else comp.melee++;
    }
    return comp;
  }

  // Genome-parameterized unit weight selection
  getUnitWeight(unitType, genome, team) {
    const def = UNIT_DEFS[unitType];
    const phase = this.aiPhase[team];
    const cw = genome.counterWeight;
    const opponentTeam = team === 'player' ? 'enemy' : 'player';
    const oppComp = this.getComposition(opponentTeam);
    let weight = 2;

    // Counter-composition
    if (oppComp.air > 0) {
      const airRatio = oppComp.air / Math.max(1, oppComp.total);
      if (!def.isAir && def.range > 80) weight += Math.ceil(cw * airRatio * 2.0);
      if (def.isAir && def.range > 60) weight += Math.ceil(cw * airRatio * 1.5);
      if (airRatio > 0.5 && def.range <= 30 && !def.isAir) weight -= Math.ceil(cw * 0.8);
    }
    if (oppComp.ground > oppComp.air * 2) {
      if (def.splash) weight += Math.ceil(cw * 1.0);
      if (def.range > 100) weight += Math.ceil(cw * 0.5);
    }
    if (oppComp.total > 4 && def.splash) weight += Math.ceil(cw * 0.4 * Math.min(oppComp.total / 6, 2));
    if (oppComp.melee > oppComp.ranged + 2 && def.range > 80) weight += Math.ceil(cw * 0.6);
    if (oppComp.ranged > oppComp.melee + 3 && def.speed >= 1.5 && def.range <= 30) weight += Math.ceil(cw * 0.4);

    // Phase-based preferences (parameterized by genome)
    if (phase === 'opening' || phase === 'early') {
      if (def.cost <= genome.earlyUnitCostCap) weight += 3;
      if (def.cost >= 300) weight -= 3;
    } else if (phase === 'mid') {
      if (def.cost >= genome.midUnitMinCost && def.cost <= 300) weight += 3;
      if (def.cost <= 75) weight += 1;
    } else if (phase === 'late') {
      if (def.cost >= genome.lateUnitMinCost) weight += 4;
      if (def.cost <= 75 && !def.splash) weight -= 1;
    }

    // Healers
    if (def.healer) {
      const healerCount = this.units.filter(u => !u.dead && u.team === team && u.healer).length;
      const armySize = this.units.filter(u => !u.dead && u.team === team && !u.worker && !u.healer).length;
      const idealHealers = Math.min(4, Math.floor(armySize / 4));
      weight = healerCount < idealHealers ? Math.max(5, cw) : 0;
    }

    // Diversity bonus
    const typeCount = this.units.filter(u => !u.dead && u.team === team && u.type === unitType).length;
    if (typeCount === 0) weight += Math.ceil(cw * 0.7);
    else if (typeCount > 8) weight -= 2;
    else if (typeCount > 5) weight -= 1;

    return Math.max(0, weight);
  }

  // Genome-parameterized AI decision making
  runAI(team, dt) {
    const isPlayer = team === 'player';
    const timerProp = isPlayer ? 'aiTimerPlayer' : 'aiTimerEnemy';
    this[timerProp] -= dt;
    if (this[timerProp] > 0) return;
    this[timerProp] = 0.1 + Math.random() * 0.1; // Fast decisions for both

    const genome = isPlayer ? this.genome1 : this.genome2;
    const faction = isPlayer ? this.playerFaction : this.enemyFaction;
    const buildings = isPlayer ? this.playerBuildings : this.enemyBuildings;
    const minerals = () => isPlayer ? this.playerMinerals : this.enemyMinerals;
    const gas = () => isPlayer ? this.playerGas : this.enemyGas;
    const supply = () => this.getTeamSupply(team);
    const supplyMax = () => this.getTeamSupplyMax(team);
    const spendMinerals = (amt) => { if (isPlayer) this.playerMinerals -= amt; else this.enemyMinerals -= amt; };
    const spendGas = (amt) => { if (isPlayer) this.playerGas -= amt; else this.enemyGas -= amt; };

    const workerCount = this.units.filter(u => !u.dead && u.team === team && u.worker).length;
    const combatUnits = this.units.filter(u => !u.dead && u.team === team && !u.worker);
    const combatCount = combatUnits.length;
    const workerType = WORKER_TYPE[faction];
    const workerDef = UNIT_DEFS[workerType];
    const baseBuilding = buildings.find(b => b.type === '_base');
    const baseY = isPlayer ? GAME_H - 160 : 140;

    const hasExpansion = buildings.some(b => BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].isExpansion);
    const hasTier2Types = { terran: 'factory', protoss: 'robo', zerg: 'den' };
    const hasTier3Types = { terran: 'starport', protoss: 'fleetbeacon', zerg: 'spire' };
    const hasTier2 = buildings.some(b => b.type === hasTier2Types[faction]);
    const hasTier3 = buildings.some(b => b.type === hasTier3Types[faction]);
    const hasGas = buildings.some(b => BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].gasBuilding);
    const prodCount = buildings.filter(b => {
      const bd = BUILDING_DEFS[b.type];
      return b.built && bd && bd.unlocks && bd.unlocks.length > 0 && !bd.isExpansion && b.type !== '_base';
    }).length;

    const myArmy = this.getArmyValue(team);
    const oppArmy = this.getArmyValue(isPlayer ? 'enemy' : 'player');

    // Phase transitions
    const phase = this.aiPhase[team];
    if (phase === 'opening' && prodCount > 0 && combatCount >= 1) this.aiPhase[team] = 'early';
    else if (phase === 'early' && (hasExpansion || prodCount >= 3 || hasTier2)) this.aiPhase[team] = 'mid';
    else if (phase === 'mid' && (hasTier3 || (prodCount >= 4 && hasTier2))) this.aiPhase[team] = 'late';

    // Always attack stance (matches original simulator behavior)

    // Utility scores (parameterized by genome weights)
    const supplyHeadroom = supplyMax() - supply();
    const pendingSupply = buildings.filter(b => !b.built && BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].supplyCap).length;

    // Supply utility
    let supplyScore = 0;
    if (supplyHeadroom <= 0 && pendingSupply === 0) supplyScore = 100;
    else if (supplyHeadroom <= 2 && pendingSupply === 0) supplyScore = 90;
    else if (supplyHeadroom <= genome.supplyBuffer && pendingSupply < 2) supplyScore = 50;

    // Worker utility
    const idealWorkers = Math.min(genome.workersPerBase * (1 + (hasExpansion ? 1 : 0)), genome.workerCap);
    let workerScore = 0;
    if (workerCount < idealWorkers) {
      const deficit = idealWorkers - workerCount;
      const phaseW = { opening: 1.6, early: 1.4, mid: 1.0, late: 0.5 }[this.aiPhase[team]] || 1;
      workerScore = Math.min(80, deficit * 14 * phaseW * genome.workerW);
    }

    // Army utility
    let armyScore = 0;
    if (prodCount > 0) {
      const armyRatio = oppArmy > 0 ? myArmy / oppArmy : 2;
      armyScore = 65;
      if (armyRatio < 0.3) armyScore = 100;
      else if (armyRatio < 0.5) armyScore = 90;
      else if (armyRatio < 0.8) armyScore = 80;
      else if (armyRatio > 2.0) armyScore = 35;
      else if (armyRatio > 1.5) armyScore = 45;
      const oppTeam = isPlayer ? 'enemy' : 'player';
      const nearBase = this.units.filter(u => !u.dead && u.team === oppTeam && !u.worker &&
        (isPlayer ? u.y > GAME_H - 250 : u.y < 250)).length;
      if (nearBase >= 2) armyScore += 30;
      if (minerals() > 400 && combatCount > 0) armyScore += 20;
      const phaseW = { opening: 0.6, early: 1.1, mid: 1.3, late: 1.5 }[this.aiPhase[team]] || 1;
      armyScore = Math.min(100, armyScore * phaseW * genome.armyW);
    }

    // Tech utility (includes first production building)
    let techScore = 0;
    if (prodCount === 0 && workerCount >= 5 && minerals() >= 150) {
      techScore = 95; // Critical: must build first production building
    } else if (prodCount >= 1) {
      if (!hasTier2 && gas() >= 40 && prodCount >= 1) techScore = 55;
      else if (hasTier2 && !hasTier3 && gas() >= 100 && prodCount >= 2) techScore = 45;
      else if (prodCount < 3 && minerals() >= 150) techScore = 50; // extra prod buildings
      const phaseW = { opening: 0.8, early: 0.8, mid: 1.1, late: 1.3 }[this.aiPhase[team]] || 0.5;
      techScore = techScore * phaseW * genome.techW;
    }

    // Expand utility
    let expandScore = 0;
    const oppTeamExp = isPlayer ? 'enemy' : 'player';
    const nearBaseExp = this.units.filter(u => !u.dead && u.team === oppTeamExp && !u.worker &&
      (isPlayer ? u.y > GAME_H - 250 : u.y < 250)).length;
    if (!hasExpansion && minerals() >= 350 && nearBaseExp < 2 && prodCount >= 1 && workerCount >= genome.expandWorkerThreshold) {
      expandScore = 55;
      const armyRatio = oppArmy > 0 ? myArmy / oppArmy : 2;
      if (armyRatio > genome.expandArmyRatio) expandScore += 10;
      const phaseW = { opening: 0.0, early: 0.9, mid: 1.1, late: 0.7 }[this.aiPhase[team]] || 0.5;
      expandScore = expandScore * phaseW * genome.expandW;
    }

    // Sort and execute actions
    const actions = [
      { name: 'supply', score: supplyScore },
      { name: 'worker', score: workerScore },
      { name: 'army', score: armyScore },
      { name: 'tech', score: techScore },
      { name: 'expand', score: expandScore },
    ].sort((a, b) => b.score - a.score);

    let actionsExecuted = 0;
    for (const action of actions) {
      if (action.score < 15 || actionsExecuted >= 3) break;

      switch (action.name) {
        case 'supply': {
          const supplyType = FACTION_SUPPLY[faction];
          const supplyDef = BUILDING_DEFS[supplyType];
          if (pendingSupply < 2 && minerals() >= supplyDef.cost) {
            spendMinerals(supplyDef.cost);
            buildings.push({ type: supplyType, x: 50 + buildings.length * 35, y: baseY, hp: 500, maxHp: 500, built: false, buildProgress: 0, buildTime: supplyDef.buildTime, queue: [] });
            actionsExecuted++;
          }
          break;
        }
        case 'worker': {
          if (this.canAffordUnit(workerType, team) && baseBuilding && baseBuilding.queue.length < 2) {
            spendMinerals(workerDef.cost);
            baseBuilding.queue.push({ type: workerType, timeLeft: workerDef.buildTime, totalTime: workerDef.buildTime });
            actionsExecuted++;
          }
          break;
        }
        case 'army': {
          const availUnits = this.getAvailableUnits(team);
          const combatTypes = availUnits.filter(u => !UNIT_DEFS[u].worker);
          if (combatTypes.length > 0) {
            const affordable = combatTypes.filter(u => this.canAffordUnit(u, team));
            if (affordable.length > 0) {
              // Weighted random selection using genome
              const weights = affordable.map(u => this.getUnitWeight(u, genome, team));
              const totalW = weights.reduce((a, b) => a + b, 0);
              if (totalW > 0) {
                let roll = Math.random() * totalW;
                let pick = affordable[0];
                for (let i = 0; i < affordable.length; i++) {
                  roll -= weights[i];
                  if (roll <= 0) { pick = affordable[i]; break; }
                }
                const building = this.getBuildingForUnit(pick, buildings);
                if (building && building.queue.length < 5) {
                  const def = UNIT_DEFS[pick];
                  spendMinerals(def.cost);
                  spendGas(def.gasCost || 0);
                  building.queue.push({ type: pick, timeLeft: def.buildTime, totalTime: def.buildTime });
                  actionsExecuted++;
                }
              }
            }
          }
          break;
        }
        case 'tech': {
          const availBldgs = this.getAvailableBuildings(team);
          const techBldgs = availBldgs.filter(b => !BUILDING_DEFS[b].supplyCap && !BUILDING_DEFS[b].gasBuilding && !BUILDING_DEFS[b].isExpansion);
          if (techBldgs.length > 0) {
            const btype = techBldgs[0];
            const bdef = BUILDING_DEFS[btype];
            const gasCost = bdef.gasCost || 0;
            if (minerals() >= bdef.cost && gas() >= gasCost) {
              spendMinerals(bdef.cost);
              spendGas(gasCost);
              buildings.push({ type: btype, x: 50 + buildings.length * 35, y: baseY, hp: 500, maxHp: 500, built: false, buildProgress: 0, buildTime: bdef.buildTime, queue: [] });
              actionsExecuted++;
            }
          }
          break;
        }
        case 'expand': {
          const expansionType = FACTION_EXPANSION[faction];
          const expansionDef = BUILDING_DEFS[expansionType];
          if (minerals() >= expansionDef.cost) {
            spendMinerals(expansionDef.cost);
            buildings.push({ type: expansionType, x: ARENA_W / 2, y: isPlayer ? RIVER_Y + RIVER_H + 150 : RIVER_Y - 150, hp: 2000, maxHp: 2000, built: false, buildProgress: 0, buildTime: 15, queue: [] });
            actionsExecuted++;
          }
          break;
        }
      }
    }

    // Gas building
    const gasType = FACTION_GAS[faction];
    const gasCount = buildings.filter(b => BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].gasBuilding).length;
    const geysers = isPlayer ? this.gasGeysers.player : this.gasGeysers.enemy;
    if (gasCount < 2 && this.gameTime > (gasCount === 0 ? genome.gasTime : 60) && minerals() >= BUILDING_DEFS[gasType].cost) {
      const geyser = geysers[gasCount];
      spendMinerals(BUILDING_DEFS[gasType].cost);
      buildings.push({ type: gasType, x: geyser.x, y: geyser.y, hp: 500, maxHp: 500, built: false, buildProgress: 0, buildTime: BUILDING_DEFS[gasType].buildTime, queue: [] });
      geyser.workers = 3;
    }
  }

  tick(dt) {
    this.gameTime += dt;

    // Gas income
    for (const team of ['player', 'enemy']) {
      const geysers = this.gasGeysers[team];
      const buildings = team === 'player' ? this.playerBuildings : this.enemyBuildings;
      for (let i = 0; i < geysers.length; i++) {
        const g = geysers[i];
        if (g.workers <= 0 || g.gas <= 0) continue;
        const gasBuildings = buildings.filter(b => BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].gasBuilding && b.built);
        if (i >= gasBuildings.length) continue;
        const mined = Math.min(GAS_PER_WORKER_PER_SEC * g.workers * dt, g.gas);
        g.gas -= mined;
        if (team === 'player') this.playerGas = Math.min(9999, this.playerGas + mined);
        else this.enemyGas = Math.min(9999, this.enemyGas + mined);
      }
    }

    // Building queues
    for (const team of ['player', 'enemy']) {
      const buildings = team === 'player' ? this.playerBuildings : this.enemyBuildings;
      for (const b of buildings) {
        if (!b.built) {
          b.buildProgress += dt;
          if (b.buildProgress >= b.buildTime) {
            b.built = true;
            const bdef = BUILDING_DEFS[b.type];
            if (bdef && bdef.supplyCap) {
              if (team === 'player') this.playerSupplyMax += bdef.supplyCap;
              else this.enemySupplyMax += bdef.supplyCap;
            }
          }
        }
        if (!b.queue || b.queue.length === 0 || !b.built) continue;
        const item = b.queue[0];
        item.timeLeft -= dt;
        if (item.timeLeft <= 0) {
          b.queue.shift();
          const spawnY = team === 'player' ? GAME_H - 150 : 150;
          const lane = Math.random() < 0.5 ? 0 : 1;
          const x = LANE_X[lane] + (Math.random()-0.5)*30;
          this.spawnUnit(item.type, x, spawnY, team);
        }
      }
    }

    // Force fields
    for (const ff of this.forceFields) ff.life -= dt;
    this.forceFields = this.forceFields.filter(ff => ff.life > 0);

    // AI
    this.runAI('player', dt);
    this.runAI('enemy', dt);

    // Units
    for (const unit of this.units) {
      if (unit.dead) continue;
      unit.animFrame += dt * 5;
      if (unit.worker) { this.updateWorker(unit, dt); continue; }
      this.updateUnitAbilities(unit, dt);
      const target = this.findTarget(unit);
      const effectiveSpeed = unit.siegeMode ? 0 : unit.speed;
      let effectiveAtkSpeed = unit.atkSpeed;
      if (unit.type === 'ultralisk' && unit.hp < unit.maxHp * 0.3) effectiveAtkSpeed *= 0.67;
      let effectiveDmg = unit.dmg;
      if (unit.type === 'voidray') {
        if (target && target === unit.lastTarget) {
          unit.voidrayAttackTime += dt;
          if (unit.voidrayAttackTime > 4) effectiveDmg = 100;
          else if (unit.voidrayAttackTime > 2) effectiveDmg = 75;
        } else { unit.voidrayAttackTime = 0; }
        unit.lastTarget = target;
      }
      let effectiveRange = unit.range;
      let effectiveSplash = unit.splash;
      if (unit.siegeMode) { effectiveRange = 220; effectiveDmg = 180; effectiveSplash = 40; }

      if (target) {
        const d = this.dist(unit, target);
        const targetR = target.r || 0;
        if (d - targetR <= effectiveRange) {
          unit.atkTimer -= dt;
          if (unit.type === 'siegetank' && !unit.siegeMode) {
            unit.siegeTimer += dt;
            if (unit.siegeTimer > 2) { unit.siegeMode = true; unit.siegeTimer = 0; }
          }
          if (unit.atkTimer <= 0) {
            unit.atkTimer = effectiveAtkSpeed;
            if (unit.healer) {
              target.hp = Math.min(target.maxHp, target.hp + unit.healAmt);
            } else if (unit.suicide) {
              if (effectiveSplash > 0) this.dealSplash(unit.x, unit.y, effectiveSplash, effectiveDmg, unit.team);
              else this.dealDamage(target, effectiveDmg);
              unit.hp = 0; unit.dead = true;
            } else {
              if (effectiveSplash > 0) this.dealSplash(target.x, target.y, effectiveSplash, effectiveDmg, unit.team);
              else this.dealDamage(target, effectiveDmg);
            }
          }
        } else {
          if (unit.type === 'zealot' && d > 60 && d < 120 && unit.chargeTimer <= 0) {
            const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
            unit.x += Math.cos(angle) * effectiveSpeed * 50 * 3 * dt;
            unit.y += Math.sin(angle) * effectiveSpeed * 50 * 3 * dt;
            unit.chargeTimer = 5;
          } else if (effectiveSpeed > 0) {
            let blocked = false;
            if (!unit.isAir) {
              for (const ff of this.forceFields) {
                if (ff.team === unit.team) continue;
                if (this.dist(unit, ff) < ff.r + unit.r) { blocked = true; break; }
              }
            }
            if (!blocked) {
              const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
              unit.x += Math.cos(angle) * effectiveSpeed * 50 * dt;
              unit.y += Math.sin(angle) * effectiveSpeed * 50 * dt;
            }
          }
          if (unit.type === 'siegetank' && unit.siegeMode) {
            unit.siegeTimer += dt;
            if (unit.siegeTimer > 3) { unit.siegeMode = false; unit.siegeTimer = 0; }
          }
        }
      } else {
        const isP = unit.team === 'player';
        const st = isP ? this.playerStance : this.enemyStance;
        let targetY = isP ? 90 : GAME_H - 90;
        if (st === 'defend') targetY = isP ? GAME_H - 250 : 250;
        if (Math.abs(unit.y - targetY) > 5 && effectiveSpeed > 0) {
          let blocked = false;
          if (!unit.isAir) {
            for (const ff of this.forceFields) {
              if (ff.team === unit.team) continue;
              if (this.dist(unit, ff) < ff.r + unit.r) { blocked = true; break; }
            }
          }
          if (!blocked) {
            const dir = targetY > unit.y ? 1 : -1;
            unit.y += dir * effectiveSpeed * 50 * dt;
          }
        }
        if (unit.type === 'siegetank' && unit.siegeMode) {
          unit.siegeTimer += dt;
          if (unit.siegeTimer > 3) { unit.siegeMode = false; unit.siegeTimer = 0; }
        }
      }
    }

    // Cleanup dead
    this.units = this.units.filter(u => {
      if (u.hp <= 0 && !u.dead) {
        u.dead = true;
        if (u.team === 'player') this.playerSupply -= (u.supply || 1);
        else this.enemySupply -= (u.supply || 1);
      }
      return !u.dead;
    });

    // Win/lose
    if (this.towers.enemy.base.hp <= 0) { this.result = 'player'; return true; }
    if (this.towers.player.base.hp <= 0) { this.result = 'enemy'; return true; }
    if (this.gameTime > 600) {
      const pt = this.towers.player.base.hp;
      const et = this.towers.enemy.base.hp;
      this.result = pt > et ? 'player' : pt < et ? 'enemy' : 'draw';
      return true;
    }
    return false;
  }

  run() {
    const DT = 0.05;
    while (!this.tick(DT)) {}
    return this.result;
  }
}

// ============================================================
// Evolutionary Training Loop
// ============================================================

const POPULATION_SIZE = 30;
const GENERATIONS = 50;
const GAMES_PER_EVAL = 18; // 3 factions x 3 opponents x 2 sides
const ELITE_COUNT = 6;
const TOURNAMENT_SIZE = 4;

function evaluateFitness(genome, opponents) {
  let wins = 0, total = 0;
  // Play as each faction against each opponent faction, both sides
  for (const myFaction of FACTIONS) {
    for (const oppFaction of FACTIONS) {
      // Play as player
      const sim1 = new EvoGameSim(myFaction, oppFaction, genome, opponents);
      const r1 = sim1.run();
      if (r1 === 'player') wins++;
      total++;
      // Play as enemy
      const sim2 = new EvoGameSim(oppFaction, myFaction, opponents, genome);
      const r2 = sim2.run();
      if (r2 === 'enemy') wins++;
      total++;
    }
  }
  return wins / total;
}

function tournamentSelect(population, fitnesses) {
  let bestIdx = Math.floor(Math.random() * population.length);
  let bestFit = fitnesses[bestIdx];
  for (let i = 1; i < TOURNAMENT_SIZE; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (fitnesses[idx] > bestFit) {
      bestIdx = idx;
      bestFit = fitnesses[idx];
    }
  }
  return population[bestIdx];
}

function formatGenome(g) {
  const lines = [];
  for (const [k, v] of Object.entries(g)) {
    lines.push(`    ${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`);
  }
  return lines.join('\n');
}

// ---- Main Evolution ----
console.log('='.repeat(70));
console.log('  STARCLASH EVOLUTIONARY AI TRAINER');
console.log(`  Population: ${POPULATION_SIZE} | Generations: ${GENERATIONS}`);
console.log(`  Games per evaluation: ${GAMES_PER_EVAL} (${FACTIONS.length}x${FACTIONS.length}x2)`);
console.log(`  Total games: ~${POPULATION_SIZE * GENERATIONS * GAMES_PER_EVAL}`);
console.log('='.repeat(70));
console.log();

// Initialize population
let population = [];
// Seed with default genome
population.push(createDefaultGenome());
// Fill rest with random variants
for (let i = 1; i < POPULATION_SIZE; i++) {
  if (i < 5) {
    // Small mutations from default
    population.push(mutateGenome(createDefaultGenome(), 0.5, 0.3));
  } else {
    // Wider exploration
    population.push(randomGenome());
  }
}

let bestEverGenome = createDefaultGenome();
let bestEverFitness = 0;

const startTime = Date.now();

for (let gen = 0; gen < GENERATIONS; gen++) {
  const genStart = Date.now();

  // Use the current best as the opponent baseline
  const baselineOpponent = gen === 0 ? createDefaultGenome() : bestEverGenome;

  // Evaluate all individuals against the baseline
  const fitnesses = [];
  for (let i = 0; i < population.length; i++) {
    const fitness = evaluateFitness(population[i], baselineOpponent);
    fitnesses.push(fitness);
  }

  // Also do round-robin within top performers for diversity
  const sortedIndices = fitnesses.map((f, i) => i).sort((a, b) => fitnesses[b] - fitnesses[a]);
  const topN = Math.min(6, population.length);
  for (let i = 0; i < topN; i++) {
    const idx = sortedIndices[i];
    let roundRobinWins = 0, roundRobinGames = 0;
    for (let j = 0; j < topN; j++) {
      if (i === j) continue;
      const oIdx = sortedIndices[j];
      // Quick matchup: random faction pair
      const f1 = FACTIONS[Math.floor(Math.random() * 3)];
      const f2 = FACTIONS[Math.floor(Math.random() * 3)];
      const sim = new EvoGameSim(f1, f2, population[idx], population[oIdx]);
      const r = sim.run();
      if (r === 'player') roundRobinWins++;
      roundRobinGames++;
    }
    // Blend round-robin performance into fitness
    if (roundRobinGames > 0) {
      fitnesses[idx] = fitnesses[idx] * 0.7 + (roundRobinWins / roundRobinGames) * 0.3;
    }
  }

  // Find best in generation
  let bestIdx = 0;
  for (let i = 1; i < fitnesses.length; i++) {
    if (fitnesses[i] > fitnesses[bestIdx]) bestIdx = i;
  }
  const genBestFitness = fitnesses[bestIdx];
  const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

  if (genBestFitness > bestEverFitness) {
    bestEverFitness = genBestFitness;
    bestEverGenome = { ...population[bestIdx] };
  }

  const genTime = ((Date.now() - genStart) / 1000).toFixed(1);
  const bar = '\u2588'.repeat(Math.round(genBestFitness * 40));
  console.log(`  Gen ${String(gen + 1).padStart(2)}/${GENERATIONS}  |  Best: ${(genBestFitness * 100).toFixed(1)}%  Avg: ${(avgFitness * 100).toFixed(1)}%  |  ${bar}  |  ${genTime}s`);

  // Create next generation
  const newPop = [];

  // Elitism: keep top performers
  const eliteIndices = sortedIndices.slice(0, ELITE_COUNT);
  for (const ei of eliteIndices) {
    newPop.push({ ...population[ei] });
  }

  // Fill rest with offspring
  while (newPop.length < POPULATION_SIZE) {
    if (Math.random() < 0.8) {
      // Crossover + mutation
      const p1 = tournamentSelect(population, fitnesses);
      const p2 = tournamentSelect(population, fitnesses);
      const child = crossover(p1, p2);
      newPop.push(mutateGenome(child, 0.25, 0.15));
    } else {
      // Mutation only from top performer
      const parent = tournamentSelect(population, fitnesses);
      newPop.push(mutateGenome(parent, 0.4, 0.25));
    }
  }

  population = newPop;
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

// ---- Final Validation ----
console.log();
console.log('='.repeat(70));
console.log('  FINAL VALIDATION: Evolved AI vs Default AI');
console.log('='.repeat(70));

const defaultGenome = createDefaultGenome();
let evolvedWins = 0, defaultWins = 0, draws = 0;
const matchResults = {};

for (const f1 of FACTIONS) {
  for (const f2 of FACTIONS) {
    const key = `${f1} vs ${f2}`;
    let eW = 0, dW = 0, dr = 0;
    // Run 10 games per matchup
    for (let i = 0; i < 10; i++) {
      // Evolved as player
      const sim1 = new EvoGameSim(f1, f2, bestEverGenome, defaultGenome);
      const r1 = sim1.run();
      if (r1 === 'player') { evolvedWins++; eW++; }
      else if (r1 === 'enemy') { defaultWins++; dW++; }
      else { draws++; dr++; }

      // Evolved as enemy
      const sim2 = new EvoGameSim(f2, f1, defaultGenome, bestEverGenome);
      const r2 = sim2.run();
      if (r2 === 'enemy') { evolvedWins++; eW++; }
      else if (r2 === 'player') { defaultWins++; dW++; }
      else { draws++; dr++; }
    }
    matchResults[key] = { evolved: eW, default: dW, draws: dr };
    console.log(`  ${f1.padEnd(8)} vs ${f2.padEnd(8)}  |  Evolved: ${eW}/20  Default: ${dW}/20  Draw: ${dr}/20`);
  }
}

const totalGames = evolvedWins + defaultWins + draws;
console.log();
console.log(`  TOTAL: Evolved ${evolvedWins}/${totalGames} (${(evolvedWins/totalGames*100).toFixed(1)}%)  vs  Default ${defaultWins}/${totalGames} (${(defaultWins/totalGames*100).toFixed(1)}%)`);

console.log();
console.log('='.repeat(70));
console.log('  BEST EVOLVED GENOME (copy to AI_PARAMS in index.html)');
console.log('='.repeat(70));
console.log();

const g = bestEverGenome;
console.log('  // --- Evolved AI Parameters (trained via self-play) ---');
console.log('  // Phase weights:');
console.log(`  //   workerW:  ${g.workerW.toFixed(3)}  (was 1.300)`);
console.log(`  //   armyW:    ${g.armyW.toFixed(3)}  (was 1.200)`);
console.log(`  //   techW:    ${g.techW.toFixed(3)}  (was 1.000)`);
console.log(`  //   expandW:  ${g.expandW.toFixed(3)}  (was 0.900)`);
console.log(`  //   defenseW: ${g.defenseW.toFixed(3)}  (was 1.000)`);
console.log('  // Tactical params:');
console.log(`  //   attackThreshold:  ${g.attackThreshold.toFixed(3)}  (was 0.800)`);
console.log(`  //   workerCap:        ${Math.round(g.workerCap)}  (was 24)`);
console.log(`  //   gasTime:          ${g.gasTime.toFixed(1)}  (was 4.0)`);
console.log(`  //   supplyBuffer:     ${Math.round(g.supplyBuffer)}  (was 8)`);
console.log(`  //   counterWeight:    ${g.counterWeight.toFixed(1)}  (was 6.0)`);
console.log('  // Unit selection:');
console.log(`  //   earlyUnitCostCap: ${Math.round(g.earlyUnitCostCap)}  (was 100)`);
console.log(`  //   midUnitMinCost:   ${Math.round(g.midUnitMinCost)}  (was 150)`);
console.log(`  //   lateUnitMinCost:  ${Math.round(g.lateUnitMinCost)}  (was 200)`);
console.log('  // Expansion/army:');
console.log(`  //   groupRatioThreshold:    ${g.groupRatioThreshold.toFixed(3)}  (was 0.550)`);
console.log(`  //   retreatHPRatio:         ${g.retreatHPRatio.toFixed(3)}  (was 0.350)`);
console.log(`  //   expandWorkerThreshold:  ${Math.round(g.expandWorkerThreshold)}  (was 8)`);
console.log(`  //   expandArmyRatio:        ${g.expandArmyRatio.toFixed(3)}  (was 1.200)`);
console.log(`  //   workersPerBase:          ${Math.round(g.workersPerBase)}  (was 10)`);

console.log();
console.log(`  Total training time: ${totalTime}s`);
console.log('  Simulation complete.');

// Output JSON for easy parsing
console.log();
console.log('--- EVOLVED_PARAMS_JSON ---');
console.log(JSON.stringify(bestEverGenome, null, 2));
console.log('--- END_EVOLVED_PARAMS_JSON ---');
