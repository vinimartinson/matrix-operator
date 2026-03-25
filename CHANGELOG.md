# Matrix Operator — Development Changelog

All changes made during the Ship Systems, Dive Mechanics, and EMP Overhaul sessions.

---

## Overview

A comprehensive rework of the ship defense subsystems: dive depth mechanics, EMP discharge effects, and cross-panel visual synchronization. The core problem was that several UI panels operated independently from the game state — sentinels on the proximity sonar were cosmetic decorations, EMP effects only appeared in the terminal text, and depth changes had no mechanical impact. Every panel now reads live game state and reacts in real time.

---

## Files Modified

| File | Type | Summary |
|------|------|---------|
| `src/engine/ship-systems.ts` | Engine | Depth mechanics, signal degradation, EMP kill probability |
| `src/engine/types.ts` | Engine | New store fields: `sentinelCount`, `empFired`, `trinityShockAt` |
| `src/engine/game-state.ts` | Engine | New actions: `setEmpFired`, `setTrinityShock` |
| `src/data/commands.ts` | Data | Rewrote `dive` and `emp` commands with depth-aware mechanics |
| `src/terminal/ThreatRadar.tsx` | UI | Fixed stale blips, added EMP charge arc + discharge animation |
| `src/terminal/DepthGauge.tsx` | UI | Connected sentinels to game state, added EMP discharge animation |
| `src/terminal/BroadcastWave.tsx` | UI | Added `'emp'` spike type with highest amplitude/speed |
| `src/terminal/SignalMonitor.tsx` | UI | EMP spike detection with 2s auto-normalize timer |
| `src/terminal/HardlineScanner.tsx` | UI | EMP frequency surge effect (2s cyan spike + decay) |

---

## 1. Dive Depth Mechanics (`ship-systems.ts`)

Depth now has real mechanical consequences across every system.

### Signal Degradation by Depth

```
depthSignalFactor(depth):
  1 km → 100%    (full broadcast strength)
  2 km →  90%
  3 km →  75%
  4 km →  55%
  5 km →  30%    (barely readable)
```

The broadcast array level is set to `maxLevel * depthSignalFactor(depth)` whenever the ship dives or ascends.

### EMP Kill Probability by Depth

Deeper water contains the EMP blast radius better — more sentinels hit per discharge.

```
depthEmpKillChance(depth):
  1-2 km → 60%
  3 km   → 65%
  4 km   → 75%
  5 km   → 85%
```

### Sentinel Detection by Depth

Deeper = more sentinels can detect the ship = more threats on sonar.

```
sentinelCountForDepth(depth):
  ≤2 km → 1 sentinel
  ≤3 km → 2 sentinels
  ≤4 km → 3 sentinels
  >4 km → 4 sentinels
```

### Sentinel Approach Speed

Sentinels close in faster at deeper depths during `ship_defense` phase:

```
≤2 km : 10 m/tick
2-3 km: 15 m/tick
>3 km : 25-35 m/tick (scales with depth)
```

### `changeDive()` Rewrite

Now sets three values atomically: `depth`, `sentinelCount`, and `broadcastArray.level` — all derived from the new depth.

---

## 2. Dive Command (`commands.ts`)

### No-args: Zone Chart

Running `dive` with no arguments prints a depth zone reference chart showing broadcast strength, sentinel approach rate, EMP kill probability, and sentinel count for each depth tier.

### With depth argument

Running `dive <depth>` now shows:
- New broadcast signal percentage
- Sentinel approach rate for the new depth
- EMP kill probability
- Sentinel count change (e.g., "Sentinels: 1 → 3")
- Safety zone classification

---

## 3. EMP Discharge Overhaul (`commands.ts` → `fireEmpNow`)

### Depth-Aware Kill Probability

Each sentinel is individually rolled against `depthEmpKillChance(depth)`. At 5km, 85% chance per sentinel — at 1km, only 60%.

### Broadcast Array + Matrix Feed Spike

EMP discharge immediately spikes both systems to 95%:
```typescript
state.updateShip({
  broadcastArray: { ...ship.broadcastArray, level: 95 },
  matrixFeed:     { ...ship.matrixFeed,     level: 95 },
});
```

After 2 seconds, both are restored:
- Broadcast array → `maxLevel * depthSignalFactor(currentDepth)` (depth-correct value)
- Matrix feed → capped at 90%

Uses `setTimeout` + `useGameStore.getState()` to read current depth at restore time (not stale closure).

### Trinity Biometric Shock

EMP discharge causes collateral damage to Trinity:
- Health: -8 HP
- Fatigue: +15%
- Triggers `trinityShockAt` timestamp for the TrinityVitals EKG animation

