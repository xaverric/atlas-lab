import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['cron', 'once'], required: true },
    expression: { type: String },
    timezone: { type: String, default: 'UTC' },
    runAt: { type: Date },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    trigger: {
      type: String,
      enum: ['onSuccess', 'onFailure', 'onEvaluationFailure', 'onTimeout', 'onRecovery'],
      required: true,
    },
    channel: { type: String, enum: ['webhook', 'email', 'telegram'], required: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
  },
);

const retryPolicySchema = new mongoose.Schema(
  {
    maxRetries: { type: Number, default: 0 },
    delayMs: { type: Number, default: 1000 },
    backoffMultiplier: { type: Number, default: 2 },
  },
  { _id: false },
);

const jobSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    executionType: { type: String, enum: ['webhook', 'javascript', 'shell', 'git', 'n8n'], required: true },
    enabled: { type: Boolean, default: true },
    ownerId: { type: String, required: true },

    schedule: { type: scheduleSchema, required: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    timeoutMs: { type: Number, default: 30000 },

    group: { type: String, default: '' },
    tags: [{ type: String }],
    retryPolicy: { type: retryPolicySchema, default: () => ({}) },
    notifications: [notificationSchema],

    lastRunAt: { type: Date },
    lastRunStatus: { type: String, enum: ['completed', 'failed', 'timeout'] },
    nextRunAt: { type: Date },
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
jobSchema.index({ ownerId: 1, tags: 1 });
jobSchema.index({ ownerId: 1, group: 1 });
jobSchema.index({ enabled: 1 });

export const Job = mongoose.model('Job', jobSchema);
