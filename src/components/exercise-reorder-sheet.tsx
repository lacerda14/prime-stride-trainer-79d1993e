import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Check, Lock } from "lucide-react";

export interface ReorderItem {
  id: string; // exerciseIndex como string
  name: string;
  setsInfo: string; // "3 séries · 8-12 reps"
  done: boolean;
}

interface Props {
  open: boolean;
  items: ReorderItem[];
  onClose: () => void;
  onApply: (newOrder: string[]) => void;
}

export function ExerciseReorderSheet({ open, items, onClose, onApply }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-strong w-full max-w-[480px] rounded-t-3xl border-t border-border p-5 pb-[max(env(safe-area-inset-bottom),20px)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Reordenar treino</div>
            <h3 className="mt-1 text-base font-semibold tracking-tight">Arraste para mudar a ordem</h3>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ReorderList items={items} onApply={onApply} onClose={onClose} />
      </div>
    </div>
  );
}

function ReorderList({ items, onApply, onClose }: { items: ReorderItem[]; onApply: Props["onApply"]; onClose: () => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // separa concluídos (fixos no topo) e ativos (arrastáveis)
  const fixed = items.filter((i) => i.done);
  const active = items.filter((i) => !i.done);

  function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIdx = active.findIndex((i) => i.id === a.id);
    const newIdx = active.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(active, oldIdx, newIdx);
    const newOrder = [...fixed, ...reordered].map((i) => i.id);
    onApply(newOrder);
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {fixed.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-surface/30 px-3 py-3 opacity-60">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{it.name}</div>
                <div className="text-[11px] text-muted-foreground">Concluído</div>
              </div>
              <Check className="h-4 w-4 text-primary" />
            </li>
          ))}
          <SortableContext items={active.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {active.map((it) => (
              <SortableRow key={it.id} item={it} />
            ))}
          </SortableContext>
        </ul>
      </DndContext>
      <button onClick={onClose} className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow">
        Pronto
      </button>
    </>
  );
}

function SortableRow({ item }: { item: ReorderItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex touch-none items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-surface"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold tracking-tight">{item.name}</div>
        <div className="text-[11px] text-muted-foreground">{item.setsInfo}</div>
      </div>
    </li>
  );
}
