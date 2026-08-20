#!/usr/bin/env python3
"""
双端应用图标生成器 - 学生端 / 家长端
学生端：绿色渐变 + 白色"书"字 + 黄色星（成长）
家长端：紫色渐变 + 白色"书"字 + 粉色心（守护）
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, 'public', 'icons')

def find_font():
    candidates = [
        r'C:\Windows\Fonts\msyhbd.ttc',
        r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\simhei.ttf',
        r'C:\Windows\Fonts\simsun.ttc',
        r'C:\Windows\Fonts\Deng.ttf',
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def draw_gradient(size, top, bottom):
    img = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        ratio = y / size
        r = int(top[0] + (bottom[0] - top[0]) * ratio)
        g = int(top[1] + (bottom[1] - top[1]) * ratio)
        b = int(top[2] + (bottom[2] - top[2]) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img

def rounded_mask(size, radius_ratio=0.22):
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask

def draw_star(img, size, cx_s, cy_s, r_s, color):
    """按512基准比例画五角星"""
    draw = ImageDraw.Draw(img)
    s = size / 512.0
    cx, cy, r = int(cx_s * s), int(cy_s * s), int(r_s * s)
    points = []
    for i in range(10):
        ang = -90 + i * 36
        rad = r if i % 2 == 0 else r * 0.45
        points.append((cx + rad * math.cos(math.radians(ang)),
                       cy + rad * math.sin(math.radians(ang))))
    draw.polygon(points, fill=color)

def draw_heart(img, size, cx_s, cy_s, r_s, color):
    """按512基准比例画心形"""
    draw = ImageDraw.Draw(img)
    s = size / 512.0
    cx, cy, r = cx_s * s, cy_s * s, r_s * s
    # 两圆 + 三角近似心形
    draw.ellipse([cx - r, cy - r * 0.9, cx, cy + r * 0.1], fill=color)
    draw.ellipse([cx, cy - r * 0.9, cx + r, cy + r * 0.1], fill=color)
    draw.polygon([(cx - r * 0.98, cy - r * 0.18), (cx + r * 0.98, cy - r * 0.18), (cx, cy + r)], fill=color)

def draw_pencil(img, size):
    """右下角橙色钢笔装饰"""
    draw = ImageDraw.Draw(img)
    s = size / 512.0
    x1, y1 = int(300 * s), int(330 * s)
    x2, y2 = int(380 * s), int(410 * s)
    draw.line([(x1, y1), (x2, y2)], fill=(255, 165, 0, 255), width=int(28 * s))
    draw.polygon([
        (x2, y2),
        (int(x2 + 20 * s), int(y2 - 10 * s)),
        (int(x2 + 8 * s), int(y2 - 26 * s))
    ], fill=(255, 180, 60, 255))

def draw_char(img, size, char, maskable=False):
    s = size / 512.0
    text_scale = 0.80 if maskable else 1.0
    char_size = int(size * 0.42 * text_scale)
    font = None
    font_path = find_font()
    if font_path:
        try:
            font = ImageFont.truetype(font_path, char_size)
        except Exception:
            font = None
    draw = ImageDraw.Draw(img)
    if font:
        tmp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        tdraw = ImageDraw.Draw(tmp)
        bbox = tdraw.textbbox((0, 0), char, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (size - tw) / 2 - bbox[0]
        ty = (size - th) / 2 - bbox[1]
        tdraw.text((tx, ty), char, font=font, fill=(255, 255, 255, 255))
        img.alpha_composite(tmp)
    else:
        draw.rectangle([int(180 * s), int(150 * s), int(332 * s), int(362 * s)],
                       fill=(255, 255, 255, 255))

def create_icon(size, kind, maskable=False):
    if kind == 'student':
        img = draw_gradient(size, (46, 196, 137), (15, 110, 86))   # 绿色系
    else:
        img = draw_gradient(size, (127, 119, 221), (60, 52, 137))  # 紫色系

    draw_char(img, size, '书', maskable)

    if kind == 'student':
        # 学生端：右上黄色五角星 + 右下钢笔
        draw_star(img, size, 410, 110, 46, (255, 214, 102, 255))
        draw_pencil(img, size)
    else:
        # 家长端：右上粉色爱心 + 右下金色小星
        draw_heart(img, size, 405, 105, 52, (255, 130, 160, 255))
        draw_star(img, size, 390, 400, 34, (255, 214, 102, 255))

    mask = rounded_mask(size, 0.10 if maskable else 0.22)
    img.putalpha(mask)
    return img

def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'PNG')
    print(f'  OK {os.path.basename(path)} ({img.size[0]}x{img.size[1]})')

def main():
    print('=== 生成双端应用图标 ===')
    if not find_font():
        print('  WARN: 未找到系统中文字体，使用降级绘制')

    for kind in ['student', 'parent']:
        print(f'[{kind}]')
        save_png(create_icon(512, kind), os.path.join(OUTPUT_DIR, f'icon-{kind}-512.png'))
        save_png(create_icon(192, kind), os.path.join(OUTPUT_DIR, f'icon-{kind}-192.png'))
        save_png(create_icon(512, kind, maskable=True), os.path.join(OUTPUT_DIR, f'icon-{kind}-maskable-512.png'))
        # apple-touch-icon (180)
        save_png(create_icon(180, kind), os.path.join(OUTPUT_DIR, f'icon-{kind}-180.png'))

    print('=== 双端图标生成完成 ===')

if __name__ == '__main__':
    main()
