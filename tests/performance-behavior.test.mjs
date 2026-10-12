import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMetric, compareMetricScopes, historicalMetricValue, captureReportSnapshot, MAIN_METRICS } from '../lib/performance-metrics.ts';

const row = (overrides = {}) => ({ stationCode:'SAW', provider:'TGS', period:'2026-06', sourceFile:'source.xlsx', flights:100, passengers:200, otp:90, ota:85, region:'Marmara', countryCode:'TR', city:'İstanbul', ...overrides });

test('reported count zero remains zero while missing counts remain missing', () => {
  assert.equal(aggregateMetric([row({unreadDocuments:null})], 'unreadDocuments'), null);
  assert.equal(aggregateMetric([row({unreadDocuments:0})], 'unreadDocuments'), 0);
  assert.equal(aggregateMetric([row({unreadDocuments:2}),row({unreadDocuments:null})], 'unreadDocuments'), 2);
  assert.equal(aggregateMetric([row({passengers:null})], 'passengers'), null);
  assert.equal(aggregateMetric([row({delayMinutes:null})], 'delay'), null);
});
test('ratios use only the matching reported passenger denominators', () => {
  const rows = [row({passengers:100,digitalBoardingRatio:0.8,damagedRate:0.1}), row({stationCode:'ESB',passengers:300,digitalBoardingRatio:0.4,damagedRate:null})];
  assert.equal(aggregateMetric(rows, 'digitalBoarding'), 0.5);
  assert.equal(aggregateMetric(rows, 'damaged'), 0.1);
  assert.equal(aggregateMetric([row({passengers:null,digitalBoardingRatio:0.8})], 'digitalBoarding'), null);
});
test('a rounded derived count cannot erase the reported baggage ratio',()=>{
  assert.equal(aggregateMetric([row({passengers:200,damagedRate:0.002,damagedCount:0})],'damaged'),0.002);
});
test('comparison rejects unequal metric coverage and station/provider scopes', () => {
  assert.equal(compareMetricScopes([row({safetyReports:0})],[row({safetyReports:2})],'safetyReports').comparable,true);
  assert.equal(compareMetricScopes([row({safetyReports:null})],[row({safetyReports:2})],'safetyReports').comparable,false);
  assert.equal(compareMetricScopes([row()],[row({stationCode:'ESB'})],'otp').comparable,false);
  assert.equal(compareMetricScopes([row()],[row({provider:'Havaş'})],'otp').comparable,false);
});
test('snapshot is immutable and omits disabled comparison', () => {
  const records=[row({title:'Haziran'})]; const filters={period:'2026-06', comparisonPeriod:'none', stations:['SAW']};
  const snap=captureReportSnapshot({scope:'summary',records,comparison:[row()],history:records,issues:[],filters});
  records[0].passengers=999; filters.stations.push('ESB');
  assert.equal(snap.records[0].passengers,200); assert.equal(snap.comparison.length,0);
  assert.equal(snap.filters.stations.length,1); assert.ok(Object.isFrozen(snap.records[0]));
});
test('one passenger identity and distinct safety report count retain adjacent card groups', () => {
  assert.equal(MAIN_METRICS.filter(key=>key==='passengers').length,1);
  assert.equal(MAIN_METRICS.indexOf('ota'),MAIN_METRICS.indexOf('otp')+1);
  assert.equal(MAIN_METRICS.indexOf('lost'),MAIN_METRICS.indexOf('damaged')+1);
  assert.equal(MAIN_METRICS.indexOf('safetyReports'),MAIN_METRICS.indexOf('safety')+1);
  assert.ok(MAIN_METRICS.includes('digitalBoarding'));
});
test('historical trend omits periods with incompatible station or metric coverage',()=>{
  const baseline=[row(),row({stationCode:'ESB'})];
  assert.equal(historicalMetricValue([row({otp:40})],baseline,'otp'),null);
  assert.equal(historicalMetricValue([row({otp:40}),row({stationCode:'ESB',otp:80})],baseline,'otp'),60);
});
