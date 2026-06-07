# -*- coding: utf-8 -*-
import os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

BASE = "/sessions/inspiring-great-feynman/mnt/ZotovNavigator"
LIB = "/usr/share/fonts/truetype/liberation2"
pdfmetrics.registerFont(TTFont("LS", f"{LIB}/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("LSB", f"{LIB}/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("LSI", f"{LIB}/LiberationSans-Italic.ttf"))

W, H = 960, 540
RED = Color(192/255, 0, 0)
DARK = Color(0.13, 0.13, 0.13)
GRAY = Color(0.42, 0.42, 0.42)
TINT = Color(0.985, 0.93, 0.93)      # light red card fill
TINT2 = Color(0.965, 0.88, 0.88)     # stronger tint
WHITE = Color(1, 1, 1)
MX = 40

logo = ImageReader(f"{BASE}/assets/logo_header.png")
LW, LH = Image.open(f"{BASE}/assets/logo_header.png").size  # 475x125

def header(c, title, title_size=44):
    # logo top-right
    lw = 150.0
    lh = lw * LH / LW
    c.drawImage(logo, W - MX - lw, H - 26 - lh, width=lw, height=lh, mask='auto')
    # title
    c.setFillColor(RED)
    c.setFont("LSB", title_size)
    c.drawString(MX, H - 78, title)
    # rule
    c.setStrokeColor(RED)
    c.setLineWidth(3)
    c.line(MX, H - 96, W - MX - 168, H - 96)

def wrap(text, font, size, maxw):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(t, font, size) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def rrect(c, x, y, w, h, r, fill=None, stroke=None, lw=1):
    if fill is not None:
        c.setFillColor(fill)
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.setLineWidth(lw)
    c.roundRect(x, y, w, h, r, stroke=1 if stroke is not None else 0,
                fill=1 if fill is not None else 0)

def draw_check(c, x, y, s):
    # red check mark, baseline-ish around y
    c.setStrokeColor(RED)
    c.setLineWidth(2.4)
    c.setLineCap(1)
    c.line(x, y + s*0.35, x + s*0.38, y)
    c.line(x + s*0.38, y, x + s, y + s*0.95)

# ---------------------------------------------------------------- SLIDE 4
def slide4(c):
    header(c, "Целевая аудитория")
    c.setFillColor(DARK)
    c.setFont("LSB", 19)
    c.drawString(MX, H - 138, "Кто теряется в Центре «Зотов»?")

    personas = [
        ("Новый посетитель", "«Где гардероб? Где касса? Куда идти?»"),
        ("Гость на мероприятие", "«Лекция на 3-м этаже — как туда попасть?»"),
        ("Семья с детьми", "«Где мастер-класс? Где туалет? Где кафе?»"),
        ("Планировщик дня", "«Хочу успеть выставку, лекцию и кино — какой маршрут?»"),
    ]
    gap = 22
    cw = (W - 2*MX - gap) / 2
    ch = 132
    top = H - 162
    coords = [
        (MX, top - ch),
        (MX + cw + gap, top - ch),
        (MX, top - 2*ch - gap),
        (MX + cw + gap, top - 2*ch - gap),
    ]
    for (x, y), (name, q) in zip(coords, personas):
        rrect(c, x, y, cw, ch, 12, fill=TINT)
        # red accent bar
        c.setFillColor(RED)
        c.rect(x, y, 6, ch, stroke=0, fill=1)
        c.setFillColor(RED)
        c.setFont("LSB", 21)
        c.drawString(x + 26, y + ch - 38, name)
        c.setFillColor(DARK)
        c.setFont("LS", 16)
        ln = wrap(q, "LS", 16, cw - 52)
        yy = y + ch - 70
        for l in ln:
            c.drawString(x + 26, yy, l)
            yy -= 22

# ---------------------------------------------------------------- SLIDE 5
def slide5(c):
    header(c, "Решение")
    c.setFillColor(DARK)
    c.setFont("LSB", 22)
    c.drawString(MX, H - 142, "Зотов.Навигатор — три формата, один продукт")

    cards = [
        ("Сайт Зотова", "Встраивается на centrezotov.ru через iframe"),
        ("Телефон", "Мобильная версия без установки, работает как PWA"),
        ("Стойка при входе", "Интерактивный экран и печатные буклеты прямо у входа"),
    ]
    n = 3
    arrow = 50
    cw = (W - 2*MX - (n-1)*arrow) / n
    ch = 210
    top = H - 175
    y = top - ch
    xs = [MX + i*(cw + arrow) for i in range(n)]
    bandh = 52
    for x, (name, body) in zip(xs, cards):
        rrect(c, x, y, cw, ch, 14, fill=TINT, stroke=TINT2, lw=1)
        # red header band
        c.setFillColor(RED)
        c.roundRect(x, y + ch - bandh, cw, bandh, 14, stroke=0, fill=1)
        c.rect(x, y + ch - bandh, cw, bandh/2, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("LSB", 20)
        c.drawCentredString(x + cw/2, y + ch - bandh + 18, name)
        # body
        c.setFillColor(DARK)
        c.setFont("LS", 17)
        ln = wrap(body, "LS", 17, cw - 40)
        yy = y + ch - bandh - 40
        for l in ln:
            c.drawCentredString(x + cw/2, yy, l)
            yy -= 24
    # arrows
    c.setFillColor(RED)
    c.setFont("LSB", 34)
    for i in range(n-1):
        ax = xs[i] + cw + arrow/2
        c.drawCentredString(ax, y + ch/2 - 12, "→")

# ---------------------------------------------------------------- SLIDE 7
def slide7(c):
    header(c, "MVP: что уже работает")
    items = [
        "3D-модель здания со всеми этажами и зонами",
        "Клик на зону — описание, тип, текущие события",
        "Переключение между этажами",
        "Маршрут до любого мероприятия",
        "Составной маршрут по нескольким точкам",
        "Обходной маршрут по всем текущим событиям",
        "Поиск по названию зоны или мероприятия",
        "Афиша событий внутри карты",
        "Рекомендации товаров из магазина по теме события",
        "ИИ-помощник — навигация, история, программа Центра",
        "Физический прототип навигационной стойки с буклетами",
    ]
    col_x = [MX, 500]
    colw = 420
    rowh = 64
    top = H - 150
    left = items[:6]
    right = items[6:]
    for col, group in zip(col_x, [left, right]):
        y = top
        for it in group:
            cy = y - rowh + 18
            rrect(c, col, y - rowh + 6, colw, rowh - 14, 10, fill=TINT)
            draw_check(c, col + 16, cy + 6, 16)
            c.setFillColor(DARK)
            c.setFont("LS", 16)
            ln = wrap(it, "LS", 16, colw - 70)
            ty = cy + (6 if len(ln) == 1 else 14)
            for l in ln:
                c.drawString(col + 48, ty, l)
                ty -= 19
            y -= rowh

# ---------------------------------------------------------------- SLIDE 8
def slide8(c):
    header(c, "Перспективы развития")
    items = [
        ("Детализация 3D-модели", "Точная архитектура, навигационные точки, интерьеры"),
        ("Интеграция на сайт Центра «Зотов»", "Встраивание в centrezotov.ru через iframe"),
        ("Цифровые экраны внутри здания", "Интерактивные киоски на этажах и при входе"),
        ("Индор-навигация", "Позиционирование по Wi-Fi / BLE, маршрут «в реальном времени»"),
        ("Подключение живой базы данных", "ELMA365 API → события обновляются автоматически"),
    ]
    col_x = [MX, 500]
    colw = 420
    top = H - 145
    blockh = 118
    layout = [(0, col_x[0], 0), (1, col_x[0], 1), (2, col_x[0], 2),
              (3, col_x[1], 0), (4, col_x[1], 1)]
    for idx, x, row in layout:
        title, sub = items[idx]
        y = top - row*blockh
        # number badge
        r = 17
        cxb, cyb = x + r, y - r - 2
        c.setFillColor(RED)
        c.circle(cxb, cyb, r, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("LSB", 18)
        c.drawCentredString(cxb, cyb - 7, str(idx + 1))
        # title
        c.setFillColor(DARK)
        c.setFont("LSB", 18)
        tx = x + 2*r + 16
        c.drawString(tx, y - 14, title)
        # sub
        c.setFillColor(GRAY)
        c.setFont("LS", 14)
        ln = wrap(sub, "LS", 14, colw - (2*r + 16))
        sy = y - 36
        for l in ln:
            c.drawString(tx, sy, l)
            sy -= 18

# ---------------------------------------------------------------- SLIDE 9
def slide9(c):
    header(c, "Ссылки и контакты")
    # left column
    lx = MX
    c.setFillColor(RED)
    c.setFont("LSB", 18)
    c.drawString(lx, H - 150, "GitHub")
    c.setFillColor(DARK)
    c.setFont("LS", 14)
    url = "https://github.com/yotisha842/ZotovNavigator/blob/main/docs/presentation.md"
    for i, l in enumerate(wrap(url, "LS", 14, 470)):
        c.drawString(lx, H - 174 - i*19, l)

    c.setFillColor(RED)
    c.setFont("LSB", 18)
    c.drawString(lx, H - 246, "Telegram")
    handles = ["@yotishaa", "@sonyachibis", "@speqq", "@Crefxx", "@angelinamadatyan"]
    # pills
    px, py = lx, H - 282
    pad = 14
    ph = 30
    gap = 12
    maxw = 470
    c.setFont("LS", 15)
    for hd in handles:
        tw = pdfmetrics.stringWidth(hd, "LS", 15)
        pw = tw + 2*pad
        if px + pw > lx + maxw:
            px = lx
            py -= ph + gap
        rrect(c, px, py - ph, pw, ph, ph/2, fill=TINT, stroke=TINT2, lw=1)
        c.setFillColor(DARK)
        c.drawString(px + pad, py - ph + 9, hd)
        px += pw + gap

    # QR right
    qr = ImageReader(f"{BASE}/assets/qr.png")
    qs = 270
    qx = W - MX - qs
    qy = 70
    c.drawImage(qr, qx, qy, width=qs, height=qs, mask='auto')
    c.setFillColor(GRAY)
    c.setFont("LS", 14)
    c.drawCentredString(qx + qs/2, qy - 24, "QR-код на веб-приложение")

# ---------------------------------------------------------------- BUILD
out = f"{BASE}/_new_pages.pdf"
c = canvas.Canvas(out, pagesize=(W, H))
for fn in [slide4, slide5, slide7, slide8, slide9]:
    fn(c)
    c.showPage()
c.save()
print("written", out)
