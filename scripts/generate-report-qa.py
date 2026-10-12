#!/usr/bin/env python3
"""Render the four report-mode contracts to deterministic QA PDFs."""

from __future__ import annotations

import sys
from pathlib import Path
from statistics import median

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
SCOPE = sys.argv[1] if len(sys.argv) > 1 else "summary"
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / f"tmp/pdfs/{SCOPE}-report-qa.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#002554")
BLUE = colors.HexColor("#008FDA")
INK = colors.HexColor("#162A3A")
MUTED = colors.HexColor("#5F7180")
BORDER = colors.HexColor("#D8E2EA")
SOFT = colors.HexColor("#EEF4F8")
GREEN = colors.HexColor("#19896A")
AMBER = colors.HexColor("#B66C13")
RED = colors.HexColor("#C74B4B")

FONT_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
BOLD_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
pdfmetrics.registerFont(TTFont("AJet", str(FONT_PATH)))
pdfmetrics.registerFont(TTFont("AJet-Bold", str(BOLD_PATH)))

RECORDS = [
    ("ADB", "İzmir", 413, 67025, 91.25, 92.30, 46, 0.3585, 0.0766, 1.04),
    ("AYT", "Antalya", 505, 85858, 90.60, 90.45, 62, 0.4407, 0.0878, 1.22),
    ("BJV", "Muğla", 287, 43804, 92.95, 93.70, 28, 0.4158, 0.0653, 1.16),
    ("COV", "Mersin", 231, 36596, 91.25, 91.70, 26, 0.4685, 0.0966, 1.01),
    ("DLM", "Muğla", 214, 33076, 93.60, 93.25, 21, 0.3858, 0.0553, 0.86),
    ("ESB", "Ankara", 2418, 387741, 90.95, 91.60, 282, 0.3295, 0.1072, 0.85),
    ("SAW", "İstanbul", 4288, 708318, 89.25, 89.00, 631, 0.3855, 0.1802, 1.86),
]

OTP_TREND = [
    ("Tem 25", 86.5), ("Ağu 25", 85.7), ("Eyl 25", 88.1), ("Eki 25", 90.0),
    ("Kas 25", 89.2), ("Ara 25", 87.8), ("Oca 26", 83.2), ("Şub 26", 87.1),
    ("Mar 26", 90.3), ("Nis 26", 91.3), ("May 26", 91.9), ("Haz 26", 90.2),
]

OTA_TREND = [
    ("Tem 25", 86.2), ("Ağu 25", 85.8), ("Eyl 25", 87.8), ("Eki 25", 90.1),
    ("Kas 25", 88.9), ("Ara 25", 87.9), ("Oca 26", 82.9), ("Şub 26", 87.2),
    ("Mar 26", 90.0), ("Nis 26", 91.5), ("May 26", 91.6), ("Haz 26", 90.3),
]

SAFETY_PCT = {"ADB": (0.03, 0.07), "AYT": (0.03, 0.07), "BJV": (0.03, 0.06), "COV": (0.04, 0.06), "DLM": (0.04, 0.05), "ESB": (0.05, 0.05), "SAW": (0.06, 0.05)}
PREVIOUS_OTP = {"ADB": 93.0, "AYT": 92.3, "BJV": 94.65, "COV": 92.95, "DLM": 95.3, "ESB": 92.65, "SAW": 90.95}


def text(c: Canvas, value: str, x: float, y: float, size=8, color=INK, bold=False):
    c.setFillColor(color)
    c.setFont("AJet-Bold" if bold else "AJet", size)
    c.drawString(x, y, value)


def wrapped_text(c: Canvas, value: str, x: float, y: float, max_width: float, size=5.5, color=MUTED, bold=False, leading=None, max_lines=4):
    """Draw bounded report copy without leaking into adjacent cards."""
    font = "AJet-Bold" if bold else "AJet"
    line_height = leading or size * 1.45
    lines: list[str] = []
    current = ""
    for word in value.split():
        candidate = f"{current} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and pdfmetrics.stringWidth(f"{lines[-1]}…", font, size) > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = f"{lines[-1]}…"
    for index, line in enumerate(lines):
        text(c, line, x, y - index * line_height, size, color, bold)


