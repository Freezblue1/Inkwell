/**
 * The whiteboard editor: an infinite SVG canvas with pen, shapes, arrows
 * (which stay attached to what they point at), sticky notes, text, frames,
 * pictures, scene cards and Story Bible cards, plus a minimap. Pan with the
 * hand tool / Space / middle mouse / wheel; Ctrl+wheel zooms at the cursor.
 * Undo/redo, keyboard shortcuts, autosave via `onSave`.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as RPointerEvent,
  type SetStateAction,
} from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ID, WbElement, Whiteboard } from '@/types/models';
import { useStore } from '@/store';
import { newId } from '@/lib/ids';
import { addAsset } from '@/db/repos/assets';
import { promptDialog } from '@/components/DialogHost';
import {
  attachableAt,
  boundaryPoint,
  containsRect,
  copyElements,
  elementBounds,
  elementsInFrame,
  FRAME_COLORS,
  paintOrder,
  routeConnectors,
  moveElement,
  normalizeRect,
  rectsIntersect,
  resizeElement,
  simplifyPoints,
  textHeight,
  topmostAt,
  unionBounds,
  DEFAULT_NOTE_TEXT,
  NOTE_COLORS,
  canRotate,
  localBounds,
  rotateElement,
  rotatePoint,
  rotationOf,
  snapAngle,
  type Point,
} from '@/lib/whiteboard';
import { WbDefsContext, WbElementView, WB_FONT } from './WbElementView';
import { TOOLS, WhiteboardToolbar, type WbStyle, type WbTool } from './WhiteboardToolbar';
import { Minimap } from './Minimap';

type Viewport = Whiteboard['viewport'];

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | {
      kind: 'move';
      start: Point;
      before: WbElement[];
      moved: boolean;
      ids: Set<ID>;
      detach: Set<ID>;
    }
  | {
      kind: 'resize';
      id: ID;
      end: 'end' | 'start';
      before: WbElement[];
      snap?: ID | null;
    }
  | { kind: 'marquee'; start: Point; current: Point; additive: boolean }
  | { kind: 'draw'; start: Point }
  /** Note/text placement waits for pointer-up, after the browser has moved focus. */
  | { kind: 'place'; type: 'note' | 'text'; at: Point }
  | { kind: 'erase'; before: WbElement[]; erased: boolean }
  /** Turning the selection with the rotate handle: `base` is the starting angle shown to the user. */
  | { kind: 'rotate'; pivot: Point; start: number; base: number; delta: number; before: WbElement[]; ids: Set<ID> };

