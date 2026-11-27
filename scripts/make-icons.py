"""
The app icons, public/icons/icon-512.png and icon-192.png, composed from the art: the wood tile
repeated (darkened a little), Dusty Vane's framed portrait (p_outlaw) centred at 4x art pixels
with a soft shadow and a 2-px #120A04 outline round the frame. Needs Pillow.

    python3 scripts/make-icons.py .
"""
import sys
from PIL import Image, ImageFilter, ImageEnhance
root = sys.argv[1]
N = Image.NEAREST
wood = Image.open(f'{root}/src/assets/sprites/wood.png').convert('RGBA')
face = Image.open(f'{root}/src/assets/sprites/p_outlaw.png').convert('RGBA')
# art px: both files are 3x
wood1 = wood.resize((wood.width // 3, wood.height // 3), N)
face1 = face.resize((face.width // 3, face.height // 3), N)   # 96x104

def compose(size, wood_scale, face_scale):
    bg = Image.new('RGBA', (size, size))
    tile = wood1.resize((wood1.width * wood_scale, wood1.height * wood_scale), N)
    for y in range(0, size, tile.height):
        for x in range(0, size, tile.width):
            bg.alpha_composite(tile, (x, y))
    # the boards a touch darker, so the frame stands off them
    bg = ImageEnhance.Brightness(bg).enhance(0.78)
    f = face1.resize((face1.width * face_scale, face1.height * face_scale), N)
    fx, fy = (size - f.width) // 2, (size - f.height) // 2
    # a soft drop shadow, then a 2-px dark outline following the frame's alpha
    a = f.getchannel('A')
    sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow = Image.new('RGBA', f.size, (8, 4, 1, 170)); shadow.putalpha(a.point(lambda v: 170 if v > 0 else 0))
    sh.alpha_composite(shadow, (fx, fy + max(2, size // 64)))
    sh = sh.filter(ImageFilter.GaussianBlur(size / 64))
    bg.alpha_composite(sh)
    o = max(1, size // 256)
    ring = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    dark = Image.new('RGBA', f.size, (0x12, 0x0A, 0x04, 255)); dark.putalpha(a.point(lambda v: 255 if v > 0 else 0))
    for dx in range(-o, o + 1):
        for dy in range(-o, o + 1):
            ring.alpha_composite(dark, (fx + dx, fy + dy))
    bg.alpha_composite(ring)
    bg.alpha_composite(f, (fx, fy))
    return bg.convert('RGB')

compose(512, 2, 4).save(f'{root}/public/icons/icon-512.png', optimize=True)
# 192: the portrait at 1.5x is not whole, so 192 is the 512 sampled down with a box filter
compose(512, 2, 4).resize((192, 192), Image.BOX).save(f'{root}/public/icons/icon-192.png', optimize=True)
