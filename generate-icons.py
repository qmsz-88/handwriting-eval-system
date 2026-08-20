#!/usr/bin/env python3
"""
应用图标生成器 - 为 PWA / Android / iOS 生成全套图标
设计：蓝紫渐变圆角方块 + 白色"书"字 + 橙色星点
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'icons')

def find_font():
    """查找系统中文字体"""
    candidates = [
        r'C:\Windows\Fonts\msyhbd.ttc',  # 微软雅黑 Bold
        r'C:\Windows\Fonts\msyh.ttc',    # 微软雅黑
        r'C:\Windows\Fonts\simhei.ttf',  # 黑体
        r'C:\Windows\Fonts\simsun.ttc',  # 宋体
        r'C:\Windows\Fonts\Deng.ttf',    # 等线
        '/System/Library/Fonts/PingFang.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def draw_gradient(size):
    """绘制蓝紫渐变背景"""
    img = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(img)
    # 顶部 #667EEA → 底部 #764BA2
    top = (102, 126, 234)
    bottom = (118, 75, 162)
    for y in range(size):
        ratio = y / size
        r = int(top[0] + (bottom[0] - top[0]) * ratio)
        g = int(top[1] + (bottom[1] - top[1]) * ratio)
        b = int(top[2] + (bottom[2] - top[2]) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img

def rounded_mask(size, radius_ratio=0.22):
    """圆角矩形透明蒙版"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask

def draw_pen_accent(img, size):
    """右下角绘制橙色钢笔头装饰"""
    draw = ImageDraw.Draw(img)
    s = size / 512.0
    # 钢笔：底部右下的斜线
    x1, y1 = int(300 * s), int(330 * s)
    x2, y2 = int(380 * s), int(410 * s)
    draw.line([(x1, y1), (x2, y2)], fill=(255, 165, 0, 255), width=int(28 * s))
    # 笔尖
    draw.polygon([
        (x2, y2),
        (int(x2 + 20 * s), int(y2 - 10 * s)),
        (int(x2 + 8 * s), int(y2 - 26 * s))
    ], fill=(255, 180, 60, 255))

def draw_star_accent(img, size):
    """右上角绘制白色小星"""
    draw = ImageDraw.Draw(img)
    s = size / 512.0
    cx, cy, r = int(410 * s), int(110 * s), int(46 * s)
    points = []
    for i in range(10):
        ang = -90 + i * 36
        import math
        rad = r if i % 2 == 0 else r * 0.45
        points.append((cx + rad * math.cos(math.radians(ang)),
                       cy + rad * math.sin(math.radians(ang))))
    draw.polygon(points, fill=(255, 214, 102, 255))

def create_icon(size, font_size_ratio=0.42, maskable=False):
    """生成单个尺寸图标"""
    s = size / 512.0
    img = draw_gradient(size)

    # 文字区域（maskable 时缩小留出安全区）
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

    # 绘制"书"字
    if font:
        # 先渲染文字到独立图层测量
        tmp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        tdraw = ImageDraw.Draw(tmp)
        bbox = tdraw.textbbox((0, 0), '书', font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (size - tw) / 2 - bbox[0]
        ty = (size - th) / 2 - bbox[1]
        tdraw.text((tx, ty), '书', font=font, fill=(255, 255, 255, 255))
        # 白色描边效果：多次偏移合成
        outline_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(outline_img)
        odraw.text((tx, ty), '书', font=font, fill=(255, 255, 255, 255))
        img.alpha_composite(outline_img)
    else:
        # 无字体时的降级：画方块模拟
        draw.rectangle([int(180 * s), int(150 * s), int(332 * s), int(362 * s)],
                       fill=(255, 255, 255, 255))

    # 装饰元素
    draw_star_accent(img, size)
    draw_pen_accent(img, size)

    # 圆角遮罩
    mask = rounded_mask(size, 0.22 if not maskable else 0.10)
    img.putalpha(mask)

    return img

def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'PNG')
    print(f'  ✓ {path} ({img.size[0]}x{img.size[1]})')

def main():
    print('=== 生成应用图标 ===')
    if not find_font():
        print('  ⚠ 未找到系统中文字体，使用降级绘制')

    # 1. PWA 图标
    print('[PWA]')
    save_png(create_icon(512), os.path.join(OUTPUT_DIR, 'icon-512.png'))
    save_png(create_icon(192), os.path.join(OUTPUT_DIR, 'icon-192.png'))
    # maskable 版本（更大安全区）
    save_png(create_icon(512, maskable=True), os.path.join(OUTPUT_DIR, 'icon-maskable-512.png'))

    # 2. Android mipmap 全套
    print('[Android mipmap]')
    android_sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    android_dir = os.path.join(os.path.dirname(OUTPUT_DIR), 'android-res', 'mipmap')
    for density, size in android_sizes.items():
        save_png(create_icon(size, font_size_ratio=0.38),
                 os.path.join(android_dir, density, 'ic_launcher.png'))
        save_png(create_icon(size, font_size_ratio=0.38),
                 os.path.join(android_dir, density, 'ic_launcher_round.png'))

    # 3. iOS 图标（AppIcon 尺寸）
    print('[iOS]')
    ios_sizes = {'40': 40, '60': 60, '58': 58, '87': 87, '80': 80, '120': 120,
                 '180': 180, '20': 20, '29': 29, '76': 76, '152': 152, '167': 167,
                 '1024': 1024}
    ios_dir = os.path.join(os.path.dirname(OUTPUT_DIR), 'ios-res', 'AppIcon')
    for name, size in ios_sizes.items():
        save_png(create_icon(size, font_size_ratio=0.38),
                 os.path.join(ios_dir, f'icon-{name}.png'))

    # 4. 启动屏（Android splash）
    print('[Splash]')
    splash = draw_gradient(1024)
    mask = rounded_mask(1024, 0.05)
    splash.putalpha(mask)
    splash_dir = os.path.join(os.path.dirname(OUTPUT_DIR), 'android-res', 'splash')
    save_png(splash, os.path.join(splash_dir, 'splash.png'))

    print('=== 图标生成完成 ===')

if __name__ == '__main__':
    main()
