import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const {Miniflare}=require('miniflare');
const args=process.argv.slice(2);
if(args.some(a=>a==='--remote'))throw new Error('Bu komut yalnız yerel, boş veritabanında çalışır. Canlı kurulum için KULLANICI-AKTARIMI.md dosyasını okuyun.');
const persistAt=args.indexOf('--persist');
const persist=path.resolve(persistAt>=0?args[persistAt+1]:path.join(root,'.wrangler/state/v3/d1'));
const backup=JSON.parse(await readFile(path.join(root,'private-transfer/accounts.json'),'utf8'));
if(backup.format!=='ajet-account-transfer-v1'||!Array.isArray(backup.schema)||!Array.isArray(backup.inserts))throw new Error('Geçersiz hesap yedeği.');
let config;
try{config=JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8'));}catch{throw new Error('Önce npm run build komutunu çalıştırın.');}
const binding=config.d1_databases?.find(b=>b.binding==='DB');
if(!binding?.database_id)throw new Error('DB bağlantısı bulunamadı.');
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("local-account-transfer")}}',compatibilityDate:config.compatibility_date,d1Databases:{DB:binding.database_id},d1Persist:persist});
try{
  const db=await mf.getD1Database('DB');
  const existing=await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('users','workspaces','uploads','station_performance','maintenance_operations') LIMIT 1").first();
  if(existing)throw new Error('Hedef veritabanı boş değil veya aktarım zaten yapıldı. Var olan kayıtlara dokunulmadı.');
  const statements=[...backup.schema.map(sql=>db.prepare(sql)),...backup.inserts.map(q=>db.prepare(q.sql).bind(...q.values))];
  await db.batch(statements);
  const result=await db.prepare('SELECT count(*) AS accounts, sum(CASE WHEN status=\'active\' AND archived_at IS NULL THEN 1 ELSE 0 END) AS active FROM users').first();
  const sessions=await db.prepare('SELECT count(*) AS count FROM user_sessions').first();
  if(result.accounts!==backup.counts.users||sessions.count!==0)throw new Error('Aktarım doğrulaması başarısız.');
  console.log(`Hesap aktarımı tamamlandı: ${result.accounts} hesap, ${result.active} aktif hesap. Mevcut e-posta ve şifreler kullanılabilir. Eski oturumlar taşınmadı.`);
}catch(error){console.error(error.message?.startsWith('Hedef')?error.message:'Hesap aktarımı tamamlanamadı. Yedek içeriğini veya parola hash’lerini günlüklere yazdırmayın.');process.exitCode=1;}finally{await mf.dispose();}
