import { parse } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { MongoClient, ObjectId } from 'mongodb';
import { hash, argon2id } from 'argon2';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(a => a !== '--apply')) throw new Error('Nur --apply erlaubt.');
const apply = args.includes('--apply');
const config = parse(await readFile('.env.demo.local'));
const name = 'clubmatiq_demo';
if (config.MONGODB_DB_NAME !== name || !config.MONGODB_URI ||
    !/^mongodb(?:\+srv)?:\/\/clubmatiq_demo_user:/.test(config.MONGODB_URI)) {
  throw new Error('Ausschliesslich Demo-Datenbank mit separatem Demo-Benutzer erlaubt.');
}
const id = key => new ObjectId(createHash('sha256').update('clubmatiq-demo-v1:' + key).digest('hex').slice(0, 24));
const clubId = id('verein');
const vereinId = clubId.toHexString();
const now = new Date();
const roles = ['admin', 'materialverantwortlich', 'leiter', 'mitglied'];
const plan = [];
function add(collection, key, data) {
  plan.push({ collection, document: { _id: id(collection + ':' + key), vereinId, ...data } });
}
plan.push({ collection: 'vereine', document: { _id: clubId, name: 'Turnverein Musterhausen', kuerzel: 'TVM', erstelltAm: now, integrationen: { clubdesk: { aktiviert: false, status: 'nicht_verbunden' } } } });
for (const rolle of roles) add('benutzer', rolle, { vorname: 'Demo', nachname: rolle, email: rolle + '@clubmatiq.example', rolle, aktiv: true, erstelltAm: now });
for (const name of ['Turngeräte','Kleingeräte','Bälle','Wettkampfmaterial','Trainingshilfen','Vereinskleider','Veranstaltungsmaterial','Sonstiges']) add('kategorien', name, { name });
for (const name of ['Geräteraum','Materialschrank','Vereinslager','Kleiderlager','Wettkampflager']) add('lagerorte', name, { name });
for (const [sortierung, bezeichnung] of ['104','116','128','140','152','164','XS','S','M','L','XL','XXL'].entries()) add('groessen', bezeichnung, { bezeichnung, sortierung });
for (const name of ['ELKI','KITU','JUKO','TI','TU','TV']) add('riegen', name, { name, namensschluessel: name.toLocaleLowerCase('de-CH'), bereich: ['ELKI','KITU','JUKO'].includes(name) ? 'juko' : 'aktive', aktiv: true, erstelltAm: now, aktualisiertAm: now });