def rounded(c: Canvas, x, y, w, h, fill=colors.white, stroke=BORDER, radius=7):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def header(c: Canvas, page: int, total: int):
    width, height = landscape(A4)
    logo = ROOT / "public/ajet-logo.png"
    c.drawImage(str(logo), 32, height - 54, width=78, height=28, preserveAspectRatio=True, mask="auto")
    text(c, "Hizmete Özel", width - 105, height - 35, 7, BLUE, True)
    text(c, "12 Ağustos 2026", width - 105, height - 47, 6, MUTED)
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.4)
    c.line(32, height - 59, width - 32, height - 59)
    c.setStrokeColor(BORDER)
    c.setLineWidth(.5)
    c.line(32, 25, width - 32, 25)
    text(c, "Veri Yükleme: IMP-202606-TGS-001 · Sütun Eşleştirme: TGS-v1.0 · Hesaplama: KPI-v1.0", 32, 14, 5.6, MUTED)
    c.setFillColor(NAVY)
    c.setFont("AJet-Bold", 5.6)
    c.drawRightString(width - 32, 14, f"{page} / {total}")


def page_one(c: Canvas, page=1, total=2, report_title="YÖNETİCİ ÖZETİ"):
    width, height = landscape(A4)
    header(c, page, total)
    text(c, report_title, 32, height - 78, 6.5, BLUE, True)
    text(c, "TGS İstasyon Performans Özeti", 32, height - 100, 18, NAVY, True)
    text(c, "Haziran 2026 · 7 istasyon · 12 aylık TEST VERİSİ kapsamı", 32, height - 116, 7, MUTED)

    scopes = [
        ("DÖNEM", "Haziran 2026"), ("KARŞILAŞTIRMA DÖNEMİ", "Mayıs 2026"), ("Handling Provider", "TGS"), ("HAVALİMANI", "7 seçili"),
        ("BÖLGE", "Çoklu"), ("ÜLKE", "Türkiye"), ("ŞEHİR", "Çoklu"), ("VERİ", "TEST · 12 aylık"),
    ]
    scope_h, gap = 29, 6
    scope_w = (width - 64 - gap * 3) / 4
    for index, (label, value) in enumerate(scopes):
        row, col = divmod(index, 4)
        x, y = 32 + col * (scope_w + gap), height - 161 - row * (scope_h + 5)
        rounded(c, x, y, scope_w, scope_h, SOFT, SOFT, 5)
        text(c, label, x + 8, y + 17, 5.1, BLUE, True)
        text(c, value, x + 8, y + 6, 6.3, NAVY, True)

    total_flights = sum(record[2] for record in RECORDS)
    total_passengers = sum(record[3] for record in RECORDS)
    weighted_otp = sum(record[2] * record[4] for record in RECORDS) / total_flights
    weighted_ota = sum(record[2] * record[5] for record in RECORDS) / total_flights
    total_delay = sum(record[6] for record in RECORDS)
    damaged_count = sum(int(record[3] * record[7] / 100 + .5) for record in RECORDS)
    lost_count = sum(int(record[3] * record[8] / 100 + .5) for record in RECORDS)
    damaged_rate = damaged_count / total_passengers * 100
    lost_rate = lost_count / total_passengers * 100
    weighted_safety = sum(record[2] * SAFETY_PCT[record[0]][0] for record in RECORDS) / total_flights
    kpis = [
        ("Toplam Uçuş", f"{total_flights:,}".replace(",", "."), "Mayıs 7.816 · Değişim +540"),
        ("Toplam Yolcu", f"{total_passengers:,}".replace(",", "."), "Mayıs 1.258.871 · Değişim +103.547"),
        ("OTP", f"%{weighted_otp:.1f}".replace(".", ","), "Mayıs %91,9 · Değişim −1,7 puan"),
        ("OTA", f"%{weighted_ota:.1f}".replace(".", ","), "Mayıs %91,6 · Değişim −1,3 puan"),
        ("Toplam Tehir", f"{total_delay:,} dk".replace(",", "."), "Mayıs 782 dk · Değişim +314 dk"),
        ("Hasarlı Bagaj %", f"%{damaged_rate:.2f}".replace(".", ","), "Mayıs %0,34 · Değişim +0,03 puan"),
        ("Kayıp Bagaj %", f"%{lost_rate:.2f}".replace(".", ","), "Mayıs %0,13 · Değişim +0,01 puan"),
        ("Şikâyet Dönüş Süresi", f"{median(record[9] for record in RECORDS):.2f} gün".replace(".", ","), "Mayıs 0,95 gün · Değişim +0,09 gün"),
        ("Safety %", f"%{weighted_safety:.2f}".replace(".", ","), "Mayıs %0,05 · Değişim 0,00 puan"),
    ]
    kpi_h, kpi_gap = 79, 8
    kpi_w = (width - 64 - kpi_gap * 2) / 3
    for index, (label, value, note) in enumerate(kpis):
        row, col = divmod(index, 3)
        x, y = 32 + col * (kpi_w + kpi_gap), height - 322 - row * (kpi_h + kpi_gap)
        rounded(c, x, y, kpi_w, kpi_h, colors.HexColor("#F8FBFD"), BORDER, 7)
        c.setFillColor(BLUE if index in (2, 3) else NAVY); c.circle(x + 14, y + kpi_h - 16, 3.2, fill=1, stroke=0)
        text(c, label, x + 24, y + kpi_h - 19, 6.4, MUTED, True)
        text(c, value, x + 13, y + 31, 14, NAVY, True)
        text(c, note, x + 13, y + 11, 5.5, MUTED)


