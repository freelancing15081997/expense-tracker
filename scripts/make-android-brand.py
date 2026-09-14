from PIL import Image
import os

src_path = r"c:\Users\pujar\Desktop\Expense Tracker\expense-tracker\public\logo.png"
root = r"c:\Users\pujar\Desktop\Expense Tracker\expense-tracker\android\app\src\main\res"
src = Image.open(src_path).convert("RGBA")
w, h = src.size
mark = src.crop((0, 0, w, int(h * 0.58)))
bbox = mark.getbbox()
if bbox:
    mark = mark.crop(bbox)

NAVY = (11, 31, 58, 255)


def fit_on(canvas_size, img, pad=0.16, bg=NAVY):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg)
    max_inner = int(canvas_size * (1 - 2 * pad))
    ratio = min(max_inner / img.width, max_inner / img.height)
    nw, nh = max(1, int(img.width * ratio)), max(1, int(img.height * ratio))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((canvas_size - nw) // 2, (canvas_size - nh) // 2), resized)
    return canvas


def full_splash(sw, sh):
    canvas = Image.new("RGBA", (sw, sh), NAVY)
    inner = int(min(sw, sh) * 0.46)
    icon = fit_on(inner, mark, pad=0.08, bg=(255, 255, 255, 255))
    canvas.paste(icon, ((sw - inner) // 2, (sh - inner) // 2), icon)
    return canvas.convert("RGB")


fit_on(512, mark, 0.1, (255, 255, 255, 255)).save(os.path.join(root, "drawable", "splash_brand.png"))
full_splash(1080, 1920).save(os.path.join(root, "drawable", "splash.png"))

sizes = {
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (1080, 1920),
    "drawable-port-xxxhdpi": (1440, 2560),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1920, 1080),
    "drawable-land-xxxhdpi": (2560, 1440),
}
for folder, size in sizes.items():
    d = os.path.join(root, folder)
    os.makedirs(d, exist_ok=True)
    full_splash(*size).save(os.path.join(d, "splash.png"))

mip = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
for folder, size in mip.items():
    d = os.path.join(root, folder)
    os.makedirs(d, exist_ok=True)
    icon = fit_on(size, mark, 0.18, NAVY).convert("RGB")
    icon.save(os.path.join(d, "ic_launcher.png"))
    icon.save(os.path.join(d, "ic_launcher_round.png"))
    fg = fit_on(size * 2, mark, 0.22, NAVY)
    fg.save(os.path.join(d, "ic_launcher_foreground.png"))

print("icons written")
