import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Check, X, Star, PlayCircle, Plus, Pencil, ShieldAlert } from "lucide-react";
import {
  getMyRole,
  listExercisesWithStatus,
  listCandidates,
  searchVideosForExercise,
  approveCandidate,
  rejectCandidate,
  setPrimaryMedia,
  addManualMedia,
  updateExerciseCues,
  type ExerciseRowDTO,
  type ExerciseMediaDTO,
} from "@/lib/exercise-media.functions";

export const Route = createFileRoute("/admin/exercise-media")({
  head: () => ({
    meta: [
      { title: "Curador de Vídeos · PM Hybrid" },
      { name: "description", content: "Admin · biblioteca de vídeos de execução" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const fetchRole = useServerFn(getMyRole);
  const { data: role, isLoading } = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });

  if (isLoading) {
    return (
      <AppShell title="Curador">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!role?.isAdmin) {
    return (
      <AppShell title="Restrito">
        <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Esta área é restrita a administradores.</p>
        </div>
      </AppShell>
    );
  }
  return <CuratorBoard />;
}

function CuratorBoard() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listExercisesWithStatus);
  const searchFn = useServerFn(searchVideosForExercise);
  const { data, isLoading } = useQuery({ queryKey: ["admin-exercises"], queryFn: () => fetchList() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"missing" | "all">("missing");
  const [search, setSearch] = useState("");

  const exercises = useMemo(() => {
    const list = data ?? [];
    const f = filter === "missing" ? list.filter((e) => !e.has_primary) : list;
    if (!search.trim()) return f;
    const s = search.toLowerCase();
    return f.filter((e) => e.name.toLowerCase().includes(s));
  }, [data, filter, search]);

  const selected = (data ?? []).find((e) => e.id === selectedId) ?? null;

  const search1 = useMutation({
    mutationFn: (exercise_id: string) => searchFn({ data: { exercise_id, max_results: 5 } }),
    onSuccess: (r) => {
      toast.success(`Agente encontrou ${r.saved} candidatos`);
      qc.invalidateQueries({ queryKey: ["admin-exercises"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const searchAll = useMutation({
    mutationFn: async () => {
      const targets = (data ?? []).filter((e) => !e.has_primary).slice(0, 10);
      let total = 0;
      for (const e of targets) {
        try {
          const r = await searchFn({ data: { exercise_id: e.id, max_results: 3 } });
          total += r.saved;
        } catch (err) {
          console.error("search failed", e.name, err);
        }
      }
      return total;
    },
    onSuccess: (n) => {
      toast.success(`Agente salvou ${n} candidatos`);
      qc.invalidateQueries({ queryKey: ["admin-exercises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Curador de Vídeos" eyebrow="Admin">
      <div className="space-y-4 px-4 pb-8 pt-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("missing")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${filter === "missing" ? "bg-primary text-primary-foreground" : "bg-surface/60 text-muted-foreground"}`}
          >
            Sem vídeo
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-surface/60 text-muted-foreground"}`}
          >
            Todos
          </button>
        </div>
        <Input placeholder="Buscar exercício..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10" />
        <Button onClick={() => searchAll.mutate()} disabled={searchAll.isPending} className="w-full" variant="outline">
          {searchAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Rodar agente nos 10 primeiros sem vídeo
        </Button>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <ul className="space-y-2">
            {exercises.map((e) => (
              <ExerciseRow
                key={e.id}
                row={e}
                onPick={() => setSelectedId(e.id)}
                onSearch={() => search1.mutate(e.id)}
                searching={search1.isPending && search1.variables === e.id}
              />
            ))}
          </ul>
        )}
      </div>

      <ExerciseDrawer exerciseId={selected?.id ?? null} exerciseName={selected?.name ?? ""} onClose={() => setSelectedId(null)} />
    </AppShell>
  );
}

function ExerciseRow({ row, onPick, onSearch, searching }: { row: ExerciseRowDTO; onPick: () => void; onSearch: () => void; searching: boolean }) {
  return (
    <li className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
      <button onClick={onPick} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold">{row.name}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {row.has_primary ? <span className="text-primary">✓ Vídeo primário</span>
            : row.approved_count > 0 ? `${row.approved_count} aprovado(s) · sem primário`
            : row.total_candidates > 0 ? `${row.total_candidates} candidato(s) pendente(s)`
            : <span className="text-muted-foreground/70">sem candidatos</span>}
        </div>
      </button>
      <Button onClick={onSearch} size="sm" variant="ghost" disabled={searching} className="h-8 w-8 p-0" aria-label="Buscar candidatos">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </Button>
    </li>
  );
}

function ExerciseDrawer({ exerciseId, exerciseName, onClose }: { exerciseId: string | null; exerciseName: string; onClose: () => void }) {
  const open = exerciseId !== null;
  const qc = useQueryClient();
  const fetchCands = useServerFn(listCandidates);
  const approve = useServerFn(approveCandidate);
  const reject = useServerFn(rejectCandidate);
  const setPrimary = useServerFn(setPrimaryMedia);
  const addManual = useServerFn(addManualMedia);
  const { data, isLoading } = useQuery({
    queryKey: ["candidates", exerciseId],
    queryFn: () => fetchCands({ data: { exercise_id: exerciseId! } }),
    enabled: open,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["candidates", exerciseId] });
    qc.invalidateQueries({ queryKey: ["admin-exercises"] });
  };
  const [manualUrl, setManualUrl] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[440px] max-h-[90vh] overflow-y-auto bg-background border-border/60">
        <DialogHeader><DialogTitle className="text-base font-semibold">{exerciseName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Nenhum candidato ainda. Use a busca do agente.</p>
          ) : (
            (data ?? []).map((c) => (
              <CandidateCard
                key={c.id}
                c={c}
                onApprove={async (set_primary) => {
                  try { await approve({ data: { media_id: c.id, set_primary } }); toast.success("Aprovado"); invalidate(); }
                  catch (e) { toast.error((e as Error).message); }
                }}
                onReject={async () => {
                  try { await reject({ data: { media_id: c.id } }); toast.success("Removido"); invalidate(); }
                  catch (e) { toast.error((e as Error).message); }
                }}
                onSetPrimary={async () => {
                  try { await setPrimary({ data: { media_id: c.id } }); toast.success("Definido como primário"); invalidate(); }
                  catch (e) { toast.error((e as Error).message); }
                }}
              />
            ))
          )}

          <div className="space-y-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Adicionar manualmente</div>
            <Input placeholder="https://youtube.com/watch?v=..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} className="h-9" />
            <Button
              size="sm"
              className="w-full"
              disabled={!manualUrl.trim() || !exerciseId}
              onClick={async () => {
                try {
                  await addManual({ data: { exercise_id: exerciseId!, url: manualUrl.trim(), set_primary: true } });
                  toast.success("Adicionado como primário");
                  setManualUrl("");
                  invalidate();
                } catch (e) { toast.error((e as Error).message); }
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar e marcar como primário
            </Button>
          </div>

          {exerciseId && <CuesEditor exerciseId={exerciseId} onSaved={invalidate} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CandidateCard({ c, onApprove, onReject, onSetPrimary }: { c: ExerciseMediaDTO; onApprove: (p: boolean) => void; onReject: () => void; onSetPrimary: () => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
      <div className="flex items-start gap-3">
        <button onClick={() => setPreview((p) => !p)} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-elevated">
          {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <PlayCircle className="m-auto h-6 w-6 text-muted-foreground" />}
          <PlayCircle className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-xs font-semibold leading-snug">{c.title}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {c.channel_name ?? c.source}{c.duration_seconds ? ` · ${Math.round(c.duration_seconds / 60)}min` : ""}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${(c.source_quality_score ?? 0) >= 70 ? "bg-primary/15 text-primary" : "bg-surface-elevated text-muted-foreground"}`}>{c.source_quality_score ?? 0}/100</span>
            {c.is_approved && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">aprovado</span>}
            {c.is_primary && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">primário</span>}
            {!c.embed_allowed && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">sem embed</span>}
          </div>
          {c.reason_for_recommendation && <p className="mt-1.5 text-[11px] text-muted-foreground">{c.reason_for_recommendation}</p>}
        </div>
      </div>
      {preview && c.embed_allowed && c.embed_url && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe src={c.embed_url} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!c.is_approved ? (
          <>
            <Button size="sm" onClick={() => onApprove(false)} className="flex-1"><Check className="mr-1 h-3.5 w-3.5" /> Aprovar</Button>
            <Button size="sm" onClick={() => onApprove(true)} className="flex-1"><Star className="mr-1 h-3.5 w-3.5" /> Aprovar + primário</Button>
          </>
        ) : !c.is_primary ? (
          <Button size="sm" variant="outline" onClick={onSetPrimary} className="flex-1"><Star className="mr-1 h-3.5 w-3.5" /> Marcar como primário</Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onReject} className="text-destructive"><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function CuesEditor({ exerciseId, onSaved }: { exerciseId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [mistakes, setMistakes] = useState("");
  const update = useServerFn(updateExerciseCues);
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-3">
      {!open ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="w-full"><Pencil className="mr-2 h-3.5 w-3.5" /> Editar instruções e erros comuns</Button>
      ) : (
        <div className="space-y-2">
          <Textarea placeholder="Execução passo a passo..." value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} />
          <Textarea placeholder="Erros comuns..." value={mistakes} onChange={(e) => setMistakes(e.target.value)} rows={3} />
          <Button size="sm" className="w-full"
            onClick={async () => {
              try {
                await update({ data: { exercise_id: exerciseId, instructions: instructions || undefined, common_mistakes: mistakes || undefined } });
                toast.success("Salvo"); setOpen(false); onSaved();
              } catch (e) { toast.error((e as Error).message); }
            }}>Salvar</Button>
        </div>
      )}
    </div>
  );
}
