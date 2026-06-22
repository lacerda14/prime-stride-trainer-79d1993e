import { useRef, useState } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateAvatarUrl } from "@/lib/profile.functions";

// Recorta no centro (quadrado), redimensiona pra no máx `max` px e devolve um
// JPEG leve (~quality 0.85). Respeita a orientação EXIF (foto não vem deitada).
async function resizeToJpeg(file: File, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
    createImageBitmap(file),
  );
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const out = Math.min(max, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Não foi possível processar a imagem."))),
      "image/jpeg",
      0.85,
    ),
  );
}

/** Avatar tocável com upload. O arquivo vai pro bucket `avatars/{uid}/` (RLS) e a
 *  URL pública é persistida via updateAvatarUrl. Funciona na web e no app (o
 *  <input type=file> abre o picker nativo de fotos no iOS/Android). */
export function AvatarUpload({
  uid,
  currentUrl,
  name,
  size = 96,
  onUpdated,
}: {
  uid: string | null | undefined;
  currentUrl: string | null | undefined;
  name?: string | null;
  size?: number;
  onUpdated?: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const save = useServerFn(updateAvatarUrl);
  const url = preview ?? currentUrl ?? null;
  const initial = (name ?? "").trim().charAt(0).toUpperCase();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (!uid) {
      toast.error("Carregando seu perfil, tente de novo em 1s.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    setBusy(true);
    try {
      const blob = await resizeToJpeg(file, 512);
      const path = `${uid}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      await save({ data: { avatar_url: publicUrl } });
      setPreview(publicUrl);
      onUpdated?.(publicUrl);
      toast.success("Foto atualizada!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        className="relative shrink-0 rounded-full transition active:scale-95"
        style={{ width: size, height: size }}
        aria-label="Trocar foto de perfil"
      >
        <div className="h-full w-full overflow-hidden rounded-full border border-border bg-surface-elevated ring-1 ring-white/10">
          {url ? (
            <img src={url} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              {initial ? (
                <span className="text-2xl font-semibold text-primary">{initial}</span>
              ) : (
                <User className="h-1/2 w-1/2 text-primary" />
              )}
            </div>
          )}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </>
  );
}
