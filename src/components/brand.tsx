/**
 * Garnet emblem: a rhombic dodecahedron (the natural crystal habit of garnet) viewed down its
 * three-fold axis — a hexagon resolved into three rhombic facets. Original geometry.
 */
export function Emblem({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M16 2 28.1 9v14L16 30 3.9 23V9Z" fill="#982E48" />
      <path d="M16 2 28.1 9 16 16 3.9 9Z" fill="#B7455D" />
      <path d="M16 16 28.1 9v14L16 30Z" fill="#6F2034" />
      <path d="M16 2 28.1 9v14L16 30 3.9 23V9Z" fill="none" stroke="#E68B9B" strokeOpacity=".55" strokeWidth=".8" />
      <path d="M16 16v14M16 16 3.9 9M16 16l12.1-7" stroke="#F7EFEA" strokeOpacity=".35" strokeWidth=".6" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Emblem />
      <span className="font-serif text-[1.35rem] leading-none tracking-[-0.01em]">Garnet</span>
    </span>
  );
}
