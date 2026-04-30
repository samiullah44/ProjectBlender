import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  blogId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  text: string;
  claps: number;
  clappers: mongoose.Types.ObjectId[];
  hidden: boolean;          // admin can hide/show
  editedAt?: Date;          // set when comment is edited
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>({
  blogId:   { type: Schema.Types.ObjectId, ref: 'Blog', required: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text:     { type: String, required: true, maxlength: 1000, trim: true },
  claps:    { type: Number, default: 0, min: 0 },
  clappers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  hidden:   { type: Boolean, default: false },
  editedAt: { type: Date },
}, {
  timestamps: true
});

// Efficient Comment_List queries (newest first per blog)
commentSchema.index({ blogId: 1, createdAt: -1 });
// Efficient lookup of comments by author
commentSchema.index({ authorId: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
