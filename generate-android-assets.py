#!/usr/bin/env python3
"""
生成 Android 原生图标和启动屏（共26个PNG文件）。
在 GitHub Actions 构建时自动运行，无需预置二进制文件。
"""
import os
from PIL import Image, ImageDraw, ImageFont

# 项目根目录（此脚本位于项目根目录）
ROOT = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# 主题色
BG_COLOR = (38, 166, 154)       # #26A69A 绿色
FG_COLOR = (255, 255, 255, 255) # 白色
SPLASH_COLOR = (74, 144, 217)   # #4a90d9 蓝色

# 图标尺寸：dpi -> (launcher_size, foreground_size)
DENSITIES = {
    'mdpi':    (48,  108),
    'hdpi':    (72,  162),
    'xhdpi':   (96,  216),
    'xxhdpi':  (144, 324),
    'xxxhdpi': (192, 432),
}

# 启动屏尺寸：orientation-dpi -> (width, height)
SPLASH_SIZES = {
    'port-mdpi':    (320, 480),
    'port-hdpi':    (480, 800),
    'port-xhdpi':   (720, 1280),
    'port-xxhdpi':  (1080, 1920),
    'port-xxxhdpi': (1440, 2560),
    'land-mdpi':    (480, 320),
    'land-hdpi':    (800, 480),
    'land-xhdpi':   (1280, 720),
    'land-xxhdpi':  (1920, 1080),
    'land-xxxhdpi': (2560, 1440),
}

def draw_launcher_icon(size):
    """绘制启动器图标：绿色背景 + 白色"书"字"""
    img = Image.new('RGBA', (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)
    # 尝试加载中文字体，失败则画圆
    font = None
    for fp in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
               '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
               '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
               'C:\\Windows\\Fonts\\simhei.ttf']:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, int(size * 0.6))
                break
            except Exception:
                pass
    if font:
        text = '书'
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (size - tw) // 2 - bbox[0]
        y = (size - th) // 2 - bbox[1]
        draw.text((x, y), text, fill=FG_COLOR, font=font)
    else:
        # 没有字体就画一个白色圆
        margin = size // 6
        draw.ellipse([margin, margin, size - margin, size - margin], fill=FG_COLOR)
    return img

def draw_round_icon(size):
    """圆形图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size - 1, size - 1], fill=BG_COLOR)
    margin = size // 6
    draw.ellipse([margin, margin, size - margin, size - margin], fill=FG_COLOR)
    return img

def draw_foreground(size):
    """前景图标：透明背景 + 白色"书"字"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = None
    for fp in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
               '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
               '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
               'C:\\Windows\\Fonts\\simhei.ttf']:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, int(size * 0.55))
                break
            except Exception:
                pass
    if font:
        text = '书'
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (size - tw) // 2 - bbox[0]
        y = (size - th) // 2 - bbox[1]
        draw.text((x, y), text, fill=FG_COLOR, font=font)
    else:
        margin = size // 4
        draw.ellipse([margin, margin, size - margin, size - margin], fill=FG_COLOR)
    return img

def draw_splash(w, h):
    """启动屏：纯色背景"""
    return Image.new('RGB', (w, h), SPLASH_COLOR)

def main():
    print('Generating Android icons and splash screens...')
    count = 0

    # 生成 mipmap 图标
    for dpi, (launcher_size, fg_size) in DENSITIES.items():
        mipmap_dir = os.path.join(RES, f'mipmap-{dpi}')
        os.makedirs(mipmap_dir, exist_ok=True)

        # ic_launcher.png
        img = draw_launcher_icon(launcher_size)
        img.save(os.path.join(mipmap_dir, 'ic_launcher.png'))
        count += 1

        # ic_launcher_round.png
        img = draw_round_icon(launcher_size)
        img.save(os.path.join(mipmap_dir, 'ic_launcher_round.png'))
        count += 1

        # ic_launcher_foreground.png
        img = draw_foreground(fg_size)
        img.save(os.path.join(mipmap_dir, 'ic_launcher_foreground.png'))
        count += 1

    # 生成 splash 启动屏
    for key, (w, h) in SPLASH_SIZES.items():
        parts = key.split('-')
        orient, dpi = parts[0], parts[1]
        dir_name = f'drawable-{orient}-{dpi}'
        splash_dir = os.path.join(RES, dir_name)
        os.makedirs(splash_dir, exist_ok=True)
        img = draw_splash(w, h)
        img.save(os.path.join(splash_dir, 'splash.png'))
        count += 1

    # 默认 drawable/splash.png
    img = draw_splash(480, 320)
    img.save(os.path.join(RES, 'drawable', 'splash.png'))
    count += 1

    print(f'Done! Generated {count} PNG files.')

if __name__ == '__main__':
    main()
