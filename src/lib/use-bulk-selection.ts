"use client";

/**
 * Row selection for bulk actions on list pages.
 *
 * Selection is scoped to the rows currently visible: `selectedIds` only ever
 * contains ids in `visibleIds`, so narrowing a filter can never leave hidden
 * rows silently selected for a bulk action. Rows that come back into view keep
 * their checked state.
 */

import { useCallback, useMemo, useState } from "react";

export function useBulkSelection(visibleIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const visibleKey = visibleIds.join("|");
  const selectedIds = useMemo(
    () => visibleIds.filter((id) => picked.has(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleKey, picked],
  );

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setPicked((prev) => new Set([...prev, ...visibleIds]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const unselectAll = useCallback(() => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.delete(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  /** Drop specific ids (e.g. rows that left the list after an action). */
  const deselect = useCallback((ids: string[]) => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const count = selectedIds.length;
  const total = visibleIds.length;

  return {
    selectedIds,
    isSelected: (id: string) => picked.has(id),
    toggle,
    selectAll,
    unselectAll,
    deselect,
    count,
    total,
    allSelected: total > 0 && count === total,
    someSelected: count > 0 && count < total,
  };
}

/** Run an action per id and summarise the outcome for a toast. */
export async function runBulk(
  ids: string[],
  action: (id: string) => Promise<unknown>,
): Promise<{ ok: string[]; failed: { id: string; message: string }[] }> {
  const results = await Promise.allSettled(ids.map((id) => action(id)));
  const ok: string[] = [];
  const failed: { id: string; message: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push(ids[i]);
    else
      failed.push({
        id: ids[i],
        message: r.reason instanceof Error ? r.reason.message : "Failed",
      });
  });
  return { ok, failed };
}
