import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    ownerId: { type: String, required: true },
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

folderSchema.index({ ownerId: 1, parentId: 1 });
folderSchema.index({ parentId: 1, name: 1 }, { unique: true });

export const Folder = mongoose.model('Folder', folderSchema);
