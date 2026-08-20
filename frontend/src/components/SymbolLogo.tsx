import { useEffect, useRef, useState } from "react";
import { logoUrl, monoColor, monoText } from "../lib/logos";

// Logo d'un symbole : vraie image si trouvée, sinon monogramme coloré (fallback garanti).
// Le fournisseur renvoie un placeholder 100×100 (HTTP 200) quand il n'a pas le logo → on le
// rejette par la taille (vrais logos ≥ 250px). onLoad ne se déclenchant pas pour les images
// déjà en cache, on revérifie aussi au montage via la ref.
export default function SymbolLogo({ symbol, size = 22 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const check = () => {
    const im = imgRef.current;
    if (im && im.complete && im.naturalWidth > 0 && im.naturalWidth < 128) setFailed(true);
  };
  useEffect(() => { check(); }, []);

  if (failed) {
    return (
      <span
        className="wl-logo wl-logo-mono"
        style={{ width: size, height: size, background: monoColor(symbol), fontSize: Math.round(size * 0.42) }}
        aria-hidden="true"
      >
        {monoText(symbol)}
      </span>
    );
  }
  return (
    <img
      ref={imgRef} className="wl-logo" src={logoUrl(symbol)} alt="" width={size} height={size}
      onError={() => setFailed(true)} onLoad={check}
    />
  );
}
