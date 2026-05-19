from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import portrait
from reportlab.pdfgen import canvas


NJ_TAX_RATE = Decimal("0.06625")
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf" / "angel-tips-receipt-testcases"


STORE = {
    "name": "ANGEL TIPS NAIL SPA",
    "address_1": "313 NORTH AVENUE",
    "address_2": "GARWOOD, NJ 07027",
    "phone": "908-928-9022",
    "website": "angeltipsgarwoodnj.com",
}


def money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"


@dataclass
class LineItem:
    label: str
    price: Decimal
    quantity: int = 1
    expected_service: str = ""


@dataclass
class ReceiptCase:
    slug: str
    template: str
    receipt_no: str
    when: str
    staff: str
    customer: str
    payment: str
    items: list[LineItem]
    note: str = ""
    discount_label: str = ""
    discount_amount: Decimal = Decimal("0.00")


RECEIPTS = [
    ReceiptCase(
        slug="01-classic-regular-manicure-french",
        template="classic",
        receipt_no="AT-240401-1007",
        when="2026-04-01 10:07 AM",
        staff="Tina",
        customer="LINA Z",
        payment="VISA",
        items=[
            LineItem("REGULAR MANICURE", Decimal("18.00"), expected_service="Regular Manicure"),
            LineItem("FRENCH ADD-ON", Decimal("10.00"), expected_service="French Add-On"),
        ],
        note="Walk-in guest",
    ),
    ReceiptCase(
        slug="02-modern-color-gel-removal",
        template="modern",
        receipt_no="AT-240402-1134",
        when="2026-04-02 11:34 AM",
        staff="Mei",
        customer="MELISSA W",
        payment="MC",
        items=[
            LineItem("COLOR GEL MANI", Decimal("35.00"), expected_service="Color Gel Manicure"),
            LineItem("REMOVE GEL COLOR", Decimal("10.00"), expected_service="Remove Gel Color"),
        ],
        note="Requested short almond shape",
    ),
    ReceiptCase(
        slug="03-thermal-sns-design-extra-length",
        template="thermal",
        receipt_no="AT-240403-1416",
        when="2026-04-03 02:16 PM",
        staff="Emma",
        customer="JULIA C",
        payment="AMEX",
        items=[
            LineItem("SNS COLOR POWDER", Decimal("45.00"), expected_service="SNS Color Powder"),
            LineItem("NAIL DESIGN - 2 NAILS", Decimal("14.00"), expected_service="Nail Design One Nail"),
            LineItem("EXTRA LENGTH", Decimal("10.00"), expected_service="Extra Length"),
        ],
        note="Chrome powder requested on ring fingers",
    ),
    ReceiptCase(
        slug="04-classic-acrylic-set-tropical-french",
        template="classic",
        receipt_no="AT-240404-1548",
        when="2026-04-04 03:48 PM",
        staff="Karla",
        customer="NORA P",
        payment="DISCOVER",
        items=[
            LineItem("ACRYLIC SET W/GEL", Decimal("70.00"), expected_service="Acrylic Set With Gel Color"),
            LineItem("FRENCH STYLE TROPICAL", Decimal("15.00"), expected_service="French Style Tropical Color"),
            LineItem("EXTRA LENGTH", Decimal("10.00"), expected_service="Extra Length"),
        ],
        note="Vacation set / bright coral tips",
    ),
    ReceiptCase(
        slug="05-modern-regular-pedi-callus-gel",
        template="modern",
        receipt_no="AT-240405-1202",
        when="2026-04-05 12:02 PM",
        staff="Diana",
        customer="SARA K",
        payment="VISA",
        items=[
            LineItem("REGULAR PEDICURE", Decimal("30.00"), expected_service="Regular Pedicure"),
            LineItem("WITH COLOR GEL", Decimal("20.00"), expected_service="Pedicure With Color Gel"),
            LineItem("CALLUS TREATMENT", Decimal("12.00"), expected_service="Callus Treatment"),
        ],
        note="Customer brought reference color photo",
    ),
    ReceiptCase(
        slug="06-thermal-dream-pedi-foot-massage",
        template="thermal",
        receipt_no="AT-240406-1736",
        when="2026-04-06 05:36 PM",
        staff="Coco",
        customer="IRENE H",
        payment="CASH",
        items=[
            LineItem("DREAM SPA PEDICURE", Decimal("92.00"), expected_service="Dream Spa Pedicure"),
            LineItem("10 MIN FOOT MASSAGE", Decimal("14.00"), expected_service="10-Minute Foot Massage"),
            LineItem("FRENCH ADD-ON", Decimal("10.00"), expected_service="Pedicure French Add-On"),
        ],
        note="Cash ticket / no change due",
    ),
    ReceiptCase(
        slug="07-classic-waxing-multi-service",
        template="classic",
        receipt_no="AT-240407-1321",
        when="2026-04-07 01:21 PM",
        staff="Lily",
        customer="AMY T",
        payment="MC",
        items=[
            LineItem("EYEBROW WAX", Decimal("12.00"), expected_service="Eyebrow Wax"),
            LineItem("LIP WAX", Decimal("8.00"), expected_service="Lip Wax"),
            LineItem("CHIN WAX", Decimal("10.00"), expected_service="Chin Wax"),
            LineItem("UNDER ARMS WAX", Decimal("20.00"), expected_service="Under Arms Wax"),
        ],
        note="Quick facial waxing appointment",
    ),
    ReceiptCase(
        slug="08-modern-swedish-massage",
        template="modern",
        receipt_no="AT-240408-1630",
        when="2026-04-08 04:30 PM",
        staff="John",
        customer="MICHELLE R",
        payment="AMEX",
        items=[
            LineItem("SWEDISH MASSAGE 60M", Decimal("85.00"), expected_service="Swedish Massage"),
        ],
        note="Quiet room requested",
    ),
    ReceiptCase(
        slug="09-thermal-little-angels-bundle",
        template="thermal",
        receipt_no="AT-240409-1105",
        when="2026-04-09 11:05 AM",
        staff="Yoyo",
        customer="MIA + MOM",
        payment="VISA",
        items=[
            LineItem("LITTLE ANGELS MANI&PEDI", Decimal("35.00"), expected_service="Little Angels Manicure & Pedicure"),
            LineItem("KIDS POLISH TOES/NAILS", Decimal("25.00"), expected_service="Little Angels Polish for Toes and Nails"),
        ],
        note="Child under 10 service",
    ),
    ReceiptCase(
        slug="10-modern-spa-mani-pedi-brow-new-customer",
        template="modern",
        receipt_no="AT-240410-1822",
        when="2026-04-10 06:22 PM",
        staff="Christina",
        customer="EVELYN S",
        payment="VISA",
        items=[
            LineItem("ORGANIC SPA MANI", Decimal("36.00"), expected_service="Organic Spa Manicure"),
            LineItem("SEA BREEZE SPA PEDI", Decimal("52.00"), expected_service="Sea Breeze Spa Pedicure"),
            LineItem("EYEBROW WAX", Decimal("12.00"), expected_service="Eyebrow Wax"),
        ],
        note="New guest promo applied",
        discount_label="NEW CUSTOMER TEXT START",
        discount_amount=Decimal("10.00"),
    ),
]