def page_two(c: Canvas, page=2, total=2):
    width, height = landscape(A4)
    c.showPage()
    header(c, page, total)
    text(c, "OPERASYONEL ÖNCELİKLER", 32, height - 78, 6.5, BLUE, True)
    text(c, "Dönemsel performans, karşılaştırma ve öne çıkan istasyonlar", 32, height - 100, 18, NAVY, True)
    text(c, "Genel Bakış ile aynı filtrelenmiş veri kapsamı · 12 aylık görünüm", 32, height - 116, 7, MUTED)

    card_y, card_h, gap = height - 328, 190, 10
    card_w = (width - 64 - gap) / 2
    for x in (32, 32 + card_w + gap):
        rounded(c, x, card_y, card_w, card_h, colors.HexColor("#FBFDFE"), BORDER, 7)
    text(c, "DÖNEM KARŞILAŞTIRMASI", 44, card_y + card_h - 19, 5.8, BLUE, True)
    text(c, "OTP · Haziran 2026 ile Mayıs 2026", 44, card_y + card_h - 36, 10, NAVY, True)
    chart_left, chart_right = 62, 32 + card_w - 22
    chart_bottom, chart_top = card_y + 42, card_y + card_h - 58
    period_values = [record[4] for record in RECORDS] + list(PREVIOUS_OTP.values())
    low, high = min(period_values) - 1, max(period_values) + 1
    current_points, previous_points = [], []
    for index, record in enumerate(RECORDS):
        code, _, _, _, current_otp, *_ = record
        px = chart_left + index / (len(RECORDS) - 1) * (chart_right - chart_left)
        current_y = chart_bottom + (current_otp - low) / (high - low) * (chart_top - chart_bottom)
        previous_y = chart_bottom + (PREVIOUS_OTP[code] - low) / (high - low) * (chart_top - chart_bottom)
        current_points.append((px, current_y)); previous_points.append((px, previous_y))
        c.setStrokeColor(GREEN if current_otp >= PREVIOUS_OTP[code] else RED); c.setLineWidth(1.1); c.line(px, previous_y, px, current_y)
    c.setStrokeColor(NAVY); c.setLineWidth(1.7); c.setDash(5, 3)
    for index in range(1, len(previous_points)): c.line(previous_points[index - 1][0], previous_points[index - 1][1], previous_points[index][0], previous_points[index][1])
    c.setDash(); c.setStrokeColor(BLUE); c.setLineWidth(2.2)
    for index in range(1, len(current_points)): c.line(current_points[index - 1][0], current_points[index - 1][1], current_points[index][0], current_points[index][1])
    for index, record in enumerate(RECORDS):
        code = record[0]; px, current_y = current_points[index]; _, previous_y = previous_points[index]
        c.setFillColor(colors.white); c.setStrokeColor(NAVY); c.setLineWidth(1.5); c.circle(px, previous_y, 3.2, fill=1, stroke=1)
        c.setFillColor(BLUE); c.setStrokeColor(colors.white); c.circle(px, current_y, 3.2, fill=1, stroke=1)
        text(c, code, px - 7, card_y + 25, 5.2, NAVY, True)
    text(c, "— Haziran 2026", 44, card_y + 9, 5.4, BLUE, True)
    text(c, "- - Mayıs 2026", 118, card_y + 9, 5.4, NAVY, True)

    right_x = 32 + card_w + gap
    text(c, "DÖNEMSEL PERFORMANS", right_x + 12, card_y + card_h - 19, 5.8, BLUE, True)
    text(c, "12 Aylık OTP / OTA Performansı", right_x + 12, card_y + card_h - 36, 10, NAVY, True)
    chart_left, chart_right = right_x + 28, right_x + card_w - 18
    chart_bottom, chart_top = card_y + 45, card_y + card_h - 58
    values = [value for _, value in OTP_TREND] + [value for _, value in OTA_TREND]
    low, high = min(values) - 1, max(values) + 1
    otp_points, ota_points = [], []
    for index, ((_, otp_value), (_, ota_value)) in enumerate(zip(OTP_TREND, OTA_TREND)):
        px = chart_left + index / (len(OTP_TREND) - 1) * (chart_right - chart_left)
        otp_points.append((px, chart_bottom + (otp_value - low) / (high - low) * (chart_top - chart_bottom)))
        ota_points.append((px, chart_bottom + (ota_value - low) / (high - low) * (chart_top - chart_bottom)))
    for series, color in ((otp_points, BLUE), (ota_points, NAVY)):
        c.setStrokeColor(color); c.setLineWidth(2.2)
        for index in range(1, len(series)): c.line(series[index - 1][0], series[index - 1][1], series[index][0], series[index][1])
    for index, ((label, _), (otp_x, otp_y), (_, ota_y)) in enumerate(zip(OTP_TREND, otp_points, ota_points)):
        c.setFillColor(BLUE); c.circle(otp_x, otp_y, 3.4 if index == len(otp_points) - 1 else 2.2, fill=1, stroke=0)
        c.setFillColor(NAVY); c.circle(otp_x, ota_y, 3.4 if index == len(ota_points) - 1 else 2.2, fill=1, stroke=0)
        text(c, label, otp_x - 8, card_y + 31, 3.9, MUTED)
    text(c, f"OTP %{OTP_TREND[-1][1]:.1f}".replace(".", ","), otp_points[-1][0] - 37, otp_points[-1][1] + 8, 5.2, BLUE, True)
    text(c, f"OTA %{OTA_TREND[-1][1]:.1f}".replace(".", ","), ota_points[-1][0] - 37, ota_points[-1][1] - 11, 5.2, NAVY, True)
    text(c, "● OTP", right_x + 18, card_y + 12, 5.2, BLUE, True)
    text(c, "● OTA", right_x + 64, card_y + 12, 5.2, NAVY, True)

    text(c, "ÖNE ÇIKAN İSTASYONLAR", 32, 222, 6.2, BLUE, True)
    text(c, "Şeffaf seçim nedenleri", 32, 205, 11, NAVY, True)
    lowest_otp = min(RECORDS, key=lambda record: record[4])
    highest_lost = max((record for record in RECORDS if record[0] != lowest_otp[0]), key=lambda record: record[8])
    highest_delay = max((record for record in RECORDS if record[0] not in (lowest_otp[0], highest_lost[0])), key=lambda record: record[6] / record[2] * 100)
    insights = [
        (lowest_otp[0], f"OTP %{lowest_otp[4]:.1f}".replace(".", ","), "Hedefin altında; seçili dönemin en düşük OTP değeri"),
        (highest_lost[0], f"Kayıp Bagaj %{highest_lost[8]:.2f}".replace(".", ","), "Seçili dönemin en yüksek kayıp bagaj oranı"),
        (highest_delay[0], f"{highest_delay[6] / highest_delay[2] * 100:.1f} dk / 100 uçuş".replace(".", ","), "En yüksek normalize tehir değeri"),
    ]
    insight_w = (width - 64 - 16) / 3
    for index, (code, value, reason) in enumerate(insights):
        x = 32 + index * (insight_w + 8)
        rounded(c, x, 83, insight_w, 100, SOFT, SOFT, 7)
        c.setFillColor(NAVY); c.roundRect(x + 12, 145, 35, 25, 5, fill=1, stroke=0)
        text(c, code, x + 20, 153, 7, colors.white, True)
        text(c, value, x + 12, 124, 11, NAVY, True)
        text(c, reason, x + 12, 101, 5.4, MUTED)
        text(c, "Doğrulanmış kural · birleşik risk puanı yok", x + 12, 89, 4.8, BLUE, True)


