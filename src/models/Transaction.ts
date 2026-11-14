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
  "other",
] as const;

const TransactionSchema = new Schema(
  {
    // Owner. Every query MUST filter by userId so users only ever see their own data.
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    merchant: { type: String, required: true, trim: true, maxlength: 200 },
    // Positive amount in whole minor units of the user's data currency (US$12.34 = 1234 cents,
    // ₹12.34 = 1234 paise) to avoid rounding errors. Money in or out is given by `type`.
    amountCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    category: { type: String, enum: TRANSACTION_CATEGORIES, required: true },
    date: { type: Date, required: true },
    // "sample" = generated demo data; "upload" = from an uploaded bank statement (CSV);
    // "bank" is reserved for live bank imports.
    source: { type: String, enum: ["sample", "bank", "manual", "upload"], default: "sample" },
    // Full bank narration for uploaded rows (merchant holds the short, readable name).
    description: { type: String, trim: true, maxlength: 300 },
    // Stable fingerprint of an imported row, so re-uploading a statement never duplicates it.
    externalId: { type: String, maxlength: 100 },
  },
  { timestamps: true },
);

TransactionSchema.index({ userId: 1, date: -1 });
// One row per imported transaction per user.
TransactionSchema.index({ userId: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: "string" } } });

export type TransactionDocument = InferSchemaType<typeof TransactionSchema>;

export const TransactionModel: Model<TransactionDocument> =
  (models.Transaction as Model<TransactionDocument>) || model<TransactionDocument>("Transaction", TransactionSchema);
