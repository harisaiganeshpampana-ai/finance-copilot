// SERVER-ONLY. Mongoose model for a user's transactions.

import { type InferSchemaType, type Model, model, models, Schema, Types } from "mongoose";

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export const TRANSACTION_CATEGORIES = [
  "income",
  "housing",
  "groceries",
  "dining",
  "transport",
  "shopping",
  "utilities",
  "subscriptions",
] as const;

const TransactionSchema = new Schema(
  {
    // Owner. Every query MUST filter by userId so users only ever see their own data.
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    merchant: { type: String, required: true, trim: true, maxlength: 200 },
    // Positive amount in whole cents (US$12.34 = 1234) to avoid rounding errors.
    // Whether it's money in or out is given by `type`.
    amountCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    category: { type: String, enum: TRANSACTION_CATEGORIES, required: true },
    date: { type: Date, required: true },
    // "sample" = generated demo data; later "bank" for imported transactions.
    source: { type: String, enum: ["sample", "bank", "manual"], default: "sample" },
  },
  { timestamps: true },
);

TransactionSchema.index({ userId: 1, date: -1 });

export type TransactionDocument = InferSchemaType<typeof TransactionSchema>;

export const TransactionModel: Model<TransactionDocument> =
  (models.Transaction as Model<TransactionDocument>) || model<TransactionDocument>("Transaction", TransactionSchema);