def station_page(c: Canvas, page: int, total: int, record, new_page=True):
    if new_page:
        c.showPage()
    width, height = landscape(A4)
    header(c, page, total)
    code, city, flights, passengers, otp, ota, delay, damaged, lost, complaint = record
    names = {"ADB": "İzmir Adnan Menderes", "AYT": "Antalya", "BJV": "Milas-Bodrum", "COV": "Çukurova", "DLM": "Dalaman", "ESB": "Ankara Esenboğa", "SAW": "İstanbul Sabiha Gökçen"}
    text(c, "İSTASYON PERFORMANS KARNESİ", 32, height - 78, 6.5, BLUE, True)
    text(c, f"{code} — {names[code]}", 32, height - 104, 19, NAVY, True)
    text(c, f"{city} · Türkiye · Handling Provider: TGS · Haziran 2026", 32, height - 120, 7, MUTED)
    kpis = [
        ("Toplam Uçuş", f"{flights:,}".replace(",", "."), "Mutlak hacim"), ("Toplam Yolcu", f"{passengers:,}".replace(",", "."), "Mutlak hacim"),
        ("OTP", f"%{otp:.1f}".replace(".", ","), "Hedef %90"), ("OTA", f"%{ota:.1f}".replace(".", ","), "Hedef %90"),
        ("Toplam Tehir", "Kaynakta Raporlanmamış" if delay is None else f"{delay} dk", "Eksik değer sıfır değildir"), ("Şikâyet Dönüş Süresi", f"{complaint:.2f} gün".replace(".", ","), "Hedef ≤ 2 gün"),
        ("Hasarlı Bagaj %", f"%{damaged:.2f}".replace(".", ","), "Yolcu paydası"), ("Kayıp Bagaj %", f"%{lost:.2f}".replace(".", ","), "Yolcu paydası"),
        ("Safety %", f"%{SAFETY_PCT[code][0]:.2f}".replace(".", ","), "Kaynak oranı"), ("Safety Dışı %", f"%{SAFETY_PCT[code][1]:.2f}".replace(".", ","), "Kaynak oranı"),
    ]
    gap, tile_h = 8, 82
    tile_w = (width - 64 - gap * 4) / 5
    for index, (label, value, note) in enumerate(kpis):
        row, col = divmod(index, 5)
        x, y = 32 + col * (tile_w + gap), height - 225 - row * (tile_h + gap)
        rounded(c, x, y, tile_w, tile_h, colors.HexColor("#F8FBFD"), BORDER, 7)
        text(c, label, x + 10, y + 61, 6.3, MUTED)
        text(c, value, x + 10, y + 35, 13, NAVY, True)
        text(c, note, x + 10, y + 13, 5.4, MUTED)
    blocks = [
        ("HEDEF VE DÖNEM BAĞLAMI", "OTP / OTA hedefi %90. Şikâyet Dönüş Süresi hedefi ≤ 2 gün. Değişim ortak KPI tanımından gelir."),
        ("VERİ KAYNAĞI VE HESAPLAMA", f"Kaynak: Haziran 2026 TGS İstasyon Performans Karnesi · Genel · {code} satırı · TGS-v1.0 · KPI-v1.0"),
    ]
    block_w = (width - 72) / 2
    for index, (label, body) in enumerate(blocks):
        x = 32 + index * (block_w + 8)
        rounded(c, x, 48, block_w, 72, SOFT, SOFT, 7)
        text(c, label, x + 11, 98, 6, BLUE, True)
        wrapped_text(c, body, x + 11, 76, block_w - 22, 5.5, MUTED, max_lines=4)


