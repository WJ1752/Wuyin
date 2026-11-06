import { useRef, useState } from 'react';
import type { ClassId } from '../core/types';
import { CLASSES } from '../data/classes';
import { MAX_CHARACTERS, useGameStore } from '../state/gameStore';
import { HeroArt } from './SceneArt';
import { Check, Lock } from './PixelIcons';
import { CloudAccountPanel } from './CloudAccountPanel';
import './character-story.css';

export function AccountPanel({ onEnterHall }: { onEnterHall?: () => void }) {
  const store = useGameStore();
  const account = store.accounts.find((entry) => entry.id === store.activeAccountId)!;
  const [accountName, setAccountName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [classId, setClassId] = useState<ClassId>('ranger');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const selectedClass = CLASSES.find((hero) => hero.id === classId)!;
  const locked = !!store.labBackup || store.inCombat || store.cloudTransition;
  return (
    <div className="account-panel">
      <CloudAccountPanel onEnterHall={onEnterHall} />
      <section className="card">
        <div className="section-heading">
          <h3>当前账号 · {account.name}</h3>
          <span>{store.cloudUserId ? '云账号' : '访客本地账号'}</span>
        </div>
        <p className="muted">
          每个账号最多创建 6 个角色。角色独立成长、独立背包，装备可经共享仓库交给同账号其他角色。
          {store.cloudUserId
            ? '进度保存在此云账号，断线时保留本机副本。'
            : '访客账号保存在当前浏览器，可在设置中导出备份。'}
        </p>
        {locked && (
          <p className="positive">
            <Lock size={14} /> 请先结束演武或远征，再管理账号与仓库。
          </p>
        )}
        {!store.cloudUserId && (
          <div className="account-forms">
            <label>
              切换账号
              <select
                className="system-select"
                value={account.id}
                disabled={locked}
                onChange={(event) => store.switchAccount(event.target.value)}
              >
                {store.accounts.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                store.createAccount(accountName);
                setAccountName('');
              }}
            >
              <label>
                新账号名称
                <input
                  value={accountName}
                  maxLength={24}
                  required
                  disabled={locked}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="输入账号名称"
                />
              </label>
              <button className="ghost-button" disabled={locked || !accountName.trim()}>
                创建账号
              </button>
            </form>
          </div>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h3>角色名册</h3>
          <span>
            {account.characters.length} / {MAX_CHARACTERS}
          </span>
        </div>
        <div className="account-characters">
          {account.characters.map((character) => {
            const active = character.id === account.activeCharacterId;
            const save = active ? (store.labBackup ?? store.save) : character.save;
            const hero = CLASSES.find((entry) => entry.id === save.classId)!;
            return (
              <div
                key={character.id}
                className={`account-character-wrap ${active ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className={`account-character ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  disabled={locked}
                  onClick={() => store.switchCharacter(character.id)}
                >
                  <div className="account-portrait">
                    <HeroArt classId={save.classId} />
                  </div>
                  <strong>{character.name}</strong>
                  <span>
                    {hero.name} · Lv.{save.level}
                  </span>
                  <small>
                    {active ? (
                      <>
                        <Check size={12} /> 当前角色
                      </>
                    ) : (
                      `秘境 ${save.highestStage} 层`
                    )}
                  </small>
                  <small>
                    已通关 {save.clears} 场 · 最高秘境 {save.highestStage} 层
                  </small>
                </button>
                <button
                  type="button"
                  className="ghost-button character-delete"
                  disabled={locked}
                  title={`删除 ${character.name}`}
                  onClick={() => {
                    setDeleteTarget({ id: character.id, name: character.name });
                    setDeleteName('');
                  }}
                >
                  删除角色
                </button>
                {deleteTarget?.id === character.id && (
                  <div className="character-delete-confirm">
                    <strong>确认删除「{character.name}」</strong>
                    <span>
                      {hero.name} · Lv.{save.level} · 已通关 {save.clears} 场 · 最高{' '}
                      {save.highestStage} 层
                    </span>
                    <p>该角色背包、装备和成长将删除；账号与共享仓库保留。输入角色名确认。</p>
                    <input
                      aria-label="输入角色名确认删除"
                      value={deleteName}
                      onChange={(event) => setDeleteName(event.target.value)}
                      placeholder={character.name}
                    />
                    <button
                      className="danger-button"
                      disabled={locked || deleteName.trim() !== character.name}
                      onClick={() => {
                        store.deleteCharacter(character.id);
                        setDeleteTarget(null);
                        setDeleteName('');
                        if (useGameStore.getState().save.characterCreated === false)
                          onEnterHall?.();
                      }}
                    >
                      永久删除角色
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => {
                        setDeleteTarget(null);
                        setDeleteName('');
                      }}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {Array.from({ length: MAX_CHARACTERS - account.characters.length }, (_, index) => (
            <button
              type="button"
              className="account-character empty"
              disabled={locked}
              key={`empty-${index}`}
              onClick={() => {
                nameInput.current?.scrollIntoView({ block: 'nearest' });
                nameInput.current?.focus({ preventScroll: true });
              }}
            >
              <span>＋</span>
              <small>创建新角色</small>
            </button>
          ))}
        </div>
      </section>
      <form
        className="card character-create"
        onSubmit={(event) => {
          event.preventDefault();
          store.createCharacter(characterName, classId);
          setCharacterName('');
        }}
      >
        <h3>创建新角色</h3>
        <div className="account-forms">
          <label>
            角色名称
            <input
              ref={nameInput}
              value={characterName}
              maxLength={24}
              required
              disabled={locked}
              onChange={(event) => setCharacterName(event.target.value)}
              placeholder="为新的旅人命名"
            />
          </label>
          <label>
            职业
            <select
              className="system-select"
              value={classId}
              disabled={locked}
              onChange={(event) => setClassId(event.target.value as ClassId)}
            >
              {CLASSES.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  {hero.name} · {hero.weapon}
                </option>
              ))}
            </select>
          </label>
          <button
            className="gold-button"
            disabled={
              locked || !characterName.trim() || account.characters.length >= MAX_CHARACTERS
            }
          >
            {account.characters.length >= MAX_CHARACTERS ? '角色位已满' : '创建并进入'}
          </button>
        </div>
        <p style={{ color: selectedClass.color }}>
          {selectedClass.name} · {selectedClass.mainStat} · {selectedClass.resource}上限{' '}
          {selectedClass.maxResource} · 基础生命 {selectedClass.hp}
        </p>
        <p className="muted">{selectedClass.lore}</p>
        <p className="muted">新角色从 Lv.1 开始，职业在创建时确定。同一职业也可以创建多个角色。</p>
      </form>
    </div>
  );
}