const ref = (collection, key) => id(collection + ':' + key).toHexString();
for (const name of ['Demo Sportbedarf','Demo Textilwerk','Demo Eventmaterial']) add('lieferanten', name, {name, kontaktperson:'Demo Kontakt', email:'kontakt@lieferant.example', telefon:'', bemerkung:'Fiktiver Lieferant', erstelltAm:now, aktualisiertAm:now});
const material = [
 ['Gymnastikmatte','Turngeräte',24,45],['Sprungbrett','Turngeräte',2,350],['Turnbank','Turngeräte',4,280],['Kasten','Turngeräte',3,650],
 ['Springseil','Kleingeräte',30,8],['Gymnastikreifen','Kleingeräte',20,12],['Keule','Kleingeräte',16,15],['Balancekissen','Trainingshilfen',10,25],
 ['Fussball','Bälle',12,30],['Volleyball','Bälle',10,45],['Handball','Bälle',8,35],['Softball','Bälle',15,12],
 ['Markierungshütchen','Trainingshilfen',40,3],['Koordinationsleiter','Trainingshilfen',4,30],['Theraband','Trainingshilfen',2,12],['Stoppuhr','Wettkampfmaterial',6,25],
 ['Startnummernset','Wettkampfmaterial',3,60],['Staffelstab','Wettkampfmaterial',8,10],['Massband','Wettkampfmaterial',2,20],['Pavillon','Veranstaltungsmaterial',2,250],
 ['Festbank','Veranstaltungsmaterial',10,80],['Materialkiste','Sonstiges',0,25]
];
const clothing = [['T-Shirt',18],['Trainerjacke',55],['Trainerhose',40],['Hoodie',45],['Shorts',25],['Polo',30],['Wettkampfshirt',35],['Regenjacke',65]];
function movement(name, size, menge) {
  if (!menge) return;
  const artikelId = ref('artikel',name);
  add('lagerbewegungen',name+':'+(size??'standard'),{artikelId, groesseId:size?ref('groessen',size):null, art:'anlage', mengeDelta:menge, zeitpunkt:now, artikelName:name, ...(size?{groesseName:size}:{}), benutzerName:'Demo admin', benutzerId:ref('benutzer','admin'), referenzId:artikelId, referenzTyp:'artikel'});
}
for (const [name,category,menge,einzelwert] of material) {
  add('artikel',name,{name,kategorieId:ref('kategorien',category),lagerortId:ref('lagerorte',category==='Veranstaltungsmaterial'?'Vereinslager':category==='Wettkampfmaterial'?'Wettkampflager':category==='Turngeräte'?'Geräteraum':'Materialschrank'),lieferantId:ref('lieferanten',category==='Veranstaltungsmaterial'?'Demo Eventmaterial':'Demo Sportbedarf'),menge,einzelwert,mindestbestand:3,beschreibung:'Fiktiver Demo-Artikel',hatGroessen:false,istVereinskleidung:false,erstelltAm:now});
  movement(name,null,menge);
}
for (const [name,einzelwert] of clothing) {
  const sizes=['128','140','152','164','XS','S','M','L','XL','XXL'];
  const quantities=sizes.map((_,i)=>i===0?0:i===1?1:5);
  add('artikel',name,{name,kategorieId:ref('kategorien','Vereinskleider'),lagerortId:ref('lagerorte','Kleiderlager'),lieferantId:ref('lieferanten','Demo Textilwerk'),menge:quantities.reduce((a,b)=>a+b,0),einzelwert:0,mindestbestand:0,beschreibung:'Fiktive Vereinskleidung',hatGroessen:true,istVereinskleidung:true,erstelltAm:now});
  for (const [i,size] of sizes.entries()) {
    add('artikelvarianten',name+':'+size,{artikelId:ref('artikel',name),groesseId:ref('groessen',size),menge:quantities[i],einzelwert,mindestbestand:2});
    movement(name,size,quantities[i]);
  }
}
const first=['Alex','Robin','Kim','Noah','Mia','Lina','Lea','Jan','Sam','Nina'];
const last=['Muster','Beispiel','Testperson','Demoperson'];
const groups=['ELKI','KITU','JUKO','TI','TU','TV'];
for(let i=0;i<40;i++) {
  const key='DEMO-'+String(i+1).padStart(3,'0');
  add('clubdesk_mitglieder',key,{clubdeskId:key,anrede:'',vorname:first[i%10],nachname:last[Math.floor(i/10)],adresse:'',ort:'Musterhausen',plz:'',status:'Aktiv',aktiv:true,importiertAm:now,erstbezugsRabattIds:[],riegen:i%7===0?[groups[i%6],groups[(i+1)%6]]:[groups[i%6]]});
}
const rabattBasis={geltungsbereich:'artikel',artikelIds:[ref('artikel','T-Shirt')],kategorieIds:[],gueltigAb:null,gueltigBis:null,kombinierbar:false,aktiv:true,erstelltAm:now,aktualisiertAm:now};
add('rabattregeln','erstbezug',{...rabattBasis,name:'Erstbezug T-Shirt',rabattart:'fixpreis',wert:0,riegen:['TI','TU','TV'],maximaleMenge:1,einmaligProMitglied:true,anspruchsgruppe:'demo-erstbezug'});
add('rabattregeln','riegenrabatt',{...rabattBasis,name:'Riegenrabatt 20 %',rabattart:'prozent',wert:20,riegen:['TI','TU','TV'],maximaleMenge:null,einmaligProMitglied:false});

for (const [name,einzelwert] of clothing) {
  for (const size of ['128','140','152','164','XS','S','M','L','XL','XXL']) {
    const offen = name === 'Regenjacke';
    add('vereinskleider_preise',name+':'+size,{artikelId:ref('artikel',name),groesseId:ref('groessen',size),preistyp:offen?'variabel':'fix',druckkosten:5,verkaufspreis:offen?null:einzelwert+10,preisOffen:offen,erstelltAm:now,aktualisiertAm:now});
  }
}
const loans = [
  {key:'offen',name:'Gymnastikmatte',person:'Alex Muster',menge:4,returned:0,due:7},
  {key:'teilweise',name:'Volleyball',person:'Robin Muster',menge:5,returned:2,due:3},
  {key:'abgeschlossen',name:'Staffelstab',person:'Kim Muster',menge:4,returned:4,due:-1},
  {key:'ueberfaellig',name:'Springseil',person:'Noah Muster',menge:6,returned:0,due:-2}
];
const day = offset => new Date(now.getTime()+offset*86400000);
const date = offset => day(offset).toISOString().slice(0,10);