const ROTATE_HANDLE_GAP = 28;
const angleOf = (p: Point, c: Point) => (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
const centerOfRect = (r: { x: number; y: number; w: number; h: number }): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const HISTORY_LIMIT = 100;

export interface WhiteboardHandle {
  svg: () => SVGSVGElement | null;
  elements: () => WbElement[];
  addElement: (el: WbElement) => void;
  /** Adds several elements centred in the view (templates); fits the view when the board was empty. */
  addElements: (els: WbElement[]) => void;
  /** Opens the file picker for pictures. */
  pickImages: () => void;
  center: () => Point;
  clear: () => void;
}

interface Props {
  board: Whiteboard;
  onSave: (patch: Pick<Whiteboard, 'elements' | 'viewport'>) => void;
  /** Exposes the live SVG + elements to the parent (export, scene cards). */
  registerHandle: (h: WhiteboardHandle) => void;
}

export function WhiteboardEditor({ board, onSave, registerHandle }: Props) {
  const theme = useTheme();
  const docs = useStore((s) => s.docs);
  const ink = theme.palette.text.primary;
  // Unique <defs> ids for this board (see WbDefsContext).
  const defs = `wb${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [elements, setElementsRaw] = useState<WbElement[]>(() => routeConnectors(board.elements));
  /** Every change re-routes attached arrows, so they follow what they point at. */
  const setElements = useCallback((next: SetStateAction<WbElement[]>) => {
    setElementsRaw((prev) => routeConnectors(typeof next === 'function' ? next(prev) : next));
  }, []);
  const [snapId, setSnapId] = useState<ID | null>(null);
  const [minimap, setMinimap] = useState(() => {
    try {
      return localStorage.getItem('inkwell:wb:minimap') !== 'off';
    } catch {
      return true;
    }
  });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [vp, setVp] = useState<Viewport>(board.viewport);
  const [tool, setTool] = useState<WbTool>('select');
  const [style, setStyleState] = useState<WbStyle>({
    color: 'ink',
    strokeWidth: 4,
    noteColor: NOTE_COLORS[0],
    noteText: DEFAULT_NOTE_TEXT,
    filled: false,
  });
  const [selected, setSelected] = useState<ID[]>([]);
  const [draft, setDraft] = useState<WbElement | null>(null);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [, setHistoryTick] = useState(0);
  const history = useRef<{ past: WbElement[][]; future: WbElement[][] }>({
    past: [],
    future: [],
  });
  const drag = useRef<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const vpRef = useRef(vp);
  vpRef.current = vp;

  // Autosave whenever content or viewport settle.
  useEffect(() => {
    onSave({ elements, viewport: vp });
  }, [elements, vp, onSave]);

  const pushHistory = useCallback((before: WbElement[]) => {
    const h = history.current;
    h.past.push(before);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
    setHistoryTick((t) => t + 1);
  }, []);

  /** Replaces the elements as one undoable step. */
  const commit = useCallback(
    (next: WbElement[]) => {
      pushHistory(elementsRef.current);
      setElements(next);
    },
    [pushHistory, setElements],
  );
  const painted = useMemo(() => paintOrder(elements), [elements]);

  // Track the canvas size (minimap, centring).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect();
      if (r.width && r.height) setSize({ w: r.width, h: r.height });
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const undo = () => {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(elementsRef.current);
    setElements(prev);
    setSelected([]);
    setHistoryTick((t) => t + 1);
  };
  const redo = () => {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(elementsRef.current);
    setElements(next);
    setHistoryTick((t) => t + 1);
  };

  const center = useCallback((): Point => {
    const r = svgRef.current?.getBoundingClientRect();
    const v = vpRef.current;
    return {
      x: ((r?.width ?? 800) / 2 - v.x) / v.zoom,
      y: ((r?.height ?? 600) / 2 - v.y) / v.zoom,
    };
  }, []);

  useEffect(() => {
    registerHandle({
      svg: () => svgRef.current,
      elements: () => elementsRef.current,
      addElement: (el) => {
        commit([...elementsRef.current, el]);
        setSelected([el.id]);
        setTool('select');
      },
      addElements: (els) => {
        if (!els.length) return;
        const wasEmpty = elementsRef.current.length === 0;
        const b = unionBounds(els)!;
        const c = center();
        const placed = copyElements(els, newId, c.x - (b.x + b.w / 2), c.y - (b.y + b.h / 2));
        commit([...elementsRef.current, ...placed]);
        setSelected(placed.map((e) => e.id));
        setTool('select');
        if (wasEmpty) requestAnimationFrame(() => fitRef.current());
      },
      pickImages: () => fileRef.current?.click(),
      center,
      clear: () => {
        commit([]);
        setSelected([]);
      },
    });
  }, [registerHandle, commit, center]);

  const toWorld = (clientX: number, clientY: number): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - vp.x) / vp.zoom,
      y: (clientY - r.top - vp.y) / vp.zoom,
    };
  };

  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    setVp((v) => {
      const r = svgRef.current?.getBoundingClientRect();
      const cx = sx ?? (r ? r.width / 2 : 400);
      const cy = sy ?? (r ? r.height / 2 : 300);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const k = zoom / v.zoom;
      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  const fitRef = useRef<() => void>(() => {});
  const fit = useCallback(() => {
    const b = unionBounds(elementsRef.current);
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    if (!b) return setVp({ x: 0, y: 0, zoom: 1 });
    const pad = 60;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2 - 60) / Math.max(b.h, 1), 1.5)));
    setVp({
      zoom,
      x: r.width / 2 - (b.x + b.w / 2) * zoom,
      y: r.height / 2 + 30 - (b.y + b.h / 2) * zoom,
    });
  }, []);
  fitRef.current = fit;

  /** Adds picture files as image elements (stored in the project's assets). */
  const insertImages = useCallback(
    async (files: File[], at?: Point) => {
      const projectId = useStore.getState().project?.id;
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (!projectId || !images.length) return;
      const origin = at ?? center();
      const added: WbElement[] = [];
      for (const [i, file] of images.entries()) {
        try {
          const asset = await addAsset(projectId, file);
          const dims = await imageSize(file);
          const scale = Math.min(1, 480 / dims.w, 480 / dims.h);
          const w = Math.max(40, dims.w * scale);
          const h = Math.max(40, dims.h * scale);
          added.push({
            id: newId(),
            type: 'image',
            x: origin.x - w / 2 + i * 30,
            y: origin.y - h / 2 + i * 30,
            w,
            h,
            assetId: asset.id,
            name: file.name,
            color: 'ink',
            strokeWidth: 1,
          });
        } catch (e) {
          useStore.getState().notify(e instanceof Error ? e.message : `Could not add ${file.name}`, 'error');
        }
      }
      if (!added.length) return;
      commit([...elementsRef.current, ...added]);
      setSelected(added.map((e) => e.id));
      setTool('select');
    },
    [center, commit],
  );

  // Wheel: pan, or zoom with Ctrl/⌘ (pinch on trackpads). Native listener so we can preventDefault.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
      } else setVp((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const fillFor = (color: string) => `${color === 'ink' ? '#888888' : color}66`;
  const shapeFill = (color: string) => (style.filled ? fillFor(color) : 'none');

  const createAt = (type: 'note' | 'text', p: Point) => {
    const el: WbElement =
      type === 'note'
        ? {
            id: newId(),
            type: 'note',
            x: p.x - 90,
            y: p.y - 60,
            w: 180,
            h: 130,
            text: '',
            fill: style.noteColor,
            textColor: style.noteText,
            color: 'ink',
            strokeWidth: 1,
            docId: null,
          }
        : {
            id: newId(),
            type: 'text',
            x: p.x,
            y: p.y - 14,
            w: 260,
            text: '',
            fontSize: 24,
            color: style.color,
            strokeWidth: 1,
          };
    commit([...elementsRef.current, el]);
    setSelected([el.id]);
    setEditingId(el.id);
    setTool('select');
  };

  const selectedEls = useMemo(() => elements.filter((e) => selected.includes(e.id)), [elements, selected]);
  // Only sticky notes selected: the toolbar offers paper and text colours for them.
  const noteSelection = useMemo(() => {
    if (!selectedEls.length || !selectedEls.every((e) => e.type === 'note')) return null;
    const first = selectedEls[0] as Extract<WbElement, { type: 'note' }>;
    return { fill: first.fill, text: first.textColor ?? DEFAULT_NOTE_TEXT };
  }, [selectedEls]);
  const single = selectedEls.length === 1 ? selectedEls[0] : null;
  const shapeSelection = selectedEls.filter((e): e is Extract<WbElement, { type: 'rect' | 'ellipse' }> => e.type === 'rect' || e.type === 'ellipse');
  const handleSize = 10 / vp.zoom;

  /** Which resize handle (if any) of the single selected element is under p. */
  const handleAt = (p: Point): 'end' | 'start' | null => {
    if (!single) return null;
    if (single.type === 'arrow') {
      if (Math.hypot(p.x - single.x2, p.y - single.y2) <= handleSize) return 'end';
      if (Math.hypot(p.x - single.x1, p.y - single.y1) <= handleSize) return 'start';
      return null;
    }
    // Rotated elements: look for the corner in their own frame.
    const b = localBounds(single);
    const lp = rotatePoint(p, -rotationOf(single), centerOfRect(b));
    return Math.abs(lp.x - (b.x + b.w)) <= handleSize && Math.abs(lp.y - (b.y + b.h)) <= handleSize ? 'end' : null;
  };

  /** The round rotate handle above the selection: where it is, what it turns around, and the starting angle. */
  const rotateHandle = (() => {
    if (editingId || !selectedEls.length) return null;
    const gap = ROTATE_HANDLE_GAP / vp.zoom;
    if (single) {
      if (!canRotate(single)) return null;
      const b = localBounds(single);
      const c = centerOfRect(b);
      const rot = rotationOf(single);
      return { at: rotatePoint({ x: c.x, y: b.y - gap }, rot, c), from: rotatePoint({ x: c.x, y: b.y - 4 / vp.zoom }, rot, c), pivot: c, base: rot };
    }
    if (!selectedEls.some(canRotate)) return null;
    const ub = unionBounds(selectedEls)!;
    const c = centerOfRect(ub);
    return { at: { x: c.x, y: ub.y - gap }, from: { x: c.x, y: ub.y - 4 / vp.zoom }, pivot: c, base: 0 };
  })();
  const onRotateHandle = (p: Point) => !!rotateHandle && Math.hypot(p.x - rotateHandle.at.x, p.y - rotateHandle.at.y) <= handleSize * 0.9;
  const [rotLabel, setRotLabel] = useState<{ deg: number; at: Point } | null>(null);

  /** Turns the selection (and what's inside selected frames) by `deg` around its centre. */
  const rotateSelection = (deg: number, absolute = false) => {
    if (!rotateHandle) return;
    const { ids } = moveSet(selected);
    const delta = absolute ? deg - rotateHandle.base : deg;
    if (!delta) return;
    commit(elements.map((el) => (ids.has(el.id) ? rotateElement(el, delta, rotateHandle.pivot) : el)));
  };

  const eraseAt = (p: Point): boolean => {
    const hit = topmostAt(paintOrder(elementsRef.current), p, 8 / vp.zoom);
    if (!hit) return false;
    setElements((els) => els.filter((e) => e.id !== hit.id));
    return true;
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (editingId) return;
    wrapRef.current?.focus({ preventScroll: true });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || tool === 'hand' || spaceDown) {
      drag.current = {
        kind: 'pan',
        sx: e.clientX,
        sy: e.clientY,
        vx: vp.x,
        vy: vp.y,
      };
      return;
    }
    if (e.button !== 0) return;
    const tol = 6 / vp.zoom;
    switch (tool) {
      case 'select': {
        if (rotateHandle && onRotateHandle(p)) {
          drag.current = {
            kind: 'rotate',
            pivot: rotateHandle.pivot,
            start: angleOf(p, rotateHandle.pivot),
            base: rotateHandle.base,
            delta: 0,
            before: elements,
            ids: moveSet(selected).ids,
          };
          return;
        }
        const handle = handleAt(p);
        if (handle && single) {
          drag.current = {
            kind: 'resize',
            id: single.id,
            end: handle,
            before: elements,
          };
          return;
        }
        const hit = topmostAt(painted, p, tol);
        if (hit) {
          // Scene cards: the ↗ corner opens the linked document.
          if (hit.type === 'note' && hit.docId && p.x >= hit.x + hit.w - 28 && p.y <= hit.y + 28) {
            if (docs[hit.docId]) useStore.getState().openDoc(hit.docId);
            else useStore.getState().notify('That scene no longer exists.', 'warning');
            return;
          }
          // Story Bible cards: the ↗ corner opens the entry.
          if (hit.type === 'card' && p.x >= hit.x + hit.w - 28 && p.y <= hit.y + 28) {
            openBible(hit.bibleId);
            return;
          }
          const sel = selected.includes(hit.id) ? selected : e.shiftKey ? [...selected, hit.id] : [hit.id];
          if (!selected.includes(hit.id)) setSelected(sel);
          drag.current = {
            kind: 'move',
            start: p,
            before: elements,
            moved: false,
            ...moveSet(sel),
          };
        } else {
          if (!e.shiftKey) setSelected([]);
          drag.current = {
            kind: 'marquee',
            start: p,
            current: p,
            additive: e.shiftKey,
          };
        }
        return;
      }
      case 'pen':
        setDraft({
          id: newId(),
          type: 'path',
          points: [[p.x, p.y]],
          color: style.color,
          strokeWidth: style.strokeWidth,
        });
        drag.current = { kind: 'draw', start: p };
        return;
      case 'rect':
      case 'ellipse':
        setDraft({
          id: newId(),
          type: tool,
          x: p.x,
          y: p.y,
          w: 0,
          h: 0,
          fill: shapeFill(style.color),
          color: style.color,
          strokeWidth: style.strokeWidth,
        });
        drag.current = { kind: 'draw', start: p };
        return;
      case 'arrow': {
        // Starting on a note, shape, card or picture attaches the arrow to it.
        const src = attachableAt(painted, p, tol);
        setDraft({
          id: newId(),
          type: 'arrow',
          x1: p.x,
          y1: p.y,
          x2: p.x,
          y2: p.y,
          color: style.color,
          strokeWidth: style.strokeWidth,
          from: src?.id ?? null,
          to: null,
        });
        drag.current = { kind: 'draw', start: p };
        return;
      }
      case 'frame': {
        const n = elements.filter((el) => el.type === 'frame').length;
        setDraft({
          id: newId(),
          type: 'frame',
          x: p.x,
          y: p.y,
          w: 0,
          h: 0,
          title: `Frame ${n + 1}`,
          fill: FRAME_COLORS[n % FRAME_COLORS.length],
          color: 'ink',
          strokeWidth: 2,
        });
        drag.current = { kind: 'draw', start: p };
        return;
      }
      case 'note':
      case 'text':
        // Creating the editor here would lose focus to the mousedown that follows.
        drag.current = { kind: 'place', type: tool, at: p };
        return;
      case 'eraser':
        drag.current = { kind: 'erase', before: elements, erased: eraseAt(p) };
        return;
    }
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (svg && !d) {
      // Cursor feedback over handles.
      const p = toWorld(e.clientX, e.clientY);
      svg.style.cursor = tool !== 'select' ? '' : onRotateHandle(p) ? 'grab' : handleAt(p) ? 'nwse-resize' : '';
    }
    if (!d) return;
    const p = toWorld(e.clientX, e.clientY);
    switch (d.kind) {
      case 'pan':
        setVp((v) => ({
          ...v,
          x: d.vx + e.clientX - d.sx,
          y: d.vy + e.clientY - d.sy,
        }));
        return;
      case 'move': {
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * vp.zoom < 3) return;
        d.moved = true;
        setElements(
          d.before.map((el) => {
            if (!d.ids.has(el.id)) return el;
            const m = moveElement(el, dx, dy);
            // An arrow dragged on its own lets go of what it was attached to.
            return m.type === 'arrow' && d.detach.has(el.id) ? { ...m, from: null, to: null } : m;
          }),
        );
        return;
      }
      case 'resize': {
        const target = d.before.find((el) => el.id === d.id);
        if (target?.type === 'arrow') {
          // Dragging an arrow end: it follows the pointer and can snap onto something.
          const other = d.end === 'end' ? target.from : target.to;
          const snap = attachableAt(painted, p, 6 / vp.zoom, other ?? undefined);
          d.snap = snap?.id ?? null;
          setSnapId(d.snap);
          setElements(d.before.map((el) => (el.id !== d.id || el.type !== 'arrow' ? el : d.end === 'start' ? { ...el, x1: p.x, y1: p.y, from: null } : { ...el, x2: p.x, y2: p.y, to: null })));
          return;
        }
        setElements(d.before.map((el) => (el.id === d.id ? resizeElement(el, p) : el)));
        return;
      }
      case 'rotate': {
        const total = snapAngle(d.base + angleOf(p, d.pivot) - d.start, e.shiftKey);
        const delta = total - d.base;
        if (delta === d.delta) return;
        d.delta = delta;
        if (svg) svg.style.cursor = 'grabbing';
        setElements(d.before.map((el) => (d.ids.has(el.id) ? rotateElement(el, delta, d.pivot) : el)));
        setRotLabel({ deg: d.base ? total : delta, at: p });
        return;
      }
      case 'marquee':
        d.current = p;
        setMarquee(normalizeRect(d.start.x, d.start.y, p.x, p.y));
        return;
      case 'draw':
        setDraft((cur) => {
          if (!cur) return cur;
          if (cur.type === 'path') {
            const last = cur.points[cur.points.length - 1];
            if (Math.hypot(p.x - last[0], p.y - last[1]) * vp.zoom < 1.5) return cur;
            return { ...cur, points: [...cur.points, [p.x, p.y]] };
          }
          if (cur.type === 'arrow') {
            const snap = attachableAt(painted, p, 6 / vp.zoom, cur.from ?? undefined);
            setSnapId(snap?.id ?? null);
            return { ...cur, x2: p.x, y2: p.y, to: snap?.id ?? null };
          }
          if (cur.type === 'rect' || cur.type === 'ellipse' || cur.type === 'frame') {
            let r = normalizeRect(d.start.x, d.start.y, p.x, p.y);
            if (e.shiftKey) {
              const s = Math.max(r.w, r.h);
              r = {
                x: p.x < d.start.x ? d.start.x - s : d.start.x,
                y: p.y < d.start.y ? d.start.y - s : d.start.y,
                w: s,
                h: s,
              };
            }
            return { ...cur, ...r };
          }
          return cur;
        });
        return;
      case 'erase':
        if (eraseAt(p)) d.erased = true;
        return;
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setSnapId(null);
    if (!d) return;
    switch (d.kind) {
      case 'place':
        createAt(d.type, d.at);
        return;
      case 'move':
        if (d.moved) pushHistory(d.before);
        return;
      case 'rotate':
        setRotLabel(null);
        if (svgRef.current) svgRef.current.style.cursor = '';
        if (d.delta) pushHistory(d.before);
        return;
      case 'resize':
        if (d.snap) {
          const snap = d.snap;
          setElements((els) => els.map((el) => (el.id === d.id && el.type === 'arrow' ? (d.end === 'start' ? { ...el, from: snap } : { ...el, to: snap }) : el)));
        }
        pushHistory(d.before);
        return;
      case 'erase':
        if (d.erased) pushHistory(d.before);
        return;
      case 'marquee': {
        const r = normalizeRect(d.start.x, d.start.y, d.current.x, d.current.y);
        setMarquee(null);
        if (r.w * vp.zoom < 3 && r.h * vp.zoom < 3) return;
        // Frames are picked only when the box covers them completely.
        const ids = elements.filter((el) => (el.type === 'frame' ? containsRect(r, elementBounds(el)) : rectsIntersect(elementBounds(el), r))).map((el) => el.id);
        setSelected((cur) => (d.additive ? [...new Set([...cur, ...ids])] : ids));
        return;
      }
      case 'draw': {
        const el = draft;
        setDraft(null);
        if (!el) return;
        let finished: WbElement | null = el;
        if (el.type === 'path')
          finished = {
            ...el,
            points: simplifyPoints(el.points, 1.5 / vp.zoom),
          };
        if ((el.type === 'rect' || el.type === 'ellipse') && el.w < 4 && el.h < 4) finished = { ...el, x: el.x - 60, y: el.y - 40, w: 120, h: 80 };
        if (el.type === 'frame' && el.w < 40 && el.h < 40) finished = { ...el, x: el.x - 240, y: el.y - 160, w: 480, h: 320 };
        if (el.type === 'arrow' && !el.to && Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 4) finished = { ...el, x2: el.x1 + 120 };
        if (el.type === 'arrow' && el.to && el.to === el.from) finished = { ...el, to: null };
        if (finished) commit([...elementsRef.current, finished]);
        return;
      }
    }
  };

  const onDoubleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (tool !== 'select') return;
    const p = toWorld(e.clientX, e.clientY);
    // Double-clicking the rotate handle straightens the selection.
    if (rotateHandle && onRotateHandle(p)) {
      const ids = new Set(selected);
      commit(elements.map((el) => (ids.has(el.id) && rotationOf(el) ? rotateElement(el, -rotationOf(el), centerOfRect(localBounds(el))) : el)));
      return;
    }
    const hit = topmostAt(painted, p, 6 / vp.zoom);
    if (hit && (hit.type === 'note' || hit.type === 'text')) {
      setSelected([hit.id]);
      setEditingId(hit.id);
    } else if (hit?.type === 'card') openBible(hit.bibleId);
    else if (hit?.type === 'arrow' || hit?.type === 'frame') void renameElement(hit);
    else if (!hit) createAt('note', p);
  };

  const openBible = (id: ID) => {
    if (useStore.getState().bible.some((b) => b.id === id)) useStore.getState().openBibleEntry(id);
    else useStore.getState().notify('That Story Bible entry no longer exists.', 'warning');
  };

  /** Elements to move with a selection: frames carry what's inside them; lone arrows let go. */
  const moveSet = (sel: ID[]): { ids: Set<ID>; detach: Set<ID> } => {
    const ids = new Set(sel);
    for (const el of elements) if (ids.has(el.id) && el.type === 'frame') elementsInFrame(el, elements).forEach((id) => ids.add(id));
    const detach = new Set<ID>();
    for (const el of elements) {
      if (el.type !== 'arrow' || !ids.has(el.id) || (!el.from && !el.to)) continue;
      const targetsMove = (el.from && ids.has(el.from)) || (el.to && ids.has(el.to));
      if (!targetsMove) detach.add(el.id);
    }
    return { ids, detach };
  };

  /** Arrow label / frame title. */
  const renameElement = async (el: WbElement) => {
    if (el.type !== 'arrow' && el.type !== 'frame') return;
    const v = await promptDialog(
      el.type === 'arrow'
        ? {
            title: 'Arrow label',
            label: 'Label (leave empty for none)',
            initial: el.label ?? '',
          }
        : { title: 'Frame title', label: 'Title', initial: el.title },
    );
    if (v === null) return;
    commit(elementsRef.current.map((x) => (x.id !== el.id ? x : x.type === 'arrow' ? { ...x, label: v.trim() || undefined } : x.type === 'frame' ? { ...x, title: v.trim() || 'Frame' } : x)));
    wrapRef.current?.focus({ preventScroll: true });
  };

  const toggleMinimap = () =>
    setMinimap((m) => {
      try {
        localStorage.setItem('inkwell:wb:minimap', m ? 'off' : 'on');
      } catch {
        /* ignore */
      }
      return !m;
    });

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editingId) return;
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    void insertImages(files);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    void insertImages(files, toWorld(e.clientX, e.clientY));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editingId) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && k === 'y') return (e.preventDefault(), redo());
    if (mod && k === 'a') {
      e.preventDefault();
      setSelected(elements.map((el) => el.id));
      return;
    }
    if (mod && k === 'd' && selectedEls.length) {
      e.preventDefault();
      const withContents = moveSet(selected).ids;
      const copies = copyElements(
        elements.filter((el) => withContents.has(el.id)),
        newId,
        24,
        24,
      );
      commit([...elements, ...copies]);
      setSelected(copies.map((c) => c.id));
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) {
      e.preventDefault();
      commit(elements.filter((el) => !selected.includes(el.id)));
      setSelected([]);
      return;
    }
    if (e.key === 'Escape') return setSelected([]);
    if (e.key === 'Enter' && single && (single.type === 'note' || single.type === 'text')) {
      e.preventDefault();
      setEditingId(single.id);
      return;
    }
    if (e.key === 'Enter' && single && (single.type === 'arrow' || single.type === 'frame')) {
      e.preventDefault();
      void renameElement(single);
      return;
    }
    if (e.key.startsWith('Arrow') && selected.length) {
      e.preventDefault();
      const step = e.shiftKey ? 20 : 2;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const { ids, detach } = moveSet(selected);
      commit(elements.map((el) => (!ids.has(el.id) ? el : detach.has(el.id) && el.type === 'arrow' ? { ...moveElement(el, dx, dy), from: null, to: null } : moveElement(el, dx, dy))));
      return;
    }
    if ((e.key === '[' || e.key === ']' || e.key === '{' || e.key === '}') && !mod && selected.length) {
      // [ and ] turn the selection 15° (with Shift, 90°).
      e.preventDefault();
      const step = e.shiftKey ? 90 : 15;
      rotateSelection(e.key === '[' || e.key === '{' ? -step : step);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      setSpaceDown(true);
      return;
    }
    if (e.shiftKey && e.key === '!') return fit();
    if (!mod && !e.altKey) {
      if (e.key === '+' || e.key === '=') return zoomAt(1.25);
      if (e.key === '-') return zoomAt(1 / 1.25);
      if (e.key === '0') return setVp((v) => ({ ...v, zoom: 1 }));
      if (k === 'm') return toggleMinimap();
      if (k === 'i') return fileRef.current?.click();
      const t = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (t) setTool(t.value);
    }
  };

  // Text editing overlay.
  const editing = editingId ? elements.find((el) => el.id === editingId) : null;
  const finishEditing = (text: string) => {
    const el = elementsRef.current.find((x) => x.id === editingId);
    setEditingId(null);
    wrapRef.current?.focus({ preventScroll: true });
    if (!el || (el.type !== 'note' && el.type !== 'text')) return;
    if (el.type === 'text' && !text.trim()) {
      setElements((els) => els.filter((x) => x.id !== el.id));
      return;
    }
    if (text === el.text) return;
    commit(
      elementsRef.current.map((x) => {
        if (x.id !== el.id) return x;
        if (x.type === 'note') {
          // Grow the note to fit its text.
          const needed = textHeight(text, x.w - 24, 16) + 24 + (x.docId ? 18 : 0);
          return { ...x, text, h: Math.max(x.h, needed) };
        }
        return { ...x, text } as WbElement;
      }),
    );
  };

  const cursor = spaceDown || tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair';
  const selBounds = unionBounds(selectedEls);
  const boardBg = theme.inkwell.board ? theme.inkwell.board : theme.palette.mode === 'dark' ? '#1f2027' : '#fbfbf8';
  const gridColor = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const docTitles = (id: ID | null) => (id ? docs[id]?.title : undefined);
  const snapEl = snapId ? elements.find((el) => el.id === snapId) : undefined;
  const snapTarget = snapEl ? elementBounds(snapEl) : null;
  // The arrow being drawn, with its start (and snapped end) on the outlines.
  const draftView = useMemo(() => {
    if (!draft || draft.type !== 'arrow' || (!draft.from && !draft.to)) return draft;
    const src = draft.from ? elements.find((el) => el.id === draft.from) : undefined;
    const dst = draft.to ? elements.find((el) => el.id === draft.to) : undefined;
    const mid = (el: WbElement) => {
      const b = elementBounds(el);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    };
    const end = dst ? boundaryPoint(dst, src ? mid(src) : { x: draft.x1, y: draft.y1 }) : { x: draft.x2, y: draft.y2 };
    const start = src ? boundaryPoint(src, dst ? mid(dst) : end) : { x: draft.x1, y: draft.y1 };
    return { ...draft, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }, [draft, elements]);

  return (
    <Box
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key === ' ' && setSpaceDown(false)}
      onPaste={onPaste}
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault();
      }}
      onDrop={onDrop}
      aria-label="Whiteboard canvas. Press V, P, R, O, A, N, T or E to switch tools."
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        outline: 'none',
        bgcolor: boardBg,
        overflow: 'hidden',
      }}
    >
      <WhiteboardToolbar
        tool={tool}
        setTool={setTool}
        style={style}
        setStyle={(patch) => {
          setStyleState((s) => ({ ...s, ...patch }));
          // Restyle the selection too.
          if (selectedEls.length && (patch.color || patch.strokeWidth || patch.noteColor || patch.noteText || patch.filled !== undefined)) {
            const ids = new Set(selected);
            commit(
              elements.map((el) => {
                if (!ids.has(el.id)) return el;
                if (el.type === 'note')
                  return {
                    ...el,
                    ...(patch.noteColor ? { fill: patch.noteColor } : {}),
                    ...(patch.noteText ? { textColor: patch.noteText } : {}),
                  };
                if (el.type === 'frame') return patch.color && patch.color !== 'ink' ? { ...el, fill: patch.color } : el;
                if (el.type === 'image' || el.type === 'card') return el;
                if (el.type === 'rect' || el.type === 'ellipse') {
                  const color = patch.color ?? el.color;
                  const filled = patch.filled ?? el.fill !== 'none';
                  return { ...el, color, ...(patch.strokeWidth ? { strokeWidth: patch.strokeWidth } : {}), fill: filled ? fillFor(color) : 'none' };
                }
                if (patch.filled !== undefined && !patch.color && !patch.strokeWidth) return el;
                return {
                  ...el,
                  ...(patch.color ? { color: patch.color } : {}),
                  ...(patch.strokeWidth ? { strokeWidth: patch.strokeWidth } : {}),
                };
              }),
            );
          }
        }}
        zoom={vp.zoom}
        onZoom={(f) => zoomAt(f)}
        onFit={fit}
        canUndo={history.current.past.length > 0}
        canRedo={history.current.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        minimap={minimap}
        onToggleMinimap={toggleMinimap}
        noteSelection={noteSelection}
        filledNow={shapeSelection.length ? shapeSelection.every((s) => s.fill !== 'none') : undefined}
        canRotate={!!rotateHandle}
        onRotate={(deg) => rotateSelection(deg)}
        onPickImage={() => fileRef.current?.click()}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void insertImages(files);
        }}
      />
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          display: 'block',
          touchAction: 'none',
          cursor,
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        role="img"
        aria-label={`Whiteboard “${board.name}” with ${elements.length} items`}
      >
        <defs>
          <pattern id={`${defs}-dots`} width={24} height={24} patternUnits="userSpaceOnUse" patternTransform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
            <circle cx={1} cy={1} r={1.2} fill={gridColor} />
          </pattern>
          <pattern id={`${defs}-grid`} width={32} height={32} patternUnits="userSpaceOnUse" patternTransform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
            <path d="M32 0H0V32" fill="none" stroke={gridColor} strokeWidth={1} />
          </pattern>
          <filter id={`${defs}-shadow`} x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.25" />
          </filter>
          {/* Sticky notes: a soft contact shadow plus a deeper one where the paper lifts. */}
          <filter id={`${defs}-note-shadow`} x="-15%" y="-15%" width="140%" height="150%">
            {/* Only the shadow (the paper itself is drawn on top, unfiltered). */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="c" />
            <feOffset in="c" dy="1" result="co" />
            <feComponentTransfer in="co" result="cs">
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="d" />
            <feOffset in="d" dx="2" dy="6" result="do" />
            <feComponentTransfer in="do" result="ds">
              <feFuncA type="linear" slope="0.32" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="ds" />
              <feMergeNode in="cs" />
            </feMerge>
          </filter>
          <linearGradient id={`${defs}-note-sheen`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.07" />
          </linearGradient>
        </defs>
        {board.background !== 'plain' && <rect className="wb-bg" width="100%" height="100%" fill={`url(#${defs}-${board.background})`} />}
        <WbDefsContext.Provider value={defs}>
          <g className="wb-world" transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
            {painted.map((el) => (
              <WbElementView key={el.id} el={el} ink={ink} paper={theme.palette.background.paper} hideText={el.id === editingId} docTitle={el.type === 'note' ? docTitles(el.docId) : undefined} />
            ))}
            {draftView && <WbElementView el={draftView} ink={ink} paper={theme.palette.background.paper} />}
            <g className="wb-ui">
              {snapTarget && (
                <rect
                  x={snapTarget.x - 6 / vp.zoom}
                  y={snapTarget.y - 6 / vp.zoom}
                  width={snapTarget.w + 12 / vp.zoom}
                  height={snapTarget.h + 12 / vp.zoom}
                  rx={8 / vp.zoom}
                  fill="none"
                  stroke={theme.palette.secondary.main}
                  strokeWidth={3 / vp.zoom}
                />
              )}
              {single && !editingId && rotationOf(single) !== 0 && (() => {
                // A rotated element gets an outline (and resize corner) that turns with it.
                const b = localBounds(single);
                const c = centerOfRect(b);
                return (
                  <g transform={`rotate(${rotationOf(single)} ${c.x} ${c.y})`}>
                    <rect
                      x={b.x - 4 / vp.zoom}
                      y={b.y - 4 / vp.zoom}
                      width={b.w + 8 / vp.zoom}
                      height={b.h + 8 / vp.zoom}
                      fill="none"
                      stroke={theme.palette.primary.main}
                      strokeWidth={1.5 / vp.zoom}
                      strokeDasharray={`${6 / vp.zoom} ${4 / vp.zoom}`}
                    />
                    <rect
                      x={b.x + b.w - handleSize / 2}
                      y={b.y + b.h - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      fill={theme.palette.background.paper}
                      stroke={theme.palette.primary.main}
                      strokeWidth={1.5 / vp.zoom}
                    />
                  </g>
                );
              })()}
              {rotateHandle && (
                <g>
                  <line x1={rotateHandle.from.x} y1={rotateHandle.from.y} x2={rotateHandle.at.x} y2={rotateHandle.at.y} stroke={theme.palette.primary.main} strokeWidth={1.2 / vp.zoom} />
                  <circle cx={rotateHandle.at.x} cy={rotateHandle.at.y} r={handleSize * 0.6} fill={theme.palette.background.paper} stroke={theme.palette.primary.main} strokeWidth={1.5 / vp.zoom} />
                  <path
                    d={`M ${rotateHandle.at.x - handleSize * 0.28} ${rotateHandle.at.y + handleSize * 0.05} A ${handleSize * 0.3} ${handleSize * 0.3} 0 1 1 ${rotateHandle.at.x + handleSize * 0.05} ${rotateHandle.at.y + handleSize * 0.3}`}
                    fill="none"
                    stroke={theme.palette.primary.main}
                    strokeWidth={1.2 / vp.zoom}
                  />
                </g>
              )}
              {rotLabel && (
                <g transform={`translate(${rotLabel.at.x + 14 / vp.zoom} ${rotLabel.at.y - 14 / vp.zoom}) scale(${1 / vp.zoom})`}>
                  <rect x={0} y={-15} width={46} height={20} rx={10} fill={theme.palette.primary.main} />
                  <text x={23} y={0} textAnchor="middle" fontSize={12} fontFamily="Roboto, sans-serif" fill={theme.palette.primary.contrastText}>
                    {`${Math.round(rotLabel.deg)}°`}
                  </text>
                </g>
              )}
              {selBounds && !editingId && !(single && rotationOf(single) !== 0) && (
                <rect
                  x={selBounds.x - 4 / vp.zoom}
                  y={selBounds.y - 4 / vp.zoom}
                  width={selBounds.w + 8 / vp.zoom}
                  height={selBounds.h + 8 / vp.zoom}
                  fill="none"
                  stroke={theme.palette.primary.main}
                  strokeWidth={1.5 / vp.zoom}
                  strokeDasharray={`${6 / vp.zoom} ${4 / vp.zoom}`}
                />
              )}
              {single && !editingId && single.type !== 'arrow' && rotationOf(single) === 0 && (
                <rect
                  x={selBounds!.x + selBounds!.w - handleSize / 2}
                  y={selBounds!.y + selBounds!.h - handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  fill={theme.palette.background.paper}
                  stroke={theme.palette.primary.main}
                  strokeWidth={1.5 / vp.zoom}
                />
              )}
              {single?.type === 'arrow' &&
                [
                  [single.x1, single.y1],
                  [single.x2, single.y2],
                ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={handleSize / 2} fill={theme.palette.background.paper} stroke={theme.palette.primary.main} strokeWidth={1.5 / vp.zoom} />)}
              {marquee && (
                <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill={`${theme.palette.primary.main}22`} stroke={theme.palette.primary.main} strokeWidth={1 / vp.zoom} />
              )}
            </g>
          </g>
        </WbDefsContext.Provider>
      </svg>

      {editing && (editing.type === 'note' || editing.type === 'text') && (
        <EditOverlay
          key={editing.id}
          el={editing}
          vp={vp}
          color={editing.type === 'note' ? (editing.textColor ?? DEFAULT_NOTE_TEXT) : editing.color === 'ink' ? ink : editing.color}
          onDone={finishEditing}
        />
      )}

      {minimap && elements.length > 0 && (
        <Minimap
          elements={painted}
          vp={vp}
          width={size.w}
          height={size.h}
          ink={ink}
          onCenter={(p) =>
            setVp((v) => ({
              ...v,
              x: size.w / 2 - p.x * v.zoom,
              y: size.h / 2 - p.y * v.zoom,
            }))
          }
        />
      )}

      {elements.length === 0 && !draft && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            color: 'text.secondary',
            textAlign: 'center',
            px: 3,
          }}
        >
          <Box>
            <Box sx={{ fontFamily: WB_FONT, fontSize: 32, mb: 1 }}>A blank board for big ideas</Box>
            <Box sx={{ fontSize: 14 }}>Double-click for a sticky note · P to draw · A for arrows · F for frames · drop or paste pictures · or start from a template</Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Textarea positioned over a note/text element while editing. */
function EditOverlay({ el, vp, color, onDone }: { el: Extract<WbElement, { type: 'note' | 'text' }>; vp: Viewport; color: string; onDone: (text: string) => void }) {
  const [value, setValue] = useState(el.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const note = el.type === 'note';
  const fontSize = (note ? 16 : el.fontSize) * vp.zoom;
  const pad = note ? 12 * vp.zoom : 0;
  const offset = note && el.docId ? 18 * vp.zoom : 0;
  const top = el.y * vp.zoom + vp.y + offset;
  const rot = el.rotation ?? 0;
  // Turn around the element's centre, which sits this far into the text box.
  const originY = ((note ? el.h : textHeight(el.text || ' ', el.w, el.fontSize)) * vp.zoom) / 2 - offset;
  const height = note ? el.h * vp.zoom - (el.docId ? 18 * vp.zoom : 0) : Math.max(fontSize * 1.6, textHeight(value || ' ', el.w, el.fontSize) * vp.zoom + fontSize * 0.4);

  return (
    <textarea
      ref={ref}
      value={value}
      aria-label={note ? 'Sticky note text' : 'Text'}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          onDone(value);
        }
      }}
      style={{
        position: 'absolute',
        left: el.x * vp.zoom + vp.x,
        top,
        width: el.w * vp.zoom,
        height,
        padding: pad,
        boxSizing: 'border-box',
        fontFamily: WB_FONT,
        fontSize,
        lineHeight: 1.3,
        color,
        background: 'transparent',
        border: '1.5px dashed rgba(100,100,255,0.6)',
        borderRadius: 3,
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        zIndex: 3,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        transformOrigin: `${(el.w * vp.zoom) / 2}px ${originY}px`,
      }}
    />
  );
}

/** Natural pixel size of an image file. */
function imageSize(file: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth || 320, h: img.naturalHeight || 240 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ w: 320, h: 240 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
