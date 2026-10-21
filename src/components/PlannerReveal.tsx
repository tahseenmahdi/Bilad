'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import ReturnToChoices from './ReturnToChoices';

export type PlannerTool = 'setup' | 'nearby' | 'browse' | 'trip' | 'milai';
const options: {id: PlannerTool; label: string; icon: string}[] = [
  {id:'setup',label:'Plan a trip',icon:'route'},
  {id:'nearby',label:'Nearby places',icon:'pin'},
  {id:'browse',label:'Browse all',icon:'grid'},
  {id:'trip',label:'Your trip',icon:'list'},
  {id:'milai',label:'Ask Milai',icon:'milai'},
];

function ToolIcon({kind}:{kind:string}) {
  if(kind==='milai') return <img className="planner-tool-mascot" src="/assets/ai%20mascot.png" alt="" width="20" height="24"/>;
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==='pin'?<><path d="M18 10c0 4-6 10-6 10s-6-6-6-10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/></>:kind==='grid'?<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>:kind==='list'?<><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>:<><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h8a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h2"/></>}
  </svg>;
}

export default function PlannerReveal({active,onChange,tripCount,children}:{active:PlannerTool|null;onChange:(tool:PlannerTool|null)=>void;tripCount:number;children:ReactNode}) {
  const panelId=useId();
  const menuId=useId();
  const [menuOpen,setMenuOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const more=useRef<HTMLButtonElement>(null);
  const heading=useRef<HTMLButtonElement>(null);
  const previous=useRef<PlannerTool|null>(null);
  const current=options.find(option=>option.id===active);

  useEffect(()=>{
    const timer=setTimeout(()=>{
      if(active) {
        // Do not steal focus if the visitor already reached a field during the reveal.
        if(!root.current?.contains(document.activeElement)) heading.current?.focus({preventScroll:true});
      }
      else if(previous.current) root.current?.querySelector<HTMLButtonElement>(`[data-tool="${previous.current}"]`)?.focus({preventScroll:true});
      previous.current=active;
    },window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);
    return()=>clearTimeout(timer);
  },[active]);
  useEffect(()=>{
    if(!menuOpen)return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    const dismiss=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node)&&!more.current?.contains(event.target as Node))setMenuOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[menuOpen]);

  function open(tool:PlannerTool|null) {setMenuOpen(false);onChange(tool);}
  return <div className={`planner-reveal-deck${active?' has-open-tool':''}`} data-active={active??'none'} ref={root} onKeyDown={event=>{
    if(event.key!=='Escape')return;
    event.stopPropagation();
    if(menuOpen){setMenuOpen(false);more.current?.focus();}else if(active)open(null);
  }}>
    {!current?<nav className="planner-doorways" aria-label="Map tools">{options.map(option=><button type="button" key={option.id} data-tool={option.id} className="planner-doorway" aria-expanded="false" aria-controls={panelId} onClick={()=>open(option.id)}><ToolIcon kind={option.icon}/><span>{option.label}</span>{option.id==='trip'&&tripCount>0&&<small>{tripCount}</small>}<i className="planner-doorway-sheen" aria-hidden="true"/></button>)}</nav>:<>
      <div className="planner-open-bar">
        <button ref={heading} className="planner-open-title" type="button" aria-label={`Collapse ${current.label}`} aria-expanded="true" aria-controls={panelId} onClick={()=>open(null)}><ToolIcon kind={current.icon}/><span>{current.label}</span><span className="planner-collapse-mark" aria-hidden="true">−</span></button>
        <div className="planner-more-tools">
          <button ref={more} type="button" className="planner-more-orb" aria-label="Other map tools" aria-expanded={menuOpen} aria-controls={menuId} onClick={()=>setMenuOpen(!menuOpen)}><span className="option-dots" aria-hidden="true"><i/><i/><i/></span></button>
          <div className="planner-tools-menu" id={menuId} ref={menu} hidden={!menuOpen}>{options.filter(option=>option.id!==active).map(option=><button type="button" key={option.id} data-tool={option.id} onClick={()=>open(option.id)}><ToolIcon kind={option.icon}/>{option.label}</button>)}<ReturnToChoices label="All options" compact onClick={()=>open(null)} /></div>
        </div>
      </div>
    </>}
    <div id={panelId} className="planner-reveal-region" hidden={!current} role="region" aria-label={current?.label??'Map tools'}><div key={active} className="planner-reveal-content">{children}</div></div>
  </div>;
}
