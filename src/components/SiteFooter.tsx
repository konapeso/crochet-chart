import { CrochetHook, StitchDivider, YarnBall } from "./Decorations";

export function SiteFooter() {
  return (
    <footer className="mt-8 bg-sage px-4 pt-6 pb-10 text-center text-cream">
      <StitchDivider className="text-sage-light" />
      <div className="mt-4 flex items-center justify-center gap-3">
        <YarnBall size={28} color="#e3dc84" />
        <p className="font-display text-xl">Happy crocheting!</p>
        <CrochetHook size={28} color="#cf7569" />
      </div>
      <p className="mt-2 text-xs text-sage-light">毛糸とかぎ針と、すきな絵で。</p>
    </footer>
  );
}
