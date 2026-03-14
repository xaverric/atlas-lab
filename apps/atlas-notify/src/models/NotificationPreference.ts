import mongoose from 'mongoose';

const preferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    eventPattern: { type: String, required: true },
    channelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NotificationChannel' }],
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
      },
    },
  },
);

preferenceSchema.index({ userId: 1, eventPattern: 1 });

export const NotificationPreference = mongoose.model('NotificationPreference', preferenceSchema);
