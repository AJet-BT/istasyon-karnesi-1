export type PerformanceMetric = 'flights' | 'passengers' | 'otp' | 'ota' | 'delay' | 'delayPer100' | 'damaged' | 'lost' | 'complaint' | 'documents' | 'safety' | 'nonSafety' | 'unreadDocuments' | 'visaPassportIssues' | 'safetyReports' | 'gseDamageReports' | 'digitalBoarding';
export type PerformanceRecord = {
  stationCode:string; provider:string; period:string; sourceFile:string; flights:number; passengers:number|null;
  otp?:number|null; ota?:number|null; delayMinutes?:number|null; damagedRate?:number|null; damagedCount?:number|null;
  lostRate?:number|null; lostCount?:number|null; docRatePct?:number|null; docCount?:number|null; internationalPassengers?:number|null;
  safetyPct?:number|null; safetyCount?:number|null; nonSafetyPct?:number|null; nonSafetyCount?:number|null; complaintDays?:number|null; unreadDocuments?:number|null;
  visaPassportIssues?:number|null; safetyReports?:number|null; gseDamageReports?:number|null; digitalBoardingRatio?:number|null;
  title?:string|null; region?:string|null; countryCode?:string|null; country?:string|null; city?:string|null; isTestData?:boolean;
};
export const MAIN_METRICS:PerformanceMetric[] = ['flights','passengers','otp','ota','delay','damaged','lost','complaint','safety','safetyReports','documents','visaPassportIssues','unreadDocuments','gseDamageReports','digitalBoarding'];
export const METRIC_HEADERS = {
  unreadDocuments:'Extgoms–Okunmayan Doküman Sayısı', passengers:'Yolcu Sayısı',
  visaPassportIssues:'Vize Pasaport Doküman Aksaklıkları', safetyReports:'Emniyet Raporlaması',
  gseDamageReports:'Hasar Raporlama GSE', digitalBoarding:'Dijital Biniş Kartı Kullanım Oranı',
} as const;
export const METRIC_METHODS:Record<PerformanceMetric,string> = {
  flights:'Raporlanan uçuş toplamı · hacim, nötr', passengers:'Raporlanan yolcu toplamı · hacim, nötr',
  otp:'Uçuş ağırlıklı · yüksek değer daha iyi', ota:'Uçuş ağırlıklı · yüksek değer daha iyi',
  delay:'Raporlanan dakikaların toplamı · düşük değer daha iyi', delayPer100:'Raporlanan tehir / aynı kapsamdaki uçuş × 100',
  damaged:'Yolcu ağırlıklı kaynak oranı; yalnız vaka sayısı varsa vaka / aynı kapsamdaki yolcu',
  lost:'Yolcu ağırlıklı kaynak oranı; yalnız vaka sayısı varsa vaka / aynı kapsamdaki yolcu',
  complaint:'Raporlanan istasyon sürelerinin medyanı · gün · düşük değer daha iyi',
  documents:'Vaka / aynı kapsamdaki dış hat yolcu × 100; yalnız kaynak oranı varsa uçuş ağırlıklı',
  safety:'Uçuş ağırlıklı aksaklık yüzdesi · düşük değer daha iyi', nonSafety:'Uçuş ağırlıklı aksaklık yüzdesi · düşük değer daha iyi',
  unreadDocuments:'Raporlanan okunmayan dokümanların toplamı · adet · düşük değer daha iyi',
  visaPassportIssues:'Raporlanan vize/pasaport aksaklıklarının toplamı · adet · düşük değer daha iyi',
  safetyReports:'Raporlanan bildirimlerin toplamı · adet · nötr; rapor sayısı tek başına emniyet performansı değildir',
  gseDamageReports:'Raporlanan GSE hasar bildirimlerinin toplamı · adet · nötr izleme',
  digitalBoarding:'Oranı ve yolcu hacmi birlikte bulunan satırlarda yolcu ağırlıklı kullanım yüzdesi · yüksek değer daha iyi',
};
const countFields:Partial<Record<PerformanceMetric,keyof PerformanceRecord>> = {flights:'flights',passengers:'passengers',delay:'delayMinutes',unreadDocuments:'unreadDocuments',visaPassportIssues:'visaPassportIssues',safetyReports:'safetyReports',gseDamageReports:'gseDamageReports'};
const present = (v:unknown):v is number => typeof v==='number'&&Number.isFinite(v);
function reportedSum(rows:PerformanceRecord[],field:keyof PerformanceRecord):number|null {
  const values=rows.map(row=>row[field]).filter(present);return values.length?values.reduce((a,b)=>a+b,0):null;
}
function weighted(rows:PerformanceRecord[],field:keyof PerformanceRecord,weight:'flights'|'passengers'):number|null {
  const eligible=rows.filter(row=>present(row[field])&&present(row[weight])&&(row[weight] as number)>0);
  const denominator=eligible.reduce((n,row)=>n+(row[weight] as number),0);
  return denominator?eligible.reduce((n,row)=>n+(row[field] as number)*(row[weight] as number),0)/denominator:null;
}
export function aggregateMetric(rows:PerformanceRecord[],metric:PerformanceMetric):number|null {
  const field=countFields[metric];if(field)return reportedSum(rows,field);
  if(metric==='otp'||metric==='ota')return weighted(rows,metric,'flights');
  if(metric==='safety'||metric==='nonSafety')return weighted(rows,metric==='safety'?'safetyPct':'nonSafetyPct','flights');
  if(metric==='digitalBoarding')return weighted(rows,'digitalBoardingRatio','passengers');
  if(metric==='damaged'||metric==='lost') {
    const count=metric==='damaged'?'damagedCount':'lostCount';const rate=metric==='damaged'?'damagedRate':'lostRate';
    const eligible=rows.filter(row=>present(row.passengers)&&row.passengers>0&&(present(row[count])||present(row[rate])));
    const denominator=eligible.reduce((n,row)=>n+(row.passengers as number),0);
    return denominator?eligible.reduce((n,row)=>n+(present(row[rate])?(row[rate] as number)*(row.passengers as number):row[count] as number),0)/denominator:null;
  }
  if(metric==='documents') {
    const eligible=rows.filter(row=>present(row.docCount)&&present(row.internationalPassengers)&&row.internationalPassengers>0);
    const denominator=eligible.reduce((n,row)=>n+(row.internationalPassengers as number),0);
    return denominator?eligible.reduce((n,row)=>n+(row.docCount as number),0)/denominator*100:weighted(rows,'docRatePct','flights');
  }
  if(metric==='delayPer100') {
    const eligible=rows.filter(row=>present(row.delayMinutes)&&row.flights>0);const denominator=eligible.reduce((n,row)=>n+row.flights,0);
    return denominator?(reportedSum(eligible,'delayMinutes') as number)/denominator*100:null;
  }
  const values=rows.map(row=>row.complaintDays).filter(present).sort((a,b)=>a-b);const middle=Math.floor(values.length/2);
  return values.length?values.length%2?values[middle]:(values[middle-1]+values[middle])/2:null;
}
export function metricRecordValue(row:PerformanceRecord,metric:PerformanceMetric):number|null{return aggregateMetric([row],metric);}
export function reportedFieldSum(rows:PerformanceRecord[],field:keyof PerformanceRecord):number|null{return reportedSum(rows,field);}
export function historicalMetricValue(rows:PerformanceRecord[],baseline:PerformanceRecord[],metric:PerformanceMetric):number|null {
  return compareMetricScopes(baseline,rows,metric).comparable?aggregateMetric(rows,metric):null;
}
export function metricCoverage(rows:PerformanceRecord[],metric:PerformanceMetric){return rows.filter(row=>metricRecordValue(row,metric)!==null).length;}
const same=(a:string[],b:string[])=>{const left=[...new Set(a)].sort();const right=[...new Set(b)].sort();return left.length===right.length&&left.every((value,i)=>value===right[i]);};
export function compareMetricScopes(current:PerformanceRecord[],previous:PerformanceRecord[],metric:PerformanceMetric) {
  if(!current.length||!previous.length)return{comparable:false,label:'Karşılaştırma yok' as const,reason:'Karşılaştırma dönemi seçilmedi veya veri bulunamadı.'};
  const identity=(row:PerformanceRecord)=>[row.provider,row.stationCode,row.isTestData?'test':'real',row.region??'',row.countryCode??row.country??'',row.city??''].join('|');
  if(!same(current.map(identity),previous.map(identity)))return{comparable:false,label:'Kapsam farklı' as const,reason:'Handling Provider, istasyon, coğrafya veya veri türü kapsamları eşleşmiyor.'};
  if([...current,...previous].some(row=>!row.sourceFile))return{comparable:false,label:'Kapsam farklı' as const,reason:'Kaynak dosya kapsamı doğrulanamadı.'};
  const eligible=(rows:PerformanceRecord[])=>rows.filter(row=>metricRecordValue(row,metric)!==null).map(identity);
  if(!same(eligible(current),eligible(previous)))return{comparable:false,label:'Kapsam farklı' as const,reason:'Metrik kapsamı istasyon bazında eşleşmiyor; eksik karşılaştırma değeri üretilmedi.'};
  if(aggregateMetric(current,metric)===null||aggregateMetric(previous,metric)===null)return{comparable:false,label:'Kapsam farklı' as const,reason:'Kaynakta Raporlanmamış'};
  return{comparable:true,label:'Karşılaştırılabilir' as const,reason:'İstasyon, veri türü, coğrafya ve raporlanan metrik kapsamları eşleşiyor.'};
}
function deepFreeze<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;}
export function captureReportSnapshot<T extends {comparison:unknown[];filters:{comparisonPeriod:string};generatedAt?:number}>(input:T):T{
  const snapshot=JSON.parse(JSON.stringify({...input,generatedAt:input.generatedAt??Date.now(),comparison:input.filters.comparisonPeriod==='none'?[]:input.comparison})) as T;
  return deepFreeze(snapshot);
}
