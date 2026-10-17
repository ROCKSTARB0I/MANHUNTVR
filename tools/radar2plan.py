# radar2plan.py — turn the Manhunt scene radar plans into our own layout grids.
# Each map gets a colour key (radar shade -> role). Output: src/plans.js, one
# entry per scene: a grid of role characters at 2 radar px per cell, cropped to
# the playable area, run-length encoded.
#   ' ' void (off the plan)   '.' floor   ',' grass/dirt   '#' wall or fence line
#   'b' low block (crates, junk, cars, counters)   'B' building / tall solid   't' tree
# usage: python3 tools/radar2plan.py <dir with radar pngs>
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); import png

V, F, G, W, b, B, T, I = ' ', '.', ',', '#', 'b', 'B', 't', 'i'  # i: indoor floor (roofed)
MAPS = {
  'born-again': ('BornAgain-Manhunt-Map.png', 0.32, {(0,0,0): V, (255,255,255): V, (114,114,115): F, (159,159,159): F, (148,148,149): F, (66,66,66): F, (188,198,201): b, (143,85,107): W}),
  'doorway': ('DoorwayIntoHell-Manhunt-Map.png', 0.34, {(0,0,0): V, (57,89,60): F, (81,118,85): I, (116,163,120): B, (119,183,125): W, (153,223,160): W}),
  'white-trash': ('WhiteTrash-Manhunt-Map.png', 0.3, {(0,0,0): V, (57,89,60): F, (81,118,85): F, (118,120,93): F, (116,163,120): b, (119,183,125): b, (153,223,160): W}),
  'fuelled': ('FuelledByHate-Manhunt-Map.png', 0.3, {(0,0,0): V, (115,115,115): F, (75,79,83): F, (158,154,154): F, (92,90,90): F, (114,114,114): F, (44,44,44): W, (45,45,45): W, (123,74,99): W}),
  'grounds': ('GroundsForAssault-Manhunt-Map.png', 0.36, {(0,0,0): V, (57,89,60): F, (81,118,85): G, (116,163,120): B, (119,183,125): b, (153,223,160): W}),
  'strapped': ('StrappedForCash-MH1-Map.png', 0.36, {(0,0,0): V, (115,115,115): F, (150,152,157): F, (173,173,173): B, (132,140,115): G, (140,82,107): W, (63,63,63): W}),
  'drunk-driving': ('DrunkDriving-MH-SceneMap.png', 0.34, {(0,0,0): V, (8,8,8): V, (57,89,60): F, (49,76,51): F, (81,118,85): F, (102,147,107): b, (116,163,120): b, (119,183,125): B, (153,223,160): W}),
  'graveyard': ('GraveyardShift-MH-SceneMap.png', 0.3, {(0,0,0): V, (159,159,159): F, (114,114,114): F, (128,128,128): F, (149,149,149): F, (183,183,183): F, (207,207,207): F, (217,217,217): F, (188,198,201): F, (222,227,228): F, (228,232,233): F, (101,134,162): F, (99,115,116): b, (107,111,114): b, (64,64,64): W, (143,85,107): W}),
  'madness': ('MouthofMadness-MH-RadarMap.png', 0.3, {(0,0,0): V, (159,159,159): F, (144,146,125): F, (141,147,149): F, (167,175,177): F, (118,120,93): G, (188,198,201): B, (35,72,49): T, (143,85,107): W}),
  'divided': ('DividedTheyFall-MH-MapRadar.png', 0.34, {(0,0,0): V, (115,115,115): F, (156,156,156): F, (82,82,74): B, (123,74,99): W}),
  'press': ('PressCoverage-MH-MapRadar.png', 0.34, {(0,0,0): V, (57,90,57): F, (82,115,82): F, (49,74,49): F, (115,165,123): B, (99,148,107): b, (115,181,123): b, (156,222,165): W}),
  'tracks': ('WrongSideoftheTracks-MH-MapRadar.png', 0.4, {(0,0,0): V, (57,90,57): F, (82,115,82): F, (49,74,49): F, (115,165,123): b, (99,148,107): b, (115,181,123): b, (156,222,165): W}),
}
PRI = {W: 5, T: 4, B: 3, b: 2, I: 1, G: 1, F: 0, V: -1}

def role(key, c):
    if c in key: return key[c]
    best = min(key, key=lambda k: sum((a - b2) ** 2 for a, b2 in zip(k, c)))
    return key[best]

def convert(path, m, key):
    w, h, px = png.read(path)
    cw, ch = w // 2, h // 2; grid = []
    for j in range(ch):
        row = []
        for i in range(cw):
            rs = [role(key, px[j*2+dy][i*2+dx][:3]) for dy in (0, 1) for dx in (0, 1)]
            if W in rs: r = W                          # thin wall lines win
            else:
                cnt = {}; [cnt.__setitem__(x, cnt.get(x, 0) + 1) for x in rs]
                r = max(cnt, key=lambda x: (cnt[x], PRI[x]))
            row.append(r)
        grid.append(row)
    # drop stray specks of plan floating in the void (map frame markers etc.): keep the biggest connected area
    seen = [[0]*cw for _ in range(ch)]; best = []
    for j in range(ch):
        for i in range(cw):
            if grid[j][i] == V or seen[j][i]: continue
            comp = []; st = [(i, j)]; seen[j][i] = 1
            while st:
                x, y = st.pop(); comp.append((x, y))
                for a, c in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0 <= a < cw and 0 <= c < ch and not seen[c][a] and grid[c][a] != V: seen[c][a] = 1; st.append((a, c))
            if len(comp) > len(best): best = comp
    keep = set(best)
    for j in range(ch):
        for i in range(cw):
            if (i, j) not in keep: grid[j][i] = V
    xs = [p[0] for p in best]; ys = [p[1] for p in best]
    x0, x1, y0, y1 = max(0, min(xs) - 2), min(cw, max(xs) + 3), max(0, min(ys) - 2), min(ch, max(ys) + 3)
    rows = []
    for j in range(y0, y1):
        s = ''.join(grid[j][x0:x1]); out = []; k = 0
        while k < len(s):
            n = 1
            while k + n < len(s) and s[k+n] == s[k] and n < 99: n += 1
            out.append(s[k] if n == 1 else f'{n}{s[k]}'); k += n
        rows.append(''.join(out))
    # the radar's own pixel origin, so start/exit marks can be given in radar pixels
    return {'m': m * 2, 'w': x1 - x0, 'h': y1 - y0, 'ox': x0 * 2, 'oy': y0 * 2, 'rows': rows}

if __name__ == '__main__':
    src = sys.argv[1]; out = {}
    for sid, (f, m, key) in MAPS.items():
        out[sid] = convert(os.path.join(src, f), m, key)
        p = out[sid]; print(sid, p['w'], 'x', p['h'], 'cells', f"{p['w']*p['m']:.0f}m x {p['h']*p['m']:.0f}m", sum(len(r) for r in p['rows']), 'chars')
    dst = os.path.join(os.path.dirname(__file__), '..', 'src', 'plans.js')
    with open(dst, 'w') as fh:
        fh.write('// plans.js — level layouts traced from the Manhunt scene radar maps (tools/radar2plan.py).\n')
        fh.write("// rows: run-length encoded role characters; ' ' void, '.' floor, ',' grass, '#' wall, 'b' low block, 'B' building, 't' tree.\n")
        fh.write('export const PLANS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print('wrote', os.path.getsize(dst), 'bytes')
