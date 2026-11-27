
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI fehlt in der .env-Datei');
}

const dbName = process.env.MONGODB_DB_NAME;
if (!dbName || !['clubmatiq', 'clubmatiq_dev', 'clubmatiq_test', 'clubmatiq_demo'].includes(dbName)) {
  throw new Error('MONGODB_DB_NAME fehlt oder ist unzulässig.');
}

export const client = new MongoClient(uri);
export const db = client.db(dbName);
