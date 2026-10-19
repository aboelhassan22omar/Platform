"""
Builds every app icon and splash screen from the platform logo.

    python scripts/generate_assets.py

Source: frontend/public/brand/horus-eye-logo.png (the same mark as the site's
installable-app icons). Writes the Android launcher icons (legacy, round,
adaptive foreground and monochrome), the Android 12+ splash icon, the
notification icon, the old-style splash images, the iOS app icon and splash,
and the icon on the offline page. Run it again after changing the logo.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT.parent / "frontend" / "public" / "brand" / "horus-eye-logo.png"
NAVY = (10, 17, 32)
GOLD = (220, 166, 45)
IVORY = (245, 239, 227)
# "Powered by Aurexis" under the logo on every splash screen. Segoe UI ships
# with Windows; any other sans-serif works (pass the paths on other systems).
FONT_REGULAR = ["C:/Windows/Fonts/segoeui.ttf", "/System/Library/Fonts/SFNS.ttf", "DejaVuSans.ttf"]
FONT_BOLD = ["C:/Windows/Fonts/segoeuib.ttf", "/System/Library/Fonts/SFNS.ttf", "DejaVuSans-Bold.ttf"]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS = ROOT / "ios" / "App" / "App" / "Assets.xcassets"

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def load_logo() -> Image.Image:
    logo = Image.open(LOGO).convert("RGBA")
    return logo.crop(logo.getbbox())


def place(canvas: Image.Image, logo: Image.Image, width: float) -> Image.Image:
    """Pastes the logo centred, scaled to `width` pixels wide."""
    w = round(width)
    h = round(logo.height * w / logo.width)
    scaled = logo.resize((w, h), Image.LANCZOS)
    x = (canvas.width - w) // 2
    y = (canvas.height - h) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def font(candidates, size):
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def branding(height: int) -> Image.Image:
    """'Powered by' in soft ivory, 'Aurexis' in gold, as one transparent strip."""
    size = round(height * 0.62)
    regular, bold = font(FONT_REGULAR, size), font(FONT_BOLD, size)
    lead, name = "Powered by ", "Aurexis"
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    lead_w = probe.textlength(lead, font=regular)
    name_w = probe.textlength(name, font=bold)
    strip = clear((round(lead_w + name_w) + 4, height))
    draw = ImageDraw.Draw(strip)
    baseline = round(height * 0.78)
    draw.text((0, baseline), lead, font=regular, fill=IVORY + (165,), anchor="ls")
    draw.text((lead_w, baseline), name, font=bold, fill=GOLD + (255,), anchor="ls")
    return strip


def splash(size, logo: Image.Image, logo_share: float, brand_share: float) -> Image.Image:
    """Navy screen, logo in the middle, the credit near the bottom edge."""
    canvas = place(solid(size), logo, min(size) * logo_share)
    strip = branding(max(12, round(size[1] * brand_share)))
    x = (size[0] - strip.width) // 2
    y = size[1] - round(size[1] * 0.075) - strip.height
    canvas.alpha_composite(strip, (x, y))
    return canvas


def solid(size, color=NAVY) -> Image.Image:
    return Image.new("RGBA", size, color + (255,))


def clear(size) -> Image.Image:
    return Image.new("RGBA", size, (0, 0, 0, 0))


def silhouette(logo: Image.Image) -> Image.Image:
    """The logo as one flat white shape (notification and themed icons)."""
    white = Image.new("RGBA", logo.size, (255, 255, 255, 255))
    white.putalpha(logo.getchannel("A"))
    return white


def round_mask(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, image.width - 1, image.height - 1), fill=255)
    out = image.copy()
    out.putalpha(mask)
    return out


def save(image: Image.Image, path: Path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (image.convert("RGB") if rgb else image).save(path, optimize=True)


def main():
    logo = load_logo()
    flat = silhouette(logo)

    # A wide mark inside a circle: width w fits when w * sqrt(1 + (h/w)^2) <= d.
    fit = (1 + (logo.height / logo.width) ** 2) ** 0.5

    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        size = round(48 * scale)
        icon = place(solid((size, size)), logo, size * 0.74)
        save(icon, folder / "ic_launcher.png")
        save(round_mask(place(solid((size, size)), logo, size * 0.66)), folder / "ic_launcher_round.png")

        # Adaptive icons: 108dp layer, only the centre 66dp circle is always visible.
        layer = round(108 * scale)
        safe = layer * 66 / 108
        save(place(clear((layer, layer)), logo, safe / fit * 0.92), folder / "ic_launcher_foreground.png")
        save(place(clear((layer, layer)), flat, safe / fit * 0.92), folder / "ic_launcher_monochrome.png")

        # Status-bar icon: white on transparent, 24dp with a little padding.
        stat = round(24 * scale)
        save(place(clear((stat, stat)), flat, stat * 0.92), RES / f"drawable-{name}" / "ic_stat_notify.png")

    # Android 12+ splash: icon drawn inside a 2/3-diameter circle of a 288dp square.
    splash_icon = 288 * 4
    save(
        place(clear((splash_icon, splash_icon)), logo, splash_icon * 2 / 3 / fit * 0.9),
        RES / "drawable-nodpi" / "splash_icon.png",
    )

    # Android 12+ draws its own splash: the icon above, and this credit at the bottom
    # (windowSplashScreenBrandingImage, a 200x80dp slot).
    for name, scale in DENSITIES.items():
        w, h = round(200 * scale), round(80 * scale)
        slot = clear((w, h))
        strip = branding(round(h * 0.42))
        slot.alpha_composite(strip, ((w - strip.width) // 2, (h - strip.height) // 2))
        save(slot, RES / f"drawable-{name}" / "splash_branding.png")

    # Pre-Android-12 splash images, at the sizes the Capacitor template ships.
    for path in RES.glob("drawable*/splash.png"):
        with Image.open(path) as old:
            size = old.size
        portrait = size[1] >= size[0]
        save(splash(size, logo, 0.42 if portrait else 0.32, 0.028 if portrait else 0.045), path, rgb=True)

    # iOS: one 1024 icon with no transparency (App Store rejects alpha), and the splash.
    save(place(solid((1024, 1024)), logo, 1024 * 0.74), IOS / "AppIcon.appiconset" / "AppIcon-512@2x.png", rgb=True)
    # Shown aspect-fill: a phone sees the full height but only the middle ~45% of
    # the width, so the logo and the credit both sit well inside that column.
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        save(splash((2732, 2732), logo, 0.2, 0.024), IOS / "Splash.imageset" / name, rgb=True)

    # The offline page shows the app icon.
    save(place(solid((192, 192)), logo, 192 * 0.74), ROOT / "www" / "icon.png")

    # Google Play listing icon: 512x512, 32-bit PNG.
    save(place(solid((512, 512)), logo, 512 * 0.74), ROOT / "store" / "google-play" / "icon-512.png")
    print("Icons and splash screens written.")


if __name__ == "__main__":
    main()
