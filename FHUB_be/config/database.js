require('./env');
const { MongoClient } = require('mongodb');

let client;
let database;

async function connectDatabase() {
  if (database) return database;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || undefined);
    await db.command({ ping: 1 });
    database = db;
    return database;
  } catch (error) {
    await closeDatabase();
    throw error;
  }
}

function getDatabase() {
  if (!database) throw new Error('Database is not connected');
  return database;
}

async function closeDatabase() {
  database = undefined;
  const activeClient = client;
  client = undefined;
  if (activeClient) await activeClient.close();
}

// Do not log raw driver errors: they may contain connection details.
function connectionErrorMessage(error) {
  if (!process.env.MONGODB_URI) return 'MONGODB_URI is missing. Configure the backend .env file.';
  if (error.code === 18) return 'MongoDB authentication failed. Check the database username and password.';
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(error.code)) return 'MongoDB DNS/network lookup failed. Check network access and the Atlas hostname.';
  if (error.name === 'MongoServerSelectionError') return 'MongoDB is unreachable. Check Atlas Network Access, cluster availability, and network connectivity.';
  if (error.name === 'MongoParseError') return 'MONGODB_URI is invalid. Check the URI format and percent-encode special characters in the password.';
  return 'MongoDB connection failed. Check the backend configuration and Atlas access settings.';
}

module.exports = { connectDatabase, getDatabase, closeDatabase, connectionErrorMessage };
