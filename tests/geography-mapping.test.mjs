import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const load = async () => ({
  platform: await readFile(new URL("../lib/server/platform.ts", import.meta.url), "utf8"),
  ports: await readFile(new URL("../lib/server/ports.ts", import.meta.url), "utf8"),
  page: await readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  panel: await readFile(new URL("../app/port-master.tsx", import.meta.url), "utf8"),
  schema: await readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
});

test("ESB and SAW resolve through the centralized airport master", async () => {
  const { platform, schema } = await load();
  assert.match(platform, /code: "ESB"[^\n]+airportName: "Ankara Esenboğa Havalimanı"[^\n]+city: "Ankara"[^\n]+region: "İç Anadolu"/);
  assert.match(platform, /code: "SAW"[^\n]+airportName: "İstanbul Sabiha Gökçen Havalimanı"[^\n]+city: "İstanbul"[^\n]+region: "Marmara"/);
  assert.ok(platform.includes('portId: /^[A-Z]{3}$/.test(stationCode)'));
  assert.ok(platform.includes('locationMappingStatus: /^[A-Z]{3}$/.test(stationCode)'));
  assert.match(schema, /portId: text\("port_id"\)/);
});

test("city to airport filtering and airport to geographic context are bidirectional", async () => {
  const { page } = await load();
  assert.match(page, /item\.cityName === cityFilter/);
  assert.match(page, /setRegionFilter\(context\(selectedPorts\.map\(\(port\) => port\.regionCode\)\)\)/);
  assert.match(page, /setCountryFilter\(context\(selectedPorts\.map\(\(port\) => port\.countryCode\)\)\)/);
  assert.match(page, /setCityFilter\(context\(selectedPorts\.map\(\(port\) => port\.cityName\)\)\)/);
  assert.match(page, /distinct\.length > 1 \? "Çoklu"/);
  assert.match(page, /selected\.length === 1[\s\S]+selected\.length[\s\S]+seçili/);
});

test("unknown codes remain unresolved and are routed to real admin mapping actions", async () => {
  const { platform, ports, panel } = await load();
  assert.ok(platform.includes('? "resolved" : "unresolved"'));
  assert.match(platform, /havalimanı kodu coğrafi master veride bulunamadı/);
  assert.match(ports, /\["map", "review", "exclude"\]/);
  assert.match(panel, /Mevcut havalimanıyla eşleştir/);
  assert.match(panel, /title="Yeni Havalimanı Oluştur"/);
  assert.match(panel, /title="İncelemede Bırak"/);
  assert.match(panel, /İçe Aktarımdan Hariç Tut/);
});

test("country aliases and exports share canonical geography", async () => {
  const { platform, page } = await load();
  assert.match(platform, /\["TURKIYE", "TURKEY", "TR", "TUR"\]/);
  assert.match(platform, /return "TR"/);
  assert.match(page, /HAVALİMANI: record\.airportName/);
  assert.match(page, /ÜLKE_KODU: record\.countryCode/);
  const React = (await import('react')).default;
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {default:Report}=await import('../app/performance-report.tsx');
  const html=renderToStaticMarkup(React.createElement(Report,{snapshot:{scope:'summary',generatedAt:0,records:[],comparison:[],history:[],issues:[],filters:{period:'2026-06',comparisonPeriod:'none',provider:'TGS',region:'Marmara',country:'TR',city:'İstanbul',stations:['SAW'],source:'Tümü',dataStatus:'Tümü'}}}));
  assert.match(html,/Bölge: Marmara/);assert.match(html,/Ülke: TR/);assert.match(html,/Şehir: İstanbul/);assert.match(html,/İstasyon: SAW/);
});
