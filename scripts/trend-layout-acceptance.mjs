import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import OverviewTrend from '../app/overview-trend.tsx';
const require=createRequire(import.meta.url);
const playwright=require(process.env.QA_PLAYWRIGHT_PATH||'C:/Users/MRT45/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const css=await readFile(new URL('../app/globals.css',import.meta.url),'utf8')+await readFile(new URL('../app/dashboard-compact.css',import.meta.url),'utf8');
const browser=await playwright.chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1366,height:768}});const results=[];
try {
  for(const selection of ['passengers','delay','flights','complaint'])for(const print of [false,true]) {
    const row={stationCode:'SAW',provider:'TGS',period:'2026-06',sourceFile:'qa.xlsx',flights:1500000,passengers:4500000,delayMinutes:1000000,complaintDays:20000};
    const props={records:[row],history:[{...row,period:'2026-05'}],period:'2026-06',selection,exportMode:print};
    const html=renderToStaticMarkup(React.createElement(OverviewTrend,props));
    await page.setContent(`<style>${css}</style><div class="${print?'performance-report':'panel chart-panel'}" style="display:block;width:1050px;margin:10px">${html}</div>`);
    await page.emulateMedia({media:print?'print':'screen'});
    const boxes=await page.locator('.dual-axis-label').evaluateAll(labels=>labels.map(label=>{const b=label.getBBox();return{text:label.textContent,left:b.x,right:b.x+b.width};}));
    assert.ok(boxes.every(b=>b.left>=0&&b.right<=960),JSON.stringify({selection,print,boxes}));results.push({selection,print,boxes});
  }
  const out=path.resolve(process.env.QA_OUTPUT_DIR||'work/browser-qa');await mkdir(out,{recursive:true});await writeFile(path.join(out,'trend-layout.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,cases:results.length}));
}finally {await browser.close();}
