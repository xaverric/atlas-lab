import mongoose from 'mongoose';

const hookSchema = new mongoose.Schema(
  {
    notify: {
      templateKey: { type: String },
      channel: { type: String },
    },
  },
  { _id: false },
);

const jobSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['http', 'webhook', 'script', 'shell', 'monitor'], required: true },
    enabled: { type: Boolean, default: true },
    ownerId: { type: String, required: true },

    scheduleType: { type: String, enum: ['cron', 'once', 'interval'], required: true },
    cron: { type: String },
    runAt: { type: Date },
    intervalMs: { type: Number },

    config: { type: mongoose.Schema.Types.Mixed, required: true },
    timeoutMs: { type: Number, default: 30000 },

    onSuccess: { type: hookSchema },
    onFailure: { type: hookSchema },
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

jobSchema.index({ ownerId: 1 });

export const Job = mongoose.model('Job', jobSchema);