def build_receipt_math(receipt: ReceiptCase) -> dict[str, Decimal]:
    subtotal = sum((item.price * item.quantity for item in receipt.items), Decimal("0.00"))
    discounted_subtotal = subtotal - receipt.discount_amount
    taxable_amount = max(discounted_subtotal, Decimal("0.00"))
    tax = (taxable_amount * NJ_TAX_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tip = (taxable_amount * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = taxable_amount + tax + tip
    return {
        "subtotal": subtotal,
        "discounted_subtotal": discounted_subtotal,
        "tax": tax,
        "tip": tip,
        "total": total,
    }


def page_height_for(receipt: ReceiptCase) -> float:
    base = 360
    per_item = 26
    extra = 34 if receipt.discount_amount > 0 else 0
    note_extra = 26 if receipt.note else 0
    return max(520, base + len(receipt.items) * per_item + extra + note_extra)


def draw_centered(c: canvas.Canvas, y: float, text: str, size: int, font: str = "Helvetica-Bold") -> None:
    width = c._pagesize[0]
    c.setFont(font, size)
    c.drawCentredString(width / 2, y, text)


def draw_separator(c: canvas.Canvas, y: float, variant: str) -> None:
    width = c._pagesize[0]
    if variant == "thermal":
        c.setDash(2, 2)
    else:
        c.setDash()
    c.setLineWidth(0.8)
    c.setStrokeColor(Color(0.45, 0.45, 0.45))
    c.line(18, y, width - 18, y)
    c.setDash()


def draw_items(c: canvas.Canvas, receipt: ReceiptCase, y: float) -> float:
    width = c._pagesize[0]
    c.setFont("Courier-Bold", 8)
    c.drawString(18, y, "ITEM")
    c.drawRightString(width - 18, y, "AMOUNT")
    y -= 14
    draw_separator(c, y, receipt.template)
    y -= 16

    c.setFont("Courier", 8.5)
    for item in receipt.items:
        label = item.label
        amount = money(item.price * item.quantity)
        c.drawString(18, y, label[:26])
        c.drawRightString(width - 18, y, amount)
        y -= 12
        if len(label) > 26:
            c.setFillColor(Color(0.38, 0.38, 0.38))
            c.drawString(26, y, label[26:50])
            c.setFillColor(Color(0, 0, 0))
            y -= 12
    return y


def draw_totals(c: canvas.Canvas, receipt: ReceiptCase, y: float) -> float:
    width = c._pagesize[0]
    math = build_receipt_math(receipt)
    rows = [
        ("SUBTOTAL", math["subtotal"]),
    ]
    if receipt.discount_amount > 0:
        rows.append((receipt.discount_label[:20], -receipt.discount_amount))
    rows.extend(
        [
            ("TAX NJ 6.625%", math["tax"]),
            ("TIP 18%", math["tip"]),
            ("TOTAL", math["total"]),
        ]
    )

    draw_separator(c, y, receipt.template)
    y -= 18
    c.setFont("Courier", 8.5)
    for label, amount in rows:
        c.drawString(18, y, label)
        c.drawRightString(width - 18, y, money(amount))
        y -= 12
    return y


def render_receipt_pdf(receipt: ReceiptCase) -> Path:
    width = 226
    height = page_height_for(receipt)
    filepath = OUTPUT_DIR / f"{receipt.slug}.pdf"
    c = canvas.Canvas(str(filepath), pagesize=portrait((width, height)))
    top = height - 24

    if receipt.template == "modern":
        c.setFillColor(Color(0.96, 0.91, 0.88))
        c.roundRect(12, height - 104, width - 24, 72, 8, fill=1, stroke=0)
        c.setFillColor(Color(0.16, 0.12, 0.11))
    elif receipt.template == "thermal":
        c.setFillColor(Color(0, 0, 0))
    else:
        c.setFillColor(Color(0.12, 0.1, 0.1))

    draw_centered(c, top, STORE["name"], 12)
    draw_centered(c, top - 16, STORE["address_1"], 8, "Helvetica")
    draw_centered(c, top - 28, STORE["address_2"], 8, "Helvetica")
    draw_centered(c, top - 40, f"TEL {STORE['phone']}", 8, "Helvetica")
    draw_centered(c, top - 52, STORE["website"], 7, "Helvetica")

    y = top - 74
    draw_separator(c, y, receipt.template)
    y -= 18

    c.setFont("Courier", 8.2)
    c.drawString(18, y, f"RCPT#: {receipt.receipt_no}")
    y -= 12
    c.drawString(18, y, f"DATE : {receipt.when}")
    y -= 12
    c.drawString(18, y, f"STAFF: {receipt.staff}")
    y -= 12
    c.drawString(18, y, f"GUEST: {receipt.customer}")
    y -= 12
    c.drawString(18, y, f"PAY  : {receipt.payment}")
    y -= 16

    y = draw_items(c, receipt, y)
    y = draw_totals(c, receipt, y)

    if receipt.note:
        y -= 6
        draw_separator(c, y, receipt.template)
        y -= 16
        c.setFont("Helvetica-Oblique", 7.5)
        c.drawString(18, y, receipt.note[:34])
        y -= 12

    y -= 6
    draw_separator(c, y, receipt.template)
    y -= 18
    draw_centered(c, y, "Thank you for visiting!", 8, "Helvetica-Bold")
    draw_centered(c, y - 12, "Tips are not included in prices.", 7, "Helvetica")
    draw_centered(c, y - 24, "Please come again.", 7, "Helvetica")

    c.save()
    return filepath


def write_manifest(files: list[Path]) -> None:
    manifest = []
    for receipt, path in zip(RECEIPTS, files):
        math = build_receipt_math(receipt)
        items = []
        for item in receipt.items:
            item_dict = asdict(item)
            item_dict["price"] = money(item.price)
            items.append(item_dict)
        manifest.append(
            {
                "filename": path.name,
                "template": receipt.template,
                "receipt_no": receipt.receipt_no,
                "datetime": receipt.when,
                "staff": receipt.staff,
                "customer": receipt.customer,
                "payment": receipt.payment,
                "items": items,
                "discount_label": receipt.discount_label,
                "discount_amount": money(receipt.discount_amount),
                "subtotal": money(math["subtotal"]),
                "tax": money(math["tax"]),
                "tip": money(math["tip"]),
                "total": money(math["total"]),
                "note": receipt.note,
            }
        )

    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    lines = [
        "# Angel Tips Receipt Testcases",
        "",
        "Generated PDF receipt fixtures for local OCR and review-flow testing.",
        "",
        f"Generated at: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "Files:",
    ]
    for entry in manifest:
        lines.append(
            f"- {entry['filename']}: {', '.join(item['expected_service'] for item in entry['items'])} / staff {entry['staff']} / total {entry['total']}"
        )
    (OUTPUT_DIR / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = [render_receipt_pdf(receipt) for receipt in RECEIPTS]
    write_manifest(generated)
    print(json.dumps({"output_dir": str(OUTPUT_DIR), "files": [path.name for path in generated]}, indent=2))


if __name__ == "__main__":
    main()
