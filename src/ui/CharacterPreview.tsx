import { useEffect, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { Sword } from './PixelIcons';
import type { ClassId, SaveData } from '../core/types';
import { CharacterRig } from '../render/ProceduralRig';
import { preloadCharacterTextures } from '../render/CharacterTextures';

/** The inventory uses the same articulated model and gear appearance as combat. */
export function CharacterPreview({
  classId,
  equipment,
}: {
  classId: ClassId;
  equipment: SaveData['equipment'];
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const appearance = JSON.stringify(equipment);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    void (async () => {
      try {
        const items: SaveData['equipment'] = JSON.parse(appearance);
        await preloadCharacterTextures(classId, items);
        if (disposed) return;
        await app.init({
          width: 170,
          height: 220,
          backgroundAlpha: 0,
          antialias: false,
          resolution: 1,
          roundPixels: true,
          autoDensity: true,
          preference: 'webgl',
        });
        initialized = true;
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        setFailed(false);
        element.appendChild(app.canvas);
        const container = new Container();
        container.position.set(85, 184);
        container.scale.set(1.85);
        const rig = new CharacterRig(classId, items);
        container.addChild(rig);
        app.stage.addChild(container);
        let time = 0;
        app.ticker.add((ticker) => {
          const dt = Math.min(0.05, ticker.deltaMS / 1000);
          time += dt;
          rig.update(time, dt, false, 1, false);
        });
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      if (initialized) app.destroy(true, { children: true });
    };
  }, [classId, appearance]);
  return (
    <div className="character-rig-preview" ref={host} role="img" aria-label="当前角色与装备外观">
      {failed && <Sword size={72} strokeWidth={1} />}
    </div>
  );
}
