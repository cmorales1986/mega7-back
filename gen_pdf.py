"""
Generador de PDF — Manual de Usuario Mega7 ERP
Requiere: reportlab >= 4.0
"""
import re
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, NextPageTemplate
)
from reportlab.pdfgen import canvas as pdfcanvas

# ── Colores ───────────────────────────────────────────────────────────────────
GOLD        = colors.HexColor("#B8860B")
GOLD_LIGHT  = colors.HexColor("#F5E6C0")
GOLD_DARK   = colors.HexColor("#8B6508")
SLATE_DARK  = colors.HexColor("#1E293B")
SLATE_MID   = colors.HexColor("#334155")
SLATE_LIGHT = colors.HexColor("#64748B")
SLATE_BG    = colors.HexColor("#F8FAFC")
BORDER      = colors.HexColor("#E2E8F0")
WHITE       = colors.white
BLUE_INFO   = colors.HexColor("#1D4ED8")
BLUE_BG     = colors.HexColor("#EFF6FF")
CODE_BG     = colors.HexColor("#F1F5F9")

PAGE_W, PAGE_H = A4
ML = 2.2 * cm
MR = 2.2 * cm
MT = 2.5 * cm
MB = 2.5 * cm
CONTENT_W = PAGE_W - ML - MR


# ── Canvas callbacks ──────────────────────────────────────────────────────────
def on_cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(SLATE_DARK)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 0, w, 1.0 * cm, fill=1, stroke=0)
    canvas.rect(0, h - 0.5 * cm, w, 0.5 * cm, fill=1, stroke=0)
    canvas.restoreState()


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header
    canvas.setFillColor(SLATE_DARK)
    canvas.rect(0, h - 1.35 * cm, w, 1.35 * cm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 1.5 * cm, w, 0.15 * cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(ML, h - 0.95 * cm, "MEGA7 ERP")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GOLD_LIGHT)
    canvas.drawRightString(w - MR, h - 0.95 * cm, "Manual de Usuario — v2.0")
    # Footer
    canvas.setFillColor(SLATE_DARK)
    canvas.rect(0, 0, w, 1.05 * cm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 1.05 * cm, w, 0.12 * cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(ML, 0.35 * cm, "christtian.morales@gmail.com")
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawCentredString(w / 2, 0.35 * cm, f"Página {doc.page}")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - MR, 0.35 * cm, "© 2026 Mega7 ERP")
    canvas.restoreState()


# ── Estilos ───────────────────────────────────────────────────────────────────
def S(name, **kw):
    return ParagraphStyle(name, **kw)


STYLES = {
    "normal": S("normal", fontName="Helvetica", fontSize=9.5, leading=14,
                textColor=SLATE_MID, spaceAfter=4, alignment=TA_JUSTIFY),
    "h1":     S("h1", fontName="Helvetica-Bold", fontSize=15, leading=19,
                textColor=WHITE, spaceBefore=0, spaceAfter=0),
    "h2":     S("h2", fontName="Helvetica-Bold", fontSize=12, leading=16,
                textColor=GOLD_DARK, spaceBefore=14, spaceAfter=4),
    "h3":     S("h3", fontName="Helvetica-Bold", fontSize=10.5, leading=14,
                textColor=SLATE_DARK, spaceBefore=10, spaceAfter=4),
    "h4":     S("h4", fontName="Helvetica-BoldOblique", fontSize=9.5, leading=13,
                textColor=SLATE_MID, spaceBefore=8, spaceAfter=3),
    "bullet": S("bullet", fontName="Helvetica", fontSize=9.5, leading=14,
                textColor=SLATE_MID, leftIndent=16, spaceAfter=2),
    "num":    S("num", fontName="Helvetica", fontSize=9.5, leading=14,
                textColor=SLATE_MID, leftIndent=16, spaceAfter=2),
    "code":   S("code", fontName="Courier", fontSize=8, leading=11,
                textColor=SLATE_DARK, leftIndent=0, spaceAfter=1),
    "note":   S("note", fontName="Helvetica-Oblique", fontSize=9, leading=13,
                textColor=SLATE_MID),
    "th":     S("th", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=WHITE),
    "td":     S("td", fontName="Helvetica", fontSize=8.5, leading=12, textColor=SLATE_MID),
    "tdb":    S("tdb", fontName="Helvetica-Bold", fontSize=8.5, leading=12, textColor=SLATE_DARK),
    "toc0":   S("toc0", fontName="Helvetica-Bold", fontSize=10.5, leading=15,
                textColor=SLATE_DARK, spaceAfter=3),
    "toc1":   S("toc1", fontName="Helvetica", fontSize=9, leading=13,
                textColor=SLATE_LIGHT, leftIndent=16, spaceAfter=2),
    "cover_title": S("ct", fontName="Helvetica-Bold", fontSize=60, leading=64,
                     textColor=GOLD, alignment=TA_CENTER),
    "cover_sub":   S("cs", fontName="Helvetica", fontSize=22, leading=26,
                     textColor=GOLD_LIGHT, alignment=TA_CENTER),
    "cover_label": S("cl", fontName="Helvetica", fontSize=14, leading=18,
                     textColor=WHITE, alignment=TA_CENTER),
    "cover_info":  S("ci", fontName="Helvetica", fontSize=10, leading=15,
                     textColor=GOLD_LIGHT),
}


