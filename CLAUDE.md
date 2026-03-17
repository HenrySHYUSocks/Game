# StarClash - SC2-Inspired Mobile RTS

## Project Overview
Single-file HTML5 canvas game (`index.html`) implementing a StarCraft 2-inspired RTS with three factions (Terran, Protoss, Zerg), resource management, tech trees, and AI opponents across three difficulty levels.

## Architecture
- **Single file**: All game logic, rendering, and UI in `index.html` (~8000+ lines)
- **Simulator**: `simulate.js` mirrors game logic headlessly for AI balance testing
- **Evolver**: `evolve.js` evolutionary AI trainer using genetic algorithms for self-play parameter optimization
- **Canvas rendering**: 400x1400 pixel arena at 60fps, with 90px side panel
- **No build tools**: Pure vanilla JavaScript, no dependencies

## Key Code Sections (index.html)
- **Lines ~878-965**: `BUILDING_DEFS` - all building definitions
- **Lines ~973-1015**: `UNIT_DEFS` - all unit definitions with stats
- **Lines ~1523+**: Target finding with priority scoring (`findTarget`)
- **Lines ~1954-2100**: Building queue processing (`getBuildingForUnit`, `updateAllBuildingQueues`)
- **Lines ~2392-3192**: Main game update loop (`updateGame`)
- **Lines ~3266-4554**: Enemy AI system (utility-based with build orders, micro, army grouping)
- **Lines ~6842-7370**: Production panel UI (`drawProductionPanel`)
- **Lines ~7461-7610**: Panel button hit detection (`getPanelButtons`)
- **Lines ~7611+**: Input handling (`handleInput`)

## Game Systems

### Factions & Tech Trees
- **Terran**: Barracks -> Factory -> Starport, with addon system (Reactor/Tech Lab)
- **Protoss**: Gateway -> Robotics -> Fleet Beacon, with Chrono Boost
- **Zerg**: Spawning Pool -> Hydralisk Den -> Spire, with Creep speed bonus

### Addon System (Terran-specific)
Buildings with `canAddon: true` support Reactor or Tech Lab:
- **Reactor**: 2x production speed, restricted to `reactorUnits` list
- **Tech Lab**: Normal speed, unlocks `techlabUnits` list
- **Swap**: Buildings can swap addons for 25/25 resources over 5 seconds
- When multiple buildings of the same type exist with different addons, UI shows union of all available units
- `getBuildingForUnit()` respects addon compatibility when routing production

### AI System
- **Utility-based**: Scores actions (supply, worker, army, expand, tech, defense) and executes top 2-3
- **Phase machine**: OPENING -> EARLY -> MID -> LATE (condition-based transitions)
- **Build orders**: Faction-specific scripted openings, then utility AI takes over
- **Micro controller**: Stutter-step kiting for ranged units, enhanced focus fire
- **Army grouping**: Waits for 60%+ of army at rally point before attacking
- **Difficulty scaling**: Easy (no micro, no grouping), Hard (micro + grouping), Impossible (fast decisions + income bonus)

### Resource System
- Minerals: Workers mine from patches (5 per trip, 1.5s cycle)
- Gas: Worker-count based (0.63/worker/sec), requires refinery on geyser
- Supply: Background-built depots/pylons/overlords

## Common Patterns

### Adding a New Unit
1. Add entry to `UNIT_DEFS` with all stats
2. Add to parent building's `unlocks` array in `BUILDING_DEFS`
3. If Terran: add to `reactorUnits` or `techlabUnits` as appropriate
4. Create `drawXxxUnit()` rendering function
5. Add to AI's `getUnitWeight()` if special counter logic needed

### Adding a New Building
1. Add entry to `BUILDING_DEFS`
2. Set `requires` for tech tree dependency
3. Add to `getAvailableBuildings()` filter logic if special type
4. Add render code in `drawBuildings()`

## Important Gotchas
- Building groups in UI merge all same-type buildings - addon filtering must consider ALL buildings in group
- `getBuildingForUnit()` must check addon compatibility or units get queued on wrong buildings
- The `simulate.js` mirrors main game logic but may drift - keep both in sync for balance testing
- Panel button positions in `getPanelButtons()` must exactly mirror `drawProductionPanel()` layout
- AI income bonus (`incomeBonus`) is applied elsewhere in the update loop, not in AI code itself

## Testing
- Run `node simulate.js` for headless AI-vs-AI balance testing across faction matchups
- Manual testing: open `index.html` in browser, test all three difficulties and factions
- When changing AI: test all 3 factions x 3 difficulties = 9 combinations

## Code Style
- All game state is global variables (no classes except `GameSim` in simulate.js)
- Functions are standalone, not methods
- Canvas rendering uses immediate-mode drawing with `ctx` global
- Pixel coordinates: player base at bottom (y=1300+), enemy base at top (y=100-)
- Team values: `'player'` and `'enemy'` strings throughout
