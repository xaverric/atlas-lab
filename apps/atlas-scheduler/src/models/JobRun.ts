import mongoose from 'mongoose';

const logEntrySchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const evaluationResultSchema = new mongoose.Schema(
  {
    rule: { type: String },
    passed: { type: Boolean },
    expected: { type: mongoose.Schema.Types.Mixed },
    actual: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema(
  {
    exitCode: { type: Number },
    statusCode: { type: Number },
    stdout: { type: String },
    stderr: { type: String },
    body: { type: String },
    error: { type: String },
    evaluationResults: [evaluationResultSchema],
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const jobRunSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'timeout', 'skipped'],
      default: 'pending',
    },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    duration: { type: Number },
    result: { type: resultSchema },
    logs: [logEntrySchema],
    triggeredBy: { type: String, enum: ['schedule', 'manual', 'api'], default: 'schedule' },
    attempt: { type: Number, default: 1 },
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

jobRunSchema.index({ jobId: 1, createdAt: -1 });

export const JobRun = mongoose.model('JobRun', jobRunSchema);
