import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ShieldAlert,
  BookOpen,
  Upload,
  Trash2,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { getMyRole } from "@/lib/exercise-media.functions";
import {
  listKnowledgeDocs,
  deleteKnowledgeDoc,
  type KnowledgeDoc,
} from "@/lib/knowledge.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/knowledge")({
  head: () => ({
    meta: [
      { title: "Base de Conhecimento · Admin · PM Hybrid" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: KnowledgePage,
});

const SOURCE_TYPES = [
  { value: "scientific_paper", label: "Artigo Científico" },
  { value: "methodology", label: "Metodologia" },
  { value: "exercise_guide", label: "Guia de Exercícios" },
  { value: "nutrition_guide", label: "Guia Nutricional" },
  { value: "recovery_protocol", label: "Protocolo de Recuperação" },
  { value: "internal", label: "Interno" },
] as const;

type SourceType = (typeof SOURCE_TYPES)[number]["value"];

function KnowledgePage() {
  const fetchRole = useServerFn(getMyRole);
  const { data: role, isLoading } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
  });

  if (isLoading)
    return (
      <AppShell title="Base de Conhecimento">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );

  if (!role?.isAdmin)
    return (
      <AppShell title="Restrito">
        <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Esta área é restrita a administradores.</p>
        </div>
      </AppShell>
    );

  return <KnowledgeAdmin />;
}

function KnowledgeAdmin() {
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const qc = useQueryClient();

  const fetchDocs = useServerFn(listKnowledgeDocs);
  const { data: docs = [], isLoading } = useQuery<KnowledgeDoc[]>({
    queryKey: ["knowledge-docs", deferredSearch],
    queryFn: () => fetchDocs({ data: { search: deferredSearch } }),
  });

  const deleteDocFn = useServerFn(deleteKnowledgeDoc);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDocFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["knowledge-docs"] });
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    const v = e.target.value;
    setTimeout(() => setDeferredSearch(v), 400);
  }

  return (
    <AppShell title="Base de Conhecimento" eyebrow="Admin">
      <div className="px-4 py-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={handleSearch}
              className="pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>{docs.length} documento(s)</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "Nenhum documento encontrado." : "Nenhum documento ainda."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onDelete={() => deleteMut.mutate(doc.id)}
                deleting={deleteMut.isPending && deleteMut.variables === doc.id}
              />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadDialog
          onClose={() => {
            setShowUpload(false);
            qc.invalidateQueries({ queryKey: ["knowledge-docs"] });
          }}
        />
      )}
    </AppShell>
  );
}

function DocRow({
  doc,
  onDelete,
  deleting,
}: {
  doc: KnowledgeDoc;
  onDelete: () => void;
  deleting: boolean;
}) {
  const label = SOURCE_TYPES.find((s) => s.value === doc.source_type)?.label ?? doc.source_type;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 px-4 py-3 flex items-start gap-3">
      <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {label}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{doc.chunk_count} chunks</span>
          {doc.author && (
            <span className="text-[11px] text-muted-foreground truncate">{doc.author}</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={deleting}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

type UploadMode = "text" | "file";

// Bases de conhecimento: "geral" (aluno sem coach) + 1 tag por coach (persona).
// A tag marcada vira o escopo de RAG: o coach só busca na própria base + geral.
const KNOWLEDGE_BASES: { tag: string; label: string; emoji: string }[] = [
  { tag: "geral", label: "Base Geral", emoji: "📚" },
  { tag: "strength", label: "Alex (Força)", emoji: "💪" },
  { tag: "cardio", label: "Maya (Corrida)", emoji: "🏃" },
  { tag: "nutrition", label: "Nut (Nutrição)", emoji: "🥗" },
  { tag: "recovery", label: "Carlos (Recuperação)", emoji: "🧘" },
  { tag: "mindset", label: "Max (Mente)", emoji: "🧠" },
];

function UploadDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<UploadMode>("text");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("scientific_paper");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [bases, setBases] = useState<string[]>(["geral"]);
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function readFileAsText(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(f, "utf-8");
    });
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    let content = "";
    if (mode === "text") {
      content = textContent.trim();
      if (content.length < 50) {
        toast.error("Conteúdo muito curto (mínimo 50 caracteres)");
        return;
      }
    } else {
      if (!file) {
        toast.error("Selecione um arquivo");
        return;
      }
      if (file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(
          "PDFs devem ser processados via CLI:\npython3 scripts/ingest.py --vision arquivo.pdf",
          { duration: 6000 },
        );
        return;
      }
      content = await readFileAsText(file);
      if (content.length < 50) {
        toast.error("Arquivo muito curto ou vazio");
        return;
      }
    }

    setBusy(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão expirada");
      setBusy(false);
      return;
    }

    const { error } = await supabase.functions.invoke("ingest-document", {
      body: {
        title: title.trim(),
        source_type: sourceType,
        content,
        author: author.trim() || undefined,
        // bases (geral/coach) + tags livres → dedup
        tags: [
          ...new Set([
            ...bases,
            ...(tags
              ? tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              : []),
          ]),
        ],
        language: "pt-BR",
        force: true,
      },
    });

    setBusy(false);
    if (error) {
      toast.error("Erro ao processar: " + (error as Error).message);
      return;
    }
    toast.success("Documento processado com sucesso!");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex rounded-lg border border-border/60 overflow-hidden">
            {(["text", "file"] as UploadMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "text" ? "Colar texto" : "Arquivo .txt / .md"}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <Input
              placeholder="Nome do documento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Base de conhecimento
            </label>
            <div className="flex flex-wrap gap-1.5">
              {KNOWLEDGE_BASES.map((b) => {
                const on = bases.includes(b.tag);
                return (
                  <button
                    key={b.tag}
                    type="button"
                    onClick={() =>
                      setBases((prev) => (on ? prev.filter((t) => t !== b.tag) : [...prev, b.tag]))
                    }
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all ${
                      on
                        ? "border-primary/60 bg-primary/[0.12] text-foreground"
                        : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.emoji} {b.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marque os coaches que devem usar este documento. Cada coach busca só na própria base +
              na Geral.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Autor</label>
              <Input
                placeholder="Opcional"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Tags extras (vírgula)
              </label>
              <Input
                placeholder="hipertrofia, força"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          {mode === "text" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Conteúdo *</label>
              <Textarea
                placeholder="Cole o texto completo aqui..."
                rows={8}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="resize-none text-sm"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {textContent.length.toLocaleString("pt-BR")} chars
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Arquivo (.txt ou .md)
              </label>
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Toque para selecionar arquivo</p>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">
                Para PDFs:{" "}
                <code className="bg-muted px-1 rounded">
                  python3 scripts/ingest.py --vision arquivo.pdf
                </code>
              </p>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Processando..." : "Processar e salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
