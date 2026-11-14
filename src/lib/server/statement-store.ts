// SERVER-ONLY. MongoDB implementation of the statement store. Every query is scoped to one user.

import { Types } from "mongoose";
import { isCurrencyCode } from "@/lib/currency";
import { connectToDatabase } from "@/lib/server/db";
import type { StatementStore } from "@/lib/server/statement-upload";
import { TransactionModel } from "@/models/Transaction";
import { User } from "@/models/User";

export const mongoStatementStore: StatementStore = {
  async getProfile(userId) {
    await connectToDatabase();
    const owner = new Types.ObjectId(userId);
    const [user, otherRows] = await Promise.all([
      User.findById(owner).select("dataCurrency").lean(),
      TransactionModel.countDocuments({ userId: owner, source: { $nin: ["sample", "upload"] } }),
    ]);
    return { currency: isCurrencyCode(user?.dataCurrency) ? user.dataCurrency : "USD", otherRows };
  },

  async saveRows(userId, rows) {
    await connectToDatabase();
    const owner = new Types.ObjectId(userId);
    await TransactionModel.deleteMany({ userId: owner, source: "sample" });
    const result = await TransactionModel.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { userId: owner, externalId: r.externalId },
          update: {
            $set: {
              merchant: r.merchant,
              description: r.description,
              amountCents: Math.abs(r.amountMinor),
              type: r.amountMinor > 0 ? "income" : "expense",
              category: r.category,
              date: new Date(`${r.date}T00:00:00Z`),
              source: "upload",
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return { inserted: result.upsertedCount };
  },

  async sumUploaded(userId) {
    await connectToDatabase();
    const [row] = await TransactionModel.aggregate<{ total: number }>([
      { $match: { userId: new Types.ObjectId(userId), source: "upload" } },
      { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", { $multiply: ["$amountCents", -1] }] } } } },
    ]);
    return row?.total ?? 0;
  },

  async saveProfile(userId, { currency, statement, openingBalanceMinor }) {
    await connectToDatabase();
    await User.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          dataCurrency: currency,
          statement: { ...statement, uploadedAt: new Date(statement.uploadedAt) },
          ...(openingBalanceMinor !== undefined ? { openingBalanceCents: openingBalanceMinor } : {}),
        },
      },
    );
  },
};
