#!/usr/bin/env python3
"""Extract thesis PDF pages (focus appendix EK A) to PNG images."""
from __future__ import annotations

import os
import sys
from pathlib import Path

PDF = Path(r"C:\Users\nadire\fullyedek123\21127210224_NadireYondem__bitirme\21127210224_NadireYondem__bitirme_tezi.pdf")
OUT = Path(r"C:\Users\nadire\Desktop\nadire-portfolio\assets\bitirme\_tez_pages")

def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if not PDF.exists():
        print(f"MISSING_PDF|{PDF}")
        return 1
    print(f"PDF|{PDF}|size={PDF.stat().st_size}|mtime={PDF.stat().st_mtime}")

    # Prefer PyMuPDF
    try:
        import fitz  # type: ignore
        doc = fitz.open(PDF)
        print(f"PAGES|{doc.page_count}|engine=pymupdf")
        # Extract all pages; name appendix range specially if known
        # Thesis: EK A starts around page 30 of 38 (0-index ~29)
        for i in range(doc.page_count):
            page = doc.load_page(i)
            # Also dump embedded images on this page
            for img_i, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n >= 5:  # CMYK
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    out_img = OUT / f"embedded_p{i+1:02d}_{img_i:02d}.png"
                    pix.save(str(out_img))
                    print(f"EMBEDDED|{out_img.name}|{out_img.stat().st_size}")
                except Exception as e:
                    print(f"EMBED_FAIL|p{i+1}|{e}")
            # Render full page at 2x
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            out_page = OUT / f"page_{i+1:02d}.png"
            pix.save(str(out_page))
            print(f"PAGE|{out_page.name}|{out_page.stat().st_size}")
        doc.close()
        return 0
    except ImportError:
        print("NO_PYMUPDF")
    except Exception as e:
        print(f"PYMUPDF_ERR|{e}")

    # Fallback: pypdfium2
    try:
        import pypdfium2 as pdfium  # type: ignore
        pdf = pdfium.PdfDocument(str(PDF))
        print(f"PAGES|{len(pdf)}|engine=pypdfium2")
        for i in range(len(pdf)):
            page = pdf[i]
            bitmap = page.render(scale=2)
            pil = bitmap.to_pil()
            out_page = OUT / f"page_{i+1:02d}.png"
            pil.save(out_page)
            print(f"PAGE|{out_page.name}|{out_page.stat().st_size}")
        return 0
    except ImportError:
        print("NO_PDFIUM")
    except Exception as e:
        print(f"PDFIUM_ERR|{e}")

    # Fallback: pdf2image
    try:
        from pdf2image import convert_from_path  # type: ignore
        images = convert_from_path(str(PDF), dpi=150)
        print(f"PAGES|{len(images)}|engine=pdf2image")
        for i, img in enumerate(images):
            out_page = OUT / f"page_{i+1:02d}.png"
            img.save(out_page, "PNG")
            print(f"PAGE|{out_page.name}|{out_page.stat().st_size}")
        return 0
    except ImportError:
        print("NO_PDF2IMAGE")
    except Exception as e:
        print(f"PDF2IMAGE_ERR|{e}")

    print("FAIL|no PDF renderer available")
    return 2

if __name__ == "__main__":
    sys.exit(main())
