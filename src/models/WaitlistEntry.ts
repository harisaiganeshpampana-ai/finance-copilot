// SERVER-ONLY. People waiting for real bank sync (one entry per user).

import { type InferSchemaType, type Model, model, models, Schema, Types } from "mongoose";

const WaitlistEntrySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    feature: { type: String, enum: ["real-bank-sync"], default: "real-bank-sync" },
  },
  { timestamps: true },
);

export type WaitlistEntryDocument = InferSchemaType<typeof WaitlistEntrySchema>;

export const WaitlistEntry: Model<WaitlistEntryDocument> =
  (models.WaitlistEntry as Model<WaitlistEntryDocument>) ||
  model<WaitlistEntryDocument>("WaitlistEntry", WaitlistEntrySchema);
