#!/usr/bin/env node
// ============================================================
// STARCLASH Balance Simulator — Headless AI vs AI
// Runs many games and reports win rates per faction matchup
// ============================================================

// ---- Constants (mirrored from index.html) ----
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
const FACTION_COLORS = {
  terran: { primary: '#4488ff', dark: '#223366', light: '#66aaff' },
  protoss: { primary: '#ffcc00', dark: '#665500', light: '#ffee66' },
  zerg: { primary: '#ff4444', dark: '#662222', light: '#ff8888' }
};

// ---- Building Definitions ----
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

// ---- Unit Definitions ----
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
  hightemplar:  { faction:'protoss', cost:150, gasCost:150, supply:2, hp:280, dmg:180,speed:0.7, range:130, atkSpeed:2.5, count:1, r:9,  name:'High Templar', splash:55, buildTime:6 },
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

// ---- Game Simulation ----
class GameSim {
  constructor(faction1, faction2) {
    this.playerFaction = faction1;
    this.enemyFaction = faction2;
    this.gameTime = 0;
    this.units = [];
    this.projectiles = [];
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
    this.result = null; // 'player' | 'enemy' | 'draw'

    this.towers = {
      player: {
        base:  { x: ARENA_W / 2, y: GAME_H - 90,  hp: 2400, maxHp: 2400, r: BASE_R }
      },
      enemy: {
        base:  { x: ARENA_W / 2, y: 90,  hp: 2400, maxHp: 2400, r: BASE_R }
      }
    };

    this.mineralPatches = {
      player: [
        { x: 35,  y: GAME_H - 110, minerals: 1800, maxMinerals: 1800 },
        { x: 70,  y: GAME_H - 100, minerals: 1800, maxMinerals: 1800 },
        { x: 110, y: GAME_H - 105, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 - 20, y: GAME_H - 95, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 + 30, y: GAME_H - 100, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W - 50, y: GAME_H - 105, minerals: 1800, maxMinerals: 1800 },
      ],
      enemy: [
        { x: 35,  y: 110, minerals: 1800, maxMinerals: 1800 },
        { x: 70,  y: 100, minerals: 1800, maxMinerals: 1800 },
        { x: 110, y: 105, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 - 20, y: 95, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W/2 + 30, y: 100, minerals: 1800, maxMinerals: 1800 },
        { x: ARENA_W - 50, y: 105, minerals: 1800, maxMinerals: 1800 },
      ],
      expansion: [
        { x: 60,  y: RIVER_Y - 120, minerals: 1500, maxMinerals: 1500 },
        { x: ARENA_W - 60, y: RIVER_Y - 120, minerals: 1500, maxMinerals: 1500 },
        { x: 60,  y: RIVER_Y + RIVER_H + 120, minerals: 1500, maxMinerals: 1500 },
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

    // Tracking stats
    this.stats = {
      player: { unitsBuilt: 0, unitsLost: 0, mineralsSpent: 0, gasSpent: 0, peakSupply: 0 },
      enemy: { unitsBuilt: 0, unitsLost: 0, mineralsSpent: 0, gasSpent: 0, peakSupply: 0 },
    };

    // Start with 4 workers each
    const pw = WORKER_TYPE[faction1];
    const ew = WORKER_TYPE[faction2];
    for (let i = 0; i < 4; i++) {
      this.spawnUnit(pw, ARENA_W/2 + (Math.random()-0.5)*30, GAME_H - 110 + (Math.random()-0.5)*15, 'player');
      this.spawnUnit(ew, ARENA_W/2 + (Math.random()-0.5)*30, 110 + (Math.random()-0.5)*15, 'enemy');
    }
  }

  dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  spawnUnit(defName, x, y, team) {
    const def = UNIT_DEFS[defName];
    const totalSupply = (def.supply || 1) * def.count;
    if (team === 'player') { this.playerSupply += totalSupply; this.stats.player.peakSupply = Math.max(this.stats.player.peakSupply, this.playerSupply); }
    else { this.enemySupply += totalSupply; this.stats.enemy.peakSupply = Math.max(this.stats.enemy.peakSupply, this.enemySupply); }

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
    if (team === 'player') this.stats.player.unitsBuilt += def.count;
    else this.stats.enemy.unitsBuilt += def.count;
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
        const exists = buildings.some(b => b.type === btype);
        if (exists) continue;
        available.push(btype);
        continue;
      }
      if (bdef.gasBuilding) {
        const gasCount = buildings.filter(b => b.type === btype).length;
        if (gasCount >= 2) continue;
        available.push(btype);
        continue;
      }
      const exists = buildings.some(b => b.type === btype);
      if (exists) continue;
      if (bdef.requires) {
        const hasReq = buildings.some(b => b.type === bdef.requires && b.built);
        if (!hasReq) continue;
      }
      available.push(btype);
    }
    return available;
  }

