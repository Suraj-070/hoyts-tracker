'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CINEMAS, TYPE_LABEL, KNOWN_MOVIES } from '../lib/constants'
import { todayKey, fmtDateLong, fmtDayLabel, fmtTime, groupByDateAndHall, sortHalls, getUniqueDates } from '../lib/utils'
import SeatMap from '../components/SeatMap'
import MoviePoster, { CardPoster } from '../components/MoviePoster'

// ─── Cache ──────────────────────────────────────────────────────────────────
const CK = (id) => `hoyts-sessions-${id}`
const MAX = 2 * 24 * 60 * 60 * 1000
const saveC = (id,s) => { try{localStorage.setItem(CK(id),JSON.stringify({savedAt:Date.now(),sessions:s}))}catch(e){} }
const loadC = (id) => { try{const r=localStorage.getItem(CK(id));if(!r)return null;const{savedAt,sessions}=JSON.parse(r);if(Date.now()-savedAt>MAX){localStorage.removeItem(CK(id));return null};return sessions.filter(s=>new Date(s.date||'').getTime()>Date.now()-MAX)}catch(e){return null} }
const clearOld = () => { try{Object.keys(localStorage).filter(k=>k.startsWith('hoyts-sessions-')).forEach(k=>{try{const{savedAt}=JSON.parse(localStorage.getItem(k));if(Date.now()-savedAt>MAX)localStorage.removeItem(k)}catch(e){localStorage.removeItem(k)}})}catch(e){} }

// ─── Time ──────────────────────────────────────────────────────────────────
const now$    = () => { const n=new Date(); return n.getHours()*60+n.getMinutes() }
const status$ = (ss) => { const n=now$(); for(const s of ss){if(s.startMin<=n&&n<s.endMin)return'playing'}; return now$()>=ss[ss.length-1].endMin?'done':'upcoming' }
const current$= (ss) => { const n=now$(); return ss.find(s=>s.startMin<=n&&n<s.endMin)||null }
const next$   = (ss) => { const n=now$(); return ss.find(s=>s.startMin>n)||null }
const human$  = (m) => { if(!m||m<1)return'now'; if(m<60)return`${m}m`; return`${Math.floor(m/60)}h ${m%60}m` }
const pct$    = (start,end) => { const n=now$(); if(n<start||n>=end)return 0; return Math.round(((n-start)/(end-start))*100) }

// ─── Type palette ───────────────────────────────────────────────────────────
const TC  = {DBOX:'var(--dbox)',XTREME:'var(--xtreme)',IMAX:'var(--imax)',VMAX:'var(--vmax)',LUX:'var(--lux)',GOLD:'var(--goldx)',STANDARD:'var(--std)'}
const TB  = {DBOX:'var(--dbox-bg)',XTREME:'var(--xtr-bg)',IMAX:'var(--imax-bg)',VMAX:'var(--vmax-bg)',LUX:'var(--lux-bg)',GOLD:'var(--goldx-bg)',STANDARD:'var(--std-bg)'}
const TD  = {DBOX:'var(--dbox-bdr)',XTREME:'var(--xtr-bdr)',IMAX:'var(--imax-bdr)',VMAX:'var(--vmax-bdr)',LUX:'var(--lux-bdr)',GOLD:'var(--goldx-bdr)',STANDARD:'var(--std-bdr)'}
const ALL = ['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD']

// ─── Ambient ────────────────────────────────────────────────────────────────
function Ambient({view}) {
  const c={tonight:['rgba(245,166,35,0.04)','rgba(0,229,160,0.025)'],schedule:['rgba(123,111,255,0.04)','rgba(245,166,35,0.02)'],closing:['rgba(245,166,35,0.05)','rgba(255,107,53,0.02)'],settings:['rgba(191,95,255,0.03)','rgba(0,191,255,0.02)']}
  const[c1,c2]=c[view]||c.tonight
  return(<div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}} aria-hidden><div style={{position:'absolute',top:'-30%',left:'-15%',width:'65vw',height:'65vw',maxWidth:560,maxHeight:560,borderRadius:'50%',background:c1,filter:'blur(120px)',transition:'background 1.5s ease'}}/><div style={{position:'absolute',bottom:'-15%',right:'-20%',width:'55vw',height:'55vw',maxWidth:440,maxHeight:440,borderRadius:'50%',background:c2,filter:'blur(140px)',transition:'background 1.5s ease'}}/></div>)
}

// ─── Offline / PWA / Pull-to-refresh ────────────────────────────────────────
function OfflineBanner() {
  const[off,setOff]=useState(false),[show,setShow]=useState(false)
  useEffect(()=>{const a=()=>{setOff(true);setShow(true)},b=()=>{setShow(true);setOff(false);setTimeout(()=>setShow(false),2500)};window.addEventListener('offline',a);window.addEventListener('online',b);if(!navigator.onLine){setOff(true);setShow(true)};return()=>{window.removeEventListener('offline',a);window.removeEventListener('online',b)}},[])
  if(!show)return null
  return(<div style={{position:'fixed',top:54,left:0,right:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'8px 16px',background:off?'rgba(239,68,68,0.94)':'rgba(0,229,160,0.94)',borderBottom:`1px solid ${off?'rgba(239,68,68,0.3)':'rgba(0,229,160,0.3)'}`,animation:'slideDown 0.3s ease'}}><i className={`ti ${off?'ti-wifi-off':'ti-wifi'}`} style={{fontSize:13,color:'#fff'}}/><span style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:700,letterSpacing:1.5,color:'#fff',textTransform:'uppercase'}}>{off?'No connection — cached data':'Back online'}</span></div>)
}

