'use client';
import {useState} from 'react';
import {overviewTrendData,trendLabel,trendUnit,trendValueLabel,type OverviewTrendMetric} from '@/lib/overview-trend';
import {metricCatalog} from '@/lib/visualization-engine';
import {type PerformanceRecord} from '@/lib/performance-metrics';

export default function OverviewTrend({records,history,period,selection='otpOta',comparisonPeriod='none',exportMode=false,onSelect}:{records:PerformanceRecord[];history:PerformanceRecord[];period:string;selection?:OverviewTrendMetric;comparisonPeriod?:string;exportMode?:boolean;onSelect?:(metric:Exclude<OverviewTrendMetric,'otpOta'>)=>void}) {
  const [hover,setHover]=useState<number|null>(null);
  const {periods,series}=overviewTrendData(records,history,period,selection);
  const values=series.flatMap(s=>s.values).filter((v):v is number=>v!==null);
  const enough=series.some(s=>s.values.filter(v=>v!==null).length>=2);
  const definition=series.length>0?metricCatalog[series[0].metric]:metricCatalog.otp;
  const axisLabel=(v:number)=>definition.displayUnit!=='percent'&&Math.abs(v)>=10000?`${new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(v)} ${trendUnit(series[0].metric)}`:trendValueLabel(series[0].metric,v);
  const low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1;
  const spread=Math.max(high-low,definition.unit==='ratio-percent'?.01:definition.unit==='days'?.1:1),min=Math.max(0,low-spread*.5),max=Math.min(definition.unit==='ratio-percent'?1:definition.unit==='percent'?100:Infinity,high+spread*.5);
  const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
  const left=Math.max(76,...ticks.map(v=>axisLabel(v).length*8+16));
  const x=(i:number)=>left+i/11*(900-left),y=(v:number)=>225-(v-min)/Math.max(max-min,.00001)*185;
  const parts=(numbers:Array<number|null>)=>{const groups:string[][]=[[]];numbers.forEach((v,i)=>{if(v===null){if(groups.at(-1)?.length)groups.push([]);}else groups.at(-1)?.push(`${x(i)},${y(v)}`);});return groups.filter(g=>g.length);};
  return <div className={`dual-trend overview-metric-trend ${exportMode?'report-main-trend':''}`} data-overview-trend={selection}>
    <div className="dual-trend-toolbar"><div className="dual-trend-legend">{series.map(s=><span key={s.metric}><i style={{background:metricCatalog[s.metric].color}}/>{trendLabel(s.metric)} ({trendUnit(s.metric)})</span>)}<span><i className="current"/>Ana Dönem: {period}</span>{comparisonPeriod!=='none'&&<span><i className="comparison"/>Karşılaştırma Dönemi: {comparisonPeriod}</span>}</div></div>
    {!enough?<div className="chart-empty">{trendLabel(selection)} dönemsel eğilimi için en az iki uyumlu ve raporlanmış dönem gereklidir.</div>:<div className="dual-trend-canvas" onMouseLeave={()=>setHover(null)}><svg viewBox="0 0 960 280" role="img" aria-label={`12 Aylık ${trendLabel(selection)} Performansı`}>
      {ticks.map((v,i)=><g key={i}><line className="dual-grid" x1={left} x2="900" y1={y(v)} y2={y(v)}/><text className="dual-axis-label" x={left-10} y={y(v)+4} textAnchor="end">{axisLabel(v)}</text></g>)}
      <line className="dual-period-guide current" x1={x(11)} x2={x(11)} y1="30" y2="225"/>
      {comparisonPeriod!=='none'&&periods.includes(comparisonPeriod)&&<line className="dual-period-guide comparison" x1={x(periods.indexOf(comparisonPeriod))} x2={x(periods.indexOf(comparisonPeriod))} y1="30" y2="225"/>}
      {series.map(s=><g key={s.metric}>{parts(s.values).map((part,i)=><polyline key={i} className="dual-line" points={part.join(' ')} style={{stroke:metricCatalog[s.metric].color}}/>) }{s.values.map((v,i)=>v===null?null:<circle key={i} className="dual-marker" style={{fill:metricCatalog[s.metric].color}} cx={x(i)} cy={y(v)} r={i===11?5:3.5}><title>{[periods[i],trendLabel(s.metric),trendValueLabel(s.metric,v)].join(' · ')}</title></circle>)}</g>)}
      {hover!==null&&!exportMode&&<line className="dual-crosshair" x1={x(hover)} x2={x(hover)} y1="30" y2="225"/>}
      {periods.map((p,i)=><g key={p} tabIndex={exportMode?undefined:0} role={!exportMode&&onSelect?'button':undefined} onClick={()=>!exportMode&&onSelect?.(series[0].metric)} onKeyDown={event=>{if(!exportMode&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onSelect?.(series[0].metric);}}} onMouseEnter={()=>setHover(i)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)} aria-label={`${p}: ${series.map(s=>`${trendLabel(s.metric)} ${trendValueLabel(s.metric,s.values[i])}`).join(', ')}`}><rect className="dual-hit-area" x={x(i)-30} y="30" width="60" height="195"/><text className="dual-month-label" x={x(i)} y="253" textAnchor="middle">{p.slice(2)}</text></g>)}
    </svg>{hover!==null&&!exportMode&&<div className="dual-tooltip" role="tooltip" style={{left:`${Math.min(85,Math.max(15,x(hover)/960*100))}%`}}><strong>{periods[hover]}</strong>{series.map(s=><div key={s.metric}>{trendLabel(s.metric)} <b>{trendValueLabel(s.metric,s.values[hover])}</b></div>)}</div>}</div>}
    <p className="chart-footnote">{period} ile biten 12 aylık görünüm · Raporlanmamış değerler ve uyumsuz dönemler çizilmez.</p>
  </div>;
}
