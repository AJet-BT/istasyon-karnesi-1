import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {overviewTrendData,trendUnit,OVERVIEW_TREND_METRICS} from '../lib/overview-trend.ts';
import OverviewTrend from '../app/overview-trend.tsx';
import {aggregateMetric,MAIN_METRICS} from '../lib/performance-metrics.ts';
const row=(extra={})=>({stationCode:'SAW',provider:'TGS',period:'2026-06',sourceFile:'test_mock.xlsx',isTestData:true,flights:10,passengers:100,otp:90,ota:85,unreadDocuments:0,delayMinutes:12,complaintDays:1.5,digitalBoardingRatio:.75,...extra});
test('overview window always includes 12 calendar months ending at the main period with gaps and no future',()=>{
  const records=[row()];const history=[row({period:'2026-04',unreadDocuments:3}),row({period:'2026-05',unreadDocuments:null}),row({period:'2026-07',unreadDocuments:999}),row({period:'2026-03',provider:'Havaş'})];
  const data=overviewTrendData(records,history,'2026-06','unreadDocuments');
  assert.equal(data.periods.length,12);assert.equal(data.periods[0],'2025-07');assert.equal(data.periods.at(-1),'2026-06');
  assert.deepEqual(data.series[0].values.slice(-3),[3,null,0]);assert.equal(data.series[0].values[8],null);
});
test('every operational selection matches KPI aggregation and has appropriate axis units',()=>{
  const records=[row(),row({stationCode:'ESB',flights:30,passengers:300,otp:80,digitalBoardingRatio:.5})];
  for(const metric of OVERVIEW_TREND_METRICS)assert.equal(overviewTrendData(records,[],'2026-06',metric).series[0].values.at(-1),aggregateMetric(records,metric));
  assert.ok(MAIN_METRICS.every(m=>OVERVIEW_TREND_METRICS.includes(m)));
  assert.equal(trendUnit('digitalBoarding'),'%');assert.equal(trendUnit('delay'),'dk');assert.equal(trendUnit('complaint'),'gün');assert.equal(trendUnit('safetyReports'),'adet');
  assert.deepEqual(overviewTrendData(records,[],'2026-06').series.map(s=>s.metric),['otp','ota']);
});
test('chart and exported chart use identical plot geometry and break the line at missing periods',()=>{
  const records=[row()];const history=[row({period:'2026-03',unreadDocuments:5}),row({period:'2026-04',unreadDocuments:null}),row({period:'2026-05',unreadDocuments:2})];
  const props={records,history,period:'2026-06',selection:'unreadDocuments'};
  const render=exportMode=>renderToStaticMarkup(React.createElement(OverviewTrend,{...props,exportMode}));
  const paths=html=>[...html.matchAll(/<polyline[^>]*points="([^"]*)"/g)].map(x=>x[1]);
  assert.equal(paths(render(false)).length,2);assert.deepEqual(paths(render(false)),paths(render(true)));
  assert.match(render(false),/0 adet/);assert.match(render(false),/Kaynakta Raporlanmamış/);assert.doesNotMatch(render(false),/TEST VERİSİ/);
  assert.match(renderToStaticMarkup(React.createElement(OverviewTrend,{...props,history:[]})),/en az iki uyumlu/);
});
