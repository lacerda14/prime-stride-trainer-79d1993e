import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Check, X, Star, PlayCircle, Plus, Pencil, ShieldAlert, Zap } from "lucide-react";
import {
  getMyRole,
  listExercisesWithStatus,
  listCandidates,
  listPendingQueue,
  searchVideosForExercise,
  bulkSearchMissingVideos,
  approveCandidate,
  rejectCandidate,
  setPrimaryMedia,
  addManualMedia,
  updateExerciseCues,
  type ExerciseRowDTO,
  type ExerciseMediaDTO,
  type PendingQueueItemDTO,
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
      if (r.error) {
        toast.error(r.error.message);
        return;
      }
      toast.success(`Agente encontrou ${r.saved} candidatos`);
      qc.invalidateQueries({ queryKey: ["admin-exercises"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const missingCount = (data ?? []).filter((e) => !e.has_primary).length;

  const [tab, setTab] = useState<"exercises" | "queue">("exercises");
  const fetchQueue = useServerFn(listPendingQueue);
  const queueQ = useQuery({
    queryKey: ["pending-queue"],
    queryFn: () => fetchQueue(),
    enabled: tab === "queue",
  });
  const pendingCount = queueQ.data?.length ?? 0;

  return (
    <AppShell title="Curador de Vídeos" eyebrow="Admin">
      <div className="space-y-4 px-4 pb-8 pt-3">
        <div className="flex items-center gap-2">
          <Link
            to="/admin/users"
            className="rounded-full border border-border/60 bg-surface/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Usuários →
          </Link>
        </div>
        <div className="flex gap-1 rounded-full bg-surface/40 p-1">
          <button
            onClick={() => setTab("exercises")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${tab === "exercises" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Exercícios
          </button>
          <button
            onClick={() => setTab("queue")}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${tab === "queue" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Fila {pendingCount > 0 && <span className="ml-1 rounded-full bg-background/20 px-1.5 text-[10px]">{pendingCount}</span>}
          </button>
        </div>

        {tab === "exercises" ? (
          <>
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

            <div className="rounded-2xl border border-border/60 bg-surface/40 p-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{missingCount}</span> exercício(s) sem vídeo. Busque um por vez (ícone <Search className="inline h-3 w-3" /> na linha) ou abra o exercício e cole uma URL do YouTube em "Adicionar manualmente". A busca automática consome cota diária do YouTube (~100 buscas/dia no total).
              </p>
            </div>

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
          </>
        ) : (
          <PendingQueue
            items={queueQ.data ?? []}
            isLoading={queueQ.isLoading}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ["pending-queue"] });
              qc.invalidateQueries({ queryKey: ["admin-exercises"] });
            }}
            onOpenExercise={(id) => { setTab("exercises"); setSelectedId(id); }}
          />
        )}
      </div>

      <ExerciseDrawer exerciseId={selected?.id ?? null} exerciseName={selected?.name ?? ""} onClose={() => setSelectedId(null)} />
    </AppShell>
  );
}

function PendingQueue({
  items,
  isLoading,
  onChanged,
  onOpenExercise,
}: {
  items: PendingQueueItemDTO[];
  isLoading: boolean;
  onChanged: () => void;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const approve = useServerFn(approveCandidate);
  const reject = useServerFn(rejectCandidate);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const runBatch = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    const primaryGiven = new Set<string>();
    for (const it of items) if (it.exercise_has_primary) primaryGiven.add(it.exercise_id);
    let ok = 0;
    for (const id of ids) {
      const item = items.find((i) => i.media.id === id);
      if (!item) continue;
      const set_primary = !primaryGiven.has(item.exercise_id);
      try {
        await approve({ data: { media_id: id, set_primary } });
        if (set_primary) primaryGiven.add(item.exercise_id);
        ok++;
      } catch (e) { console.error(e); }
    }
    setBusy(false);
    setSelected(new Set());
    toast.success(`${ok} aprovado(s)`);
    onChanged();
  };

  if (isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
        <Check className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-2 text-sm font-semibold">Fila vazia</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Nenhum candidato pendente. Rode o agente para buscar mais.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/80 p-2 backdrop-blur">
        <span className="text-[11px] text-muted-foreground">
          {selected.size > 0 ? `${selected.size} de ${items.length}` : `${items.length} pendentes`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={() => runBatch(Array.from(selected))}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Aprovar selecionados
          </Button>
          <Button size="sm" disabled={busy} onClick={() => runBatch(items.map((i) => i.media.id))}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Aprovar todos
          </Button>
        </div>
      </div>

      {items.map((it) => (
        <div key={it.media.id} className="space-y-1">
          <button
            onClick={() => onOpenExercise(it.exercise_id)}
            className="flex w-full items-center justify-between px-1 text-left"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{it.exercise_name}</span>
            <span className="text-[10px] text-muted-foreground/70">abrir</span>
          </button>
          <CandidateCard
            c={it.media}
            selected={selected.has(it.media.id)}
            onToggleSelect={() => toggle(it.media.id)}
            onApprove={async (set_primary) => {
              try { await approve({ data: { media_id: it.media.id, set_primary } }); toast.success("Aprovado"); onChanged(); }
              catch (e) { toast.error((e as Error).message); }
            }}
            onReject={async () => {
              try { await reject({ data: { media_id: it.media.id } }); toast.success("Removido"); onChanged(); }
              catch (e) { toast.error((e as Error).message); }
            }}
            onSetPrimary={() => {}}
          />
        </div>
      ))}
    </div>
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // reset selection ao trocar de exercício
  useMemo(() => { setSelected(new Set()); }, [exerciseId]);

  const candidates = data ?? [];
  const approvableIds = candidates.filter((c) => !c.is_approved && c.embed_allowed).map((c) => c.id);
  const hasPrimary = candidates.some((c) => c.is_primary);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const runBatch = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    let primarySet = hasPrimary;
    for (const id of ids) {
      try {
        const set_primary = !primarySet;
        await approve({ data: { media_id: id, set_primary } });
        if (set_primary) primarySet = true;
        ok++;
      } catch (e) {
        console.error(e);
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    toast.success(`${ok} candidato(s) aprovado(s)`);
    invalidate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[440px] max-h-[90vh] overflow-y-auto bg-background border-border/60">
        <DialogHeader><DialogTitle className="text-base font-semibold">{exerciseName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {approvableIds.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface/80 p-2 backdrop-blur">
              <span className="text-[11px] text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selecionado(s)` : `${approvableIds.length} para revisar`}
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy || selected.size === 0}
                  onClick={() => runBatch(Array.from(selected))}
                >
                  {bulkBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                  Aprovar selecionados
                </Button>
                <Button
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => runBatch(approvableIds)}
                >
                  {bulkBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                  Aprovar todos
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : candidates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Nenhum candidato ainda. Use a busca do agente.</p>
          ) : (
            candidates.map((c) => (
              <CandidateCard
                key={c.id}
                c={c}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggle(c.id)}
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

function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function qualityLabel(score?: number | null): { label: string; tone: string } {
  const s = score ?? 0;
  if (s >= 80) return { label: "Excelente", tone: "bg-primary text-primary-foreground" };
  if (s >= 65) return { label: "Bom", tone: "bg-primary/15 text-primary" };
  if (s >= 45) return { label: "Médio", tone: "bg-surface-elevated text-foreground/80" };
  return { label: "Fraco", tone: "bg-destructive/15 text-destructive" };
}

function CandidateCard({ c, onApprove, onReject, onSetPrimary, selected, onToggleSelect }: { c: ExerciseMediaDTO; onApprove: (p: boolean) => void; onReject: () => void; onSetPrimary: () => void; selected?: boolean; onToggleSelect?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const selectable = !c.is_approved && c.embed_allowed && !!onToggleSelect;
  const duration = formatDuration(c.duration_seconds);
  const quality = qualityLabel(c.source_quality_score);
  const canEmbed = c.embed_allowed && !!c.embed_url;

  return (
    <div className={`space-y-2 rounded-2xl border p-3 transition ${selected ? "border-primary bg-primary/5" : "border-border/60 bg-surface/40"}`}>
      <div className="flex items-start gap-2">
        {selectable && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            aria-label="Selecionar candidato"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-xs font-semibold leading-snug">{c.title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{c.channel_name ?? c.source}</div>
        </div>
      </div>

      {canEmbed ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          {playing ? (
            <iframe
              src={`${c.embed_url}${c.embed_url!.includes("?") ? "&" : "?"}autoplay=1`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button onClick={() => setPlaying(true)} className="group relative h-full w-full">
              {c.thumbnail_url && (
                <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 backdrop-blur transition group-hover:scale-110">
                  <PlayCircle className="h-7 w-7 text-white" />
                </div>
              </div>
              {duration && (
                <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {duration}
                </span>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3 text-[11px] text-destructive">
          <X className="h-3.5 w-3.5" /> Vídeo não permite embed — student não verá
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${quality.tone}`}>
          {quality.label} · {c.source_quality_score ?? 0}/100
        </span>
        {duration && (
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
            {duration}
          </span>
        )}
        {c.is_approved && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">aprovado</span>}
        {c.is_primary && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">primário</span>}
      </div>

      {c.reason_for_recommendation && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{c.reason_for_recommendation}</p>
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
