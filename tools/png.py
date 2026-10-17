# tiny PNG reader (8-bit RGB/RGBA/grey/palette) — no PIL on this Mac
import zlib, struct
def read(path):
    d = open(path, 'rb').read(); assert d[:8] == b'\x89PNG\r\n\x1a\n'
    i = 8; idat = b''; pal = None
    while i < len(d):
        n, t = struct.unpack('>I4s', d[i:i+8]); c = d[i+8:i+8+n]; i += 12 + n
        if t == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', c[:10])
        elif t == b'PLTE': pal = [tuple(c[k:k+3]) for k in range(0, len(c), 3)]
        elif t == b'IDAT': idat += c
    assert bd == 8, bd
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]; raw = zlib.decompress(idat); st = w * ch
    out = []; prev = bytearray(st); p = 0
    for y in range(h):
        f = raw[p]; line = bytearray(raw[p+1:p+1+st]); p += 1 + st
        for x in range(st):
            a = line[x-ch] if x >= ch else 0; b = prev[x]; cc = prev[x-ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - cc), abs(a - cc), abs(a + b - 2 * cc)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else cc)) & 255
        prev = line
        row = []
        for x in range(w):
            px = line[x*ch:(x+1)*ch]
            if ct == 3: row.append(pal[px[0]] + (255,))
            elif ct == 0: row.append((px[0],)*3 + (255,))
            elif ct == 4: row.append((px[0],)*3 + (px[1],))
            elif ct == 2: row.append(tuple(px) + (255,))
            else: row.append(tuple(px))
        out.append(row)
    return w, h, out
