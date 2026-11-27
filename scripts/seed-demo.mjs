import { parse } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { MongoClient, ObjectId } from 'mongodb';
import { hash, argon2id } from 'argon2';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
if (new Set(args).size !== args.length || args.some(a => !['--apply','--reset','--confirm=clubmatiq_demo'].includes(a)) || (args.includes('--confirm=clubmatiq_demo') !== (reset && args.includes('--apply')))) throw new Error('Reset erfordert --reset --apply --confirm=clubmatiq_demo.');
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

const sales = [
 {key:'twint',name:'T-Shirt',size:'M',menge:2,direct:2,price:28,paid:true,payment:'twint',buyer:'Alex Muster'},
 {key:'bar',name:'Hoodie',size:'L',menge:1,direct:1,price:55,paid:true,payment:'bar',buyer:'Robin Muster'},
 {key:'bestellung',name:'Trainerjacke',size:'128',menge:2,direct:0,price:65,paid:false,payment:'rechnung',buyer:'Kim Muster'},
 {key:'gemischt',name:'Shorts',size:'140',menge:3,direct:1,price:35,paid:false,payment:'rechnung',buyer:'Noah Muster'},
 {key:'preis-offen',name:'Regenjacke',size:'S',menge:1,direct:0,price:null,paid:false,payment:'rechnung',buyer:'Mia Muster'}
];
add('vereinskleider_sammelbestellungen','demo-reserve',{lieferantId:ref('lieferanten','Demo Textilwerk'),lieferantName:'Demo Textilwerk',status:'entwurf',positionen:[{artikelId:ref('artikel','Polo'),groesseId:ref('groessen','M'),artikelname:'Polo',menge:4,geliefertMenge:0,kundenbedarfMenge:0,lagerreserveMenge:4}],bemerkung:'Demo: Lagerreserve',erstelltAm:now,aktualisiertAm:now});
add('vereinskleider_sammelbestellungen','demo-kundenbedarf',{lieferantId:ref('lieferanten','Demo Textilwerk'),lieferantName:'Demo Textilwerk',status:'bestellt',positionen:[{artikelId:ref('artikel','Trainerjacke'),groesseId:ref('groessen','128'),artikelname:'Trainerjacke',menge:3,geliefertMenge:0,kundenbedarfMenge:2,lagerreserveMenge:1},{artikelId:ref('artikel','Shorts'),groesseId:ref('groessen','140'),artikelname:'Shorts',menge:3,geliefertMenge:0,kundenbedarfMenge:2,lagerreserveMenge:1}],bemerkung:'Demo: Kundenbedarf und Lagerreserve',bestelltAm:now,erstelltAm:now,aktualisiertAm:now});
for(const [artikelName,rolle,beschreibung,status,notiz] of [
 ['Gymnastikmatte','mitglied','Naht am Rand aufgegangen.','offen',''],
 ['Sprungbrett','leiter','Rutschfester Belag löst sich.','in_bearbeitung','Materialverantwortliche prüfen eine Reparatur.'],
 ['Volleyball','leiter','Ball verliert Luft am Ventil.','erledigt','Ventil geprüft und repariert.']
]) {
  const bearbeitet=status!=='offen';
  const erstelltAm=new Date(now.getTime()-86400000);
  const bearbeiter={bearbeitetVonId:ref('benutzer','materialverantwortlich'),bearbeitetVonName:'Demo materialverantwortlich'};
  add('schadensmeldungen',artikelName,{artikelId:ref('artikel',artikelName),artikelName,beschreibung,fotos:[],gemeldetVonId:ref('benutzer',rolle),gemeldetVonName:'Demo '+rolle,status,bearbeitungsnotiz:notiz,erstelltAm,aktualisiertAm:bearbeitet?now:erstelltAm,...(bearbeitet?{...bearbeiter,bearbeitungsverlauf:[{datum:now,alterStatus:'offen',alteNotiz:'',neuerStatus:status,notiz,...bearbeiter}]}:{})});
}
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
  console.log('vereinskleider_verkaeufe: '+sales.length+' vorgesehene Geschäftsvorfälle');
  console.log('vereinskleider_rechnungen: 3 vorgesehene Rechnungen');
  console.log('inventuren: 1 vorgesehene Inventur mit aktuellen Soll-Beständen');
  const resetCollections = ['clubdesk_mitglieder','lieferanten','riegen','ausleihen','vereine','schadensmeldungen','lagerbewegungen','kategorien','inventarbewertung_aufnahmen','artikelvarianten','rabattregeln','vereinskleider_preise','vereinskleider_rechnungen','benutzer','vereinskleider_gutschriften','vereinskleider_verkaeufe','artikel','clubdesk_gruppenzuordnungen','inventuren','einladungen','vereinskleider_sammelbestellungen','sessions','lagerorte','inventurpositionen','bildUploads','inventurprotokoll','vereinskleider_rechnungsnummern','groessen'];
  if(reset) {
    const actual=(await db.listCollections({}, {nameOnly:true}).toArray()).map(c=>c.name);
    if(actual.some(c=>!resetCollections.includes(c))) throw new Error('Unbekannte Collection: Reset abgebrochen.');
    for(const c of actual) console.log('Reset '+c+': '+await db.collection(c).countDocuments({})+' Dokumente');
  }
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
        if(reset) {
          for(const c of resetCollections) await db.collection(c).deleteMany({}, {session});
        }
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
        for (const sale of sales) {
          const _id = id('demo-sale:'+sale.key);
          const existing = await db.collection('vereinskleider_verkaeufe').findOne({_id},{session});
          if (existing) {
            if (existing.vereinId !== vereinId) throw new Error('Verkaufs-ID-Konflikt.');
            continue;
          }
          const artikelId=ref('artikel',sale.name), groesseId=ref('groessen',sale.size);
          const artikel=await db.collection('artikel').findOne({_id:new ObjectId(artikelId),vereinId,istVereinskleidung:true,archiviert:{$ne:true}},{session});
          const variante=await db.collection('artikelvarianten').findOne({artikelId,groesseId,vereinId,aktiv:{$ne:false}},{session});
          const preis=await db.collection('vereinskleider_preise').findOne({artikelId,groesseId,vereinId},{session});
          if (!artikel || !variante || !preis || preis.verkaufspreis!==sale.price || (preis.preisOffen===true)!==(sale.price===null)) throw new Error('Demo-Verkauf: Artikel oder Preis abweichend.');
          if(sale.direct) {
            for(const [collection,filter] of [['artikel',{_id:new ObjectId(artikelId),vereinId}],['artikelvarianten',{_id:variante._id,vereinId}]]) {
              const result=await db.collection(collection).updateOne({...filter,menge:{$gte:sale.direct}},{$inc:{menge:-sale.direct}},{session});
              if(result.modifiedCount!==1) throw new Error('Demo-Verkauf: Bestand fehlt.');
            }
          }
          const bestellMenge=sale.menge-sale.direct;
          const positionen=[];
          for(const [verkaufsart,menge] of [['direkt',sale.direct],['bestellung',bestellMenge]]) {
            if(menge) positionen.push({artikelId,groesseId,artikelname:sale.name,menge,einzelpreis:sale.price,...(sale.price===null?{preisOffen:true}:{}),positionsbetrag:menge*(sale.price??0),verkaufsart});
          }
          const endbetrag=sale.menge*(sale.price??0);
          await db.collection('vereinskleider_verkaeufe').insertOne({_id,vereinId,verkaufsart:bestellMenge?(sale.direct?'gemischt':'bestellung'):'direkt',status:bestellMenge?'offen':'abgeschlossen',preisOffen:sale.price===null,offenePreispositionen:sale.price===null?1:0,direktMenge:sale.direct,bestellMenge,kaeufer:sale.buyer,riegen:['TI'],zahlungsart:sale.payment,zahlungsstatus:sale.price===null?'preis_offen':sale.paid?'bezahlt':'offen',bezahltBetrag:sale.paid?endbetrag:0,zahlungen:sale.paid?[{betrag:endbetrag,datum:now,zahlungsart:sale.payment}]:[],bemerkung:'Fiktiver Demo-Verkauf',positionen,rabatte:[],zusaetzlicherRabatt:0,zwischentotal:endbetrag,rabattTotal:0,endbetrag,restbetragBekannt:sale.paid?0:endbetrag,erstelltAm:now,aktualisiertAm:now},{session});
          if(sale.direct) await db.collection('lagerbewegungen').insertOne({_id:id('sale-movement:'+sale.key),vereinId,artikelId,groesseId,art:'verkauf',mengeDelta:-sale.direct,zeitpunkt:now,artikelName:sale.name,groesseName:sale.size,benutzerName:'Demo admin',benutzerId:ref('benutzer','admin'),referenzId:_id.toHexString(),referenzTyp:'verkauf'},{session});
        }
        for (const key of ['twint','bar','bestellung']) {
          const _id=id('demo-invoice:'+key);
          const invoices=db.collection('vereinskleider_rechnungen');
          const existing=await invoices.findOne({_id},{session});
          if(existing) {
            if(existing.vereinId!==vereinId) throw new Error('Rechnungs-ID-Konflikt.');
            continue;
          }
          const verkaufId=id('demo-sale:'+key).toHexString();
          const verkaeufe=db.collection('vereinskleider_verkaeufe');
          const v=await verkaeufe.findOne({_id:new ObjectId(verkaufId),vereinId},{session});
          if(!v || v.status==='storniert' || v.preisOffen || v.rechnungId || v.trancheRechnungIds?.length) throw new Error('Demo-Rechnung: Verkauf nicht verrechenbar.');
          const cents=x=>Math.round(x*100);
          if(!Number.isFinite(v.endbetrag)||!Number.isFinite(v.bezahltBetrag)||v.bezahltBetrag<0||v.bezahltBetrag>v.endbetrag||v.zahlungen.reduce((sum,z)=>sum+cents(z.betrag),0)!==cents(v.bezahltBetrag)) throw new Error('Demo-Rechnung: Zahlungsstand ungültig.');
          const jahr=now.getFullYear();
          const counter=await db.collection('vereinskleider_rechnungsnummern').findOneAndUpdate({_id:vereinId+':'+jahr},{$inc:{nummer:1},$setOnInsert:{vereinId,jahr}},{upsert:true,returnDocument:'after',session});
          if(!counter||!Number.isSafeInteger(counter.nummer)) throw new Error('Rechnungsnummer fehlt.');
          const status=v.bezahltBetrag===v.endbetrag?'bezahlt':v.bezahltBetrag>0?'teilweise_bezahlt':'offen';
          await invoices.insertOne({_id,vereinId,verkaufId,rechnungsnummer:jahr+'-'+String(counter.nummer).padStart(5,'0'),empfaenger:v.kaeufer,riegen:v.riegen,zahlungsart:v.zahlungsart,bemerkung:v.bemerkung,positionen:v.positionen,rabatte:v.rabatte,zusaetzlicherRabatt:v.zusaetzlicherRabatt,zwischentotal:v.zwischentotal,rabattTotal:v.rabattTotal,gesamtbetrag:v.endbetrag,bezahltBetrag:v.bezahltBetrag,zahlungen:v.zahlungen,status,erstelltAm:now,aktualisiertAm:now,clubdeskExportStatus:'nicht_exportiert'},{session});
          const result=await verkaeufe.updateOne({_id:v._id,vereinId,rechnungId:{$exists:false},trancheRechnungIds:{$exists:false}},{$set:{rechnungId:_id.toHexString(),aktualisiertAm:now}},{session});
          if(result.modifiedCount!==1) throw new Error('Demo-Rechnung: Verkaufsreferenz konnte nicht gespeichert werden.');
        }
        const inventurId=id('demo-inventur:geraeteraum');
        const inventuren=db.collection('inventuren');
        const vorhandeneInventur=await inventuren.findOne({_id:inventurId},{session});
        if(vorhandeneInventur && vorhandeneInventur.vereinId!==vereinId) throw new Error('Inventur-ID-Konflikt.');
        if(!vorhandeneInventur) {
          const lagerortId=ref('lagerorte','Geräteraum');
          const lagerort=await db.collection('lagerorte').findOne({_id:new ObjectId(lagerortId),vereinId},{session});
          if(!lagerort) throw new Error('Demo-Inventur: Lagerort fehlt.');
          const artikel=await db.collection('artikel').find({vereinId,lagerortId},{session}).sort({name:1}).toArray();
          if(!artikel.length || artikel.some(a=>a.hatGroessen)) throw new Error('Demo-Inventur: unerwarteter Artikelbestand.');
          const positionen=artikel.map((a,i)=>({_id:id('demo-inventur-position:'+a._id.toHexString()),vereinId,inventurId:inventurId.toHexString(),artikelId:a._id.toHexString(),artikelName:a.name,lagerortId,groesseId:null,sollBestand:a.menge,istBestand:i===0?a.menge:null,einzelwert:a.einzelwert??0,bemerkung:'',kontrolliertAm:i===0?now:null}));
          await inventuren.insertOne({_id:inventurId,vereinId,name:'Demo-Inventur Geräteraum',typ:'lagerort',lagerortId,lagerortName:lagerort.name,status:'offen',anzahlArtikel:artikel.length,anzahlPositionen:positionen.length,erstelltAm:now,erstelltVon:ref('benutzer','admin')},{session});
          await db.collection('inventurpositionen').insertMany(positionen,{session});
        }
        const aufnahmen=db.collection('inventarbewertung_aufnahmen');
        const bewertungId=id('demo-bewertung:historisch');
        const vorhandeneBewertung=await aufnahmen.findOne({_id:bewertungId},{session});
        if(vorhandeneBewertung && vorhandeneBewertung.vereinId!==vereinId) throw new Error('Bewertungs-ID-Konflikt.');
        if(!vorhandeneBewertung) {
          const artikel=await db.collection('artikel').find({vereinId},{session}).sort({name:1}).toArray();
          const varianten=await db.collection('artikelvarianten').find({vereinId},{session}).toArray();
          const maps={};
          for(const c of ['kategorien','lagerorte','groessen']) maps[c]=new Map((await db.collection(c).find({vereinId},{session}).toArray()).map(d=>[String(d._id),String(c==='groessen'?d.bezeichnung:d.name)]));
          const zeilen=[];
          for(const a of artikel) {
            for(const p of a.hatGroessen?varianten.filter(v=>String(v.artikelId)===String(a._id)):[a]) {
              const menge=p.menge??0;
              if(!Number.isSafeInteger(menge)||menge<0) throw new Error('Demo-Bewertung: ungültiger Bestand.');
              if(a.hatGroessen&&menge===0) continue;
              const einzelwert=typeof p.einzelwert==='number'&&Number.isFinite(p.einzelwert)&&p.einzelwert>=0?p.einzelwert:null;
              zeilen.push({artikelId:String(a._id),artikel:String(a.name),kategorie:maps.kategorien.get(String(a.kategorieId))??'Unbekannt',lagerort:maps.lagerorte.get(String(a.lagerortId))??'Unbekannt',groesse:a.hatGroessen?maps.groessen.get(String(p.groesseId))??'Unbekannt':'',menge,einzelwert,gesamtwert:einzelwert===null?null:menge*einzelwert});
            }
          }
          await aufnahmen.insertOne({_id:bewertungId,vereinId,aufgenommenAm:now,aufgenommenVon:ref('benutzer','admin'),zeilen},{session});
        }
      });
    } finally { await session.endSession(); }
    console.log(reset?'Demo-Daten atomar zurückgesetzt und neu erstellt.':'Demo-Grundstruktur sichergestellt. Bestehende Datensätze unverändert.');
  }
} finally { await client.close(); }
