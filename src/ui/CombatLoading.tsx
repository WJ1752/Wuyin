import { Component, type ReactNode } from 'react';
import type { CombatConfig } from '../core/types';
import { getCampaignChapter } from '../data/campaign';
import { STAGES } from '../data/stages';
import { reportClientEvent } from '../state/telemetry';
import { Swords } from './PixelIcons';

export function CombatLoading({
  config,
  lab,
  official,
}: {
  config: CombatConfig;
  lab: boolean;
  official: boolean;
}) {
  const chapter =
    !lab && !config.challenge && !official ? getCampaignChapter(config.stage) : undefined;
  return (
    <div className="rift-arrival" role="status">
      <Swords size={30} />
      <strong>
        {config.training
          ? '秘境演武场'
          : (chapter?.title ?? STAGES[config.stage - 1]?.name ?? '秘境')}
      </strong>
      <span>正在布置战场</span>
    </div>
  );
}

export class CombatLoadBoundary extends Component<
  { onReturnToCamp: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    reportClientEvent('runtime', 'battle-module-unavailable');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="combat-screen">
        <div className="paused-label" role="alert">
          <h2>无法加载战斗</h2>
          <p>刷新游戏后，可从营地再次出征。</p>
          <button className="gold-button" onClick={() => window.location.reload()}>
            刷新游戏
          </button>
          <button className="outline-button" onClick={this.props.onReturnToCamp}>
            返回营地
          </button>
        </div>
      </section>
    );
  }
}