# ── Helpers de formato inline ─────────────────────────────────────────────────
def inline(text):
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<b><i>\1</i></b>', text)
    text = re.sub(r'\*\*(.+?)\*\*',     r'<b>\1</b>',         text)
    text = re.sub(r'\*(.+?)\*',         r'<i>\1</i>',         text)
    text = re.sub(r'`([^`]+)`',
                  r'<font name="Courier" color="#B8860B" size="8">\1</font>', text)
    # safe ampersand
    text = text.replace('&', '&amp;')
    for ent in ('lt','gt','amp','quot','nbsp','bull'):
        text = text.replace(f'&amp;{ent};', f'&{ent};')
    return text


def h1_block(text):
    """Barra de sección con fondo oscuro y borde dorado inferior."""
    p = Paragraph(f'<b>{inline(text)}</b>', STYLES["h1"])
    tbl = Table([[p]], colWidths=[CONTENT_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), SLATE_DARK),
        ("LEFTPADDING",  (0,0),(-1,-1), 10),
        ("RIGHTPADDING", (0,0),(-1,-1), 10),
        ("TOPPADDING",   (0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("LINEBELOW",    (0,0),(-1,-1), 2.5, GOLD),
    ]))
    return tbl


def note_block(text):
    note_style = S("note_inner", fontName="Helvetica-Oblique", fontSize=9,
                   leading=13, textColor=SLATE_MID)
    data = [[Paragraph(f"<b>Nota:</b> {inline(text)}", note_style)]]
    tbl = Table(data, colWidths=[CONTENT_W])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), BLUE_BG),
        ("LINEBEFORE",   (0,0),(0,-1),  3, BLUE_INFO),
        ("LEFTPADDING",  (0,0),(-1,-1), 10),
        ("RIGHTPADDING", (0,0),(-1,-1), 10),
        ("TOPPADDING",   (0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
    ]))
    return tbl


def code_block(lines_list):
    rows = []
    for cl in lines_list:
        esc = cl.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        rows.append([Paragraph(esc or " ", STYLES["code"])])
    tbl = Table(rows, colWidths=[CONTENT_W - 0.4*cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), CODE_BG),
        ("LEFTPADDING",  (0,0),(-1,-1), 8),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
        ("TOPPADDING",   (0,0),(-1,-1), 2),
        ("BOTTOMPADDING",(0,0),(-1,-1), 2),
        ("LINEBEFORE",   (0,0),(0,-1),  3, GOLD),
        ("BOX",          (0,0),(-1,-1), 0.5, BORDER),
    ]))
    return tbl