function PWABanner() {
  const[p,setP]=useState(null),[g,setG]=useState(false)
  useEffect(()=>{if(localStorage.getItem('pwa-dismissed')){setG(true);return};const h=(e)=>{e.preventDefault();setP(e)};window.addEventListener('beforeinstallprompt',h);return()=>window.removeEventListener('beforeinstallprompt',h)},[])
  if(!p||g)return null
  const go=async()=>{p.prompt();await p.userChoice;setP(null);localStorage.setItem('pwa-dismissed','1')}
  return(<div style={{position:'fixed',bottom:80,left:12,right:12,zIndex:150,background:'var(--bg-2)',border:'1px solid var(--gold-bdr)',borderRadius:20,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 24px 64px rgba(0,0,0,0.85)',animation:'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)'}}><div style={{width:40,height:40,background:'var(--gold-bg)',border:'1px solid var(--gold-bdr)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="ti ti-device-mobile" style={{fontSize:19,color:'var(--gold)'}}/></div><div style={{flex:1}}><div style={{fontFamily:'var(--body)',fontSize:13,fontWeight:600,color:'var(--t1)',marginBottom:2}}>Install Last Session</div><div style={{fontFamily:'var(--body)',fontSize:11,color:'var(--t3)'}}>Add to home screen</div></div><div style={{display:'flex',gap:6,flexShrink:0}}><button onClick={()=>{setP(null);setG(true);localStorage.setItem('pwa-dismissed','1')}} style={{fontFamily:'var(--mono)',fontSize:9,padding:'6px 10px',borderRadius:8,border:'1px solid var(--b2)',background:'transparent',color:'var(--t3)',letterSpacing:.5}}>Skip</button><button onClick={go} style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:700,padding:'6px 12px',borderRadius:8,border:'1px solid var(--gold-bdr)',background:'var(--gold-bg)',color:'var(--gold)',letterSpacing:.5}}>Install</button></div></div>)
}

function PullRefresh({onRefresh,loading}) {
  const sY=useRef(0),dR=useRef(0),lR=useRef(loading),[dist,setDist]=useState(0),[ref,setRef]=useState(false);const T=64
  useEffect(()=>{lR.current=loading},[loading])
  useEffect(()=>{
    const ts=(e)=>{if(window.scrollY>5)return;sY.current=e.touches[0].clientY;dR.current=0}
    const tm=(e)=>{if(window.scrollY>5)return;const d=Math.max(0,Math.min(T+20,e.touches[0].clientY-sY.current));dR.current=d;if(d>8)setDist(d)}
    const te=async()=>{const d=dR.current;if(d>=T&&!lR.current){setRef(true);await onRefresh();setRef(false)};dR.current=0;setDist(0)}
    window.addEventListener('touchstart',ts,{passive:true});window.addEventListener('touchmove',tm,{passive:true});window.addEventListener('touchend',te)
    return()=>{window.removeEventListener('touchstart',ts);window.removeEventListener('touchmove',tm);window.removeEventListener('touchend',te)}
  },[onRefresh])
  if(dist<2&&!ref)return null
  const trig=dist>=T
  return(<div style={{position:'fixed',top:54,left:0,right:0,zIndex:190,display:'flex',alignItems:'center',justifyContent:'center',height:ref?44:Math.min(44,dist*0.65),overflow:'hidden',background:'rgba(0,0,0,0.85)',borderBottom:`1px solid ${trig?'var(--gold-bdr)':'var(--b0)'}`,transition:dist===0?'height 0.3s ease':'border-color 0.15s'}}><div style={{display:'flex',alignItems:'center',gap:8}}><i className="ti ti-refresh" style={{fontSize:14,color:trig?'var(--gold)':'var(--t3)',transform:`rotate(${(dist/T)*180}deg)`,animation:ref?'spin 0.8s linear infinite':'none',transition:'color 0.2s,transform 0.06s'}}/><span style={{fontFamily:'var(--mono)',fontSize:9,letterSpacing:1.5,color:trig?'var(--gold)':'var(--t3)',fontWeight:700,textTransform:'uppercase',transition:'color 0.2s'}}>{ref?'Refreshing…':trig?'Release':'Pull to refresh'}</span></div></div>)
}

// ─── Ticker ─────────────────────────────────────────────────────────────────
function Ticker({sessions,movieMap}) {
  const halls=groupByDateAndHall(sessions,movieMap)[todayKey()]||{}
  const sorted=sortHalls(halls)
  const dot=<span style={{fontFamily:'var(--mono)',fontSize:8,color:'rgba(0,0,0,0.28)',padding:'0 10px',flexShrink:0}}>◆</span>
  const items=(pfx)=>sorted.length
    ? sorted.flatMap(([name,hall],i)=>{
        const last=hall.sessions[hall.sessions.length-1]
        const st=status$(hall.sessions),col=st==='playing'?'rgba(0,80,40,0.6)':st==='done'?'rgba(0,0,0,0.25)':'rgba(0,0,0,0.15)'
        return[<span key={pfx+i} style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:700,letterSpacing:2,color:'#080808',padding:'0 18px',flexShrink:0,background:col}}>{name} · {fmtTime(last.startMin)}</span>,<span key={pfx+i+'d'} style={{fontFamily:'var(--mono)',fontSize:8,color:'rgba(0,0,0,0.22)',flexShrink:0}}>◆</span>]
      })
    : [<span key={pfx} style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:700,letterSpacing:2,color:'#080808',padding:'0 24px',flexShrink:0}}>HOYTS LAST SESSION TRACKER · SELECT YOUR CINEMA</span>]
  return(<div style={{background:'var(--gold)',height:26,overflow:'hidden',display:'flex',alignItems:'center'}}><div style={{display:'flex',whiteSpace:'nowrap',animation:'ticker 52s linear infinite',willChange:'transform'}}>{items('a')}{items('b')}</div></div>)
}

