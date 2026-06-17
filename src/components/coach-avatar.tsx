import { useState } from "react";

// Avatar do coach: mostra a foto (avatar_url) e cai pro emoji se faltar/erro.
export function CoachAvatar({
  url,
  emoji,
  size = "h-11 w-11",
  text = "text-2xl",
  round = false,
  className = "",
}: {
  url?: string | null;
  emoji?: string | null;
  size?: string;
  text?: string;
  round?: boolean;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  const showImg = !!url && ok;
  return (
    <div
      className={`${size} shrink-0 overflow-hidden ${round ? "rounded-full" : "rounded-xl"} border border-border/40 bg-surface/60 ${className}`}
    >
      {showImg ? (
        <img
          src={url!}
          alt=""
          loading="lazy"
          onError={() => setOk(false)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${text}`}>
          {emoji ?? "🤖"}
        </div>
      )}
    </div>
  );
}
