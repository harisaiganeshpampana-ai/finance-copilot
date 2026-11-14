// SERVER-ONLY. MongoDB connection via Mongoose, cached on globalThis so that hot reloads
// in development (and repeated calls in serverless functions) reuse one connection
// instead of opening a new one every time.

import mongoose from "mongoose";

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as typeof globalThis & { _mongooseCache?: MongooseCache };
const cache: MongooseCache = (globalForMongoose._mongooseCache ??= { conn: null, promise: null });

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("MONGODB_URI is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new DatabaseNotConfiguredError();
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(uri, {
    bufferCommands: false, // fail fast instead of queueing queries while disconnected
    serverSelectionTimeoutMS: 8000,
  });

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null; // allow a retry on the next call
    throw err;
  }
  return cache.conn;
}
