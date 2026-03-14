import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema(
  {
    channelType: { type: String, required: true },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationChannel' },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    error: { type: String },
    sentAt: { type: Date },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    event: { type: String },
    title: { type: String },
    subject: { type: String },
    body: { type: String },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    data: { type: mongoose.Schema.Types.Mixed },
    deliveries: [deliverySchema],
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

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
