import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../core/types';
import { bulkSalvageable, materialValue, MAX_STASH, useGameStore } from '../state/gameStore';

export function useBackpackSelection(visible: Item[]) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const selected = useMemo(() => visible.filter((item) => ids.has(item.id)), [ids, visible]);
  useEffect(() => {
    if (selected.length < ids.size) setIds(new Set(selected.map((item) => item.id)));
  }, [ids, selected]);
  return {
    active,
    visible,
    selected,
    has: (id: string) => ids.has(id),
    toggleMode() {
      setIds(new Set());
      setActive((value) => !value);
    },
    toggleItem(id: string) {
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    selectAll() {
      setIds(new Set(visible.map((item) => item.id)));
    },
    clear() {
      setIds(new Set());
    },
  };
}

type Selection = ReturnType<typeof useBackpackSelection>;

export function BackpackOrganizer({ batch }: { batch: Selection }) {
  return batch.active ? <BatchActions batch={batch} /> : null;
}

function BatchActions({ batch }: { batch: Selection }) {
  const {
    save,
    accounts,
    activeAccountId,
    labBackup,
    inCombat,
    cloudTransition,
    depositItems,
    salvageSelected,
  } = useGameStore();
  const [confirmation, setConfirmation] = useState('');
  const selectButton = useRef<HTMLButtonElement>(null);
  const eligible = batch.selected.filter((item) => bulkSalvageable(item, save.keepRareAffix));
  const eligibleIds = eligible.map((item) => item.id);
  const selectionKey = JSON.stringify(
    batch.selected.map((item) => [item.id, bulkSalvageable(item, save.keepRareAffix)]),
  );
  useEffect(() => setConfirmation(''), [selectionKey]);
  const confirming = confirmation === selectionKey;
  const free =
    MAX_STASH - (accounts.find((entry) => entry.id === activeAccountId)?.stash.length ?? 0);
  const count = batch.selected.length;
  const all = count > 0 && count === batch.visible.length;
  const crystals = eligible.reduce((sum, item) => sum + materialValue(item).crystals, 0);
  const skip = count - eligible.length;
  return (
    <section className="pack-batch-bar" aria-label="批量整理">
      <div className="pack-batch-selection">
        <strong aria-live="polite">已选 {count} 件</strong>
        <button
          ref={selectButton}
          type="button"
          className="ghost-button"
          disabled={!batch.visible.length}
          onClick={all ? batch.clear : batch.selectAll}
        >
          {all ? '清空选择' : `全选当前结果 · ${batch.visible.length}`}
        </button>
      </div>
      {confirming ? (
        <div className="pack-batch-confirm">
          <p>
            永久分解 {eligible.length} 件，获得 {crystals} 结晶。镶嵌宝石返还。
            {skip > 0 && `另有 ${skip} 件受保护，将保留。`}
          </p>
          <button
            type="button"
            className="danger-button"
            data-sound="forge"
            disabled={cloudTransition || inCombat}
            onClick={() => {
              salvageSelected(eligibleIds);
              setConfirmation('');
              selectButton.current?.focus();
            }}
          >
            确认分解 {eligible.length} 件
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setConfirmation('');
              selectButton.current?.focus();
            }}
          >
            取消分解
          </button>
        </div>
      ) : (
        <div className="pack-batch-actions">
          <button
            type="button"
            className="outline-button"
            data-sound="equip"
            disabled={!count || count > free || !!labBackup || inCombat || cloudTransition}
            onClick={() => depositItems(batch.selected.map((item) => item.id))}
          >
            {labBackup ? '演武期间不可存入' : count > free ? `仓库仅余 ${free} 格` : '存入共享仓库'}
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={!eligible.length || cloudTransition || inCombat}
            onClick={() => setConfirmation(selectionKey)}
          >
            {count && !eligible.length
              ? '所选装备受保护'
              : `分解所选${eligible.length ? ` · ${eligible.length} 件` : ''}`}
          </button>
        </div>
      )}
    </section>
  );
}
