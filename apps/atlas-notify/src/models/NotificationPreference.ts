import mongoose from 'mongoose';

const preferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    channels: {
      email: {
        enabled: { type: Boolean, default: false },
        address: { type: String, default: '' },
      },
      telegram: {
        enabled: { type: Boolean, default: false },
        chatId: { type: String, default: '' },
      },
    },
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

export const NotificationPreference = mongoose.model('NotificationPreference', preferenceSchema);
