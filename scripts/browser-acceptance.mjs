import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const playwright=require(process.env.QA_PLAYWRIGHT_PATH||'C:/Users/MRT45/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const XLSX=require('xlsx');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5173';
const out=path.resolve(process.env.QA_OUTPUT_DIR||'work/browser-qa');await mkdir(out,{recursive:true});
const browser=await playwright.chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'msedge'});
const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const results=[];
try {
  await page.goto(base);await page.locator('.executive-kpis .metric-card').first().waitFor({timeout:30000});
  for(const viewport of [{width:1366,height:768},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);await page.waitForTimeout(200);
    const measurement=await page.locator('.executive-kpis .metric-card').evaluateAll(cards=>({cards:cards.map(card=>{const r=card.getBoundingClientRect();return{label:card.querySelector('.metric-label').textContent,bottom:r.bottom,top:r.top,left:r.left,right:r.right,visible:r.top>=0&&r.bottom<=innerHeight,clipped:card.scrollHeight>card.clientHeight+2};}),viewport:{width:innerWidth,height:innerHeight,zoom:devicePixelRatio},scrollWidth:document.documentElement.scrollWidth}));
    assert.equal(measurement.cards.length,15);assert.ok(measurement.cards.filter(card=>!card.visible).length<=2,JSON.stringify(measurement));assert.ok(measurement.scrollWidth<=viewport.width,'horizontal scrolling');assert.ok(measurement.cards.every(card=>!card.clipped),JSON.stringify(measurement.cards));
    results.push({test:'desktop-visibility',viewport,measurement});await page.screenshot({path:path.join(out,`dashboard-${viewport.width}.png`)});
  }
  const fixture=(period)=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Cover']]),'Kapak');const cells=[['Handling Provider','TGS'],['Raporlama Dönemi',period],['İSTASYON','FLIGHT','PASS','DELAY','DOC','DAM','LOST','IRSAFE','NIRSAFE','OTP','OTA','COMP','Extgoms–Okunmayan Doküman Sayısı','Vize Pasaport Doküman Aksaklıkları','Emniyet Raporlaması','Hasar Raporlama GSE','Dijital Biniş Kartı Kullanım Oranı']];for(const [i,station] of ['ADB','AYT','BJV','COV','DLM','ESB','SAW'].entries())cells.push([station,100+i,200+i,10,0.001,0.002,0.001,0.002,0.001,period==='2026-05'?0.85:0.9,0.89,1,i===0?0:i,i===1?'':i,2,i===2?'':1,0.75]);XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(cells),'Kaynak');return Buffer.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}));};
  for(const period of ['2026-05','2026-06']) {
    await page.getByRole('button',{name:'Veri Yükleme',exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:`QA_TGS_${period}.xlsx`,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fixture(period)});
    await page.locator('.dataset-title input').fill(`${period} QA Başlığı`);
    const response=page.waitForResponse(r=>r.url().includes('/api/platform')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Veriyi İçe Aktar',exact:true}).click();const saved=await response;const payload=await saved.json();assert.equal(saved.status(),201,JSON.stringify(payload));assert.equal(payload.selection.sheetName,'Kaynak');assert.equal(payload.selection.headerRow,3);
    await page.getByText('2026', {exact:true}).count().catch(()=>0);
    await page.getByRole('button',{name:'Genel Bakış',exact:true}).click();await page.locator('.executive-kpis').waitFor();results.push({test:'file-title-import',period,title:payload.title,selection:payload.selection});
  }
  await page.locator('.primary-filters select').nth(0).selectOption('2026-06');
  await page.locator('.primary-filters select').nth(1).selectOption('2026-05');await page.waitForTimeout(1100);await page.locator('.executive-kpis.comparison-active').waitFor();
  await page.setViewportSize({width:1366,height:768});const compareMetrics=await page.locator('.executive-kpis .metric-card').evaluateAll(cards=>cards.map(card=>({label:card.querySelector('.metric-label').textContent,bottom:card.getBoundingClientRect().bottom,clipped:card.scrollHeight>card.clientHeight+2})));
  assert.ok(compareMetrics.filter(card=>card.bottom>768).length<=2);assert.ok(compareMetrics.every(card=>!card.clipped),JSON.stringify(compareMetrics));results.push({test:'comparison-visibility',metrics:compareMetrics});await page.screenshot({path:path.join(out,'dashboard-comparison.png')});

  const selector=page.getByLabel('Ana sayfa trend metriği');assert.equal(await selector.inputValue(),'otpOta');
  const selectionChecks=[];
  for(const metric of ['flights','otp','delay','complaint','unreadDocuments','digitalBoarding']) {
    await selector.selectOption(metric);const chart=page.locator('.overview-dual-trend [data-overview-trend]');assert.equal(await chart.getAttribute('data-overview-trend'),metric);
    await chart.locator('svg g[aria-label]').last().hover();assert.ok(await chart.getByRole('tooltip').count());selectionChecks.push({metric,tooltip:await chart.getByRole('tooltip').innerText()});
  }
  await selector.selectOption('digitalBoarding');results.push({test:'overview-metric-selector',checks:selectionChecks});
  const dashboardValues=await page.locator('.executive-kpis .metric-card').evaluateAll(cards=>cards.map(c=>c.querySelector('.metric-comparison-values .current strong')?.textContent||c.querySelector('.metric-value')?.textContent));
  await page.evaluate(()=>{window.print=()=>{window.__qaPrintRequested=true;};});

  for(const [option,scope]of [['Hızlı PDF','summary'],['Master PDF','full']]) {
    await page.locator('.topbar').getByRole('button',{name:option,exact:true}).click();await page.locator(`.performance-report[data-report-scope="${scope}"]`).waitFor({state:'attached'});

    assert.equal(await page.locator('[data-report-metric]').count(),15);
    assert.equal(await page.locator('.performance-report [data-report-section]').first().getAttribute('data-report-section'),'cover');
    assert.equal(await page.locator('.performance-report [data-report-section=cover] img').getAttribute('src'),'/ajet-logo.png');
    const reportText=await page.locator('.performance-report').textContent();assert.doesNotMatch(reportText,/TEST VERİSİ|Üretim verisi|test_mock|SecretSheet|KPI-v3|Kaynaklar ve İzlenebilirlik|\.xlsx|satır \d+/i);
    assert.equal(await page.locator('.performance-report [data-report-section=main-trend] [data-overview-trend]').getAttribute('data-overview-trend'),'digitalBoarding');
    const reportValues=await page.locator('[data-report-metric] > strong').allTextContents();
    dashboardValues.forEach((v,i)=>assert.ok(reportValues[i].includes(v.trim()),v+' / '+reportValues[i]));
    if(scope==='full') {assert.equal(await page.locator('[data-report-station]').count(),7);assert.equal(await page.locator('[data-station-metric]').count(),105);}
    // Changing overview selection after capture must leave the report immutable.
    await selector.selectOption('flights');assert.equal(await page.locator('.performance-report [data-report-section=main-trend] [data-overview-trend]').getAttribute('data-overview-trend'),'digitalBoarding');await selector.selectOption('digitalBoarding');
assert.ok(await page.locator('.performance-report [data-comparison=true]').count()>0);
    await page.emulateMedia({media:'print'});const layouts=await page.locator('.report-page').evaluateAll(pages=>pages.map(p=>({section:p.dataset.reportSection,height:p.getBoundingClientRect().height,scroll:p.scrollHeight})));assert.ok(layouts.every(p=>p.height<=718&&p.scroll<=719),JSON.stringify(layouts));results.push({test:'report-layout',scope,layouts});await page.pdf({path:path.join(out,`${scope}-comparison.pdf`),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});results.push({test:'actual-pdf-path',option,comparison:true});
  }
  await page.locator('.primary-filters select').nth(1).selectOption('none');await page.waitForTimeout(700);
  await page.locator('.topbar').getByRole('button',{name:'Master PDF',exact:true}).click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.performance-report [data-comparison=true]').count(),0);await page.emulateMedia({media:'print'});await page.pdf({path:path.join(out,'full-no-comparison.pdf'),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});results.push({test:'actual-pdf-path',option:'Master PDF',comparison:false});
  await selector.selectOption('otpOta');await page.locator('.topbar').getByRole('button',{name:'Hızlı PDF',exact:true}).click();await page.waitForTimeout(300);assert.equal(await page.locator('.performance-report [data-report-section=main-trend] [data-overview-trend]').getAttribute('data-overview-trend'),'otpOta');assert.equal(await page.locator('.performance-report [data-report-section=main-trend] .dual-line').count(),2);await page.emulateMedia({media:'print'});await page.pdf({path:path.join(out,'summary-default.pdf'),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});results.push({test:'default-dual-report',passed:true});
  await page.getByRole('button',{name:'Zamanında Performans',exact:true}).click();assert.equal(await page.getByLabel('Ana sayfa trend metriği').count(),0);assert.ok(await page.locator('.dual-trend .dual-line.otp').count());results.push({test:'analysis-trends-preserved',passed:true});
  await page.getByRole('button',{name:'Rapor Merkezi',exact:true}).click();assert.equal(await page.locator('.report-card button').filter({hasText:'PDF'}).count(),2);results.push({test:'two-pdf-options',passed:true});
  await page.getByRole('button',{name:'Genel Bakış',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'dashboard-mobile.png')});
  assert.equal(errors.length,0,JSON.stringify(errors));await writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,tests:results.length,out}));
} catch(error) {
  await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await writeFile(path.join(out,'failure.txt'),String(error.stack));console.error(error.stack);process.exitCode=1;
} finally {await browser.close();}
