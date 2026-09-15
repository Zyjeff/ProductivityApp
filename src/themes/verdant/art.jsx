import React, { useEffect, useRef, useState } from 'react';

// Original vector pixelwork. Every mark is authored here; no game assets or fonts.
const RUNES = ['M1 10V1h6v4H3v5h4','M1 1h6v9H1V6h3V3','M1 1v9h6V6H4V1','M1 1h6v3H4v6H1V7','M1 1v6h6V1M4 7v4','M1 4h6M4 1v9M1 7v3h6','M1 1h3v3h3v6H1V7h3','M1 1h6M4 1v9M1 10h6'];
export function Glyph({ seed = 0, size = 22, className = '' }) {
  let n = typeof seed === 'string' ? [...seed].reduce((s, c) => s + c.charCodeAt(0), 0) : seed;
  return <svg className={className} width={size} height={size} viewBox="-3 -2 14 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"><path d={RUNES[n % RUNES.length]} /></svg>;
}
export function Crystal({ size = 112 }) {
  return <svg width={size} height={size * 1.22} viewBox="0 0 96 118" className="v-crystal" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#213e29" d="M43 3h12v8h9v10h9v16h7v40H69v16H58v16H40V99H28V85H17V50h8V30h9V13h9z"/>
    <path fill="#96f79b" d="M44 8h9v9h9v14h8v19l-20 53-15-23V32h9z"/>
    <path fill="#35ce68" d="M53 17h9v14h8v19l-20 53V45z"/>
    <path fill="#daffb8" d="M44 8h9v37L36 80V32h8z"/>
    <path fill="#67e987" d="M36 32v48l14 23H41v-9H30V80h-8V52h8V32z"/>
    <path fill="#178d4c" d="M70 42h6v32H65v16H55v13h-5z"/>
    <path fill="#b5ffbd" d="M36 32h8v8h-8zM29 55h7v20h-7zM43 86h7v9h-7z"/>
    <path fill="#f2ffe1" d="M44 17h5v19h-5zM39 40h5v8h-5zM30 52h5v7h-5z"/>
    <path fill="#55e483" d="M57 48h6v12h-6zM52 65h6v7h-6z"/>
    <path fill="#cfffbe" opacity=".7" d="M68 31h3v15h-3zM25 52h3v22h-3z"/>
  </svg>;
}
export function Seal({ pct = 0, seed = 0, active = false, compact = false, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => { const fn = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', fn); return () => document.removeEventListener('visibilitychange', fn); }, []);
  const tilt = e => {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const b = e.currentTarget.getBoundingClientRect();
    ref.current?.style.setProperty('--tilt-x', `${(e.clientX-b.x-b.width/2)/b.width*7}deg`);
    ref.current?.style.setProperty('--tilt-y', `${-(e.clientY-b.y-b.height/2)/b.height*7}deg`);
  };
  return <div ref={ref} className={'v-seal' + (compact ? ' v-seal--compact' : '') + (active && visible ? ' v-seal--active' : '')} onPointerMove={tilt} onPointerLeave={() => {ref.current?.style.setProperty('--tilt-x','0deg'); ref.current?.style.setProperty('--tilt-y','0deg');}}>
    <svg className="v-seal-drawing" viewBox="0 0 320 320" aria-hidden="true" fill="none">
      <circle cx="160" cy="160" r="136" stroke="currentColor" strokeOpacity=".16" strokeDasharray="1 7" />
      <path d="M160 8v16M160 296v16M8 160h16M296 160h16" stroke="currentColor" strokeOpacity=".5"/>
      <g className="v-orbit">
        <circle cx="160" cy="160" r="112" stroke="currentColor" strokeOpacity=".3"/>
        <circle cx="160" cy="160" r="91" stroke="currentColor" strokeOpacity=".18"/>
        {Array.from({length:24}, (_,i) => <g key={i} transform={`translate(160 160) rotate(${i*15}) translate(-4 -108)`}><path d={RUNES[(i + (typeof seed === 'number' ? seed : seed.length)) % 8]} stroke="currentColor" strokeWidth="1.2" opacity={i%3 ? '.6' : '.9'}/></g>)}
      </g>
      <path d="M160 76l84 84-84 84-84-84zM160 90l70 70-70 70-70-70z" stroke="currentColor" strokeOpacity=".14" />
      {Array.from({length:40}, (_,i) => <rect key={i} x="158" y="27" width="4" height={i%5===0 ? 7 : 3} transform={`rotate(${i*9} 160 160)`} fill={i < Math.round(pct/2.5) ? 'var(--amber)' : 'currentColor'} opacity={i < Math.round(pct/2.5) ? 1 : .17} />)}
      {[0,90,180,270].map(i => <g key={i} transform={`rotate(${i} 160 160)`}><path d="M154 18h12v12h-12zM157 21h6v6h-6z" stroke="currentColor" strokeOpacity=".7"/></g>)}
    </svg>
    <div className="v-seal-center">{children || (compact ? <Glyph seed={seed} size={62}/> : <Crystal />)}</div>
    {!compact && <div className="v-sparks" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} style={{'--i':i,left:`${13+(i*31)%76}%`,top:`${17+(i*19)%70}%`}}/>)}</div>}
  </div>;
}
export function Segments({ pct = 0, count = 20 }) {return <div className="v-segments" role="meter" aria-label="Progress" aria-valuenow={Math.round(Math.min(100,pct))} aria-valuemin={0} aria-valuemax={100}>{Array.from({length:count},(_,i)=><i key={i} className={i < pct / 100 * count ? 'on' : ''}/>)}</div>;}
export function Heading({ eyebrow, title, subtitle, children }) {return <header className="v-heading"><div><div className="v-eyebrow"><Glyph size={16}/>{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div className="v-heading-actions">{children}</div>}</header>;}
