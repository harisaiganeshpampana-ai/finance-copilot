// SERVER-ONLY. MongoDB-backed user store used by the auth logic.

import type { UserStore } from "@/lib/auth/credentials";
import { connectToDatabase } from "@/lib/server/db";
import { User } from "@/models/User";

export const mongoUserStore: UserStore = {
  async findByEmail(email) {
    await connectToDatabase();
    const doc = await User.findOne({ email }).select("+password").lean();
    if (!doc) return null;
    return { id: String(doc._id), name: doc.name, email: doc.email, passwordHash: doc.password ?? null };
  },

  async create({ name, email, passwordHash }) {
    await connectToDatabase();
    const doc = await User.create({ name, email, password: passwordHash, provider: "credentials" });
    return { id: String(doc._id), name: doc.name, email: doc.email };
  },

  async upsertOAuthUser({ name, email, image, provider }) {
    await connectToDatabase();
    // Existing account (e.g. email/password): keep its name and password; refresh the picture.
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      if (image && existing.image !== image) await User.updateOne({ _id: existing._id }, { $set: { image } });
      return { id: String(existing._id), name: existing.name, email: existing.email, created: false };
    }
    try {
      const doc = await User.create({ name, email, provider, ...(image ? { image } : {}) });
      return { id: String(doc._id), name: doc.name, email: doc.email, created: true };
    } catch (err) {
      // Two first-time sign-ins at the same moment: the other one created it.
      if ((err as { code?: number }).code === 11000) {
        const doc = await User.findOne({ email }).lean();
        if (doc) return { id: String(doc._id), name: doc.name, email: doc.email, created: false };
      }
      throw err;
    }
  },
};
