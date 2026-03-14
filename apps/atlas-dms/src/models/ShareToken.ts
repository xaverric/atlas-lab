import mongoose from 'mongoose';

const shareTokenSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    token: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    maxDownloads: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
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

shareTokenSchema.index({ token: 1 });
shareTokenSchema.index({ documentId: 1 });
shareTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ShareToken = mongoose.model('ShareToken', shareTokenSchema);