// ─── Cinema picker ──────────────────────────────────────────────────────────
function CinemaSheet({value,onChange,open,onClose}) {
  const[search,setSearch]=useState(''),ref=useRef(null)
  useEffect(()=>{if(open){document.body.style.overflow='hidden';setTimeout(()=>ref.current?.focus(),250)}else{document.body.style.overflow='';setSearch('')};return()=>{document.body.style.overflow=''}},[open])
  const grouped=CINEMAS.reduce((acc,c)=>{if(search&&!c.name.toLowerCase().includes(search.toLowerCase()))return acc;if(!acc[c.state])acc[c.state]=[];acc[c.state].push(c);return acc},{})
  const total=Object.values(grouped).reduce((a,arr)=>a+arr.length,0)
  if(!open)return null
  return(
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.88)'}}/>
      <div style={{position:'relative',zIndex:1,background:'var(--bg-2)',borderRadius:'24px 24px 0 0',border:'1px solid var(--b2)',borderBottom:'none',maxHeight:'88vh',minHeight:'40vh',display:'flex',flexDirection:'column',boxShadow:'0 -28px 80px rgba(0,0,0,0.95)',animation:'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'16px 0 4px'}}><div style={{width:36,height:4,borderRadius:2,background:'var(--b3)'}}/></div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 22px 14px'}}>
          <span style={{fontFamily:'var(--display)',fontSize:28,color:'var(--t1)',letterSpacing:2}}>Select Cinema</span>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:9,border:'1px solid var(--b2)',background:'var(--bg-3)',color:'var(--t2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✕</button>
        </div>
        <div style={{padding:'0 16px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg-1)',border:'1px solid var(--b2)',borderRadius:14,padding:'12px 16px'}}>
            <i className="ti ti-search" style={{fontSize:14,color:'var(--t3)',flexShrink:0}}/>
            <input ref={ref} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cinemas…" style={{flex:1,background:'transparent',border:'none',outline:'none',fontFamily:'var(--body)',fontSize:15,color:'var(--t1)',caretColor:'var(--gold)'}}/>
            {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:'var(--t3)',fontSize:13,padding:0}}>✕</button>}
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1,WebkitOverflowScrolling:'touch',paddingBottom:'calc(env(safe-area-inset-bottom,0px)+28px)'}}>
          {total===0&&<div style={{textAlign:'center',padding:'48px 20px',color:'var(--t3)',fontFamily:'var(--body)',fontSize:14}}>No cinemas match "{search}"</div>}
          {Object.entries(grouped).map(([state,cins])=>(
            <div key={state}>
              <div style={{fontFamily:'var(--mono)',fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--t4)',padding:'10px 22px 4px'}}>{state}</div>
              {cins.map(c=>{const active=c.id===value;return(
                <button key={c.id} onClick={()=>{onChange(c.id);onClose()}} style={{display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',padding:'15px 22px',minHeight:56,background:active?'var(--gold-bg)':'transparent',border:'none',borderBottom:'1px solid var(--b0)',WebkitTapHighlightColor:'transparent'}}>
                  <i className="ti ti-building" style={{fontSize:15,color:active?'var(--gold)':'var(--t4)',flexShrink:0}}/>
                  <span style={{fontFamily:'var(--body)',fontSize:15,fontWeight:active?600:400,color:active?'var(--gold)':'var(--t1)',flex:1}}>{c.name}</span>
                  {active&&<i className="ti ti-check" style={{fontSize:15,color:'var(--gold)',flexShrink:0}}/>}
                </button>
              )})}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CinemaPicker({value,onOpen}) {
  const c=CINEMAS.find(c=>c.id===value)
  return(<button onClick={onOpen} style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg-2)',border:'1px solid var(--b2)',borderRadius:22,padding:'7px 13px',fontFamily:'var(--body)',fontSize:12,fontWeight:500,color:'var(--t1)',transition:'border-color 0.15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--b3)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--b2)'}><i className="ti ti-map-pin" style={{fontSize:13,color:'var(--gold)'}}/><span style={{fontWeight:600,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c?.name||'Select cinema'}</span><i className="ti ti-chevron-down" style={{fontSize:11,color:'var(--t3)'}}/></button>)
}

// ─── Hall Card ──────────────────────────────────────────────────────────────
function HallCard({hallName,hall,expanded,onToggle,delay,cinemaId}) {
  const col=TC[hall.typeId]||'var(--std)',bg=TB[hall.typeId]||'var(--std-bg)',bdr=TD[hall.typeId]||'var(--std-bdr)',lbl=TYPE_LABEL[hall.typeId]||hall.typeId
  const sess=hall.sessions,last=sess[sess.length-1]
  const[occ,setOcc]=useState(null),[sel,setSel]=useState(null),[nowM,setNowM]=useState(now$())
  useEffect(()=>{if(!last.sessionId)return;fetch('/api/hoyts/seats?sessionId='+last.sessionId+'&cinemaId='+(last.cinemaId||cinemaId)).then(r=>r.json()).then(d=>{if(d.summary)setOcc(d.summary.occupancyPct)}).catch(()=>{})},[last.sessionId])
  useEffect(()=>{const t=setInterval(()=>setNowM(now$()),30000);return()=>clearInterval(t)},[])
  const st=status$(sess),cur=current$(sess),nx=next$(sess),isFin=cur&&cur.startMin===last.startMin
  const mL=cur?cur.endMin-nowM:null,mN=nx?nx.startMin-nowM:null
  const isSame=cur&&cur.movie===last.movie
  const poster=cur||last
  const highOcc=occ>=95?'#FF3B3B':occ>=80?'var(--dbox)':null
  const cls=isFin?'hall-card is-final':st==='playing'?'hall-card is-playing':st==='done'?'hall-card is-done':'hall-card'

  return(
    <div className="fade-up" style={{animationDelay:delay+'ms',marginBottom:10}}>
      <div onClick={()=>{navigator.vibrate?.(6);onToggle()}} className={cls}>
        <CardPoster movieName={poster.movie} movieId={poster.movieId}/>
        <div style={{position:'relative',zIndex:1}}>
          {/* Status strip */}
          {(st==='playing'||isFin)&&(
            <div style={{padding:'9px 14px 0',display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:isFin?'var(--gold)':'var(--playing)',boxShadow:`0 0 10px ${isFin?'var(--gold-glow)':'var(--playing-glow)'}`,animation:'blip 1.2s ease-in-out infinite',flexShrink:0}}/>
              <span style={{fontFamily:'var(--mono)',fontSize:8,fontWeight:700,letterSpacing:2,color:isFin?'var(--gold)':'var(--playing)',textTransform:'uppercase'}}>{isFin?'Final Show':'Now Playing'}</span>
              {mL>0&&<span style={{fontFamily:'var(--mono)',fontSize:8,color:isFin?'var(--gold-txt)':'rgba(0,229,160,0.6)',marginLeft:'auto',flexShrink:0}}>ends {human$(mL)}</span>}
            </div>
          )}
          <div style={{padding:'10px 14px 12px',display:'flex',gap:12,alignItems:'flex-start'}}>
            {/* Poster thumb */}
            <div style={{position:'relative',flexShrink:0}}>
              <MoviePoster movieName={poster.movie} movieId={poster.movieId} size="md"/>
              {highOcc&&st!=='done'&&<div style={{position:'absolute',top:-4,right:-4,width:12,height:12,borderRadius:'50%',background:highOcc,border:'2px solid var(--bg-1)',boxShadow:`0 0 10px ${highOcc}`,animation:'blip 1.2s ease-in-out infinite'}}/>}
            </div>
            {/* Info column */}
            <div style={{flex:1,minWidth:0}}>
              {/* Hall + badge */}
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4,flexWrap:'wrap'}}>
                <span style={{fontFamily:'var(--display)',fontSize:22,letterSpacing:1.5,color:'var(--t1)',lineHeight:1}}>{hallName}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:7,fontWeight:700,padding:'2px 7px',borderRadius:99,background:bg,color:col,border:`1px solid ${bdr}`,letterSpacing:.3,flexShrink:0,maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lbl}</span>
              </div>
              {/* Movie title — prominent */}
              <div style={{fontFamily:'var(--body)',fontSize:'clamp(15px,4vw,18px)',fontWeight:700,color:'var(--t1)',marginBottom:8,lineHeight:1.25,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{last.movie}</div>
              {/* Time chips */}
              <div style={{display:'flex',gap:5,flexWrap:'nowrap'}}>
                <TimeChip label={st==='done'?'LAST':'START'} value={fmtTime(last.startMin)} col={isFin?'var(--gold)':st==='playing'?'var(--playing)':col} dim={st==='done'}/>
                {last.runtime>0&&<TimeChip label="ENDS" value={'~'+fmtTime(last.endMin)} col='var(--t3)' dim={st==='done'}/>}
                {last.runtime>0&&<TimeChip label="RUN" value={last.runtime+'m'} col='var(--t4)' dim={st==='done'}/>}
              </div>
              {/* Upcoming */}
              {nx&&nx.startMin===last.startMin&&mN>0&&st!=='playing'&&(
                <div style={{marginTop:8,display:'inline-flex',alignItems:'center',gap:5,background:'var(--gold-bg)',border:'1px solid var(--gold-bdr)',borderRadius:99,padding:'3px 10px'}}>
                  <i className="ti ti-clock" style={{fontSize:10,color:'var(--gold)'}}/>
                  <span style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--gold)',letterSpacing:1}}>in {human$(mN)}</span>
                </div>
              )}
            </div>
            {/* Chevron + status dot */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,flexShrink:0,paddingTop:4}}>
              {st==='playing'&&!isFin&&<div style={{width:7,height:7,borderRadius:'50%',background:'var(--playing)',boxShadow:'0 0 10px var(--playing-glow)',animation:'blip 1.2s ease-in-out infinite'}}/>}
              <i className="ti ti-chevron-down chevron" style={{fontSize:15,color:'var(--t4)',transform:expanded?'rotate(180deg)':'none'}}/>
            </div>
          </div>
        </div>
        {/* Seat map */}
        {expanded&&sess.some(s=>s.sessionId)&&(
          <div style={{padding:'0 15px 15px',borderTop:'1px solid var(--b1)'}} onClick={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
            {sess.length>1&&<div style={{display:'flex',flexWrap:'wrap',gap:5,padding:'10px 0 10px'}}>{sess.map((s,i)=>{if(!s.sessionId)return null;const past=now$()>s.endMin,active=sel===s.sessionId;return(<button key={i} onClick={e=>{e.stopPropagation();e.preventDefault();setSel(s.sessionId)}} style={{fontFamily:'var(--display)',fontSize:18,letterSpacing:1,padding:'5px 12px',borderRadius:9,background:active?bg:'var(--bg-3)',border:`1px solid ${active?bdr:'var(--b1)'}`,color:active?col:past?'var(--t4)':'var(--t2)',opacity:past&&!active?0.5:1,transition:'all 0.15s',WebkitTapHighlightColor:'transparent'}}>{fmtTime(s.startMin)}</button>)})}</div>}
            <SeatMap key={sel} sessionId={String(sel||last.sessionId)} cinemaId={sess.find(s=>s.sessionId===sel)?.cinemaId||last.cinemaId||cinemaId} typeColor={col}/>
          </div>
        )}
      </div>
    </div>
  )
}

function TimeChip({label,value,col,dim}) {
  return(
    <div style={{background:'rgba(0,0,0,0.55)',borderRadius:8,padding:'5px 9px',border:'1px solid var(--b1)',minWidth:0,flexShrink:1}}>
      <div style={{fontFamily:'var(--mono)',fontSize:7,color:'var(--t4)',letterSpacing:1,marginBottom:2}}>{label}</div>
      <div style={{fontFamily:'var(--display)',fontSize:16,color:dim?'var(--t4)':col,lineHeight:1,whiteSpace:'nowrap'}}>{value}</div>
    </div>
  )
}

// ─── TypeSection ────────────────────────────────────────────────────────────
function TypeSection({typeId,halls,expandedHalls,toggleHall,prefix,cinemaId}) {
  if(!halls.length)return null
  const col=TC[typeId]||'var(--std)',lbl=TYPE_LABEL[typeId]||typeId
  return(
    <div style={{marginBottom:32}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:12,borderBottom:'1px solid var(--b0)'}}>
        <div style={{width:2,height:20,borderRadius:1,background:col,flexShrink:0,boxShadow:`0 0 10px ${col}90`}}/>
        <span style={{fontFamily:'var(--display)',fontSize:'clamp(14px,3.5vw,18px)',color:col,letterSpacing:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'calc(100% - 70px)'}}>{lbl}</span>
        <span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--t4)',marginLeft:'auto'}}>{halls.length} hall{halls.length!==1?'s':''}</span>
      </div>
      {halls.map(([name,hall],i)=><HallCard key={name} hallName={name} hall={hall} delay={i*40} cinemaId={cinemaId} expanded={!!expandedHalls[`${prefix}-${name}`]} onToggle={()=>toggleHall(`${prefix}-${name}`)}/>)}
    </div>
  )
}