def md_table(rows):
    n_cols = max(len(r) for r in rows)
    avail  = CONTENT_W
    # Heurística: primera columna 30%, resto equitativo
    if n_cols == 1:
        col_ws = [avail]
    elif n_cols == 2:
        col_ws = [avail * 0.35, avail * 0.65]
    elif n_cols == 3:
        col_ws = [avail * 0.25, avail * 0.45, avail * 0.30]
    else:
        col_ws = [avail / n_cols] * n_cols

    formatted = []
    for ri, row in enumerate(rows):
        # Normalizar longitud de fila
        while len(row) < n_cols:
            row.append("")
        if ri == 0:
            formatted.append([Paragraph(f'<b>{inline(c)}</b>', STYLES["th"]) for c in row])
        else:
            frow = []
            for ci, c in enumerate(row):
                style = STYLES["tdb"] if (ci == 0 and "**" in c) else STYLES["td"]
                frow.append(Paragraph(inline(c), style))
            formatted.append(frow)

    tbl = Table(formatted, colWidths=col_ws, repeatRows=1)
    cmds = [
        ("BACKGROUND",   (0,0),(-1,0),  SLATE_DARK),
        ("TEXTCOLOR",    (0,0),(-1,0),  WHITE),
        ("ALIGN",        (0,0),(-1,-1), "LEFT"),
        ("VALIGN",       (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",  (0,0),(-1,-1), 7),
        ("RIGHTPADDING", (0,0),(-1,-1), 7),
        ("TOPPADDING",   (0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("GRID",         (0,0),(-1,-1), 0.4, BORDER),
        ("LINEBELOW",    (0,0),(-1,0),  1.5, GOLD),
    ]
    for ri in range(1, len(formatted)):
        bg = SLATE_BG if ri % 2 == 0 else WHITE
        cmds.append(("BACKGROUND", (0,ri),(-1,ri), bg))
    tbl.setStyle(TableStyle(cmds))
    return tbl


# ── Parser Markdown → flowables ───────────────────────────────────────────────
def parse(md_text):
    story   = []
    lines   = md_text.splitlines()
    i       = 0
    n       = len(lines)
    in_code = False
    code_buf= []
    tbl_buf = []
    in_tbl  = False

    def flush_table():
        if tbl_buf:
            story.append(Spacer(1,4))
            story.append(md_table(tbl_buf))
            story.append(Spacer(1,8))
        tbl_buf.clear()

    while i < n:
        line = lines[i]

        # ── Código ────────────────────────────────────────────────────────────
        if line.startswith("```"):
            if in_tbl:
                flush_table()
                in_tbl = False
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                story.append(Spacer(1,4))
                story.append(code_block(code_buf))
                story.append(Spacer(1,6))
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # ── Tablas ────────────────────────────────────────────────────────────
        if line.startswith("|"):
            if re.match(r'^\|[-| :]+\|$', line.strip()):
                i += 1
                continue
            in_tbl = True
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            tbl_buf.append(cells)
            i += 1
            continue
        else:
            if in_tbl:
                flush_table()
                in_tbl = False

        # ── HR ────────────────────────────────────────────────────────────────
        if line.strip() in ("---","***","___"):
            story.append(HRFlowable(width="100%", thickness=0.5,
                                    color=BORDER, spaceAfter=3, spaceBefore=3))
            i += 1
            continue

        # ── Encabezados ───────────────────────────────────────────────────────
        m1 = re.match(r'^# (.+)',    line)
        m2 = re.match(r'^## (.+)',   line)
        m3 = re.match(r'^### (.+)',  line)
        m4 = re.match(r'^#### (.+)', line)

        if m1:
            story.append(Spacer(1, 8))
            story.append(h1_block(m1.group(1)))
            story.append(Spacer(1, 6))
            i += 1; continue
        if m2:
            story.append(Spacer(1, 4))
            story.append(Paragraph(inline(m2.group(1)), STYLES["h2"]))
            story.append(HRFlowable(width="35%", thickness=1.5, color=GOLD,
                                    spaceAfter=3, spaceBefore=0, hAlign="LEFT"))
            i += 1; continue
        if m3:
            story.append(Paragraph(inline(m3.group(1)), STYLES["h3"]))
            i += 1; continue
        if m4:
            story.append(Paragraph(inline(m4.group(1)), STYLES["h4"]))
            i += 1; continue

        # ── Notas ─────────────────────────────────────────────────────────────
        nm = re.match(r'^> (.+)', line)
        if nm:
            story.append(note_block(nm.group(1)))
            story.append(Spacer(1, 4))
            i += 1; continue

        # ── Listas ────────────────────────────────────────────────────────────
        bm = re.match(r'^(\s*)[-*] (.+)', line)
        om = re.match(r'^(\s*)(\d+)\. (.+)', line)
        if bm:
            indent = len(bm.group(1))
            li = indent * 10 + 14
            p = Paragraph(
                f'<bullet bulletIndent="{li-10}">&bull;</bullet>{inline(bm.group(2))}',
                S("bl", fontName="Helvetica", fontSize=9.5, leading=14,
                  textColor=SLATE_MID, leftIndent=li, spaceAfter=2)
            )
            story.append(p)
            i += 1; continue
        if om:
            indent = len(om.group(1))
            num    = om.group(2)
            text   = om.group(3)
            li     = indent * 10 + 18
            p = Paragraph(
                f'<bullet bulletIndent="{li-14}"><b>{num}.</b></bullet>{inline(text)}',
                S("nl", fontName="Helvetica", fontSize=9.5, leading=14,
                  textColor=SLATE_MID, leftIndent=li, spaceAfter=2)
            )
            story.append(p)
            i += 1; continue

        # ── Línea vacía ───────────────────────────────────────────────────────
        if not line.strip():
            story.append(Spacer(1, 3))
            i += 1; continue

        # ── Párrafo normal ────────────────────────────────────────────────────
        story.append(Paragraph(inline(line), STYLES["normal"]))
        i += 1

    if in_tbl:
        flush_table()

    return story


# ── Portada ───────────────────────────────────────────────────────────────────
def cover_story():
    els = []
    els.append(Spacer(1, 5.5 * cm))

    # Título MEGA7
    t = Table([[Paragraph("<b>MEGA7</b>", STYLES["cover_title"])]],
              colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.transparent)]))
    els.append(t)
    els.append(Spacer(1, 0.25*cm))

    # ERP
    t2 = Table([[Paragraph("ERP", STYLES["cover_sub"])]],
               colWidths=[CONTENT_W])
    t2.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.transparent)]))
    els.append(t2)
    els.append(Spacer(1, 0.5*cm))

    # Línea dorada
    ht = Table([[""]],colWidths=[9*cm], hAlign="CENTER")
    ht.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),2,GOLD)]))
    els.append(ht)
    els.append(Spacer(1, 0.5*cm))

    # Subtítulo
    t3 = Table([[Paragraph("Manual de Usuario", STYLES["cover_label"])]],
               colWidths=[CONTENT_W])
    t3.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.transparent)]))
    els.append(t3)
    els.append(Spacer(1, 3.0*cm))

    # Caja de información
    info_rows = [
        [Paragraph("<b>Versión:</b>  2.0", STYLES["cover_info"])],
        [Paragraph("<b>Fecha:</b>  25 de Junio de 2026", STYLES["cover_info"])],
        [Paragraph("<b>Stack:</b>  Next.js + .NET 8 + PostgreSQL", STYLES["cover_info"])],
        [Paragraph("<b>Soporte:</b>  christtian.morales@gmail.com", STYLES["cover_info"])],
    ]
    ib = Table(info_rows, colWidths=[10*cm], hAlign="CENTER")
    ib.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), colors.HexColor("#2D3748")),
        ("BOX",          (0,0),(-1,-1), 1, GOLD),
        ("LEFTPADDING",  (0,0),(-1,-1), 16),
        ("RIGHTPADDING", (0,0),(-1,-1), 16),
        ("TOPPADDING",   (0,0),(-1,-1), 9),
        ("BOTTOMPADDING",(0,0),(-1,-1), 9),
    ]))
    els.append(ib)
    els.append(PageBreak())
    return els


