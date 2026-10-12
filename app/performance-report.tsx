/* eslint-disable @next/next/no-img-element */
import { aggregateMetric, compareMetricScopes, historicalMetricValue, MAIN_METRICS, METRIC_METHODS, metricCoverage, metricRecordValue, type PerformanceMetric, type PerformanceRecord } from '@/lib/performance-metrics';
import { formatMetricValue, formatMetricDelta, metricCatalog, metricDeltaStatus } from '@/lib/visualization-engine';
import { KPI_LABELS, MISSING_VALUE_LABEL } from '@/lib/corporate-language';

import OverviewTrend from '@/app/overview-trend';
import {trendLabel,type OverviewTrendMetric} from '@/lib/overview-trend';

type ReportRecord=PerformanceRecord & {id?:string;stationName?:string;airportName?:string|null;sourceSheet?:string;sourceRow?:number;uploadId?:string;mappingVersion?:string;validationStatus?:string};
export type PerformanceSnapshot={scope:'summary'|'full';generatedAt:number;trendMetric?:OverviewTrendMetric;records:ReportRecord[];comparison:ReportRecord[];history:ReportRecord[];issues:Array<{level:string;message:string}>;filters:{period:string;comparisonPeriod:string;provider:string;region:string;country:string;city:string;stations:string[];source:string;dataStatus:string}};
export const PDF_OPTIONS=[{scope:'summary' as const,label:'Hızlı PDF'},{scope:'full' as const,label:'Master PDF'}];
const FULL_METRICS:PerformanceMetric[]=[...MAIN_METRICS,'nonSafety'];
const label=(metric:PerformanceMetric)=>KPI_LABELS[metric as keyof typeof KPI_LABELS]??metricCatalog[metric].shortLabel;
export function reportMetricValue(metric:PerformanceMetric,value:number|null) {
  if(value===null)return MISSING_VALUE_LABEL;
  return `${formatMetricValue(metric,value)}${metricCatalog[metric].unit==='count'?metric==='flights'?' uçuş':metric==='passengers'?' yolcu':' adet':''}`;
}
function delta(metric:PerformanceMetric,current:number|null,previous:number|null) {
  if(current===null||previous===null)return MISSING_VALUE_LABEL;
  const absolute=formatMetricDelta(metric,current,previous);
  if(metricCatalog[metric].unit!=='count')return absolute;
  return `${absolute}${previous>0?` · ${((current/previous-1)*100).toLocaleString('tr-TR',{maximumFractionDigits:1})}%`: ' · göreli değişim hesaplanamaz (önceki değer 0)'}`;
}
const chunks=<T,>(items:T[],size:number)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));
function TrendGraphic({snapshot,metric}:{snapshot:PerformanceSnapshot;metric:PerformanceMetric}) {
  const periods=[...new Set(snapshot.history.map(row=>row.period))].filter(p=>p<=snapshot.filters.period).sort().slice(-12);
  const previousPeriods=[...new Set(snapshot.history.map(row=>row.period))].filter(p=>p<=snapshot.filters.comparisonPeriod).sort().slice(-periods.length);
  const values=periods.map(period=>historicalMetricValue(snapshot.history.filter(row=>row.period===period),snapshot.records,metric));
  const prior=snapshot.comparison.length&&compareMetricScopes(snapshot.records,snapshot.comparison,metric).comparable?previousPeriods.map(period=>historicalMetricValue(snapshot.history.filter(row=>row.period===period),snapshot.comparison,metric)):[];
  const valid=[...values,...prior].filter((v):v is number=>v!==null);const low=Math.min(...valid);const high=Math.max(...valid);const spread=Math.max(high-low,metricCatalog[metric].unit==='count'?1:0.001);
  const x=(i:number)=>45+i/Math.max(periods.length-1,1)*390;const y=(v:number)=>125-(v-low)/spread*90;
  const segments=(series:Array<number|null>)=>{const parts:string[][]=[[]];series.forEach((value,i)=>{if(value===null){if(parts.at(-1)?.length)parts.push([]);}else parts.at(-1)?.push(`${x(i)},${y(value)}`);});return parts.filter(part=>part.length);};
  return <article className="report-chart"><h3>{label(metric)} · Tarihsel Eğilim</h3><p>{METRIC_METHODS[metric]}</p>{valid.length?<><svg viewBox="0 0 480 166" role="img" aria-label={`${label(metric)} tarihsel ve karşılaştırma dönemleri`}>
    <line x1="45" x2="435" y1="125" y2="125" stroke="#cbd8e0"/>
    {segments(values).map((part,i)=><polyline key={`a${i}`} points={part.join(' ')} fill="none" stroke="#008fda" strokeWidth="2.5"/>)}
    {segments(prior).map((part,i)=><polyline key={`b${i}`} points={part.join(' ')} fill="none" stroke="#7f91a0" strokeWidth="2.5" strokeDasharray="5 3"/>)}
    {prior.map((value,i)=>value===null?null:<circle key={`prior-${i}`} cx={x(i)} cy={y(value)} r="3" fill="white" stroke="#7f91a0" strokeWidth="2"/>)}
    {values.map((value,i)=><g key={periods[i]}>{value!==null&&<><circle cx={x(i)} cy={y(value)} r="3.5" fill="#008fda"/><text x={x(i)} y={y(value)-7} textAnchor="middle">{formatMetricValue(metric,value)}</text></>}<text x={x(i)} y="145" textAnchor="middle">{periods[i].slice(2)}</text>{prior.length>0&&<text x={x(i)} y="160" textAnchor="middle" fill="#637783">{previousPeriods[i]?.slice(2)}</text>}</g>)}
  </svg><div className="report-legend"><span><i/>Ana dönemle biten zaman penceresi</span>{prior.length>0&&<span><i className="previous"/>Karşılaştırma dönemiyle biten pencere</span>}</div></>:<p className="report-missing">{MISSING_VALUE_LABEL}</p>}</article>;
}
function StationComparisonGraphic({snapshot,metric,comparisonScope=snapshot}:{snapshot:PerformanceSnapshot;metric:PerformanceMetric;comparisonScope?:PerformanceSnapshot}) {
  const eligibility=compareMetricScopes(comparisonScope.records,comparisonScope.comparison,metric);
  const paired=snapshot.records.map(row=>({row,current:metricRecordValue(row,metric),previous:snapshot.comparison.find(p=>p.provider===row.provider&&p.stationCode===row.stationCode)}));
  const maximum=Math.max(1,...paired.flatMap(pair=>[pair.current??0,pair.previous?metricRecordValue(pair.previous,metric)??0:0]));
  return <article className="report-chart"><h3>{label(metric)} · İstasyon Karşılaştırması</h3>{!eligibility.comparable?<p>{businessReason(eligibility.reason)}</p>:<>{paired.map(pair=>{const previous=pair.previous?metricRecordValue(pair.previous,metric):null;return <div className="report-station-bars" key={`${pair.row.provider}-${pair.row.stationCode}`}><b>{pair.row.stationCode}</b><div><i style={{width:`${(pair.current??0)/maximum*100}%`}}/><i className="previous" style={{width:`${(previous??0)/maximum*100}%`}}/></div><span>{reportMetricValue(metric,pair.current)} / {reportMetricValue(metric,previous)}</span></div>;})}<div className="report-legend"><span><i/>{snapshot.filters.period}</span><span><i className="previous"/>{snapshot.filters.comparisonPeriod}</span></div></>}</article>;
}

