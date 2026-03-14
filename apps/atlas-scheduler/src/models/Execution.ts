import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  {
    exitCode: { type: Number },
    statusCode: { type: Number },
    stdout: { type: String },
    stderr: { type: String },
    body: { type: String },
    outputRef: { type: String },
    error: { type: String },
  },
  { _id: false },
);

const executionSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'timeout'], default: 'pending' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    duration: { type: Number },
    result: { type: resultSchema },
    triggeredBy: { type: String, enum: ['schedule', 'manual'], default: 'schedule' },
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

executionSchema.index({ jobId: 1, createdAt: -1 });

export const Execution = mongoose.model('Execution', executionSchema);