# ── Tabla de Contenido manual ─────────────────────────────────────────────────
TOC_ENTRIES = [
    (0, "1.  Acceso al Sistema"),
    (0, "2.  Dashboard"),
    (0, "3.  Períodos Contables"),
    (0, "4.  Socios de Negocio"),
    (0, "5.  Productos y Catálogo"),
    (0, "6.  Inventario"),
    (1, "6.1  Almacenes"),
    (1, "6.2  Stock Actual"),
    (1, "6.3  Entradas de Stock"),
    (1, "6.4  Salidas de Stock"),
    (1, "6.5  Transferencias de Stock"),
    (1, "6.6  Lotes y Series"),
    (0, "7.  Ventas"),
    (1, "7.1  Pedidos de Venta"),
    (1, "7.2  Facturas de Venta"),
    (1, "7.3  Cuentas por Cobrar (CxC)"),
    (1, "7.4  Cobros — Pagos Recibidos"),
    (0, "8.  Compras"),
    (1, "8.1  Órdenes de Compra"),
    (1, "8.2  Recepciones de Compra"),
    (1, "8.3  Facturas de Servicios"),
    (1, "8.4  Facturas de Compra por Estado"),
    (1, "8.5  Pagos a Proveedores"),
    (0, "9.  Finanzas"),
    (1, "9.1  Cajas"),
    (1, "9.2  Bancos y Cuentas Bancarias"),
    (1, "9.3  Depósitos Bancarios"),
    (0, "10. Contabilidad"),
    (1, "10.1  Plan de Cuentas"),
    (1, "10.2  Libro Diario"),
    (1, "10.3  Contabilidad Automática"),
    (1, "10.4  Configuración Contable"),
    (1, "10.5  Balance de Comprobación"),
    (1, "10.6  Libro Mayor"),
    (1, "10.7  Estado de Resultados"),
    (1, "10.8  Balance General"),
    (0, "11. Panel de Reportes"),
    (0, "12. Configuración del Sistema"),
    (0, "13. Gestión de Permisos"),
    (0, "14. Administración de Usuarios"),
    (0, "15. Reglas Generales del Sistema"),
    (0, "16. Apéndice Técnico"),
]