function KpiTiles({snapshot,station=false,comparisonScope=snapshot}:{snapshot:PerformanceSnapshot;station?:boolean;comparisonScope?:PerformanceSnapshot}) {
  const {records,comparison,filters}=snapshot;
  const enabled=filters.comparisonPeriod!=='none'&&comparisonScope.comparison.length>0;
  return <div className="report-kpis">{MAIN_METRICS.map(metric=>{
    const value=aggregateMetric(records,metric),previous=aggregateMetric(comparison,metric);
    const eligibility=compareMetricScopes(comparisonScope.records,comparisonScope.comparison,metric);
    return <article key={metric} data-report-metric={station?undefined:metric} data-station-metric={station?metric:undefined}>
      <span>{label(metric)}</span><strong className={value===null?'missing-value':''}>{reportMetricValue(metric,value)}</strong>
      {!station&&<small>Raporlanan: {metricCoverage(records,metric)}/{records.length} istasyon</small>}
      {enabled&&<><small>{filters.comparisonPeriod}: {reportMetricValue(metric,previous)}</small><small className={eligibility.comparable?metricDeltaStatus(metric,value,previous):'missing'}>{eligibility.comparable?delta(metric,value,previous):businessReason(eligibility.reason)}</small></>}
    </article>;
  })}</div>;
}
function businessReason(reason:string) {
  if(reason==='Kaynakta Raporlanmamış')return reason;
  if(reason.includes('kapsamları eşleşmiyor'))return 'Dönemlerin karşılaştırma kapsamları eşleşmiyor.';
  if(reason.includes('Metrik kapsamı'))return 'Metrik kapsamı istasyon bazında eşleşmiyor; fark hesaplanmadı.';
  return 'Karşılaştırma için yeterli ve uyumlu veri bulunamadı.';
}
function PerformanceSummary({snapshot}:{snapshot:PerformanceSnapshot}) {
  const {records,comparison,filters}=snapshot;
  const enabled=filters.comparisonPeriod!=='none'&&comparison.length>0;
  const missing=MAIN_METRICS.filter(metric=>metricCoverage(records,metric)<records.length);
  const changes=MAIN_METRICS.filter(metric=>compareMetricScopes(records,comparison,metric).comparable).map(metric=>({metric,current:aggregateMetric(records,metric),previous:aggregateMetric(comparison,metric)}));
  const improved=changes.filter(c=>metricDeltaStatus(c.metric,c.current,c.previous)==='improved');
  const worsened=changes.filter(c=>metricDeltaStatus(c.metric,c.current,c.previous)==='worsened');
  return <div className="report-performance-summary"><p><b>{records.length} istasyon</b> için {reportMetricValue('flights',aggregateMetric(records,'flights'))} ve {reportMetricValue('passengers',aggregateMetric(records,'passengers'))} raporlandı.</p>
    <p>OTP {reportMetricValue('otp',aggregateMetric(records,'otp'))} · OTA {reportMetricValue('ota',aggregateMetric(records,'ota'))}.</p>
    {enabled&&<div data-comparison="true"><p>{filters.comparisonPeriod} → {filters.period}: {changes.length}/{MAIN_METRICS.length} metrik karşılaştırılabilir. {improved.length} iyileşme · {worsened.length} kötüleşme; hacim ve bildirim sayıları nötr izlenir.</p><ul>{changes.filter(c=>c.current!==c.previous).slice(0,4).map(c=><li key={c.metric} className={metricDeltaStatus(c.metric,c.current,c.previous)}>{label(c.metric)}: {reportMetricValue(c.metric,c.previous)} → {reportMetricValue(c.metric,c.current)} · {delta(c.metric,c.current,c.previous)}</li>)}</ul>{changes.length<MAIN_METRICS.length&&<p>Eksik değerler veya farklı kapsamlar için fark hesaplanmadı.</p>}</div>}
    <p>{missing.length?missing.length+' metrikte istasyon kapsamı eksik; toplamlar yalnız raporlanan değerleri içerir.':'Tüm ana metriklerde istasyon kapsamı tam.'} {MISSING_VALUE_LABEL} sıfır olarak yorumlanmaz.</p>
  </div>;
}
export default function PerformanceReport({snapshot}:{snapshot:PerformanceSnapshot}) {
  const {records,comparison,filters,scope}=snapshot;
  const comparisonEnabled=filters.comparisonPeriod!=='none'&&comparison.length>0;
  const heading=scope==='summary'?'Hızlı PDF':'Master PDF';
  // Only authored report titles belong in a presentation; filenames and lineage stay in the snapshot.
  const titles=(rows:ReportRecord[])=>[...new Set(rows.map(row=>row.title).filter((title):title is string=>!!title&&!/\.(xlsx?|csv)\b|\b(test|demo|mock)\b|test[_\s-]?mock/i.test(title)))].join(' · ');
  const title=titles(records)||'İstasyon Performans Raporu';
  const previousTitle=titles(comparison)||'İstasyon Performans Raporu';
  const selection=snapshot.trendMetric??'otpOta';
  const sections:Array<{key:string;station?:string;body:React.ReactNode}>=[];
  const context=<div className="report-filter-scope"><span>Handling Provider: {filters.provider||'Tümü'}</span><span>İstasyon: {filters.stations.length?filters.stations.join(', '):'Tümü'}</span><span>Bölge: {filters.region||'Tümü'} · Ülke: {filters.country||'Tümü'} · Şehir: {filters.city||'Tümü'}</span>{filters.dataStatus&&filters.dataStatus!=='Tümü'&&<span>Veri durumu: {filters.dataStatus}</span>}</div>;
  sections.push({key:'cover',body:<div className="report-cover"><img src="/ajet-logo.png" alt="AJet"/><span className="report-cover-eyebrow">TGS İSTASYON PERFORMANS</span><h1>{heading}</h1><h2>{title}</h2><p className="report-cover-period">Raporlama Dönemi · {filters.period}</p>{comparisonEnabled&&<div data-comparison="true"><p>Karşılaştırma · {filters.comparisonPeriod} / {filters.period}</p><p>{previousTitle} / {title}</p></div>}{context}<small>Hizmete Özel</small></div>});
  sections.push({key:'summary',body:<><h1>Genel Performans · {filters.period}</h1>{context}<KpiTiles snapshot={snapshot}/><p className="report-note">Yeşil: iyileşme · Kırmızı: kötüleşme · Hacim ve bildirim sayıları: nötr. Raporlanan sıfırlar korunur.</p></>});
  if(scope==='summary')sections.push({key:'main-trend',body:<><h2>Performans Özeti</h2><PerformanceSummary snapshot={snapshot}/><h2>12 Aylık {trendLabel(selection)} Performansı</h2><OverviewTrend records={records} history={snapshot.history} period={filters.period} selection={selection} comparisonPeriod={comparisonEnabled?filters.comparisonPeriod:'none'} exportMode/></>});
  if(scope==='full') {

    sections.push({key:'performance-summary',body:<><h2>Genel Performans Özeti</h2><PerformanceSummary snapshot={snapshot}/></>});
    if(comparisonEnabled)for(const [index,rows]of chunks(records,8).entries())sections.push({key:'comparison-'+index,body:<div data-comparison="true"><h2>İki Dönem Karşılaştırması</h2><p>{filters.comparisonPeriod} · {previousTitle} / {filters.period} · {title}</p><div className="report-chart-grid">{(['otp','ota'] as const).map(metric=><StationComparisonGraphic key={metric} snapshot={{...snapshot,records:rows}} comparisonScope={snapshot} metric={metric}/>)}</div></div>});
    sections.push({key:'main-trend',body:<><h2>12 Aylık {trendLabel(selection)} Performansı</h2><OverviewTrend records={records} history={snapshot.history} period={filters.period} selection={selection} comparisonPeriod={comparisonEnabled?filters.comparisonPeriod:'none'} exportMode/></>});
    for(const [index,group]of chunks(FULL_METRICS,2).entries())sections.push({key:'trends-'+index,body:<><h2>Tarihsel Eğilim ve Operasyonel Analiz</h2><div className="report-chart-grid">{group.map(metric=><TrendGraphic key={metric} snapshot={snapshot} metric={metric}/>)}</div></>});
    const stationGroups=[...new Map(records.map(row=>[row.provider+'|'+row.stationCode,row])).values()];
    for(const row of stationGroups) {
      const current=records.filter(r=>r.stationCode===row.stationCode&&r.provider===row.provider);
      const prior=comparison.filter(r=>r.stationCode===row.stationCode&&r.provider===row.provider);
      const stationHistory=snapshot.history.filter(r=>r.stationCode===row.stationCode&&r.provider===row.provider);
      const portSnapshot={...snapshot,records:current,comparison:prior,history:stationHistory};
      const portTitle=row.stationCode+' · '+(row.airportName||row.stationName||'İstasyon');
      sections.push({key:'port-'+row.provider+'-'+row.stationCode,station:row.stationCode+'|'+row.provider,body:<><h1>{portTitle}</h1><p className="report-port-context">{row.provider} · {filters.period}{comparisonEnabled?' / '+filters.comparisonPeriod:''} · {row.city||''} {row.country||''}</p><KpiTiles snapshot={portSnapshot} comparisonScope={snapshot} station/>{comparisonEnabled&&!prior.length&&<p>Bu istasyon için karşılaştırma dönemi raporlanmamış; fark hesaplanmadı.</p>}<p className="report-note">{MISSING_VALUE_LABEL}: ilgili metrikte raporlanmış değer yoktur.</p></>});
      sections.push({key:'port-trend-'+row.provider+'-'+row.stationCode,body:<><h2>{portTitle} · Eğilim ve Analiz</h2><p className="report-port-context">{row.provider} · {filters.period}{comparisonEnabled?' / '+filters.comparisonPeriod:''} · İstasyon bölümünün devamı</p><h3>12 Aylık {trendLabel(selection)} Performansı</h3><OverviewTrend records={current} history={stationHistory} period={filters.period} selection={selection} comparisonPeriod={comparisonEnabled?filters.comparisonPeriod:'none'} exportMode/></>});
    }
    const stationPairs=records.flatMap(row=>FULL_METRICS.map(metric=>({row,metric,previous:comparison.find(p=>p.stationCode===row.stationCode&&p.provider===row.provider)})));
    for(const [index,rows]of chunks(stationPairs,10).entries())sections.push({key:'details-'+index,body:<><h2>İstasyon Ayrıntıları {comparisonEnabled?'ve Karşılaştırması':''}</h2><table className="report-table"><thead><tr><th>İstasyon / Handling Provider</th><th>Metrik</th><th>{filters.period}</th>{comparisonEnabled&&<><th>{filters.comparisonPeriod}</th><th>Değişim</th></>}</tr></thead><tbody>{rows.map(({row,metric,previous},i)=>{const current=metricRecordValue(row,metric),before=previous?metricRecordValue(previous,metric):null;const valid=compareMetricScopes(records,comparison,metric);return <tr key={i}><td><b>{row.stationCode}</b> · {row.provider}<small>{row.airportName||row.stationName}</small></td><td>{label(metric)}</td><td>{reportMetricValue(metric,current)}</td>{comparisonEnabled&&<><td>{reportMetricValue(metric,before)}</td><td className={valid.comparable?metricDeltaStatus(metric,current,before):'missing'}>{valid.comparable?delta(metric,current,before):businessReason(valid.reason)}</td></>}</tr>;})}</tbody></table></>});

    const fields=[['docCount','Doküman Aksaklığı'],['internationalPassengers','Dış Hat Yolcu'],['damagedCount','Hasarlı Bagaj Vaka'],['lostCount','Kayıp Bagaj Vaka'],['safetyCount','Safety Vaka'],['nonSafetyCount','Safety Dışı Vaka']] as const;
    for(const [index,rows]of chunks([...records,...(comparisonEnabled?comparison:[])],8).entries())sections.push({key:'volumes-'+index,body:<><h2>Operasyonel Hacimler ve Aksaklık Sayıları</h2><p className="report-note">Yalnız oran raporlanan eski dönemlerde vaka sayıları oran ve hacimden yuvarlanmış olabilir; KPI oranları raporlanan oranı korur.</p><table className="report-table"><thead><tr><th>İstasyon / Coğrafya</th><th>Dönem</th>{fields.map(([field,title])=><th key={field}>{title} ({field==='internationalPassengers'?'yolcu':'adet'})</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td><b>{row.stationCode} · {row.provider}</b><small>{row.city||MISSING_VALUE_LABEL} · {row.country||row.countryCode||MISSING_VALUE_LABEL} · {row.region||MISSING_VALUE_LABEL}</small></td><td>{row.period}</td>{fields.map(([field])=><td key={field}>{row[field]==null?MISSING_VALUE_LABEL:Number(row[field]).toLocaleString('tr-TR')}</td>)}</tr>)}</tbody></table></>});
    for(const [index,metrics]of chunks(FULL_METRICS,8).entries())sections.push({key:'coverage-'+index,body:<><h2>Veri Kalitesi ve Kapsam</h2><p>Eksik raporlanan metrikler toplamdan ve karşılaştırmadan ilgili kapsam kurallarına göre dışlanır; eksik değerler sıfır değildir.</p><p>{records.filter(row=>row.validationStatus==='warning').length} istasyonda kontrol gerektiren değer bulunuyor. Ayrıntılı doğrulama bilgileri uygulamanın veri kalitesi ekranında incelenebilir.</p><table className="report-table"><thead><tr><th>Metrik</th><th>Raporlanan istasyon · {filters.period}</th>{comparisonEnabled&&<th>{filters.comparisonPeriod}</th>}<th>İş yorumu</th></tr></thead><tbody>{metrics.map(metric=><tr key={metric}><td>{label(metric)}</td><td>{metricCoverage(records,metric)}/{records.length}</td>{comparisonEnabled&&<td>{metricCoverage(comparison,metric)}/{comparison.length}</td>}<td>{METRIC_METHODS[metric]}</td></tr>)}</tbody></table></>});
  }
  return <div className="print-report performance-report" data-report-scope={scope} data-snapshot-at={snapshot.generatedAt}>{sections.map((section,index)=><section className={'print-page report-page '+(section.key==='cover'?'report-cover-page':'')} data-report-section={section.key} data-report-station={section.station} key={section.key}>{section.key!=='cover'&&<header className="report-header"><img src="/ajet-logo.png" alt="AJet"/><div><b>{heading} · {filters.period}</b><span>Hizmete Özel</span></div></header>}<div className="report-page-body">{section.body}</div><footer className="report-footer"><span>AJet · İstasyon Performansı · {filters.period}</span><span>{index+1} / {sections.length}</span></footer></section>)}</div>;
}
