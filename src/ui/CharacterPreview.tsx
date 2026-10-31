import { useEffect, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { Sword } from 'lucide-react';
import type { ClassId, SaveData } from '../core/types';
import { CharacterRig } from '../render/ProceduralRig';

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
        await app.init({
          width: 170,
          height: 220,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
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
        container.position.set(77, 151);
        container.scale.set(2.15);
        const rig = new CharacterRig(classId, JSON.parse(appearance));
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
