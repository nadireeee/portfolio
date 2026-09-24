# -*- coding: utf-8 -*-
import pymupdf as fitz
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

pdf = r"C:\Users\nadire\fullyedek123\21127210224_NadireYondem__bitirme\21127210224_NadireYondem__bitirme_tezi.pdf"
out = r"C:\Users\nadire\Desktop\nadire-portfolio\assets\bitirme\_tez_pages"
os.makedirs(out, exist_ok=True)

doc = fitz.open(pdf)
print("pages", doc.page_count)

interesting = set()
for i in range(doc.page_count):
    t = doc[i].get_text()
    low = t.lower()
    if any(
        k in low
        for k in [
            "şekil",
            "ekran",
            "ek a",
            "quiz",
            "chat",
            "codementor",
            "codelearn",
            "chead",
            "giriş",
            "login",
            "soru",
        ]
    ):
        interesting.add(i)
        safe = t.encode("utf-8", "replace").decode("utf-8")
        print(f"PAGE {i+1}:", " ".join(safe.split())[:350])

for i in range(max(0, doc.page_count - 22), doc.page_count):
    interesting.add(i)

for i in sorted(interesting):
    pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.6, 1.6))
    p = os.path.join(out, f"page-{i+1:03d}.png")
    pix.save(p)
    print("saved", p)

img_dir = os.path.join(out, "embedded")
os.makedirs(img_dir, exist_ok=True)
n = 0
for i in range(doc.page_count):
    for img in doc.get_page_images(i):
        xref = img[0]
        try:
            data = doc.extract_image(xref)
            if data["width"] < 180 or data["height"] < 180:
                continue
            ext = data["ext"]
            fn = os.path.join(img_dir, f"p{i+1:02d}_x{xref}.{ext}")
            with open(fn, "wb") as f:
                f.write(data["image"])
            n += 1
        except Exception:
            pass
print("embedded large", n)
