#!/usr/bin/env python3
"""
双端差异化图标生成器：在现有品牌 LOGO（渐变+书字+星/铅笔）基础上
增加明显的「学生端」「家长端」白色药丸标签，区分两个独立 APK。

产出：
  1. PWA 双端图标（public/icons/，带标签）
  2. Android flavor 资源：
     android/app/src/student/res/  （学生端，绿色系，applicationId=com.family.hwstudent）
     android/app/src/parent/res/   （家长端，紫色系，applicationId=com.family.hwparent）
     - mipmap-{dpi}/ic_launcher(.png/_round.png/_foreground.png)
     - mipmap-anydpi-v26/ic_launcher(.xml/_round.xml)
     - drawable/ic_launcher_bg.xml（渐变背景）
     - drawable-*/splash.png（品牌启动屏，带端别标题）
  3. 预览图 icons-preview-dual.png
"""
import math
import os
import sys

try:
    import PIL  # noqa
except ImportError:
    sys.path.insert(0, r'C:\Users\84887\.workbuddy\binaries\python\pillow-pkgs')

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
PWA_DIR = os.path.join(ROOT, 'public', 'icons')
STUDENT_RES = os.path.join(ROOT, 'android', 'app', 'src', 'student', 'res')
PARENT_RES = os.path.join(ROOT, 'android', 'app', 'src', 'parent', 'res')

# ---------- 品牌色 ----------
GREEN_TOP = (46, 196, 166)     # #2EC4A6
GREEN_BOTTOM = (13, 100, 78)   # #0D644E
PURPLE_TOP = (127, 119, 221)
PURPLE_BOTTOM = (58, 50, 128)
STAR_GOLD = (255, 210, 90)
STAR_GOLD_DEEP = (255, 190, 60)
WHITE = (255, 255, 255, 255)

THEMES = {
    'student': {'top': GREEN_TOP, 'bottom': GREEN_BOTTOM, 'badge_text': '学生端',
                'badge_color': (13, 100, 78), 'title': '书写评价 · 学生端'},
    'parent': {'top': PURPLE_TOP, 'bottom': PURPLE_BOTTOM, 'badge_text': '家长端',
               'badge_color': (58, 50, 128), 'title': '书写评价 · 家长端'},
}

DENSITIES = {
    'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216),
    'xxhdpi': (144, 324), 'xxxhdpi': (192, 432),
}

SPLASH_SIZES = {
    'port-mdpi': (320, 480), 'port-hdpi': (480, 800),
    'port-xhdpi': (720, 1280), 'port-xxhdpi': (1080, 1920),
    'port-xxxhdpi': (1440, 2560),
    'land-mdpi': (480, 320), 'land-hdpi': (800, 480),
    'land-xhdpi': (1280, 720), 'land-xxhdpi': (1920, 1080),
    'land-xxxhdpi': (2560, 1440),
}


def find_font(bold=True):
    candidates = [
        r'C:\Windows\Fonts\msyhbd.ttc' if bold else r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf',
        r'C:\Windows\Fonts\Deng.ttf', r'C:\Windows\Fonts\simsun.ttc',
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None


def draw_gradient(size, top, bottom):
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img


def rounded_mask(size, radius_ratio=0.22):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return mask


def draw_star(img, cx, cy, r, color=STAR_GOLD):
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(10):
        ang = -90 + i * 36
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(math.radians(ang)),
                    cy + rad * math.sin(math.radians(ang))))
    sh = [(x + r * 0.06, y + r * 0.08) for x, y in pts]
    d.polygon(sh, fill=(0, 0, 0, 60))
    d.polygon(pts, fill=color)


def draw_heart(img, cx, cy, r, color=(255, 138, 168)):
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r * 0.92, cx, cy + r * 0.08], fill=color)
    d.ellipse([cx, cy - r * 0.92, cx + r, cy + r * 0.08], fill=color)
    d.polygon([(cx - r * 0.99, cy - r * 0.2), (cx + r * 0.99, cy - r * 0.2),
               (cx, cy + r)], fill=color)