// ─── DateTabs ───────────────────────────────────────────────────────────────
function DateTabs({dates,selected,onSelect}) {
  const today=todayKey()
  return(
    <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',paddingBottom:2,scrollSnapType:'x mandatory',WebkitOverflowScrolling:'touch'}}>
      {dates.map(d=>{
        const active=d===selected,isToday=d===today
        return(
          <button key={d} onClick={()=>onSelect(d)} style={{flexShrink:0,scrollSnapAlign:'start',fontFamily:'var(--body)',fontSize:12,fontWeight:active?600:500,padding:'8px 16px',borderRadius:99,border:`1px solid ${active?'var(--gold-bdr)':isToday?'var(--b3)':'var(--b2)'}`,background:active?'var(--gold-bg)':'transparent',color:active?'var(--gold)':isToday?'var(--t1)':'var(--t2)',whiteSpace:'nowrap',transition:'all 0.15s',position:'relative'}}>
            {d===today?'Today ●':fmtDayLabel(d)}
          </button>
        )
      })}
    </div>
  )
}

// ─── StatCard ───────────────────────────────────────────────────────────────
function StatCard({label,value,color,icon}) {
  return(
    <div className="stat-card" style={{flex:1,background:'var(--bg-1)',borderRadius:14,padding:'13px 15px',border:'1px solid var(--b1)',cursor:'default'}}>
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:7}}>
        {icon&&<i className={`ti ${icon}`} style={{fontSize:11,color:color||'var(--t4)'}}/>}
        <div style={{fontFamily:'var(--mono)',fontSize:9,letterSpacing:1.5,textTransform:'uppercase',color:'var(--t4)'}}>{label}</div>
      </div>
      <div className="stat-value" style={{fontFamily:'var(--display)',fontSize:'clamp(26px,5.5vw,34px)',color:color||'var(--t1)',letterSpacing:'2px',lineHeight:1}}>{value}</div>
    </div>
  )
}