def toc_story():
    els = []
    # Barra de título
    tbar = Table([[Paragraph("<b>Tabla de Contenido</b>",
                             S("tb", fontName="Helvetica-Bold", fontSize=14,
                               leading=18, textColor=WHITE))]],
                 colWidths=[CONTENT_W])
    tbar.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), SLATE_DARK),
        ("LEFTPADDING",  (0,0),(-1,-1), 10),
        ("TOPPADDING",   (0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("LINEBELOW",    (0,0),(-1,-1), 2, GOLD),
    ]))
    els.append(tbar)
    els.append(Spacer(1, 10))

    for level, label in TOC_ENTRIES:
        style = STYLES["toc0"] if level == 0 else STYLES["toc1"]
        els.append(Paragraph(label, style))

    els.append(PageBreak())
    return els


# ── Documento ─────────────────────────────────────────────────────────────────
def main():
    src  = Path(r"E:\DESARROLLO\Proyectos old\Mega7\MANUAL.md")
    dest = Path(r"E:\DESARROLLO\Proyectos old\Mega7\MANUAL_Mega7.pdf")

    md = src.read_text(encoding="utf-8")

    # Encontrar inicio del contenido real (sección 1)
    lines = md.splitlines()
    start = 0
    for idx, line in enumerate(lines):
        if line.startswith("## 1."):
            start = idx
            break
    content_md = "\n".join(lines[start:])

    # Armar historia
    story = []
    story += cover_story()
    story += toc_story()
    story += parse(content_md)

    # Documento con dos templates de página
    doc = BaseDocTemplate(
        str(dest),
        pagesize=A4,
        leftMargin=ML, rightMargin=MR,
        topMargin=MT + 1.0*cm,   # extra para header
        bottomMargin=MB + 0.8*cm, # extra para footer
    )

    frame_cover = Frame(0, 0, PAGE_W, PAGE_H, id="cover")
    frame_body  = Frame(ML, MB + 0.8*cm,
                        CONTENT_W, PAGE_H - MT - MB - 1.8*cm,
                        id="body")

    doc.addPageTemplates([
        PageTemplate(id="Cover",  frames=[frame_cover], onPage=on_cover),
        PageTemplate(id="Normal", frames=[frame_body],  onPage=on_page),
    ])

    # Las primeras 2 páginas (portada + TOC) usan Cover, luego Normal
    # Insertamos cambio de template
    story.insert(0, NextPageTemplate("Normal"))   # después de portada usa Normal
    # La portada termina con PageBreak, después TOC en Normal
    # La portada misma usa on_cover (primera página)

    doc.build(story)

    print(f"PDF generado: {dest}")
    print(f"Tamaño: {dest.stat().st_size / 1024:.0f} KB")
    print(f"Páginas aprox.: calculadas por reportlab")


if __name__ == "__main__":
    main()
