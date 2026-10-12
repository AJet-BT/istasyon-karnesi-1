import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PerformanceReport from '../app/performance-report.tsx';
import {MAIN_METRICS,captureReportSnapshot} from '../lib/performance-metrics.ts';

const row=(extra={})=>({stationCode:'SAW',stationName:'Sabiha Gökçen',provider:'TGS',period:'2026-06',sourceFile:'test_mock.xlsx',sourceSheet:'SecretSheet',sourceRow:123,mappingVersion:'private-map',title:'Haziran Raporu',isTestData:true,flights:100,passengers:200,otp:90,ota:88,unreadDocuments:0,digitalBoardingRatio:.75,...extra});
const snap=(scope='full',enabled=true)=>captureReportSnapshot({scope,generatedAt:1780272000000,trendMetric:'digitalBoarding',records:[row()],comparison:enabled?[row({period:'2026-05',title:'Mayıs Raporu',otp:85})]:[],history:[row({period:'2026-05'}),row()],issues:[{level:'warning',message:'test_mock.xlsx satır 123: eşleştirme uyarısı'}],filters:{period:'2026-06',comparisonPeriod:enabled?'2026-05':'none',provider:'TGS',stations:[],region:'Tümü',country:'Tümü',city:'Tümü',source:'private-upload-id',dataStatus:'Tümü'}});
const render=snapshot=>renderToStaticMarkup(React.createElement(PerformanceReport,{snapshot}));
test('both reports start with branded cover and never expose technical lineage or type labels',()=>{
  for(const scope of ['summary','full']){
    const html=render(snap(scope));
    assert.match(html,/data-report-section="cover"/);
    assert.ok(html.indexOf('data-report-section="cover"')<html.indexOf('data-report-section="summary"'));
    assert.match(html,/ajet-logo.png/);
    assert.doesNotMatch(html,/test_mock|SecretSheet|private-map|private-upload-id|satır 123|TEST VERİSİ|Üretim verisi|KPI-v3|Kaynaklar ve İzlenebilirlik/i);
    assert.equal(snap(scope).records[0].isTestData,true);
  }
});
test('master station tiles preserve dashboard order, zeros, missing values and comparison',()=>{
  const html=render(snap());
  const station=html.split('data-report-station="SAW|TGS"')[1];assert.ok(station);
  const tiles=[...station.split('data-report-section=')[0].matchAll(/data-station-metric="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(tiles,MAIN_METRICS);
  assert.match(station,/0 adet/);assert.match(station,/Kaynakta Raporlanmamış/);assert.match(station,/\+5 puan/);
  assert.ok(html.indexOf('data-report-station=')<html.indexOf('data-report-section="details-'));
  assert.doesNotMatch(render(snap('full',false)),/data-comparison="true"/);
});
test('selected main trend is captured immutably and used by both PDFs',()=>{
  const input=snap();assert.ok(Object.isFrozen(input));
  assert.throws(()=>input.trendMetric='otp',TypeError);
  for(const scope of ['summary','full'])assert.match(render({...input,scope}),/data-overview-trend="digitalBoarding"/);
});
test('station absent in comparison still shows the previous period and missing values on every tile',()=>{
  const base=snap();const html=render({...base,records:[...base.records,row({stationCode:'ESB'})]});
  const port=html.split('data-report-station="ESB|TGS"')[1].split('data-report-section=')[0];
  assert.equal((port.match(/2026-05: Kaynakta Raporlanmamış/g)||[]).length,MAIN_METRICS.length);
  assert.doesNotMatch(port,/\+5 puan/);
});
