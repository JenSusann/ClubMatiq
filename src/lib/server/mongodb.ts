
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI fehlt in der .env-Datei');
}

export const client = new MongoClient(uri);
export const db = client.db('clubmatiq');