  getBuildingForUnit(unitType, buildings) {
    const def = UNIT_DEFS[unitType];
    if (def.worker) {
      // Workers from base or expansion
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
      for (const key of ['base']) {
        const t = enemyTowers[key];
        if (t.hp <= 0) continue;
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
    for (const key of ['base']) {
      const t = enemyTowers[key];
      if (t.hp <= 0) continue;
      if (this.dist(t, { x, y }) <= radius + t.r) {
        t.hp -= dmg;
        if (t.hp < 0) t.hp = 0;
      }
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

  runAI(team, dt) {
    const isPlayer = team === 'player';
    const timerProp = isPlayer ? 'aiTimerPlayer' : 'aiTimerEnemy';
    this[timerProp] -= dt;
    if (this[timerProp] > 0) return;
    this[timerProp] = 2.0 + Math.random() * 2.0;

    const faction = isPlayer ? this.playerFaction : this.enemyFaction;
    const buildings = isPlayer ? this.playerBuildings : this.enemyBuildings;
    const minerals = () => isPlayer ? this.playerMinerals : this.enemyMinerals;
    const gas = () => isPlayer ? this.playerGas : this.enemyGas;
    const supply = () => this.getTeamSupply(team);
    const supplyMax = () => this.getTeamSupplyMax(team);
    const spendMinerals = (amt) => { if (isPlayer) this.playerMinerals -= amt; else this.enemyMinerals -= amt; };
    const spendGas = (amt) => { if (isPlayer) this.playerGas -= amt; else this.enemyGas -= amt; };

    const workerCount = this.units.filter(u => !u.dead && u.team === team && u.worker).length;
    const workerType = WORKER_TYPE[faction];
    const workerDef = UNIT_DEFS[workerType];
    const baseBuilding = buildings.find(b => b.type === '_base');
    const baseY = isPlayer ? GAME_H - 160 : 140;

    // Supply
    if (supply() >= supplyMax() - 3) {
      const supplyType = FACTION_SUPPLY[faction];
      const supplyDef = BUILDING_DEFS[supplyType];
      const hasBuilding = buildings.some(b => b.type === supplyType && !b.built);
      if (!hasBuilding && minerals() >= supplyDef.cost) {
        spendMinerals(supplyDef.cost);
        buildings.push({ type: supplyType, x: 50 + buildings.length * 35, y: baseY, hp: 500, maxHp: 500, built: false, buildProgress: 0, buildTime: supplyDef.buildTime, queue: [] });
        return;
      }
    }

    // Gas refinery (up to 2)
    const gasType = FACTION_GAS[faction];
    const gasCount = buildings.filter(b => BUILDING_DEFS[b.type] && BUILDING_DEFS[b.type].gasBuilding).length;
    const geysers = isPlayer ? this.gasGeysers.player : this.gasGeysers.enemy;
    if (gasCount < 2 && this.gameTime > (gasCount === 0 ? 15 : 60) && minerals() >= BUILDING_DEFS[gasType].cost) {
      const geyser = geysers[gasCount];
      spendMinerals(BUILDING_DEFS[gasType].cost);
      buildings.push({ type: gasType, x: geyser.x, y: geyser.y, hp: 500, maxHp: 500, built: false, buildProgress: 0, buildTime: BUILDING_DEFS[gasType].buildTime, queue: [] });
      // Auto-assign 3 workers to the geyser
      geyser.workers = 3;
      return;
    }

    // Workers
    if (workerCount < 12 && this.canAffordUnit(workerType, team) && baseBuilding && baseBuilding.queue.length < 2) {
      spendMinerals(workerDef.cost);
      baseBuilding.queue.push({ type: workerType, timeLeft: workerDef.buildTime, totalTime: workerDef.buildTime });
      return;
    }

    // Expansion base
    const expansionType = FACTION_EXPANSION[faction];
    const expansionDef = BUILDING_DEFS[expansionType];
    const hasExpansion = buildings.some(b => b.type === expansionType);
    if (!hasExpansion && this.gameTime > 90 && minerals() >= expansionDef.cost) {
      spendMinerals(expansionDef.cost);
      buildings.push({ type: expansionType, x: ARENA_W / 2, y: isPlayer ? RIVER_Y + RIVER_H + 150 : RIVER_Y - 150, hp: 2000, maxHp: 2000, built: false, buildProgress: 0, buildTime: 15, queue: [] });
      return;
    }

    // Production buildings
    const availBuildings = this.getAvailableBuildings(team);
    const prodBuildings = availBuildings.filter(b => !BUILDING_DEFS[b].supplyCap && !BUILDING_DEFS[b].gasBuilding && !BUILDING_DEFS[b].isExpansion);
    if (prodBuildings.length > 0) {
      const btype = prodBuildings[0];
      const bdef = BUILDING_DEFS[btype];
      const gasCost = bdef.gasCost || 0;
      if (minerals() >= bdef.cost && gas() >= gasCost) {
        spendMinerals(bdef.cost);
        spendGas(gasCost);
        buildings.push({ type: btype, x: 50 + buildings.length * 35, y: baseY, hp: 500, maxHp: 500, built: false, buildProgress: 0, buildTime: bdef.buildTime, queue: [] });
        return;
      }
    }

    // Combat units
    const availUnits = this.getAvailableUnits(team);
    const combatUnits = availUnits.filter(u => !UNIT_DEFS[u].worker);
    if (combatUnits.length > 0) {
      const affordable = combatUnits.filter(u => this.canAffordUnit(u, team));
      if (affordable.length > 0) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)];
        const building = this.getBuildingForUnit(pick, buildings);
        if (building && building.queue.length < 3) {
          const def = UNIT_DEFS[pick];
          spendMinerals(def.cost);
          spendGas(def.gasCost || 0);
          building.queue.push({ type: pick, timeLeft: def.buildTime, totalTime: def.buildTime });
          const s = isPlayer ? this.stats.player : this.stats.enemy;
          s.mineralsSpent += def.cost;
          s.gasSpent += (def.gasCost || 0);
        }
      }
    }

    // More workers
    if (workerCount < 12 && this.canAffordUnit(workerType, team) && baseBuilding && baseBuilding.queue.length < 2) {
      spendMinerals(workerDef.cost);
      baseBuilding.queue.push({ type: workerType, timeLeft: workerDef.buildTime, totalTime: workerDef.buildTime });
    }
  }

  tick(dt) {
    this.gameTime += dt;

    // Gas income (worker-based, depletes from geysers)
    for (const team of ['player', 'enemy']) {
      const geysers = this.gasGeysers[team];
      const buildings = team === 'player' ? this.playerBuildings : this.enemyBuildings;
      for (let i = 0; i < geysers.length; i++) {
        const g = geysers[i];
        if (g.workers <= 0 || g.gas <= 0) continue;
        // Check if refinery built on this geyser
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
        // Construction
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
        // Production queue
        if (!b.queue || b.queue.length === 0 || !b.built) continue;
        const item = b.queue[0];
        item.timeLeft -= dt;
        if (item.timeLeft <= 0) {
          b.queue.shift();
          const baseY = team === 'player' ? GAME_H - 150 : 150;
          const lane = Math.random() < 0.5 ? 0 : 1;
          const x = LANE_X[lane] + (Math.random()-0.5)*30;
          this.spawnUnit(item.type, x, baseY, team);
        }
      }
    }

    // Force fields
    for (const ff of this.forceFields) ff.life -= dt;
    this.forceFields = this.forceFields.filter(ff => ff.life > 0);

    // AI (both sides)
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
              // Simplified: direct hit (no projectile travel time)
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
        const isPlayer = unit.team === 'player';
        const stance = isPlayer ? this.playerStance : this.enemyStance;
        let targetY = isPlayer ? 90 : GAME_H - 90;
        if (stance === 'defend') targetY = isPlayer ? GAME_H - 250 : 250;
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
        if (u.team === 'player') { this.playerSupply -= (u.supply || 1); this.stats.player.unitsLost++; }
        else { this.enemySupply -= (u.supply || 1); this.stats.enemy.unitsLost++; }
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
    const DT = 0.05; // 50ms tick (20 ticks/sec)
    while (!this.tick(DT)) {}
    return this.result;
  }
}

// ---- Run Simulations ----
const GAMES_PER_MATCHUP = 50;
const results = {};

// All 9 matchups (including mirrors)
const matchups = [];
for (const f1 of FACTIONS) {
  for (const f2 of FACTIONS) {
    matchups.push([f1, f2]);
  }
}

console.log('='.repeat(70));
console.log('  STARCLASH BALANCE SIMULATOR');
console.log(`  Running ${GAMES_PER_MATCHUP} games per matchup (${matchups.length * GAMES_PER_MATCHUP} total)`);
console.log('='.repeat(70));
console.log();

const overallWins = { terran: 0, protoss: 0, zerg: 0 };
const overallGames = { terran: 0, protoss: 0, zerg: 0 };
const matchupStats = {};

for (const [f1, f2] of matchups) {
  const key = `${f1} vs ${f2}`;
  let f1Wins = 0, f2Wins = 0, draws = 0;
  let totalTime = 0;
  let totalPlayerUnits = 0, totalEnemyUnits = 0;
  let totalPlayerLost = 0, totalEnemyLost = 0;
  let totalPlayerPeakSupply = 0, totalEnemyPeakSupply = 0;

  for (let i = 0; i < GAMES_PER_MATCHUP; i++) {
    const sim = new GameSim(f1, f2);
    const result = sim.run();
    totalTime += sim.gameTime;
    totalPlayerUnits += sim.stats.player.unitsBuilt;
    totalEnemyUnits += sim.stats.enemy.unitsBuilt;
    totalPlayerLost += sim.stats.player.unitsLost;
    totalEnemyLost += sim.stats.enemy.unitsLost;
    totalPlayerPeakSupply += sim.stats.player.peakSupply;
    totalEnemyPeakSupply += sim.stats.enemy.peakSupply;

    if (result === 'player') f1Wins++;
    else if (result === 'enemy') f2Wins++;
    else draws++;
  }

  const n = GAMES_PER_MATCHUP;
  const avgTime = totalTime / n;
  const f1WinRate = ((f1Wins / n) * 100).toFixed(1);
  const f2WinRate = ((f2Wins / n) * 100).toFixed(1);

  matchupStats[key] = { f1Wins, f2Wins, draws, avgTime, f1WinRate, f2WinRate };

  // Track overall
  overallGames[f1] += n;
  overallGames[f2] += n;
  overallWins[f1] += f1Wins;
  overallWins[f2] += f2Wins;

  const f1Pad = f1.padEnd(7);
  const f2Pad = f2.padEnd(7);
  const timeStr = `${Math.floor(avgTime/60)}m${Math.floor(avgTime%60)}s`;
  console.log(`  ${f1Pad} vs ${f2Pad}  |  ${f1Pad}: ${f1WinRate.padStart(5)}%  ${f2Pad}: ${f2WinRate.padStart(5)}%  Draw: ${((draws/n)*100).toFixed(1).padStart(5)}%  |  Avg: ${timeStr}  |  Units: ${Math.round(totalPlayerUnits/n)} vs ${Math.round(totalEnemyUnits/n)}  |  Peak Supply: ${Math.round(totalPlayerPeakSupply/n)} vs ${Math.round(totalEnemyPeakSupply/n)}`);
}

console.log();
console.log('='.repeat(70));
console.log('  OVERALL FACTION WIN RATES (across all matchups)');
console.log('='.repeat(70));
for (const f of FACTIONS) {
  const wr = ((overallWins[f] / overallGames[f]) * 100).toFixed(1);
  const bar = '\u2588'.repeat(Math.round(overallWins[f] / overallGames[f] * 40));
  console.log(`  ${f.padEnd(8)} ${wr.padStart(5)}%  ${bar}  (${overallWins[f]}W / ${overallGames[f]}G)`);
}

// Non-mirror matchup analysis
console.log();
console.log('='.repeat(70));
console.log('  NON-MIRROR MATCHUP MATRIX');
console.log('='.repeat(70));
const nonMirror = {};
for (const f of FACTIONS) nonMirror[f] = { wins: 0, games: 0 };
for (const [f1, f2] of matchups) {
  if (f1 === f2) continue;
  const key = `${f1} vs ${f2}`;
  const s = matchupStats[key];
  nonMirror[f1].wins += s.f1Wins;
  nonMirror[f1].games += GAMES_PER_MATCHUP;
}

for (const f of FACTIONS) {
  const wr = ((nonMirror[f].wins / nonMirror[f].games) * 100).toFixed(1);
  const bar = '\u2588'.repeat(Math.round(nonMirror[f].wins / nonMirror[f].games * 40));
  console.log(`  ${f.padEnd(8)} ${wr.padStart(5)}%  ${bar}  (${nonMirror[f].wins}W / ${nonMirror[f].games}G)`);
}

// Balance assessment
console.log();
console.log('='.repeat(70));
console.log('  BALANCE ASSESSMENT');
console.log('='.repeat(70));

const nonMirrorRates = FACTIONS.map(f => ({ faction: f, rate: nonMirror[f].wins / nonMirror[f].games }));
nonMirrorRates.sort((a, b) => b.rate - a.rate);
const spread = (nonMirrorRates[0].rate - nonMirrorRates[2].rate) * 100;

if (spread < 10) {
  console.log('  VERDICT: Well balanced! Spread is only ' + spread.toFixed(1) + '% between best and worst faction.');
} else if (spread < 20) {
  console.log('  VERDICT: Slightly imbalanced. Spread is ' + spread.toFixed(1) + '% between best and worst faction.');
  console.log(`  ${nonMirrorRates[0].faction.toUpperCase()} seems strongest, ${nonMirrorRates[2].faction.toUpperCase()} seems weakest.`);
} else {
  console.log('  VERDICT: Significantly imbalanced! Spread is ' + spread.toFixed(1) + '%.');
  console.log(`  ${nonMirrorRates[0].faction.toUpperCase()} is overpowered, ${nonMirrorRates[2].faction.toUpperCase()} is underpowered.`);
}

// Specific matchup concerns
console.log();
console.log('  Head-to-head concerns (>65% win rate):');
let concerns = 0;
for (const [f1, f2] of matchups) {
  if (f1 === f2) continue;
  const key = `${f1} vs ${f2}`;
  const s = matchupStats[key];
  if (parseFloat(s.f1WinRate) > 65) {
    console.log(`    ! ${f1.toUpperCase()} beats ${f2.toUpperCase()} ${s.f1WinRate}% of the time`);
    concerns++;
  }
}
if (concerns === 0) console.log('    None! All head-to-head matchups are within 65% threshold.');

// Suggested fixes
if (spread >= 10) {
  console.log();
  console.log('  SUGGESTED BALANCE ADJUSTMENTS:');
  const strongest = nonMirrorRates[0].faction;
  const weakest = nonMirrorRates[2].faction;

  // Analyze what's going wrong
  for (const [f1, f2] of matchups) {
    if (f1 === f2) continue;
    const key = `${f1} vs ${f2}`;
    const s = matchupStats[key];
    if (parseFloat(s.f1WinRate) > 60) {
      // f1 is beating f2
      if (f1 === strongest) {
        const units1 = Object.entries(UNIT_DEFS).filter(([k,v]) => v.faction === f1 && !v.worker);
        const avgDPS1 = units1.reduce((sum, [k,v]) => sum + (v.dmg / v.atkSpeed) * v.count, 0) / units1.length;
        const avgHP1 = units1.reduce((sum, [k,v]) => sum + v.hp * v.count, 0) / units1.length;
        const avgCost1 = units1.reduce((sum, [k,v]) => sum + v.cost, 0) / units1.length;

        const units2 = Object.entries(UNIT_DEFS).filter(([k,v]) => v.faction === f2 && !v.worker);
        const avgDPS2 = units2.reduce((sum, [k,v]) => sum + (v.dmg / v.atkSpeed) * v.count, 0) / units2.length;
        const avgHP2 = units2.reduce((sum, [k,v]) => sum + v.hp * v.count, 0) / units2.length;
        const avgCost2 = units2.reduce((sum, [k,v]) => sum + v.cost, 0) / units2.length;

        console.log(`    ${f1.toUpperCase()} vs ${f2.toUpperCase()} (${s.f1WinRate}% win rate):`);
        console.log(`      ${f1} avg DPS/unit: ${avgDPS1.toFixed(1)}, avg HP: ${avgHP1.toFixed(0)}, avg cost: ${avgCost1.toFixed(0)}`);
        console.log(`      ${f2} avg DPS/unit: ${avgDPS2.toFixed(1)}, avg HP: ${avgHP2.toFixed(0)}, avg cost: ${avgCost2.toFixed(0)}`);

        if (avgDPS1 / avgCost1 > avgDPS2 / avgCost2 * 1.15) {
          console.log(`      -> ${f1} has better DPS/cost. Consider reducing ${f1} unit damage or increasing costs.`);
        }
        if (avgHP1 / avgCost1 > avgHP2 / avgCost2 * 1.15) {
          console.log(`      -> ${f1} has better HP/cost. Consider reducing ${f1} unit HP or increasing costs.`);
        }
      }
    }
  }
}

console.log();
console.log('Simulation complete.');
