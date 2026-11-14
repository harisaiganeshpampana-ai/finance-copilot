// SERVER-ONLY. Mongoose model for CalmOwe users.

import { type InferSchemaType, type Model, model, models, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // bcrypt hash, never the plain password. Excluded from queries unless explicitly selected.
    password: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

// Reuse the compiled model across hot reloads.
export const User: Model<UserDocument> = (models.User as Model<UserDocument>) || model<UserDocument>("User", UserSchema);