const client = new MongoClient(config.MONGODB_URI);
try {
  await client.connect();
  const db = client.db(name);
  const status = await db.command({ connectionStatus: 1 });
  const auth = status.authInfo;
  if (auth.authenticatedUsers.length !== 1 || auth.authenticatedUsers[0].user !== 'clubmatiq_demo_user' ||
      auth.authenticatedUserRoles.length !== 1 || auth.authenticatedUserRoles[0].role !== 'readWrite' ||
      auth.authenticatedUserRoles[0].db !== name) throw new Error('Demo-Rollenprüfung fehlgeschlagen.');
  console.log('Zieldatenbank:', name);
  for (const collection of new Set(plan.map(p => p.collection))) {
    console.log(collection + ': ' + plan.filter(p => p.collection === collection).length + ' vorgesehene Datensätze');
  }
  console.log('ausleihen: ' + loans.length + ' vorgesehene Geschäftsvorfälle');
  if (!apply) {
    console.log('Vorschau: keine Änderungen.');
  } else {
    const passwords = roles.map(r => config['DEMO_PASSWORD_' + r.toUpperCase()]);
    if (passwords.some(p => !p || p.length < 16) || new Set(passwords).size !== roles.length) throw new Error('Vier unterschiedliche Demo-Passwörter mit mindestens 16 Zeichen in .env.demo.local erforderlich.');
    for (const p of plan.filter(p => p.collection === 'benutzer')) {
      p.document.passwortHash = await hash(passwords[roles.indexOf(p.document.rolle)], { type: argon2id });
    }
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const {collection, document} of plan) {
          const existing = await db.collection(collection).findOne({_id: document._id}, {session});
          if (existing && (collection === 'vereine' ? existing.name !== document.name : existing.vereinId !== vereinId)) throw new Error('ID-Konflikt: ' + collection);
          if (collection === 'benutzer') {
            const other = await db.collection(collection).findOne({email: document.email, _id: {$ne: document._id}}, {session});
            if (other) throw new Error('Demo-E-Mail bereits vergeben.');
          }
          const {_id, ...fields} = document;
          await db.collection(collection).updateOne({_id}, {$setOnInsert: fields}, {upsert: true, session});
        }
        for (const loan of loans) {
          const _id = id('ausleihen:'+loan.key);
          const existing = await db.collection('ausleihen').findOne({_id},{session});
          if (existing) {
            if (existing.vereinId !== vereinId) throw new Error('Ausleih-ID-Konflikt.');
            continue;
          }
          const artikelId = ref('artikel',loan.name);
          const result = await db.collection('artikel').updateOne({_id:new ObjectId(artikelId),vereinId,hatGroessen:false,archiviert:{$ne:true},menge:{$gte:loan.menge}},{$inc:{menge:loan.returned-loan.menge}},{session});
          if (result.matchedCount !== 1) throw new Error('Demo-Ausleihe: Bestand fehlt.');
          const status = loan.returned===loan.menge?'abgeschlossen':loan.returned?'teilweise':'offen';
          await db.collection('ausleihen').insertOne({_id,vereinId,artikelId,groesseId:null,person:loan.person,menge:loan.menge,ausleihdatum:date(-5),rueckgabedatum:date(loan.due),bemerkung:'Fiktive Demo-Ausleihe',status,zurueckgegeben:loan.returned,erstelltAm:now,...(loan.returned?{rueckgaben:[{menge:loan.returned,datum:now}],letzteRueckgabeAm:now}:{}),...(status==='abgeschlossen'?{abgeschlossenAm:now}:{})},{session});
          for (const [art,mengeDelta] of [['ausleihe',-loan.menge],['rueckgabe',loan.returned]]) {
            if (!mengeDelta) continue;
            await db.collection('lagerbewegungen').insertOne({_id:id('loan-movement:'+loan.key+':'+art),vereinId,artikelId,groesseId:null,art,mengeDelta,zeitpunkt:now,artikelName:loan.name,benutzerName:'Demo admin',benutzerId:ref('benutzer','admin'),referenzId:_id.toHexString(),referenzTyp:'ausleihe'},{session});
          }
        }
      });
    } finally { await session.endSession(); }
    console.log('Demo-Grundstruktur sichergestellt. Bestehende Datensätze unverändert.');
  }
} finally { await client.close(); }
