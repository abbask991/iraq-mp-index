"""Image metadata extraction (Pillow-only). EXIF / camera / dates / software / GPS.

IMPORTANT: absence of metadata does NOT prove manipulation — social platforms strip
EXIF on upload. Findings are SIGNALS only, never proof.
"""
from io import BytesIO


def extract(img_bytes: bytes) -> dict:
    out = {"signals": [], "exif": {}}
    try:
        from PIL import Image, ExifTags
        im = Image.open(BytesIO(img_bytes))
        out.update({"format": im.format, "mode": im.mode, "width": im.width,
                    "height": im.height, "size_bytes": len(img_bytes)})
        raw = None
        try:
            raw = im._getexif()  # type: ignore[attr-defined]
        except Exception:
            raw = None
        exif = {}
        if raw:
            for k, v in raw.items():
                name = ExifTags.TAGS.get(k, str(k))
                try:
                    exif[name] = str(v)[:140]
                except Exception:
                    pass
        out["exif"] = exif
        out["camera"] = exif.get("Model")
        out["software"] = exif.get("Software")
        out["created"] = exif.get("DateTimeOriginal") or exif.get("DateTime")
        out["modified"] = exif.get("DateTime")
        out["has_gps"] = "GPSInfo" in exif

        if not exif:
            out["signals"].append("لا توجد بيانات EXIF — شائع جداً في صور السوشال ولقطات الشاشة (لا يُثبت تلاعباً).")
        else:
            if out.get("camera"):
                out["signals"].append(f"كاميرا: {out['camera']} (يرجّح أصل تصوير).")
            sw = (out.get("software") or "").lower()
            if any(s in sw for s in ("photoshop", "gimp", "snapseed", "lightroom", "pixlr")):
                out["signals"].append(f"حُرّرت ببرنامج «{out['software']}» — تحرير لا يعني بالضرورة تضليلاً.")
            if out.get("has_gps"):
                out["signals"].append("تحتوي إحداثيات GPS — يمكن التحقق من الموقع المزعوم.")
    except Exception as e:
        out["error"] = str(e)[:100]
        out["signals"].append("تعذّر قراءة الصورة — تأكّد من الصيغة (jpg/png/webp).")
    return out