### Terminal Output

```
  ╔═══════════════════════════════════════╗
  ║    ⚡  E M P   D I S C H A R G E  ⚡ ║
  ╚═══════════════════════════════════════╝

  PROXIMITY SONAR: 3 sentinel(s) detected in range
  Depth: 4.0 km  |  EMP kill probability: 75% (depth bonus ✓)

  ✓ NEUTRALIZED : 2 sentinel(s) — contact lost
  ✗ SURVIVED    : 1 sentinel(s) — still closing

  Sentinel distance: 450m → 890m

  !! TRINITY BIOMETRIC SHOCK !!
  HP: 92%  |  STRESS: 45%  |  EKG SPIKING

  ▸ BROADCAST ARRAY : SPIKE 95% — decays in 2s
  ▸ MATRIX FEED     : SPIKE 95% — decays in 2s
```

---

## 4. ThreatRadar / Spatial Analysis (`ThreatRadar.tsx`)

### Bug Fix: Stale Sentinel Blips After EMP

**Root cause:** The canvas animation loop ran in `useEffect([], [])` and read sentinel data from React refs (`sentCountRef.current = sentCount`) written during the render body. React 18's concurrent scheduler can defer re-renders, so the RAF callback fires before React processes the state update — the ref holds the old value.

**Fix:** Replaced all three stale refs (`sentDistRef`, `sentCountRef`, `depthRef`) with a single synchronous read at the top of every frame:

```typescript
const ship = useGameStore.getState().ship;
const sentNum = ship.sentinelCount ?? 0;
const sentDist = ship.sentinelDistance;
const depth = ship.depth;
```

`getState()` reads directly from Zustand's internal store — zero React involvement, always current.

### EMP Charge Arc

When `empCharging` is true, draws a circular charge indicator at the terrain center:
- Dim background ring (full circle)
- Filled arc sweeping clockwise from top, proportional to `empCharge / 100`
- Color interpolates green → cyan as charge rises
- Pulsing center dot with glow
- Drawn after blips, before EMP discharge rings

### EMP Discharge Animation

When `empFired` triggers:
- **Flash**: Bright cyan overlay fills entire canvas, fades in 100ms
- **Rings**: 4 expanding elliptical rings pulse outward from center with cyan glow + shadow
- **Terrain tint**: Grid edges shift from green/red to cyan during the pulse
- **Terrain flatten**: Elevation multiplier drops to 0 at start, slowly recovers — visually "flattens" the terrain as the EMP shockwave passes

Duration: 2.4 seconds total.

### Depth Effects on Canvas

- **Signal alpha**: Terrain rendering dimmed at depth >2km (via `ctx.globalAlpha`)
- **Deep-water noise**: Random static dots scattered across the canvas at depth >3km
- **Depth badge in header**: Shows depth with safety indicator (`2.0km ✓` green, `4.0km ⚠` orange + flash)

### Header: Charging Badge

Shows `⚡ 42%` (flashing green) when EMP is charging. Replaces sentinel count badge during charge sequence.

---

## 5. DepthGauge / Proximity Sonar (`DepthGauge.tsx`)

### Bug Fix: Hardcoded Sentinel Blips

**Root cause:** The component always iterated over all 5 entries in the `PATROLS` array, drawing every sentinel blip regardless of `ship.sentinelCount`. Sentinels on the proximity sonar were purely cosmetic.

**Fix:** Changed `for (const p of PATROLS)` to `for (let i = 0; i < sentNum; i++)` where `sentNum` comes from `useGameStore.getState().ship.sentinelCount` read directly in every frame. Killed sentinels now immediately disappear from the sonar.

### EMP Discharge Animation

When `empFired` triggers:
- **Flash**: Bright cyan overlay fills the sonar disc (fades over 120ms)
- **Rings**: 3 expanding circular rings pulse outward from the Neb's center position
- **Text flash**: "⚡ EMP ⚡" appears at center, fades over 350ms
- **Header**: Switches to "EMP ACTIVE" in cyan with flash animation
- **Border**: Turns cyan during the pulse

Duration: 2.2 seconds.

### Header Enhancement

- Shows sentinel count badge (`3▲` in orange) when sentinels are present
- Shows `✓` in green when clear
- Shows `⚡` in flashing cyan during EMP animation

---

## 6. BroadcastWave (`BroadcastWave.tsx`)

### New Spike Type: `'emp'`

Added to the `SpikeType` union and `SPIKE_PARAMS`:

```typescript
emp: { amp: 36, freq: 0.085, speed: 0.22, color: '#00dcff', label: '⚡ EMP DISCHARGE' }
```