def draw_pencil(img, cx, cy, length, angle=-45):
    d = ImageDraw.Draw(img)
    w = length * 0.24
    tip = length * 0.26
    a = math.radians(angle)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -math.sin(a), math.cos(a)

    def P(t, s):
        return (cx + ux * t + nx * s, cy + uy * t + ny * s)

    L = length / 2
    off = length * 0.05
    shadow = [P(-L, -w), P(L - tip, -w), P(L, 0), P(L - tip, w), P(-L, w)]
    d.polygon([(x + off, y + off) for x, y in shadow], fill=(0, 0, 0, 70))
    body = [P(-L, -w), P(L - tip, -w), P(L - tip, w), P(-L, w)]
    d.polygon(body, fill=(255, 196, 40))
    d.polygon([P(-L, -w), P(L - tip, -w), P(L - tip, 0), P(-L, 0)],
              fill=(255, 220, 110))
    er = length * 0.12
    d.polygon([P(-L, -w), P(-L + er, -w), P(-L + er, w), P(-L, w)],
              fill=(255, 130, 150))
    d.polygon([P(L - tip, -w), P(L, 0), P(L - tip, w)], fill=(255, 229, 180))
    lead = tip * 0.42
    d.polygon([P(L - lead * 1.6, -w * 0.4), P(L, 0), P(L - lead * 1.6, w * 0.4)],
              fill=(90, 70, 50))
    d.line([P(-L, -w), P(L - tip, -w), P(L, 0), P(L - tip, w), P(-L, w), P(-L, -w)],
           fill=(255, 255, 255), width=max(1, int(w * 0.16)))


def draw_char(img, size, char='书', cx_ratio=0.5, cy_ratio=0.5, scale=0.46):
    """居中大字（可指定中心位置），带轻投影"""
    font_path = find_font()
    fs = int(size * scale)
    font = None
    if font_path:
        try:
            font = ImageFont.truetype(font_path, fs)
        except Exception:
            font = None
    tmp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    cx, cy = size * cx_ratio, size * cy_ratio
    if font:
        bbox = td.textbbox((0, 0), char, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = cx - tw / 2 - bbox[0]
        y = cy - th / 2 - bbox[1]
        td.text((x + fs * 0.03, y + fs * 0.04), char, font=font, fill=(0, 0, 0, 70))
        td.text((x, y), char, font=font, fill=WHITE)
    else:
        m = int(size * scale * 0.52)
        td.rounded_rectangle([cx - m, cy - m, cx + m, cy + m],
                             radius=int(m * 0.3), fill=WHITE)
    img.alpha_composite(tmp)


def draw_badge(img, size, kind, cy_ratio=0.86, height_ratio=0.155, text_ratio=0.125):
    """底部白色药丸标签：学生端 / 家长端"""
    th = THEMES[kind]
    text = th['badge_text']
    color = th['badge_color']
    font_path = find_font()
    if not font_path:
        return
    fs = max(10, int(size * text_ratio))
    font = ImageFont.truetype(font_path, fs)
    d = ImageDraw.Draw(img)
    tmp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    bbox = td.textbbox((0, 0), text, font=font)
    tw, thh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ph = int(size * height_ratio)          # 药丸高度
    pw = tw + ph * 0.9                     # 药丸宽度（含左右留白）
    cx, cy = size / 2, size * cy_ratio
    x0, y0 = cx - pw / 2, cy - ph / 2
    # 投影
    td.rounded_rectangle([x0 + size * 0.008, y0 + size * 0.012,
                          x0 + pw + size * 0.008, y0 + ph + size * 0.012],
                         radius=ph / 2, fill=(0, 0, 0, 80))
    # 白色药丸 + 品牌色文字
    td.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=ph / 2, fill=WHITE)
    td.text((cx - tw / 2 - bbox[0], cy - thh / 2 - bbox[1]), text,
            font=font, fill=color + (255,))
    img.alpha_composite(tmp)


# ---------- 1. PWA 图标 ----------

def create_pwa_icon(size, kind, maskable=False):
    th = THEMES[kind]
    img = draw_gradient(size, th['top'], th['bottom'])
    s = size / 512.0
    if maskable:
        # maskable：内容集中安全区（中心 80%），标签在安全区底部
        draw_char(img, size, cy_ratio=0.42, scale=0.36)
        if kind == 'student':
            draw_star(img, size * 0.68, size * 0.26, 30 * s)
        else:
            draw_heart(img, size * 0.68, size * 0.26, 34 * s)
        draw_badge(img, size, kind, cy_ratio=0.70, height_ratio=0.13, text_ratio=0.105)
    else:
        draw_char(img, size, cy_ratio=0.43, scale=0.44)
        if kind == 'student':
            draw_star(img, 408 * s, 108 * s, 48 * s)
            draw_pencil(img, 352 * s, 356 * s, 150 * s, angle=-45)
        else:
            draw_heart(img, 402 * s, 104 * s, 54 * s)
            draw_star(img, 388 * s, 398 * s, 36 * s, STAR_GOLD_DEEP)
            draw_star(img, 320 * s, 380 * s, 18 * s, STAR_GOLD)
        draw_badge(img, size, kind, cy_ratio=0.862, height_ratio=0.15, text_ratio=0.12)
    img.putalpha(rounded_mask(size, 0.10 if maskable else 0.22))
    return img


