import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { MongoClient } from 'mongodb';
import { spawn } from 'node:child_process';

const config = parse(await readFile('.env.demo.local'));
if (config.MONGODB_DB_NAME !== 'clubmatiq_demo' || !/^mongodb(?:\+srv)?:\/\/clubmatiq_demo_user:/.test(config.MONGODB_URI ?? '')) throw new Error('Ungültige Demo-Datenbankkonfiguration.');
const client = new MongoClient(config.MONGODB_URI);
try {
  const {authInfo} = await client.db('clubmatiq_demo').command({connectionStatus:1});
  if(authInfo.authenticatedUsers.length !== 1 || authInfo.authenticatedUsers[0].user !== 'clubmatiq_demo_user' || authInfo.authenticatedUserRoles.length !== 1 || authInfo.authenticatedUserRoles[0].db !== 'clubmatiq_demo' || authInfo.authenticatedUserRoles[0].role !== 'readWrite') throw new Error('Demo-Rollenprüfung fehlgeschlagen.');
} finally { await client.close(); }
const env = {...process.env, MONGODB_URI:config.MONGODB_URI, MONGODB_DB_NAME:'clubmatiq_demo'};
for(const key of ['RESEND_API_KEY','RESEND_FROM_EMAIL','CLOUDINARY_URL','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']) env[key]='';
console.log('Demo-Datenbank geprüft. Starte auf http://localhost:5174');
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','dev','--host','localhost','--port','5174','--strictPort'],{env,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
