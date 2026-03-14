import mongoose from 'mongoose';

const indexSchema = new mongoose.Schema(
  {
    fields: { type: mongoose.Schema.Types.Mixed, required: true },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const trackerEndpointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    userId: { type: String, required: true },
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    schema: { type: mongoose.Schema.Types.Mixed, required: true },
    indexes: { type: [indexSchema], default: [] },
    retentionDays: { type: Number },
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

trackerEndpointSchema.index({ userId: 1, name: 1 }, { unique: true });

export const TrackerEndpoint = mongoose.model('TrackerEndpoint', trackerEndpointSchema);
