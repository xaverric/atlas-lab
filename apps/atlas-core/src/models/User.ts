import mongoose from 'mongoose';

const preferencesSchema = new mongoose.Schema(
  {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    keycloakId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

export const User = mongoose.model('User', userSchema);
