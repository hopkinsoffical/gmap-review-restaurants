from __future__ import annotations

import json
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "output" / "pdf" / "angel-tips-receipt-testcases"
ASSET_DIR = ROOT / "assets" / "test-photos" / "angel-tips-garwood" / "receipts"


def render_pdf_to_jpg(pdf_path: Path, jpg_path: Path) -> None:
    doc = fitz.open(pdf_path)
    if doc.page_count < 1:
        raise RuntimeError(f"No pages found in {pdf_path.name}")

    page = doc.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(2.4, 2.4), alpha=False)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    image.save(jpg_path, format="JPEG", quality=92, optimize=True)
    doc.close()


def main() -> None:
    if not PDF_DIR.exists():
        raise FileNotFoundError(f"PDF source directory not found: {PDF_DIR}")

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    created_files = []

    for pdf_path in sorted(PDF_DIR.glob("*.pdf")):
        jpg_path = ASSET_DIR / f"{pdf_path.stem}.jpg"
        render_pdf_to_jpg(pdf_path, jpg_path)
        created_files.append(jpg_path.name)

    manifest_path = PDF_DIR / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for entry in manifest:
            entry["image_filename"] = Path(entry["filename"]).with_suffix(".jpg").name
        (ASSET_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    readme_path = PDF_DIR / "README.md"
    if readme_path.exists():
        lines = readme_path.read_text(encoding="utf-8").splitlines()
        lines.append("")
        lines.append("Image exports:")
        for name in created_files:
            lines.append(f"- {name}")
        (ASSET_DIR / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    for pdf_path in PDF_DIR.glob("*.pdf"):
        pdf_path.unlink()

    print(
        json.dumps(
            {
                "asset_dir": str(ASSET_DIR),
                "images": created_files,
                "deleted_pdfs": True,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
