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
    // Create on first Google sign-in; for an existing account (e.g. email/password),
    // keep its name and password and only fill in a missing profile picture.
    const doc = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: { name, email, provider },
        ...(image ? { $set: { image } } : {}),
      },
      { upsert: true, new: true },
    ).lean();
    return { id: String(doc!._id), name: doc!.name, email: doc!.email };
  },
};
