import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteFolder', default: null },
    ownerId: { type: String, required: true },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    contentSize: { type: Number, default: 0 },
    attachments: [{
      documentId: { type: String, required: true },
      filename: String,
      mimeType: String,
      size: Number,
    }],
    dmsFolderId: { type: String, default: null },
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

noteSchema.index({ ownerId: 1, folderId: 1, createdAt: -1 });
noteSchema.index({ tags: 1 });

export const Note = mongoose.model('Note', noteSchema);