// ─── DEPARTURE BOARD ────────────────────────────────────────────────────────
function DepartureBoard({halls,loading}) {
  const[nowM,setNowM]=useState(now$())
  useEffect(()=>{const t=setInterval(()=>setNowM(now$()),15000);return()=>clearInterval(t)},[])
  if(loading)return<SkeletonGrid/>
  if(!Object.keys(halls).length)return<EmptyState icon="night" title="No sessions today" sub="Switch cinema or check Schedule."/>
  const sorted=sortHalls(halls)
  return(
    <div>
      {/* Board header */}
      <div style={{background:'var(--bg-1)',border:'1px solid var(--b1)',borderRadius:'18px 18px 0 0',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <i className="ti ti-clock-hour-4" style={{fontSize:15,color:'var(--gold)'}}/>
          <span style={{fontFamily:'var(--display)',fontSize:20,color:'var(--t1)',letterSpacing:2}}>Tonight's Closing</span>
        </div>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--gold-bg)',border:'1px solid var(--gold-bdr)',borderRadius:99,padding:'3px 11px'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:'var(--gold)',animation:'pulse 2s ease-in-out infinite'}}/>
          <span style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--gold)',letterSpacing:1.5,fontWeight:700}}>LIVE</span>
        </div>
      </div>
      {/* Column headers */}
      <div style={{background:'var(--bg-2)',display:'grid',gridTemplateColumns:'100px 1fr auto',padding:'8px 20px',borderLeft:'1px solid var(--b1)',borderRight:'1px solid var(--b1)',borderBottom:'1px solid var(--b1)'}}>
        {['Closes ~','Hall · Film','Status'].map(h=><span key={h} style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--t4)',letterSpacing:2,textTransform:'uppercase',textAlign:h==='Status'?'right':'left'}}>{h}</span>)}
      </div>
      {/* Rows */}
      <div style={{border:'1px solid var(--b1)',borderTop:'none',borderRadius:'0 0 18px 18px',overflow:'hidden'}}>
        {sorted.map(([name,hall],i)=>{
          const last=hall.sessions[hall.sessions.length-1]
          const st=status$(hall.sessions),cur=current$(hall.sessions)
          const isFin=cur&&cur.startMin===last.startMin
          const col=TC[hall.typeId]||'var(--std)'
          const ml=cur?cur.endMin-nowM:null
          const prog=cur?pct$(cur.startMin,cur.endMin):0
          const rowCls=st==='done'?'board-row done':isFin?'board-row final':st==='playing'?'board-row playing':'board-row'+(i%2===1?' alt':'')
          const stLabel=st==='playing'&&isFin?`ends ${human$(ml)}`:st==='playing'?`${human$(ml)} left`:st==='done'?'CLOSED':`last ${fmtTime(last.startMin)}`
          const stColor=isFin?'var(--gold)':st==='playing'?'var(--playing)':st==='done'?'var(--t4)':'var(--t3)'
          return(
            <div key={name} className={rowCls} style={{animationDelay:i*25+'ms'}}>
              {/* Progress bar */}
              {prog>0&&<div className="board-progress" style={{width:prog+'%'}}/>}
              {/* Time */}
              <div><div className="board-time" style={{fontSize:'clamp(28px,6.5vw,44px)'}}>~{fmtTime(last.endMin)}</div></div>
              {/* Hall + movie */}
              <div style={{minWidth:0,paddingRight:14}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                  <span style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--t3)',letterSpacing:1.5,textTransform:'uppercase'}}>{name}</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:7,padding:'2px 7px',borderRadius:99,background:TB[hall.typeId]||'var(--std-bg)',color:TC[hall.typeId]||'var(--std)',border:`1px solid ${TD[hall.typeId]||'var(--std-bdr)'}`}}>{TYPE_LABEL[hall.typeId]||hall.typeId}</span>
                </div>
                <div style={{fontFamily:'var(--body)',fontWeight:600,fontSize:'clamp(12px,3.2vw,15px)',color:'var(--t1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{last.movie}</div>
              </div>
              {/* Status */}
              <div style={{textAlign:'right',flexShrink:0}}>
                {(st==='playing'||isFin)&&<div style={{width:6,height:6,borderRadius:'50%',background:stColor,boxShadow:`0 0 8px ${stColor}`,animation:'blip 1.2s ease-in-out infinite',marginLeft:'auto',marginBottom:5}}/>}
                <span style={{fontFamily:'var(--mono)',fontSize:8,fontWeight:700,letterSpacing:1,color:stColor,textTransform:'uppercase'}}>{stLabel}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Skeleton / Empty / Error ────────────────────────────────────────────────
function SkeletonGrid() {
  return(<div>{['DBOX','XTREME','IMAX','VMAX','STANDARD'].map((t,gi)=>(<div key={t} style={{marginBottom:32,animation:`fadeUp 0.4s ease ${gi*60}ms both`}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,paddingBottom:12,borderBottom:'1px solid var(--b0)'}}><div className="skeleton" style={{width:2,height:20,borderRadius:1}}/><div className="skeleton" style={{width:90,height:14,borderRadius:6}}/></div>{[1,2].map(i=><div key={i} className="skeleton" style={{height:130,borderRadius:18,marginBottom:10,animationDelay:`${gi*60+i*80}ms`}}/>)}</div>))}</div>)
}
function EmptyState({icon,title,sub}) {
  const I={film:<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".18"/><path d="M4 17h40M4 31h40M11 10v7M35 10v7M11 31v7M35 31v7" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".12" strokeLinecap="round"/></svg>,cal:<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="30" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".18"/><line x1="6" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".12"/><rect x="15" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity=".18"/><rect x="30" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity=".18"/></svg>,night:<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 8C15.2 8 8 15.2 8 24s7.2 16 16 16 16-7.2 16-16" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".18" strokeLinecap="round"/><path d="M32 8a16 16 0 0 1-16 16" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".12" strokeLinecap="round"/></svg>}
  return(<div style={{textAlign:'center',padding:'88px 20px'}}><div style={{color:'var(--t4)',marginBottom:18,display:'flex',justifyContent:'center'}}>{I[icon]||I.film}</div><div style={{fontFamily:'var(--display)',fontSize:24,color:'var(--t4)',letterSpacing:'3px',marginBottom:10}}>{title}</div><div style={{fontFamily:'var(--body)',fontSize:13,color:'var(--t4)',lineHeight:1.9,maxWidth:260,margin:'0 auto'}}>{sub}</div></div>)
}
function ErrorState({msg,onRetry}) {
  return(<div style={{background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.22)',borderRadius:14,padding:'16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:18}}><div><div style={{fontFamily:'var(--body)',fontSize:13,fontWeight:600,color:'#EF4444',marginBottom:3}}>Couldn't load sessions</div><div style={{fontFamily:'var(--body)',fontSize:12,color:'var(--t3)'}}>{msg}</div></div><button onClick={onRetry} style={{fontFamily:'var(--body)',fontWeight:600,fontSize:12,padding:'8px 14px',borderRadius:9,border:'1px solid var(--b2)',background:'var(--bg-2)',color:'var(--t1)',flexShrink:0}}>Retry</button></div>)
}

// ─── Settings ────────────────────────────────────────────────────────────────
function Sec({label,children}) { return(<div style={{marginBottom:24}}><div style={{fontFamily:'var(--mono)',fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--t4)',marginBottom:9}}>{label}</div><div style={{background:'var(--bg-1)',border:'1px solid var(--b1)',borderRadius:16,padding:'16px'}}>{children}</div></div>) }
function SRow({label,value}) { return(<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--b0)'}}><span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--t3)'}}>{label}</span><span style={{fontFamily:'var(--mono)',fontSize:10,fontWeight:700,color:'var(--t2)'}}>{value}</span></div>) }

// ─── BottomNav ───────────────────────────────────────────────────────────────
function BottomNav({view,setView}) {
  const tabs=[{id:'tonight',label:'Tonight',icon:'ti-moon'},{id:'schedule',label:'Schedule',icon:'ti-calendar'},{id:'closing',label:'Closing',icon:'ti-clock-off'},{id:'settings',label:'Settings',icon:'ti-settings'}]
  const ai=tabs.findIndex(t=>t.id===view)
  return(
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(32px) saturate(200%)',WebkitBackdropFilter:'blur(32px) saturate(200%)',borderTop:'1px solid var(--b1)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div style={{maxWidth:600,margin:'0 auto',display:'flex',height:64,position:'relative'}}>
        <div style={{position:'absolute',bottom:10,left:`calc(${ai*25}%+14px)`,width:'calc(25% - 28px)',height:2,background:'var(--gold)',borderRadius:1,boxShadow:'0 0 12px var(--gold-glow)',transition:'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',pointerEvents:'none'}}/>
        {tabs.map(t=>{const active=view===t.id;return(
          <button key={t.id} onClick={()=>{setView(t.id);window.scrollTo({top:0,behavior:'smooth'})}} className="nav-btn" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,background:'transparent',border:'none',color:active?'var(--gold)':'var(--t4)',fontFamily:'var(--mono)',fontSize:8,fontWeight:active?700:400,letterSpacing:1,textTransform:'uppercase',position:'relative',zIndex:1,WebkitTapHighlightColor:'transparent',transition:'color 0.2s'}}>
            <i className={`ti ${t.icon}`} style={{fontSize:21,transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',transform:active?'scale(1.15)':'scale(1)',filter:active?'drop-shadow(0 0 6px var(--gold))':''}}/>
            {t.label}
          </button>
        )})}
      </div>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({cinemaId,loading,lastFetched,onRefresh,onOpenPicker}) {
  const[,tick]=useState(0)
  useEffect(()=>{const t=setInterval(()=>tick(n=>n+1),60000);return()=>clearInterval(t)},[])
  const age=lastFetched?(()=>{const d=Math.floor((Date.now()-lastFetched)/60000);return d<1?'just now':d<60?`${d}m ago`:`${Math.floor(d/60)}h ago`})():null
  return(
    <div className="glass" style={{position:'sticky',top:0,zIndex:50,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(32px) saturate(200%)',WebkitBackdropFilter:'blur(32px) saturate(200%)',borderBottom:'1px solid var(--b1)'}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:'0 16px',display:'flex',alignItems:'center',justifyContent:'space-between',height:54,gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:32,height:32,background:'var(--gold)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 16px var(--gold-glow)',flexShrink:0}}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="2" width="13" height="11" rx="2.5" fill="#000"/><path d="M5 4.5L11 7.5L5 10.5V4.5Z" fill="#F5A623"/></svg>
          </div>
          <div>
            <div style={{fontFamily:'var(--display)',fontSize:20,color:'var(--t1)',letterSpacing:'1px',lineHeight:1}}>Last Session</div>
            <div style={{fontFamily:'var(--mono)',fontSize:8,letterSpacing:2.5,color:'var(--gold)',textTransform:'uppercase',marginTop:1}}>HOYTS Tracker</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {age&&<span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--t4)'}}>{age}</span>}
          <button onClick={onRefresh} disabled={loading} style={{width:34,height:34,borderRadius:9,border:'1px solid var(--b2)',background:'transparent',color:'var(--t3)',display:'flex',alignItems:'center',justifyContent:'center',transition:'border-color 0.15s,color 0.15s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--b4)';e.currentTarget.style.color='var(--t1)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--b2)';e.currentTarget.style.color='var(--t3)'}}>
            <i className="ti ti-refresh" style={{fontSize:16,animation:loading?'spin 1s linear infinite':'none'}}/>
          </button>
          <CinemaPicker value={cinemaId} onOpen={onOpenPicker}/>
        </div>
      </div>
    </div>
  )
}

function PageTitle({eyebrow,title,sub}) {
  return(
    <div style={{marginBottom:24}}>
      <div style={{fontFamily:'var(--mono)',fontSize:9,letterSpacing:3,color:'var(--t4)',textTransform:'uppercase',marginBottom:10}}>{eyebrow}</div>
      <div style={{fontFamily:'var(--display)',fontSize:'clamp(30px,7vw,48px)',color:'var(--t1)',letterSpacing:'2px',lineHeight:1}}>{title}</div>
      {sub&&<div style={{fontFamily:'var(--body)',fontSize:13,color:'var(--t3)',marginTop:7}}>{sub}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const[cinemaId,setCinemaId]=useState('EGDENS')
  const[sessions,setSessions]=useState([])
  const[movieMap,setMovieMap]=useState({})
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[selDate,setSelDate]=useState(todayKey())
  const[expanded,setExpanded]=useState({})
  const[lastFetched,setLastFetched]=useState(null)
  const[view,setView]=useState('tonight')
  const[picker,setPicker]=useState(false)

  const cinema=CINEMAS.find(c=>c.id===cinemaId)
  const movies={...KNOWN_MOVIES,...movieMap}

  useEffect(()=>{clearOld()},[])
  useEffect(()=>{const s=localStorage.getItem('hoyts-cinema');if(s)setCinemaId(s);try{const m=localStorage.getItem('hoyts-movies');if(m)setMovieMap(JSON.parse(m))}catch(e){}},[])
  const mmRef=useRef(movieMap);useEffect(()=>{mmRef.current=movieMap},[movieMap])

  const fetch$=useCallback(async(id)=>{
    setLoading(true);setError('')
    try{
      const res=await fetch(`/api/hoyts/sessions?cinema=${id}`)
      if(!res.ok)throw new Error('HTTP '+res.status)
      const data=await res.json();if(data.error)throw new Error(data.error)
      const arr=Array.isArray(data)?data:[]
      setSessions(arr);setLastFetched(new Date());saveC(id,arr)
      const miss=[...new Set(arr.map(s=>s.movieId).filter(Boolean))].filter(mid=>{const m={...KNOWN_MOVIES,...mmRef.current}[mid];return!m||!m.name})
      if(miss.length){fetch(`/api/hoyts/films?ids=${miss.join(',')}`).then(r=>r.json()).then(map=>{const mg={...mmRef.current};Object.entries(map).forEach(([id,f])=>{if(f&&(f.name||f.runtime))mg[id]={...(mg[id]||{}),...f}});setMovieMap(mg);localStorage.setItem('hoyts-movies',JSON.stringify(mg))}).catch(()=>{})}
    }catch(e){setError(e.message)}
    setLoading(false)
  },[])

  useEffect(()=>{localStorage.setItem('hoyts-cinema',cinemaId);fetch$(cinemaId);setExpanded({});setSelDate(todayKey())},[cinemaId])
  useEffect(()=>{const t=setInterval(()=>fetch$(cinemaId),5*60*1000);return()=>clearInterval(t)},[cinemaId,fetch$])

  const byDate=groupByDateAndHall(sessions,movies)
  const dates=getUniqueDates(sessions)
  const todayH=byDate[todayKey()]||{}
  const selH=byDate[selDate]||{}
  const toggle=key=>setExpanded(p=>({[key]:!p[key]}))

  const byType=halls=>{const s=sortHalls(halls),r={};ALL.forEach(t=>{r[t]=s.filter(([,h])=>h.typeId===t)});return r}
  const todayG=byType(todayH),selG=byType(selH)
  const allS=sortHalls(todayH)
  const total=Object.values(todayH).reduce((a,h)=>a+h.sessions.length,0)
  const latest=allS.length?fmtTime(Math.max(...allS.map(([,h])=>h.sessions[h.sessions.length-1].startMin))):'--'

  const wrap={maxWidth:900,margin:'0 auto',padding:'24px 16px 0',position:'relative',zIndex:1}

  return(
    <div style={{minHeight:'100vh',paddingBottom:'calc(74px + env(safe-area-inset-bottom))',background:'var(--bg-0)'}}>
      <Ambient view={view}/>
      <OfflineBanner/>
      <PullRefresh onRefresh={()=>fetch$(cinemaId)} loading={loading}/>
      <PWABanner/>
      <Header cinemaId={cinemaId} loading={loading} lastFetched={lastFetched} onRefresh={()=>fetch$(cinemaId)} onOpenPicker={()=>setPicker(true)}/>
      {sessions.length>0&&<Ticker sessions={sessions} movieMap={movies}/>}

      {/* TONIGHT */}
      {view==='tonight'&&(
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Final sessions tonight" title={cinema?.name||'Select a cinema'}/>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--gold-bg)',border:'1px solid var(--gold-bdr)',borderRadius:99,padding:'4px 12px'}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'var(--gold)',animation:'pulse 2s ease-in-out infinite'}}/>
              <span style={{fontFamily:'var(--mono)',fontSize:8,fontWeight:700,letterSpacing:1.5,color:'var(--gold)',textTransform:'uppercase'}}>Live</span>
            </div>
            <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--t4)'}}>{fmtDateLong(todayKey())}</span>
          </div>

          {loading&&<SkeletonGrid/>}
          {!loading&&error&&<ErrorState msg={error} onRetry={()=>fetch$(cinemaId)}/>}
          {!loading&&!error&&sessions.length===0&&<EmptyState icon="film" title="No data yet" sub="Sessions load automatically. Check Settings to verify your cinema."/>}
          {!loading&&!error&&sessions.length>0&&Object.keys(todayH).length===0&&<EmptyState icon="night" title="No sessions today" sub="Nothing scheduled today. Check Schedule for upcoming days."/>}

          {!loading&&!error&&Object.keys(todayH).length>0&&(
            <>
              {/* Stats */}
              <div style={{display:'flex',gap:8,marginBottom:28,flexWrap:'wrap'}}>
                <StatCard label="Halls"        value={allS.length} icon="ti-door"   />
                <StatCard label="Total shows"  value={total}       icon="ti-ticket" />
                <StatCard label="Latest start" value={latest}      icon="ti-clock" color="var(--gold)"/>
              </div>

              {/* All halls by type */}
              {ALL.map(t=><TypeSection key={t} typeId={t} halls={todayG[t]} expandedHalls={expanded} toggleHall={toggle} prefix="tonight" cinemaId={cinemaId}/>)}
            </>
          )}
        </div>
      )}

      {/* SCHEDULE */}
      {view==='schedule'&&(
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Full schedule" title="All Days"/>
          {dates.length>0&&<div style={{marginBottom:22}}><DateTabs dates={dates} selected={selDate} onSelect={setSelDate}/></div>}
          {loading&&<SkeletonGrid/>}
          {!loading&&!error&&Object.keys(selH).length===0&&<EmptyState icon="cal" title="No sessions" sub="Nothing scheduled for this day."/>}
          {!loading&&!error&&Object.keys(selH).length>0&&ALL.map(t=><TypeSection key={t} typeId={t} halls={selG[t]} expandedHalls={expanded} toggleHall={toggle} prefix={`sch-${selDate}`} cinemaId={cinemaId}/>)}
        </div>
      )}

      {/* CLOSING */}
      {view==='closing'&&(
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Tonight" title="Closing Times" sub="When each hall goes dark"/>
          <DepartureBoard halls={todayH} loading={loading}/>
        </div>
      )}

      {/* SETTINGS */}
      {view==='settings'&&(
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Configuration" title="Settings"/>
          <Sec label="Cinema">
            <label style={{display:'block',fontFamily:'var(--mono)',fontSize:8,letterSpacing:2,textTransform:'uppercase',color:'var(--t4)',marginBottom:11}}>Your cinema</label>
            <CinemaPicker value={cinemaId} onOpen={()=>setPicker(true)}/>
          </Sec>
          <Sec label="Status">
            <SRow label="Cinema"          value={cinema?.name||'--'}/>
            <SRow label="Sessions loaded" value={sessions.length}/>
            <SRow label="Dates available" value={dates.length}/>
            <SRow label="Last updated"    value={lastFetched?lastFetched.toLocaleTimeString('en-AU'):'--'}/>
            <SRow label="Cache"           value={(()=>{const c=loadC(cinemaId);return c?`${c.length} sessions (2 days)`:'Empty'})()}/>
            <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
              <button onClick={()=>fetch$(cinemaId)} disabled={loading} style={{fontFamily:'var(--body)',fontWeight:600,fontSize:13,padding:'9px 14px',borderRadius:9,border:'1px solid var(--b2)',background:'var(--bg-2)',color:'var(--t1)'}}>{loading?'Refreshing…':'Refresh now'}</button>
              <button onClick={()=>{localStorage.removeItem(CK(cinemaId));setSessions([]);fetch$(cinemaId)}} style={{fontFamily:'var(--body)',fontWeight:600,fontSize:13,padding:'9px 14px',borderRadius:9,border:'1px solid rgba(239,68,68,0.28)',background:'transparent',color:'#EF4444'}}>Clear Cache</button>
            </div>
          </Sec>
          <Sec label="Movie details">
            <p style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--t4)',marginBottom:14,lineHeight:1.7}}>Known movies pre-filled. Enter names/runtimes for missing IDs.</p>
            {[...new Set(sessions.map(s=>s.movieId).filter(Boolean))].map(mid=>{const m=movies[mid]||{};return(<div key={mid} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}><span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--t4)',width:90,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{mid}</span><input defaultValue={m.name||''} placeholder="Movie name" onChange={e=>{const nm={...movieMap,[mid]:{...(movieMap[mid]||{}),name:e.target.value}};setMovieMap(nm);localStorage.setItem('hoyts-movies',JSON.stringify(nm))}} style={{flex:1,minWidth:120,fontFamily:'var(--body)',fontSize:13,background:'var(--bg-2)',border:'1px solid var(--b2)',borderRadius:8,padding:'8px 10px',color:'var(--t1)'}}/><input defaultValue={m.runtime||''} placeholder="min" type="number" onChange={e=>{const nm={...movieMap,[mid]:{...(movieMap[mid]||{}),runtime:Number(e.target.value)}};setMovieMap(nm);localStorage.setItem('hoyts-movies',JSON.stringify(nm))}} style={{width:66,fontFamily:'var(--body)',fontSize:13,background:'var(--bg-2)',border:'1px solid var(--b2)',borderRadius:8,padding:'8px 10px',color:'var(--t1)'}}/></div>)})}
          </Sec>
          <Sec label="Data">
            <button onClick={()=>{if(confirm('Clear all saved data?')){setSessions([]);setMovieMap({});localStorage.removeItem('hoyts-movies')}}} style={{fontFamily:'var(--body)',fontWeight:600,fontSize:13,padding:'9px 14px',borderRadius:9,border:'1px solid rgba(239,68,68,0.28)',background:'rgba(239,68,68,0.07)',color:'#EF4444'}}>Clear all data</button>
          </Sec>
        </div>
      )}

      <BottomNav view={view} setView={setView}/>
      <CinemaSheet value={cinemaId} onChange={setCinemaId} open={picker} onClose={()=>setPicker(false)}/>
    </div>
  )
}
