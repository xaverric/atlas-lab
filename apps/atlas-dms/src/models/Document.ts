import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    tags: [{ type: String }],
    ownerId: { type: String, required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
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

documentSchema.index({ ownerId: 1, folderId: 1, createdAt: -1 });
documentSchema.index({ ownerId: 1, createdAt: -1 });
documentSchema.index({ tags: 1 });

export const Document = mongoose.model('Document', documentSchema);
