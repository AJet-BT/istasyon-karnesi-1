import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PerformanceReport from '../app/performance-report.tsx';
import {captureReportSnapshot,MAIN_METRICS} from '../lib/performance-metrics.ts';
const row=(p={})=>({id:'one',stationCode:'SAW',stationName:'Sabiha Gökçen',provider:'TGS',sourceFile:'source.xlsx',title:'Haziran Raporu',period:'2026-06',flights:100,passengers:200,otp:90,ota:80,unreadDocuments:0,visaPassportIssues:2,safetyReports:3,gseDamageReports:null,digitalBoardingRatio:0.75,...p});
const snapshot=(scope='full',enabled=true)=>captureReportSnapshot({scope,generatedAt:1780272000000,records:[row()],comparison:enabled?[row({id:'two',period:'2026-05',title:'Mayıs Raporu',otp:85,visaPassportIssues:1})]:[],history:[row({period:'2026-05',otp:85}),row()],issues:[],filters:{period:'2026-06',comparisonPeriod:enabled?'2026-05':'none',provider:'TGS',region:'Tümü',country:'Tümü',city:'Tümü',stations:[],source:'Tümü',dataStatus:'Tümü'}});
test('quick application report contains every KPI, title and actual units/missing labels',()=>{
  const html=renderToStaticMarkup(React.createElement(PerformanceReport,{snapshot:snapshot('summary')}));
  for(const metric of MAIN_METRICS)assert.ok(html.includes(`data-report-metric="${metric}"`),metric);
  assert.match(html,/Haziran Raporu/);assert.match(html,/Kaynakta Raporlanmamış/);assert.match(html,/%75/);
  assert.match(html,/0 adet/);assert.doesNotMatch(html,/Başarılı.*kaydedildi/);
});
test('master comparison uses both source titles, shared differences and station charts',()=>{
  const html=renderToStaticMarkup(React.createElement(PerformanceReport,{snapshot:snapshot()}));
  assert.match(html,/Mayıs Raporu/);assert.match(html,/Haziran Raporu/);assert.match(html,/data-comparison="true"/);
  assert.match(html,/\+5 puan/);assert.match(html,/İstasyon Karşılaştırması/);assert.match(html,/Tarihsel Eğilim/);
});
test('disabled comparison omits sections and preserves internal flags without visible labels',()=>{
  const html=renderToStaticMarkup(React.createElement(PerformanceReport,{snapshot:snapshot('full',false)}));
  assert.doesNotMatch(html,/data-comparison="true"/);assert.doesNotMatch(html,/TEST VERİSİ/);assert.doesNotMatch(html,/Mayıs Raporu/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PerformanceReport,{snapshot:{...snapshot('summary',false),records:[row({isTestData:true})]}})),/TEST VERİSİ/);
});
test('a full previous scope with an extra station keeps comparison ineligible',()=>{
  const base=snapshot();const snap={...base,comparison:[...base.comparison,row({stationCode:'ESB',id:'extra',period:'2026-05'})]};
  const html=renderToStaticMarkup(React.createElement(PerformanceReport,{snapshot:snap}));
  assert.match(html,/kapsamları eşleşmiyor/);
  assert.doesNotMatch(html,/\+5 puan/);
});
