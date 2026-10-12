"use client";
import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, UploadCloud, X } from 'lucide-react';
import { detectWorkbook, parseWorkbook, IMPORT_FIELDS, IMPORT_FIELD_LABELS, METRIC_HEADERS, type ImportSelection, type WorkbookDetection, type ImportField } from '@/lib/workbook-import';
import { MISSING_VALUE_LABEL, formatProcessStatus } from '@/lib/corporate-language';

type Upload = {id:string;title?:string|null;fileName:string;provider:string;period:string;rowCount:number;warningCount:number;ownerName:string;createdAt:number;updatedAt:number;deletedAt:number|null;isActiveVersion:boolean;isTestData:boolean;versionNumber:number;sourceSheet:string;mappingVersion:string;importSelection?:string|null;importStatus:string};
export function downloadImportTemplate() {
  const book=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([
    ['Handling Provider','TGS'],['Raporlama Dönemi','2026-06'],
    ['İSTASYON','FLIGHT','DELAY','DOC','DAM','LOST','IRSAFE','NIRSAFE','OTP','OTA','COMP',METRIC_HEADERS.passengers,METRIC_HEADERS.unreadDocuments,METRIC_HEADERS.visaPassportIssues,METRIC_HEADERS.safetyReports,METRIC_HEADERS.gseDamageReports,METRIC_HEADERS.digitalBoardingRatio],
    ['SAW',100,'','','','','','','','','',200,'','','','',''],
  ]);
  sheet['!cols']=Array.from({length:17},(_,i)=>({wch:i>10?38:18}));
  XLSX.utils.book_append_sheet(book,sheet,'İstasyon Performansı');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
    ['AJet Excel şablonu'],['Handling Provider ve Raporlama Dönemi üst bilgilerini gerçek kaynak kapsamına göre düzenleyin.'],
    ['Boş hücre veya -- kaynakta raporlanmamış değerdir; 0 raporlanan sıfırdır.'],
    ['Yüzdeleri Excel yüzde hücresi (0,85 → %85) veya yüzde metni (%85) olarak girin.'],
    ['Adet alanları negatif olmayan tam sayıdır; Dijital Biniş Kartı Kullanım Oranı yolcu sayısıyla ağırlıklandırılır.'],
    ['Örnek SAW satırını kendi kaynak verinizle değiştirin. Dosya yüklerken ayrıca rapor başlığını girin.'],
  ]),'Açıklama');
  XLSX.writeFile(book,'AJet_İstasyon_Performans_Şablonu.xlsx');
}
export default function DatasetUpload({uploads,workspaceId,onChanged,onOverview,setToast}:{uploads:Upload[];workspaceId?:string;onChanged:()=>void;onOverview:()=>void;setToast:(text:string)=>void}) {
  const input=useRef<HTMLInputElement>(null);const readId=useRef(0);
  const [file,setFile]=useState<File|null>(null);const [book,setBook]=useState<XLSX.WorkBook|null>(null);
  const [title,setTitle]=useState('');const [detection,setDetection]=useState<WorkbookDetection|null>(null);
  const [selection,setSelection]=useState<ImportSelection|null>(null);const [busy,setBusy]=useState(false);const [dragging,setDragging]=useState(false);
  const [message,setMessage]=useState('');const [complete,setComplete]=useState(false);const [mode,setMode]=useState('replace');const [detail,setDetail]=useState<Upload|null>(null);
  const url=`/api/platform${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:''}`;
  const parsed=useMemo(()=>book&&selection?parseWorkbook(book,selection):null,[book,selection]);
  const issues=[...(detection?.issues??[]),...(parsed?.issues??[])];
  const errors=issues.filter(issue=>issue.level==='error');
  const chooseFile=async(next?:File)=>{
    if(!next)return;const id=++readId.current;setFile(next);setBook(null);setSelection(null);setDetection(null);setComplete(false);setMessage('');
    if(!/\.(xlsx|xls|csv)$/i.test(next.name)){setMessage('Yalnızca XLSX, XLS veya CSV kabul edilir.');return;}
    if(!next.size||next.size>15*1024*1024){setMessage('Dosya boş olmamalı ve 15 MB sınırını aşmamalıdır.');return;}
    try{const loaded=XLSX.read(await next.arrayBuffer(),{type:'array',cellDates:true,cellNF:true});if(id!==readId.current)return;
      const detected=detectWorkbook(loaded,next.name);setBook(loaded);setDetection(detected);setSelection(detected.selection);
    }catch{if(id===readId.current)setMessage('Excel okunamadı. Dosyayı Excel biçiminde yeniden kaydedin.');}
  };
  const override=(partial:Partial<ImportSelection>)=>{
    if(!book||!file)return;const detected=detectWorkbook(book,file.name,{...selection,...partial});setDetection(detected);setSelection(detected.selection);
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setMessage('');if(!file||!title.trim()||!selection){setMessage('Dosya ve rapor başlığı gereklidir. Algılanamayan dönem veya Handling Provider bilgisini Excel içinde düzeltin.');return;}
    if(errors.length||!parsed?.rows.length){setMessage('Excel doğrulanamadı. Aşağıdaki alanları kaynak dosyada düzeltin.');return;}
    setBusy(true);try{const form=new FormData();form.set('file',file);form.set('title',title.trim());form.set('selection',JSON.stringify(selection));form.set('mode',mode);
      const response=await fetch(url,{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||'İçe aktarım tamamlanamadı.');
      setComplete(true);setMessage(`${title.trim()} · ${result.rows} kayıt · v${result.versionNumber} kaydedildi.`);onChanged();setToast('Veri kümesi içe aktarıldı.');
    }catch(error){setMessage(error instanceof Error?error.message:'İçe aktarım tamamlanamadı.');}finally{setBusy(false);}
  };
  const lifecycle=async(upload:Upload,action:'delete'|'restore'|'reprocess')=>{
    const reason=action==='delete'?window.prompt('Dosya silme nedeni:','Kullanıcı isteği'):null;if(action==='delete'&&reason===null)return;
    setBusy(true);try{const response=await fetch(url,{method:action==='delete'?'DELETE':'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:upload.id,action,reason})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'İşlem tamamlanamadı.');onChanged();setToast(action==='delete'?'Dosya silindi.':action==='restore'?'Dosya geri yüklendi.':'Dosya kayıtlı eşleştirmesiyle yeniden işlendi.');
    }catch(error){setToast(error instanceof Error?error.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}
  };
  return <div className="page-stack">
    <div className="page-heading"><div><span>VERİ YÜKLEME</span><h2>Excel Veri Yükleme</h2><p>Dosyayı seçin, rapor başlığını girin ve tek işlemle içe aktarın.</p></div><button className="secondary-button" onClick={downloadImportTemplate}><Download size={16}/> Excel Şablonunu İndir</button></div>
    <form className="panel dataset-form" onSubmit={submit} aria-label="Dosya ve başlık ile içe aktarım">
      <div className={`dropzone ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);void chooseFile(event.dataTransfer.files[0]);}}>
        <UploadCloud size={30}/><h3>{file?file.name:'Excel dosyasını buraya bırakın'}</h3><button type="button" className="secondary-button" onClick={()=>input.current?.click()}>Dosya seç</button><small>XLSX, XLS veya CSV · en fazla 15 MB</small>
        <input ref={input} aria-label="Excel dosyası" type="file" accept=".xlsx,.xls,.csv" onChange={event=>void chooseFile(event.target.files?.[0])} hidden/>
      </div>
      <label className="dataset-title"><span>Rapor / Veri Kümesi Başlığı</span><input required maxLength={180} value={title} onChange={event=>setTitle(event.target.value)} placeholder="Örn. Haziran TGS İstasyon Performansı"/></label>
      {selection&&<p className="detection-summary">{selection.sheetName} · başlık satırı {selection.headerRow} · {selection.provider??MISSING_VALUE_LABEL} · {selection.period??MISSING_VALUE_LABEL} · {parsed?.rows.length??0} istasyon</p>}
      {issues.length>0&&<div className="import-results" role="status">{issues.slice(0,12).map((issue,i)=><p className={issue.level} key={i}>{issue.sourceRow?`Satır ${issue.sourceRow}: `:''}{issue.message}</p>)}{issues.length>12&&<p>{issues.length-12} ek sonuç; kaynak dosyayı düzeltip tekrar seçin.</p>}</div>}
      {book&&<details className="import-exceptions"><summary>İstisna için sütun eşleştirmesi ve önizleme</summary><p>Normal akış otomatik eşleştirmeyi kullanır. Algılanamayan dönem ve Handling Provider Excel içinde düzeltilmelidir.</p>
        <div className="form-grid"><label><span>Çalışma sayfası</span><select value={selection?.sheetName??''} onChange={event=>override({sheetName:event.target.value,headerRow:undefined,mappings:undefined})}><option value="">Seçin</option>{book.SheetNames.map(name=><option key={name}>{name}</option>)}</select></label><label><span>Başlık satırı</span><input type="number" min="1" value={selection?.headerRow??1} onChange={event=>override({headerRow:Number(event.target.value),mappings:undefined})}/></label></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Kaynak sütun</th><th>Sistem alanı</th></tr></thead><tbody>{detection?.columns.filter(c=>c.label).map(column=>{const mapped=Object.entries(selection?.mappings??{}).find(([,i])=>i===column.index)?.[0]??'';return <tr key={column.index}><td>{column.index+1} · {column.label}</td><td><select value={mapped} onChange={event=>{const mappings={...selection?.mappings};Object.entries(mappings).forEach(([field,i])=>{if(i===column.index)delete mappings[field as ImportField];});if(event.target.value)mappings[event.target.value as ImportField]=column.index;override({mappings});}}><option value="">İçe aktarma</option>{IMPORT_FIELDS.map(field=><option key={field} value={field}>{IMPORT_FIELD_LABELS[field]}</option>)}</select></td></tr>;})}</tbody></table></div>
        {parsed&&<div className="table-scroll"><table className="data-table"><thead><tr><th>İstasyon</th><th>Uçuş</th><th>{METRIC_HEADERS.passengers}</th><th>{METRIC_HEADERS.unreadDocuments}</th><th>{METRIC_HEADERS.safetyReports}</th></tr></thead><tbody>{parsed.rows.slice(0,5).map(row=><tr key={row.sourceRow}><td>{row.stationCode}</td><td>{row.flights??MISSING_VALUE_LABEL}</td><td>{row.passengers??MISSING_VALUE_LABEL}</td><td>{row.unreadDocuments??MISSING_VALUE_LABEL}</td><td>{row.safetyReports??MISSING_VALUE_LABEL}</td></tr>)}</tbody></table></div>}
      </details>}
      {selection&&uploads.some(u=>!u.deletedAt&&u.isActiveVersion&&u.provider===selection.provider&&u.period===selection.period)&&<label className="duplicate-choice"><span>Aynı dönem için önceki sürüm korunur.</span><select value={mode} onChange={event=>setMode(event.target.value)}><option value="replace">Yeni aktif sürüm oluştur</option><option value="cancel">İçe aktarımı iptal et</option></select></label>}
      {message&&<p className={`import-message ${complete?'success':'error'}`} role="status">{message}</p>}
      <div className="wizard-actions"><button type="submit" className="primary-button" disabled={busy||complete}>{busy?'İçe aktarılıyor…':'Veriyi İçe Aktar'}</button>{complete&&<><button type="button" className="secondary-button" onClick={()=>{setFile(null);setBook(null);setSelection(null);setDetection(null);setTitle('');setMessage('');setComplete(false);}}>Yeni Dosya</button><button type="button" className="secondary-button" onClick={onOverview}>Genel Bakışa Git</button></>}</div>
    </form>
    <article className="panel history-panel"><div className="section-header"><div><span>DOSYA YAŞAM DÖNGÜSÜ</span><h3>Yüklemeler ve Sürümler</h3></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Başlık / Dosya</th><th>Handling Provider</th><th>Dönem</th><th>Yükleyen</th><th>Kayıt / Sürüm</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>{uploads.length?uploads.map(upload=><tr key={upload.id}><td><b>{upload.title||upload.fileName}</b><small>{upload.fileName} · {upload.sourceSheet}</small></td><td>{upload.provider}</td><td>{upload.period}</td><td>{upload.ownerName}</td><td>{upload.rowCount} · v{upload.versionNumber}<small>{new Date(upload.createdAt).toLocaleString('tr-TR')}</small></td><td>{upload.deletedAt?'Silindi':upload.isActiveVersion?'Aktif':'Önceki Sürüm'}</td><td><div className="row-actions"><button onClick={()=>setDetail(upload)}>Dosya ve Eşleştirme</button>{upload.deletedAt?<button disabled={busy} onClick={()=>void lifecycle(upload,'restore')}>Geri Yükle</button>:<><button onClick={()=>{setTitle(upload.title||upload.fileName);setComplete(false);input.current?.click();}}>Yeni Sürüm</button><button disabled={busy} onClick={()=>void lifecycle(upload,'reprocess')}>Yeniden İşle</button><button className="danger" disabled={busy} onClick={()=>void lifecycle(upload,'delete')}>Dosyayı Sil</button></>}</div></td></tr>):<tr><td colSpan={7}>Henüz veri yüklenmedi.</td></tr>}</tbody></table></div></article>
    {detail&&<div className="modal-backdrop" onMouseDown={()=>setDetail(null)}><article className="simple-modal panel" onMouseDown={event=>event.stopPropagation()}><div className="simple-modal-head"><h3>{detail.title||detail.fileName}</h3><button onClick={()=>setDetail(null)} aria-label="Kapat"><X size={18}/></button></div><p>{detail.fileName} · {detail.provider} · {detail.period} · {detail.sourceSheet} · v{detail.versionNumber}</p><p>{formatProcessStatus(detail.importStatus)} · {detail.rowCount} kayıt · {detail.warningCount} uyarı</p><h4>Kayıtlı sütun eşleştirmesi</h4><pre className="selection-detail">{detail.importSelection?JSON.stringify(JSON.parse(detail.importSelection),null,2):`${detail.mappingVersion} · Eski kaynak, yeniden işlemede otomatik algılanır.`}</pre></article></div>}
  </div>;
}
