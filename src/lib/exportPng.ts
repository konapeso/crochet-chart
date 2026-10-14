/** 画像に書き込む毛糸の行 */
export type PngYarnRow = { hex: string; label: string; detail: string; short: boolean };

/** iOS の canvas の上限（約1670万画素）に余裕を持たせる */
const MAX_PIXELS = 12_000_000;
const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", system-ui, -apple-system, sans-serif';

/**
 * 表示中の編み図（SVG）を PNG にする。拡大・スクロールの状態や重ね描き（data-export-exclude）は含めず、
 * 全体を描いて、上にタイトル、下に配色表と記号の説明を付ける。
 */
export async function exportChartPng(opts: {
  svg: SVGSVGElement;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  yarns: PngYarnRow[];
  legend: string;
}): Promise<Blob> {
  const { svg, width, height, title, subtitle, yarns, legend } = opts;
  const scale = Math.max(1, Math.min(3, Math.sqrt(MAX_PIXELS / (width * (height + 200 + yarns.length * 30)))));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-export-exclude]").forEach((el) => el.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("width", String(width * scale));
  clone.setAttribute("height", String(height * scale));
  clone.removeAttribute("class");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
  } finally {
    URL.revokeObjectURL(url);
  }

  const pad = 16 * scale;
  const header = 56 * scale;
  const rowH = 28 * scale;
  const footer = pad + yarns.length * rowH + 40 * scale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(header + height * scale + footer);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を作れませんでした");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#18181b";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${18 * scale}px ${FONT}`;
  ctx.fillText(title, pad, 26 * scale);
  ctx.fillStyle = "#52525b";
  ctx.font = `${12 * scale}px ${FONT}`;
  ctx.fillText(subtitle, pad, 46 * scale);

  ctx.drawImage(img, 0, header, width * scale, height * scale);

  let y = header + height * scale + pad;
  ctx.textBaseline = "middle";
  for (const row of yarns) {
    const cy = y + rowH / 2;
    ctx.beginPath();
    ctx.arc(pad + 9 * scale, cy, 9 * scale, 0, Math.PI * 2);
    ctx.fillStyle = row.hex;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = scale;
    ctx.stroke();
    ctx.fillStyle = "#18181b";
    ctx.font = `${13 * scale}px ${FONT}`;
    ctx.fillText(row.label, pad + 26 * scale, cy);
    ctx.textAlign = "right";
    ctx.fillStyle = row.short ? "#b91c1c" : "#52525b";
    ctx.fillText(row.detail + (row.short ? "（不足）" : ""), canvas.width - pad, cy);
    ctx.textAlign = "left";
    y += rowH;
  }
  ctx.fillStyle = "#71717a";
  ctx.font = `${11 * scale}px ${FONT}`;
  ctx.fillText(legend, pad, y + 20 * scale);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像を作れませんでした"))), "image/png"));
}