- **Highest amplitude** of any spike type (36 vs Smith's 28)
- **Fastest wave speed** (0.22 vs Smith's 0.13)
- **Bright cyan** color with glow
- The sine wave visibly spikes to near-full height and races across the display

---

## 7. SignalMonitor (`SignalMonitor.tsx`)

### EMP Spike Detection + 2s Auto-Normalize

**Problem:** The original `useMemo` checked `events` timestamps to determine if an EMP was recent. But `useMemo` only re-evaluates when its dependency array changes — after 2 seconds, no new events arrive, so the spike never clears.

**Fix:** Replaced with `useState` + `useEffect` + `setTimeout`:

```typescript
const [empActive, setEmpActive] = useState(false);
useEffect(() => {
  const lastEmp = [...events].reverse().find((e) => e.type === 'emp_fired');
  if (!lastEmp) return;
  const remaining = 2000 - (Date.now() - lastEmp.timestamp);
  if (remaining <= 0) return;
  setEmpActive(true);
  const id = setTimeout(() => setEmpActive(false), remaining);
  return () => clearTimeout(id);
}, [events]);
```

The `useMemo` now checks `if (empActive) return 'emp'` with `empActive` in the dependency array. When the timeout fires and sets `empActive = false`, the memo re-evaluates and the BroadcastWave returns to its previous state.

---

## 8. HardlineScanner / Frequency Array (`HardlineScanner.tsx`)

### EMP Frequency Surge

When EMP fires, all frequency bars surge to near-max height in bright cyan, then linearly decay back to normal over 2 seconds.

**Detection:** Uses `useGameStore.subscribe()` inside the canvas `useEffect` to watch for new `emp_fired` events. When detected, records `performance.now()` into `empStartRef`. No React re-renders needed.

**Rendering:** Each frame computes:
```typescript
const empIntensity = empElapsed < 2000 ? Math.max(0, 1 - empElapsed / 2000) : 0;
```

When `empIntensity > 0`:
- All non-target bars are boosted to 55-98% height (with slight per-bar variation via `Math.sin`)
- Color shifts from normal green to bright cyan
- Glow shadow applied at high intensity
- Bars gradually return to their normal noise pattern as intensity decays

---

## Key Technical Patterns

### `getState()` in RAF Loops

The core pattern used across ThreatRadar and DepthGauge for canvas animation loops:

```typescript
function frame(ts: number) {
  const ship = useGameStore.getState().ship;
  // ... use ship.sentinelCount, ship.depth, etc.
}
```

This bypasses React's rendering pipeline entirely. Zustand's `getState()` is a synchronous object property lookup — guaranteed current, zero overhead, no stale-ref risk.

### `useState` + `useEffect` + `setTimeout` for Timed State

For state transitions that must fire on a timer (not on dependency change):

```typescript
const [active, setActive] = useState(false);
useEffect(() => {
  // detect trigger, compute remaining time
  setActive(true);
  const id = setTimeout(() => setActive(false), remaining);
  return () => clearTimeout(id);
}, [deps]);
```

This ensures the state clears even if no new events arrive to re-trigger the memo.

### `useGameStore.subscribe()` in Canvas Effects

For detecting store changes inside a `useEffect([], [])` canvas loop without causing React re-renders:

```typescript
useEffect(() => {
  const unsubscribe = useGameStore.subscribe((state, prevState) => {
    // compare state.events to prevState.events
    empStartRef.current = performance.now();
  });
  return () => unsubscribe();
}, []);
```

The subscription fires synchronously on every store mutation, records a `performance.now()` timestamp into a ref, and the canvas loop reads the ref on the next frame.

---

## Verification

All changes pass `npx tsc --noEmit` with zero errors.

### Manual Test Steps

1. `charge` → sonar canvas shows charge arc filling 0→100% over ~2.2s
2. `emp` → all panels react simultaneously:
   - **Spatial Analysis**: cyan flash + expanding rings, terrain flattens, killed blips vanish
   - **Proximity Sonar**: cyan flash + expanding rings, killed blips vanish, header shows "EMP ACTIVE"
   - **Broadcast Array**: wave spikes to max amplitude in cyan, normalizes after 2s
   - **Frequency Array**: all bars surge to max in cyan, decay back over 2s
   - **Terminal**: full discharge report with kill count, depth bonus, Trinity shock
3. `dive 5` → sentinels increase on both sonar panels, broadcast weakens, approach rate increases
4. `dive 1` → sentinels decrease, broadcast strengthens, safe zone indicators appear
5. `status` → broadcast/matrix feed show ~95% briefly after EMP, then drop back after 2s