def cover_page(c: Canvas, total: int):
    width, height = landscape(A4)
    c.setFillColor(NAVY); c.rect(0, 0, width, height, fill=1, stroke=0)
    logo = ROOT / "public/ajet-logo.png"
    c.setFillColor(colors.white); c.roundRect(38, height - 88, 126, 54, 8, fill=1, stroke=0)
    c.drawImage(str(logo), 42, height - 82, width=112, height=42, preserveAspectRatio=True, mask="auto")
    text(c, "AJET · YER İŞLETME BAŞKANLIĞI", 55, height - 190, 8, BLUE, True)
    text(c, "Kapsamlı Performans Raporu", 55, height - 238, 30, colors.white, True)
    text(c, "TGS İstasyon Performans Platformu", 55, height - 274, 14, colors.HexColor("#C9D8E3"))
    text(c, "Haziran 2026 · 7 istasyon · değişmez rapor kapsamı", 55, height - 325, 9, colors.white, True)
    text(c, f"1 / {total}", width - 60, 20, 6, colors.white, True)


def methodology_page(c: Canvas, page: int, total: int):
    c.showPage()
    width, height = landscape(A4)
    header(c, page, total)
    text(c, "METODOLOJİ VE KAYNAK", 32, height - 78, 6.5, BLUE, True)
    text(c, "Raporlama sözleşmesi", 32, height - 103, 18, NAVY, True)
    text(c, "Genel Bakış, PDF, Excel ve CSV için ortak KPI tanımları", 32, height - 120, 7, MUTED)
    blocks = [
        ("HESAPLAMA", "OTP ve OTA uçuş hacmiyle ağırlıklandırılır. Bagaj oranı gösterimde yalnız bir kez 100 ile çarpılır."),
        ("DEĞİŞİM RENGİ", "Yeşil performans iyileşmesini, kırmızı kötüleşmeyi gösterir. Düşük değerin iyi olduğu KPI'larda düşüş yeşildir."),
        ("KAYNAK", "Temmuz 2025 - Haziran 2026 · 12 TGS test dosyası · 84 istasyon-dönem kaydı."),
        ("SÜRÜMLER", "Sütun Eşleştirme: TGS-v1.0 · Hesaplama: KPI-v1.0"),
        ("VERİ EŞLİĞİ", "Rapor oluşturulduğu andaki değişmez veri kapsamını kullanır; filtreler rapor hazırlanırken değiştirilemez."),
        ("GİZLİLİK", "Hizmete Özel · Yetkili kullanıcı paylaşımı."),
    ]
    gap, card_w, card_h = 10, (width - 84) / 3, 135
    for index, (label, body) in enumerate(blocks):
        row, col = divmod(index, 3)
        x, y = 32 + col * (card_w + gap), height - 280 - row * (card_h + gap)
        rounded(c, x, y, card_w, card_h, SOFT, SOFT, 8)
        text(c, label, x + 12, y + 105, 6.5, BLUE, True)
        wrapped_text(c, body, x + 12, y + 76, card_w - 24, 5.5, MUTED, max_lines=5)


if SCOPE not in {"summary", "detail", "station", "full"}:
    raise SystemExit(f"Unknown scope: {SCOPE}")

canvas = Canvas(str(OUTPUT), pagesize=landscape(A4), pageCompression=1)
canvas.setTitle(f"AJet TGS {SCOPE} Report - QA")
if SCOPE == "summary":
    page_one(canvas, 1, 2, "HIZLI YÖNETİCİ ÖZETİ")
    page_two(canvas, 2, 2)
elif SCOPE == "detail":
    page_one(canvas, 1, 3, "FİLTRELİ DETAY RAPORU")
    page_two(canvas, 2, 3)
    methodology_page(canvas, 3, 3)
elif SCOPE == "station":
    station_page(canvas, 1, 1, RECORDS[-1], new_page=False)
else:
    total = len(RECORDS) + 4
    cover_page(canvas, total)
    canvas.showPage()
    page_one(canvas, 2, total, "YÖNETİCİ ÖZETİ")
    page_two(canvas, 3, total)
    for index, record in enumerate(RECORDS, start=4):
        station_page(canvas, index, total, record)
    methodology_page(canvas, total, total)
canvas.save()
print(OUTPUT)
