# Makes the app's icon: a Pythagoras tree, as the 2D page draws it by default
# (colours by generation, Sunset), on the paper colour. Writes images/favicon.svg
# and PNG copies (for older browsers and phone home screens).
#   python3 tools/make-favicon.py      (needs Pillow for the PNGs)
import math, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STOPS = [(0x2d, 0x1b, 0x69), (0xc2, 0x25, 0x5c), (0xe8, 0x59, 0x0c)]
PAPER = (0xfb, 0xf9, 0xf3)
GENERATIONS = 6

def colour(t):
    # Along the three stops, t from 0 (trunk) to 1 (last generation).
    if t <= 0.5: a, b, u = STOPS[0], STOPS[1], t / 0.5
    else: a, b, u = STOPS[1], STOPS[2], (t - 0.5) / 0.5
    return tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3))

# Each transform: p -> A p + b. The two copies sit on the top of the square,
# scaled by 1/sqrt(2) and turned by +45 and -45 degrees (the 2D preset).
def similarity(x, y, deg, s):
    c, n = math.cos(math.radians(deg)) * s, math.sin(math.radians(deg)) * s
    return (c, -n, n, c, x, y)
T = [similarity(0, 1, 45, 1 / math.sqrt(2)), similarity(0.5, 1.5, 315, 1 / math.sqrt(2))]

def compose(f, g):   # f o g
    a, b, c, d, e, h = f; A, B, C, D, E, H = g
    return (a*A + b*C, a*B + b*D, c*A + d*C, c*B + d*D, a*E + b*H + e, c*E + d*H + h)

squares, level = [], [(1, 0, 0, 1, 0, 0)]
for gen in range(GENERATIONS + 1):
    for m in level:
        a, b, c, d, e, h = m
        squares.append((gen, [(e, h), (a + e, c + h), (a + b + e, c + d + h), (b + e, d + h)]))
    level = [compose(t, m) for m in level for t in T]

xs = [p[0] for _, q in squares for p in q]; ys = [p[1] for _, q in squares for p in q]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
SIZE, MARGIN = 64, 3
scale = (SIZE - 2 * MARGIN) / max(x1 - x0, y1 - y0)
ox = (SIZE - (x1 - x0) * scale) / 2 - x0 * scale
oy = (SIZE + (y1 - y0) * scale) / 2 + y0 * scale + 3  # y goes up in the figure, down in the picture; a little low
def place(p): return (ox + p[0] * scale, oy - p[1] * scale)

hexc = lambda c: "#%02x%02x%02x" % c
parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
         '<title>Similar Fractal</title>',
         '<rect width="64" height="64" rx="10" fill="%s"/>' % hexc(PAPER)]
for gen, q in squares:
    pts = " ".join("%.2f,%.2f" % place(p) for p in q)
    parts.append('<polygon points="%s" fill="%s"/>' % (pts, hexc(colour(gen / GENERATIONS))))
parts.append("</svg>")
os.makedirs(os.path.join(ROOT, "images"), exist_ok=True)
open(os.path.join(ROOT, "images", "favicon.svg"), "w").write("\n".join(parts) + "\n")

# PNG copies, drawn 8 times larger and scaled down for smooth edges.
try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("favicon.svg written; install Pillow for the PNG copies")
def png(size, name, rounded=True):
    k = 8 * size / SIZE
    im = Image.new("RGBA", (8 * size, 8 * size), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    if rounded:
        dr.rounded_rectangle([0, 0, k * 64 - 1, k * 64 - 1], radius=k * 10, fill=PAPER + (255,))
    else:
        dr.rectangle([0, 0, 8 * size, 8 * size], fill=PAPER + (255,))
    for gen, q in squares:
        dr.polygon([(k * x, k * y) for x, y in map(place, q)], fill=colour(gen / GENERATIONS) + (255,))
    im.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, "images", name), optimize=True)
png(32, "favicon-32.png")
png(180, "apple-touch-icon.png", rounded=False)   # the phone rounds the corners itself
png(512, "icon-512.png")
print("images/favicon.svg, favicon-32.png, apple-touch-icon.png, icon-512.png written;", len(squares), "squares")
