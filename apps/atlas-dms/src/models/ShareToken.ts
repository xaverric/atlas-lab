import mongoose from 'mongoose';

const shareTokenSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    type: { type: String, enum: ['document', 'folder'], default: 'document' },
    token: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    maxDownloads: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    password: { type: String, default: null },
    permission: { type: String, enum: ['view', 'edit', 'full'], default: 'view' },
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
shareTokenSchema.index({ folderId: 1 });
shareTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ShareToken = mongoose.model('ShareToken', shareTokenSchema);