def gen_pwa():
    print('[PWA] public/icons/（带端别标签）')
    for kind in ('student', 'parent'):
        for size, name in ((512, f'icon-{kind}-512.png'),
                           (192, f'icon-{kind}-192.png'),
                           (180, f'icon-{kind}-180.png'),
                           (512, f'icon-{kind}-maskable-512.png')):
            maskable = 'maskable' in name
            create_pwa_icon(size, kind, maskable).save(
                os.path.join(PWA_DIR, name), 'PNG')
            print(f'  OK {name}')


# ---------- 2. Android flavor 资源 ----------

ADAPTIVE_XML = ('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@drawable/ic_launcher_bg"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '</adaptive-icon>\n')


def gradient_xml(top, bottom):
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<shape xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <gradient android:angle="270"\n'
            f'        android:startColor="#{top[0]:02X}{top[1]:02X}{top[2]:02X}"\n'
            f'        android:endColor="#{bottom[0]:02X}{bottom[1]:02X}{bottom[2]:02X}"\n'
            '        android:type="linear"/>\n'
            '</shape>\n')


def make_launcher_icon(icon_size, kind, round_shape=False):
    th = THEMES[kind]
    img = draw_gradient(icon_size, th['top'], th['bottom'])
    s = icon_size / 512.0
    if round_shape:
        # 圆形：内容整体上移收窄，标签置于中下
        draw_char(img, icon_size, cy_ratio=0.38, scale=0.38)
        if kind == 'student':
            draw_star(img, icon_size * 0.70, icon_size * 0.20, 34 * s)
        else:
            draw_heart(img, icon_size * 0.70, icon_size * 0.20, 38 * s)
        draw_badge(img, icon_size, kind, cy_ratio=0.72, height_ratio=0.14, text_ratio=0.11)
        mask = Image.new('L', (icon_size, icon_size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, icon_size - 1, icon_size - 1], fill=255)
        img.putalpha(mask)
    else:
        draw_char(img, icon_size, cy_ratio=0.42, scale=0.42)
        if kind == 'student':
            draw_star(img, 400 * s, 104 * s, 44 * s)
            draw_pencil(img, 352 * s, 330 * s, 132 * s, angle=-45)
        else:
            draw_heart(img, 396 * s, 100 * s, 50 * s)
            draw_star(img, 380 * s, 380 * s, 32 * s, STAR_GOLD_DEEP)
        draw_badge(img, icon_size, kind, cy_ratio=0.855, height_ratio=0.15, text_ratio=0.12)
        img.putalpha(rounded_mask(icon_size, 0.20))
    return img


def make_foreground(fg_size, kind):
    """自适应图标前景层：108dp 栅格，内容集中安全区（中心 61%）"""
    th = THEMES[kind]
    img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    s = fg_size / 512.0
    # 用缩放坐标系在安全区内绘制（安全区约 0.61，留边到 0.63）
    draw_char(img, fg_size, cy_ratio=0.40, scale=0.30)
    if kind == 'student':
        draw_star(img, fg_size * 0.645, fg_size * 0.30, 26 * s)
        draw_pencil(img, fg_size * 0.60, fg_size * 0.52, 88 * s, angle=-45)
    else:
        draw_heart(img, fg_size * 0.645, fg_size * 0.30, 30 * s)
        draw_star(img, fg_size * 0.60, fg_size * 0.53, 22 * s, STAR_GOLD_DEEP)
    draw_badge(img, fg_size, kind, cy_ratio=0.665, height_ratio=0.125, text_ratio=0.10)
    return img


def make_splash(w, h, kind):
    th = THEMES[kind]
    base = min(w, h)
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    top, bottom = th['top'], th['bottom']
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b, 255))
    # 中央白色圆角卡片 + 端别色"书"字
    card = int(base * 0.22)
    cx, cy = w // 2, int(h * 0.40)
    d.rounded_rectangle([cx - card, cy - card, cx + card, cy + card],
                        radius=int(card * 0.28), fill=(255, 255, 255, 255))
    font_path = find_font()
    if font_path:
        f = ImageFont.truetype(font_path, int(card * 1.05))
        bbox = d.textbbox((0, 0), '书', font=f)
        tw, thh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((cx - tw / 2 - bbox[0], cy - thh / 2 - bbox[1]), '书',
               font=f, fill=th['badge_color'] + (255,))
    draw_star(img, cx + card * 0.62, cy - card * 0.62, int(card * 0.22))
    # 标题 + 端别标签
    if font_path:
        tf = ImageFont.truetype(font_path, int(base * 0.055))
        title = th['title']
        bbox = d.textbbox((0, 0), title, font=tf)
        tw = bbox[2] - bbox[0]
        ty = cy + card * 1.6
        d.text((w / 2 - tw / 2 - bbox[0], ty), title, font=tf, fill=WHITE)
    return img.convert('RGB')


