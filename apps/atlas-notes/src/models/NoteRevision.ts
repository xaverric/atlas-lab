import { Schema, model, Types } from 'mongoose';

const noteRevisionSchema = new Schema({
  noteId: { type: Types.ObjectId, ref: 'Note', required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  tags: [String],
  isPublic: { type: Boolean, default: false },
  contentSize: { type: Number, default: 0 },
  editorId: { type: String, required: true },
  editorName: { type: String, default: 'Unknown' },
  summary: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

noteRevisionSchema.index({ noteId: 1, createdAt: -1 });
noteRevisionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; },
});

export const NoteRevision = model('NoteRevision', noteRevisionSchema);
