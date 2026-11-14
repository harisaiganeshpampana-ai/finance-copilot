// SERVER-ONLY. MongoDB implementation of the per-user transaction store.

import { Types } from "mongoose";
import type { Category } from "@/data/mockTransactions";
import { connectToDatabase } from "@/lib/server/db";
import type { TransactionStore } from "@/lib/server/transactions";
import { TransactionModel } from "@/models/Transaction";
import { User } from "@/models/User";

const MAX_TRANSACTIONS = 1000;

export const mongoTransactionStore: TransactionStore = {
  async listByUser(userId) {
    await connectToDatabase();
    const docs = await TransactionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .limit(MAX_TRANSACTIONS)
      .lean();
    return docs.map((d) => ({
      id: String(d._id),
      date: new Date(d.date).toISOString().slice(0, 10),
      merchant: d.merchant,
      category: d.category as Category,
      // Stored as a positive amount + type; the app uses signed cents (money out is negative).
      amountCents: d.type === "income" ? d.amountCents : -d.amountCents,
    }));
  },

  async countByUser(userId) {
    await connectToDatabase();
    return TransactionModel.countDocuments({ userId: new Types.ObjectId(userId) });
  },

  async insertForUser(userId, transactions) {
    await connectToDatabase();
    const owner = new Types.ObjectId(userId);
    await TransactionModel.insertMany(
      transactions.map((t) => ({
        userId: owner,
        merchant: t.merchant,
        amountCents: Math.abs(t.amountCents),
        type: t.amountCents > 0 ? "income" : "expense",
        category: t.category,
        date: new Date(`${t.date}T00:00:00Z`),
        source: "sample",
      })),
    );
  },

  async getOpeningBalance(userId) {
    await connectToDatabase();
    const user = await User.findById(userId).select("openingBalanceCents").lean();
    return user?.openingBalanceCents ?? 0;
  },

  async setOpeningBalance(userId, cents) {
    await connectToDatabase();
    await User.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { openingBalanceCents: cents } });
  },
};
