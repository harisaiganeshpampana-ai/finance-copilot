// SERVER-ONLY. Mongoose model for CalmOwe users.

import { type InferSchemaType, type Model, model, models, Schema } from "mongoose";
import { CURRENCY_CODES } from "@/lib/currency";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // bcrypt hash, never the plain password. Absent for accounts created with Google.
    // Excluded from queries unless explicitly selected.
    password: { type: String, select: false },
    // How the account was first created.
    provider: { type: String, enum: ["credentials", "google"], default: "credentials" },
    image: { type: String, maxlength: 2048 },
    // Account balance (whole cents) before the user's transactions; set by sample data.
    openingBalanceCents: { type: Number, default: 0, validate: Number.isSafeInteger },
    // Currency of the user's stored amounts. INR once they upload an Indian bank statement.
    dataCurrency: { type: String, enum: CURRENCY_CODES, default: "USD" },
    // The last bank statement uploaded (Monthly Financial Audit).
    statement: {
      bank: { type: String, maxlength: 40 },
      fileName: { type: String, maxlength: 120 },
      uploadedAt: { type: Date },
      periodStart: { type: String, maxlength: 10 },
      periodEnd: { type: String, maxlength: 10 },
    },
    // Connected bank (Plaid). The access token is stored ENCRYPTED (AES-256-GCM) and is
    // excluded from queries unless explicitly selected. It never leaves the server.
    plaid: {
      accessTokenEncrypted: { type: String, select: false },
      itemId: { type: String },
      env: { type: String, enum: ["sandbox", "production"] },
      institutionName: { type: String, maxlength: 80 },
      accountName: { type: String, maxlength: 60 },
      accountMask: { type: String, maxlength: 4 },
      connectedAt: { type: Date },
    },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

// Reuse the compiled model across hot reloads.
export const User: Model<UserDocument> = (models.User as Model<UserDocument>) || model<UserDocument>("User", UserSchema);
