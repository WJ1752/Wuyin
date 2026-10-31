import { useState } from 'react';
import type { ClassId } from '../core/types';
import { CLASSES } from '../data/classes';
import { MAX_CHARACTERS, useGameStore } from '../state/gameStore';
import { HeroArt } from './SceneArt';
import { Check, Lock } from './PixelIcons';

export function AccountPanel() {
  const store = useGameStore();
  const account = store.accounts.find((entry) => entry.id === store.activeAccountId)!;
  const [accountName, setAccountName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [classId, setClassId] = useState<ClassId>('ranger');
  const locked = !!store.labBackup || store.inCombat;
  return (
    <div className="account-panel">
      <section className="card">
        <div className="section-heading">
          <h3>当前账号 · {account.name}</h3>
          <span>本地账号</span>
        </div>
        <p className="muted">
          每个账号最多创建 6 个角色。角色独立成长、独立背包，装备可经共享仓库交给同账号其他角色。
          账号保存在当前浏览器，可在设置中导出备份。
        </p>
        {locked && (
          <p className="positive">
            <Lock size={14} /> 请先结束演武或远征，再管理账号与仓库。
          </p>
        )}
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
              <button
                key={character.id}
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
              </button>
            );
          })}
          {Array.from({ length: MAX_CHARACTERS - account.characters.length }, (_, index) => (
            <div className="account-character empty" key={`empty-${index}`}>
              <span>＋</span>
              <small>空闲角色位</small>
            </div>
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
        <p className="muted">新角色从 Lv.1 开始，职业在创建时确定。同一职业也可以创建多个角色。</p>
      </form>
    </div>
  );
}
