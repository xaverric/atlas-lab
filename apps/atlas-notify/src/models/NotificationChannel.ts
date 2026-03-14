import mongoose from 'mongoose';

const CHANNEL_TYPES = ['in_app', 'email', 'web_push', 'telegram', 'signal', 'whatsapp', 'sms'] as const;

const channelSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: CHANNEL_TYPES, required: true },
    label: { type: String, default: '' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    verified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationExpiresAt: { type: Date },
    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.verificationCode;
      },
    },
  },
);

channelSchema.index({ userId: 1, type: 1 });

export const NotificationChannel = mongoose.model('NotificationChannel', channelSchema);
export { CHANNEL_TYPES };
