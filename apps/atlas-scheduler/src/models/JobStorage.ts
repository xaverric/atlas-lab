import mongoose from 'mongoose';

const jobStorageSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed },
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

jobStorageSchema.index({ jobId: 1, key: 1 }, { unique: true });

export const JobStorage = mongoose.model('JobStorage', jobStorageSchema);
