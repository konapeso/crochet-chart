export type Yarn = {
  id: string;
  name: string;
  hex: string;
};

/** 仮のパレット（次の PR で毛糸在庫と連携する） */
export const PROVISIONAL_PALETTE: Yarn[] = [
  { id: "daily-wool-blend-6", name: "デイリーウールブレンド 6", hex: "#4a6e70" },
  { id: "amiami-33", name: "アミーアミー 33", hex: "#7e3f60" },
  { id: "acrylic-namibuto-203", name: "アクリル並太 203", hex: "#cc3a5c" },
  { id: "daiso-polyester-rpb2", name: "ポリエステル毛糸 RPB2 ベリー", hex: "#b88aa3" },
  { id: "off-white", name: "オフホワイト（仮）", hex: "#f2eee6" },
];

/** 方眼編み（単色）の描画色 */
export const FILET_INK = "#27272a";