def gen_flavor_res():
    for kind, res_dir in (('student', STUDENT_RES), ('parent', PARENT_RES)):
        th = THEMES[kind]
        print(f'[flavor:{kind}] {os.path.relpath(res_dir, ROOT)}')
        # 1) mipmap 各密度
        for dpi, (icon_size, fg_size) in DENSITIES.items():
            mdir = os.path.join(res_dir, f'mipmap-{dpi}')
            os.makedirs(mdir, exist_ok=True)
            make_launcher_icon(icon_size, kind).save(
                os.path.join(mdir, 'ic_launcher.png'))
            make_launcher_icon(icon_size, kind, round_shape=True).save(
                os.path.join(mdir, 'ic_launcher_round.png'))
            make_foreground(fg_size, kind).save(
                os.path.join(mdir, 'ic_launcher_foreground.png'))
            print(f'  OK mipmap-{dpi}')
        # 2) anydpi-v26 自适应 XML
        adir = os.path.join(res_dir, 'mipmap-anydpi-v26')
        os.makedirs(adir, exist_ok=True)
        for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
            with open(os.path.join(adir, name), 'w', encoding='utf-8') as f:
                f.write(ADAPTIVE_XML)
        # 3) 渐变背景 drawable（同名覆盖 main 的绿色背景）
        os.makedirs(os.path.join(res_dir, 'drawable'), exist_ok=True)
        with open(os.path.join(res_dir, 'drawable', 'ic_launcher_bg.xml'),
                  'w', encoding='utf-8') as f:
            f.write(gradient_xml(th['top'], th['bottom']))
        # 4) 启动屏（同名覆盖 main 的 splash）
        for key, (w, h) in SPLASH_SIZES.items():
            orient, dpi = key.split('-')
            sdir = os.path.join(res_dir, f'drawable-{orient}-{dpi}')
            os.makedirs(sdir, exist_ok=True)
            make_splash(w, h, kind).save(os.path.join(sdir, 'splash.png'))
        make_splash(480, 320, kind).save(
            os.path.join(res_dir, 'drawable', 'splash.png'))
        print('  OK anydpi-v26 / drawable / splash x11')


# ---------- 3. 预览 ----------

def gen_preview():
    tiles = [
        ('学生端 APK', make_launcher_icon(256, 'student')),
        ('家长端 APK', make_launcher_icon(256, 'parent')),
        ('学生端圆形', make_launcher_icon(256, 'student', True)),
        ('家长端圆形', make_launcher_icon(256, 'parent', True)),
        ('学生端前景', make_foreground(256, 'student')),
        ('家长端前景', make_foreground(256, 'parent')),
        ('PWA 学生', create_pwa_icon(256, 'student')),
        ('PWA 家长', create_pwa_icon(256, 'parent')),
    ]
    pad = 20
    W = 256 * len(tiles) + pad * (len(tiles) + 1)
    H = 256 + pad * 2 + 34
    canvas = Image.new('RGB', (W, H), (245, 247, 250))
    d = ImageDraw.Draw(canvas)
    fp = find_font()
    font = ImageFont.truetype(fp, 18) if fp else None
    for i, (label, img) in enumerate(tiles):
        x = pad + i * (256 + pad)
        canvas.paste(img, (x, pad), img)
        if font:
            bbox = d.textbbox((0, 0), label, font=font)
            d.text((x + (256 - bbox[2]) / 2, pad + 256 + 6), label,
                   font=font, fill=(60, 70, 80))
    out = os.path.join(ROOT, 'icons-preview-dual.png')
    canvas.save(out, 'PNG')
    print(f'[预览] {out}')


def main():
    print('=== 双端差异化图标生成 ===')
    if not find_font():
        print('WARN: 未找到中文字体')
    gen_pwa()
    gen_flavor_res()
    gen_preview()
    print('=== 全部完成 ===')


if __name__ == '__main__':
    main()
