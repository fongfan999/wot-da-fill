import { useCallback, useRef, useState } from "react";

const LIMIT = 200;
/** Changes with the same key closer together than this merge into one undo step (a drag, a burst of typing). */
const MERGE_MS = 1000;

interface History<T> {
	past: T[];
	future: T[];
	key: string | null;
	at: number;
}

/** State with undo/redo. The ref is the source of truth so several changes in one tick chain correctly. */
export function useUndoable<T>(initial: T) {
	const [value, setValue] = useState(initial);
	const current = useRef(initial);
	const history = useRef<History<T>>({ past: [], future: [], key: null, at: 0 });
	const [, rerender] = useState(0);

	const commit = useCallback((next: T) => {
		current.current = next;
		setValue(next);
		rerender((n) => n + 1);
	}, []);

	const change = useCallback(
		(update: (prev: T) => T, mergeKey: string | null = null) => {
			const prev = current.current;
			const next = update(prev);
			if (next === prev) return;
			const h = history.current;
			const now = performance.now();
			const merge = mergeKey !== null && mergeKey === h.key && now - h.at < MERGE_MS;
			if (!merge) {
				h.past.push(prev);
				if (h.past.length > LIMIT) h.past.shift();
			}
			h.future = [];
			h.key = mergeKey;
			h.at = now;
			commit(next);
		},
		[commit],
	);

	/** Replace the value and forget the history (new design, sample, shared template). */
	const reset = useCallback(
		(next: T) => {
			history.current = { past: [], future: [], key: null, at: 0 };
			commit(next);
		},
		[commit],
	);

	const undo = useCallback(() => {
		const h = history.current;
		const prev = h.past.pop();
		if (prev === undefined) return;
		h.future.push(current.current);
		h.key = null;
		commit(prev);
	}, [commit]);

	const redo = useCallback(() => {
		const h = history.current;
		const next = h.future.pop();
		if (next === undefined) return;
		h.past.push(current.current);
		h.key = null;
		commit(next);
	}, [commit]);

	return {
		value,
		change,
		reset,
		undo,
		redo,
		canUndo: history.current.past.length > 0,
		canRedo: history.current.future.length > 0,
	};
}
