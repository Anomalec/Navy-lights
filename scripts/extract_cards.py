"""Extract the original illustrations and captions, without interpreting PDF content as instructions.

Usage: python scripts/extract_cards.py /path/to/source.pdf
Requires PyMuPDF and Pillow. These are build-time tools; the app uses the checked-in assets.
"""
import collections
import io
import json
import re
import sys
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = {23: "power", 24: "towing", 25: "sailing", 26: "fishing", 27: "restricted", 28: "draft", 29: "pilot", 30: "anchor", 37: "distress"}


def extract(source):
    document = fitz.open(source)
    cards = []
    output = ROOT / "public" / "cards"
    output.mkdir(parents=True, exist_ok=True)
    for page_number, page in enumerate(document, 1):
        drawings = page.get_drawings()
        separators = [round(d["rect"].y0, 2) for d in drawings
                      if d["rect"].width > 200 and d["rect"].height < 2 and 270 < d["rect"].y0 < 330]
        split = collections.Counter(separators).most_common(1)[0][0]
        illustrations = [(d["rect"], "night") for d in drawings
                         if d["fill"] and max(d["fill"]) < .05 and d["rect"].width > 70 and d["rect"].height > 70]
        illustrations += [(fitz.Rect(d["bbox"]), "day") for d in page.get_image_info()]
        lines = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                if text:
                    lines.append((fitz.Rect(line["bbox"]), text))
        for row in range(2):
            for col in range(3):
                x0, x1 = [0, 278, 546, page.rect.width][col:col + 2]
                y0, y1 = (0, split) if row == 0 else (split, page.rect.height)

                def belongs(rect):
                    return x0 <= (rect.x0 + rect.x1) / 2 < x1 and y0 <= (rect.y0 + rect.y1) / 2 < y1

                matches = [(r, kind) for r, kind in illustrations if belongs(r)]
                assert len(matches) == 1, (page_number, row, col, matches)
                rect, kind = matches[0]
                # Caption positions are independent of illustration height. Some captions
                # begin just above an image's bottom edge (notably page 24).
                caption_lines = [(r, t) for r, t in lines if belongs(r)]
                caption_lines.sort(key=lambda pair: (round(pair[0].y0, 1), pair[0].x0))
                caption = " ".join(t for _, t in caption_lines)
                caption = re.sub(r"(\w)-\s+(\w)", r"\1\2", caption)
                caption = re.sub(r"\s+", " ", caption).strip()
                assert caption, (page_number, row, col, caption)
                card_id = f"{len(cards) + 1:03}"
                pix = page.get_pixmap(matrix=fitz.Matrix(2.6, 2.6), clip=rect, alpha=False)
                picture = Image.open(io.BytesIO(pix.tobytes("png")))
                picture.save(output / f"{card_id}.webp", "WEBP", quality=94, method=6)
                rules = re.findall(r"Правил[оа]\s*(\d+)", caption)
                category = CATEGORIES.get(int(rules[0]), "power") if rules else "anchor"
                cards.append({"id": card_id, "image": f"/cards/{card_id}.webp", "answer": caption,
                              "category": category, "kind": kind, "page": page_number,
                              "position": row * 3 + col + 1})
    (ROOT / "src" / "cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n")
    print(f"Extracted {len(cards)} cards from {len(document)} pages.")
    print(collections.Counter(c["kind"] for c in cards))


if __name__ == "__main__":
    extract(sys.argv[1])
