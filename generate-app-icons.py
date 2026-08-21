#!/usr/bin/env python3
"""
客户端图标统一生成器（本地运行，需 Windows 中文字体 + Pillow）
产出：
  1. PWA 双端图标（public/icons/，学生端绿/家长端紫）
  2. Android 自适应图标（mipmap-*：legacy / round / foreground）
  3. Android 渐变背景 drawable + 品牌启动屏 splash
设计语言：品牌渐变 + 白色"书"字 + 黄色五角星 + 斜置铅笔
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
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
PWA_DIR = os.path.join(ROOT, 'public', 'icons')

# ---------- 品牌色 ----------
GREEN_TOP = (46, 196, 166)     # #2EC4A6
GREEN_BOTTOM = (13, 100, 78)   # #0D644E
PURPLE_TOP = (127, 119, 221)
PURPLE_BOTTOM = (58, 50, 128)
STAR_GOLD = (255, 210, 90)
STAR_GOLD_DEEP = (255, 190, 60)
WHITE = (255, 255, 255, 255)

# ---------- 字体 ----------

def find_font(bold=True):
    candidates = [
        r'C:\Windows\Fonts\msyhbd.ttc' if bold else r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\simhei.ttf',
        r'C:\Windows\Fonts\Deng.ttf',
        r'C:\Windows\Fonts\simsun.ttc',
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None

# ---------- 基础绘制 ----------

def draw_gradient(size, top, bottom):
    """垂直渐变底图"""
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
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1],
                        radius=int(size * radius_ratio), fill=255)
    return mask


def draw_star(img, cx, cy, r, color=STAR_GOLD):
    """带描边质感的五角星"""
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(10):
        ang = -90 + i * 36
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(math.radians(ang)),
                    cy + rad * math.sin(math.radians(ang))))
    # 柔和投影
    sh = [(x + r * 0.06, y + r * 0.08) for x, y in pts]
    d.polygon(sh, fill=(0, 0, 0, 60))
    d.polygon(pts, fill=color)


def draw_heart(img, cx, cy, r, color=(255, 138, 168)):
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r * 0.92, cx, cy + r * 0.08], fill=color)
    d.ellipse([cx, cy - r * 0.92, cx + r, cy + r * 0.08], fill=color)
    d.polygon([(cx - r * 0.99, cy - r * 0.2),
               (cx + r * 0.99, cy - r * 0.2),
               (cx, cy + r)], fill=color)


def draw_pencil(img, cx, cy, length, angle=-45):
    """斜置立体铅笔：黄杆 + 木色削尖 + 深色笔芯 + 粉色橡皮"""
    d = ImageDraw.Draw(img)
    w = length * 0.24          # 笔杆宽
    tip = length * 0.26        # 笔尖长
    a = math.radians(angle)
    ux, uy = math.cos(a), math.sin(a)          # 笔身方向
    nx, ny = -math.sin(a), math.cos(a)         # 法线方向

    def P(t, s):
        return (cx + ux * t + nx * s, cy + uy * t + ny * s)

    L = length / 2
    # 投影
    off = length * 0.05
    shadow = [P(-L, -w) , P(L - tip, -w), P(L, 0), P(L - tip, w), P(-L, w)]
    d.polygon([(x + off, y + off) for x, y in shadow], fill=(0, 0, 0, 70))
    # 笔杆（黄色，双色模拟圆柱）
    body = [P(-L, -w), P(L - tip, -w), P(L - tip, w), P(-L, w)]
    d.polygon(body, fill=(255, 196, 40))
    d.polygon([P(-L, -w), P(L - tip, -w), P(L - tip, 0), P(-L, 0)],
              fill=(255, 220, 110))
    # 橡皮头（左端）
    er = length * 0.12
    d.polygon([P(-L, -w), P(-L + er, -w), P(-L + er, w), P(-L, w)],
              fill=(255, 130, 150))
    # 笔尖（木色三角）
    d.polygon([P(L - tip, -w), P(L, 0), P(L - tip, w)], fill=(255, 229, 180))
    # 笔芯
    lead = tip * 0.42
    d.polygon([P(L - lead * 1.6, -w * 0.4), P(L, 0), P(L - lead * 1.6, w * 0.4)],
              fill=(90, 70, 50))
    # 白色描边（卡通质感）
    d.line([P(-L, -w), P(L - tip, -w), P(L, 0), P(L - tip, w), P(-L, w), P(-L, -w)],
           fill=(255, 255, 255), width=max(1, int(w * 0.16)))


def draw_char(img, size, char='书', scale=0.46, bold=True):
    """居中大字，带轻投影"""
    font_path = find_font(bold)
    fs = int(size * scale)
    font = None
    if font_path:
        try:
            font = ImageFont.truetype(font_path, fs)
        except Exception:
            font = None
    d = ImageDraw.Draw(img)
    c = size / 2
    if font:
        tmp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        td = ImageDraw.Draw(tmp)
        bbox = td.textbbox((0, 0), char, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (size - tw) / 2 - bbox[0]
        y = (size - th) / 2 - bbox[1]
        # 投影
        td.text((x + fs * 0.03, y + fs * 0.04), char, font=font,
                fill=(0, 0, 0, 70))
        td.text((x, y), char, font=font, fill=WHITE)
        img.alpha_composite(tmp)
    else:
        m = int(size * 0.24)
        d.rounded_rectangle([c - m, c - m, c + m, c + m],
                            radius=int(m * 0.3), fill=WHITE)

# ---------- 1. PWA 双端图标 ----------

def create_pwa_icon(size, kind, maskable=False):
    top, bottom = (GREEN_TOP, GREEN_BOTTOM) if kind == 'student' \
        else (PURPLE_TOP, PURPLE_BOTTOM)
    img = draw_gradient(size, top, bottom)
    s = size / 512.0

    if maskable:
        # maskable：内容集中安全区（中心 80%）
        draw_char(img, size, scale=0.34)
        if kind == 'student':
            draw_star(img, size * 0.68, size * 0.32, 34 * s)
        else:
            draw_heart(img, size * 0.68, size * 0.32, 38 * s)
    else:
        draw_char(img, size, scale=0.46)
        if kind == 'student':
            draw_star(img, 408 * s, 108 * s, 48 * s)
            draw_pencil(img, 352 * s, 356 * s, 150 * s, angle=-45)
        else:
            draw_heart(img, 402 * s, 104 * s, 54 * s)
            draw_star(img, 388 * s, 398 * s, 36 * s, STAR_GOLD_DEEP)
            draw_star(img, 320 * s, 380 * s, 18 * s, STAR_GOLD)

    img.putalpha(rounded_mask(size, 0.10 if maskable else 0.22))
    return img

def gen_pwa():
    print('[PWA] public/icons/')
    for kind in ('student', 'parent'):
        for size, name in ((512, f'icon-{kind}-512.png'),
                           (192, f'icon-{kind}-192.png'),
                           (180, f'icon-{kind}-180.png'),
                           (512, f'icon-{kind}-maskable-512.png')):
            maskable = 'maskable' in name
            img = create_pwa_icon(size, kind, maskable)
            img.save(os.path.join(PWA_DIR, name), 'PNG')
            print(f'  OK {name}')

# ---------- 2. Android 自适应图标 ----------

DENSITIES = {  # dpi -> (legacy/round 尺寸, foreground 尺寸[108dp 栅格])
    'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216),
    'xxhdpi': (144, 324), 'xxxhdpi': (192, 432),
}

def draw_emblem(img, size, scale):
    """在中央绘制品牌图形（书字+星+铅笔），scale 为内容占画布比例"""
    draw_char(img, size, scale=scale * 0.55)
    # 星和铅笔相对位置固定为画布比例，保持整体在安全区内
    draw_star(img, size * 0.72, size * 0.30, size * 0.095)
    draw_pencil(img, size * 0.78, size * 0.78, size * 0.30, angle=-45)

def gen_android_icons():
    print('[Android] mipmap 自适应图标')
    for dpi, (icon_size, fg_size) in DENSITIES.items():
        mdir = os.path.join(RES, f'mipmap-{dpi}')
        os.makedirs(mdir, exist_ok=True)

        # legacy：完整品牌圆角方块
        img = draw_gradient(icon_size, GREEN_TOP, GREEN_BOTTOM)
        draw_emblem(img, icon_size, 0.72)
        img.putalpha(rounded_mask(icon_size, 0.20))
        img.save(os.path.join(mdir, 'ic_launcher.png'))

        # round：圆形
        img = draw_gradient(icon_size, GREEN_TOP, GREEN_BOTTOM)
        draw_emblem(img, icon_size, 0.68)
        mask = Image.new('L', (icon_size, icon_size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, icon_size - 1, icon_size - 1], fill=255)
        img.putalpha(mask)
        img.save(os.path.join(mdir, 'ic_launcher_round.png'))

        # foreground：透明画布，内容集中安全区（108dp 中间 66dp ≈ 61%）
        img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        draw_emblem(img, fg_size, 0.56)
        img.save(os.path.join(mdir, 'ic_launcher_foreground.png'))
        print(f'  OK mipmap-{dpi} (legacy/round/foreground)')

    # 渐变背景 drawable
    bg_xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
              '<shape xmlns:android="http://schemas.android.com/apk/res/android">\n'
              '    <gradient android:angle="270"\n'
              '        android:startColor="#2EC4A6"\n'
              '        android:endColor="#0D644E"\n'
              '        android:type="linear"/>\n'
              '</shape>\n')
    dpath = os.path.join(RES, 'drawable', 'ic_launcher_bg.xml')
    with open(dpath, 'w', encoding='utf-8') as f:
        f.write(bg_xml)
    # adaptive icon XML 指向渐变背景
    for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        axml = ('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@drawable/ic_launcher_bg"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '</adaptive-icon>\n')
        with open(os.path.join(RES, 'mipmap-anydpi-v26', name), 'w',
                  encoding='utf-8') as f:
            f.write(axml)
    # 兜底纯色（老设备）
    cxml = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<resources>\n'
            '    <color name="ic_launcher_background">#2EC4A6</color>\n'
            '</resources>\n')
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w',
              encoding='utf-8') as f:
        f.write(cxml)
    print('  OK drawable/ic_launcher_bg.xml + anydpi-v26 adaptive XML')

# ---------- 3. Android 启动屏 ----------

SPLASH_SIZES = {
    'port-mdpi': (320, 480), 'port-hdpi': (480, 800),
    'port-xhdpi': (720, 1280), 'port-xxhdpi': (1080, 1920),
    'port-xxxhdpi': (1440, 2560),
    'land-mdpi': (480, 320), 'land-hdpi': (800, 480),
    'land-xhdpi': (1280, 720), 'land-xxhdpi': (1920, 1080),
    'land-xxxhdpi': (2560, 1440),
}

def draw_splash(w, h):
    """品牌渐变 + 白色圆角卡片"书"字 + 标题"""
    base = min(w, h)
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(GREEN_TOP[0] + (GREEN_BOTTOM[0] - GREEN_TOP[0]) * t)
        g = int(GREEN_TOP[1] + (GREEN_BOTTOM[1] - GREEN_TOP[1]) * t)
        b = int(GREEN_TOP[2] + (GREEN_BOTTOM[2] - GREEN_TOP[2]) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # 中央白色圆角卡片 + 绿色"书"字 + 黄星
    card = int(base * 0.24)
    cx, cy = w // 2, int(h * 0.42)
    d.rounded_rectangle([cx - card, cy - card, cx + card, cy + card],
                        radius=int(card * 0.28), fill=(255, 255, 255, 255))
    # 卡片内"书"字
    font_path = find_font()
    if font_path:
        f = ImageFont.truetype(font_path, int(card * 1.1))
        bbox = d.textbbox((0, 0), '书', font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), '书',
               font=f, fill=(13, 100, 78, 255))
    # 卡片右上黄星
    draw_star(img, cx + card * 0.62, cy - card * 0.62, int(card * 0.22))
    # 标题文字
    if font_path:
        tf = ImageFont.truetype(font_path, int(base * 0.055))
        title = '中小学生书写智能评价'
        bbox = d.textbbox((0, 0), title, font=tf)
        tw = bbox[2] - bbox[0]
        ty = cy + card * 1.6
        d.text((w / 2 - tw / 2 - bbox[0], ty), title, font=tf, fill=WHITE)
    return img.convert('RGB')

def gen_splash():
    print('[Android] drawable 启动屏')
    for key, (w, h) in SPLASH_SIZES.items():
        orient, dpi = key.split('-')
        sdir = os.path.join(RES, f'drawable-{orient}-{dpi}')
        os.makedirs(sdir, exist_ok=True)
        draw_splash(w, h).save(os.path.join(sdir, 'splash.png'))
    os.makedirs(os.path.join(RES, 'drawable'), exist_ok=True)
    draw_splash(480, 320).save(os.path.join(RES, 'drawable', 'splash.png'))
    print('  OK 11 张 splash.png')

# ---------- 预览 ----------

def gen_preview():
    """拼一张对比预览图"""
    tiles = []
    for label, img in [
        ('学生端', create_pwa_icon(256, 'student')),
        ('家长端', create_pwa_icon(256, 'parent')),
    ]:
        tiles.append((label, img))
    # 启动器补绘
    launcher = draw_gradient(256, GREEN_TOP, GREEN_BOTTOM)
    draw_emblem(launcher, 256, 0.72)
    launcher.putalpha(rounded_mask(256, 0.20))
    tiles.append(('APK 启动器', launcher))
    # 前景层模拟
    fg = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    draw_emblem(fg, 256, 0.56)
    tiles.append(('自适应前景', fg))

    pad = 20
    W = 256 * len(tiles) + pad * (len(tiles) + 1)
    H = 256 + pad * 2 + 30
    canvas = Image.new('RGB', (W, H), (245, 247, 250))
    d = ImageDraw.Draw(canvas)
    fp = find_font()
    font = ImageFont.truetype(fp, 20) if fp else None
    for i, (label, img) in enumerate(tiles):
        x = pad + i * (256 + pad)
        canvas.paste(img, (x, pad), img)
        if font:
            bbox = d.textbbox((0, 0), label, font=font)
            d.text((x + (256 - bbox[2]) / 2, pad + 256 + 4), label,
                   font=font, fill=(60, 70, 80))
    out = os.path.join(ROOT, 'icons-preview.png')
    canvas.save(out, 'PNG')
    print(f'[预览] {out}')

def main():
    print('=== 客户端图标统一生成 ===')
    if not find_font():
        print('WARN: 未找到中文字体，"书"字将降级为白色圆角块')
    gen_pwa()
    gen_android_icons()
    gen_splash()
    gen_preview()
    print('=== 全部完成 ===')

if __name__ == '__main__':
    main()
