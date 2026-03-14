import mongoose from 'mongoose';

const noteFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteFolder', default: null },
    ownerId: { type: String, required: true },
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    aiAccessible: { type: Boolean, default: false },
    publicPermission: { type: String, enum: ['view', 'edit', 'full'], default: 'view' },
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

noteFolderSchema.index({ ownerId: 1, parentId: 1 });
noteFolderSchema.index({ parentId: 1, name: 1 }, { unique: true });

export const NoteFolder = mongoose.model('NoteFolder', noteFolderSchema);
