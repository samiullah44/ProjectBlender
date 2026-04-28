import mongoose, { Schema, Document } from 'mongoose';

type ContentBlockType = 'heading' | 'paragraph' | 'image' | 'codeBlock' | 'orderedList' | 'bulletList' | 'table' | 'blockquote';

interface ContentBlock {
  type: ContentBlockType;
  attrs?: Record<string, any>;
  content?: ContentBlock[];
  text?: string;
}

export interface ITemplateSection {
  label: string;
  allowedBlockTypes: ContentBlockType[];
  defaultBlocks: ContentBlock[];
}

export interface ITemplate extends Document {
  name: string;
  description: string;
  category: string;
  icon: string;
  sections: ITemplateSection[];
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const templateSectionSchema = new Schema<ITemplateSection>({
  label: { type: String, required: true },
  allowedBlockTypes: [{
    type: String,
    enum: ['heading', 'paragraph', 'image', 'codeBlock', 'orderedList', 'bulletList', 'table', 'blockquote']
  }],
  defaultBlocks: { type: Schema.Types.Mixed, default: [] }
}, { _id: false });

const templateSchema = new Schema<ITemplate>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  icon: { type: String, required: true },
  sections: { type: [templateSectionSchema], default: [] },
  isBuiltIn: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const Template = mongoose.model<ITemplate>('Template', templateSchema);
