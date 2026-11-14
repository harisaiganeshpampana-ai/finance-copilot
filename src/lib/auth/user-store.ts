// SERVER-ONLY. MongoDB-backed user store used by the auth logic.

import type { UserStore } from "@/lib/auth/credentials";
import { connectToDatabase } from "@/lib/server/db";
import { User } from "@/models/User";

export const mongoUserStore: UserStore = {
  async findByEmail(email) {
    await connectToDatabase();
    const doc = await User.findOne({ email }).select("+password").lean();
    if (!doc) return null;
    return { id: String(doc._id), name: doc.name, email: doc.email, passwordHash: doc.password };
  },
  async create({ name, email, passwordHash }) {
    await connectToDatabase();
    const doc = await User.create({ name, email, password: passwordHash });
    return { id: String(doc._id), name: doc.name, email: doc.email };
  },
};
