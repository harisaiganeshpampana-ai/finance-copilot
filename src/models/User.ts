// SERVER-ONLY. Mongoose model for CalmOwe users.

import { type InferSchemaType, type Model, model, models, Schema } from "mongoose";

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
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

// Reuse the compiled model across hot reloads.
export const User: Model<UserDocument> = (models.User as Model<UserDocument>) || model<UserDocument>("User", UserSchema);
