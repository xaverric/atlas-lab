import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    templateKey: { type: String, required: true },
    channel: { type: String, enum: ['email', 'telegram'], required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    subject: { type: String },
    body: { type: String },
    error: { type: String },
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

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
