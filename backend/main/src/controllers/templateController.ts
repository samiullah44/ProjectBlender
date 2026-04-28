import { Response } from 'express';
import { Template } from '../models/Template';
import { AuthRequest } from '../middleware/auth';

// ── listTemplates ─────────────────────────────────────────────────────────────

export const listTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await Template.find().lean();
    res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error('listTemplates error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── createTemplate ────────────────────────────────────────────────────────────

export const createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const template = new Template(req.body);
    await template.save();
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('createTemplate error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── updateTemplate ────────────────────────────────────────────────────────────

export const updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.status(200).json({ success: true, template });
  } catch (error) {
    console.error('updateTemplate error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── deleteTemplate ────────────────────────────────────────────────────────────

export const deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('deleteTemplate error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── seedTemplates ─────────────────────────────────────────────────────────────

const ALL_BLOCK_TYPES = [
  'heading', 'paragraph', 'image', 'codeBlock',
  'orderedList', 'bulletList', 'table', 'blockquote',
] as const;

const BUILT_IN_TEMPLATES: Array<{
  name: string;
  description: string;
  category: string;
  icon: string;
  sections: Array<{ label: string; defaultBlocks: any[] }>;
}> = [
  {
    name: 'Tutorial',
    description: 'Step-by-step guide format',
    category: 'Technical',
    icon: '📚',
    sections: [
      {
        label: 'Introduction',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Tutorial Title' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Brief introduction to what this tutorial covers and what the reader will learn.' }] },
        ],
      },
      {
        label: 'Prerequisites',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Prerequisites' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prerequisite 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prerequisite 2' }] }] },
          ]},
        ],
      },
      {
        label: 'Steps',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Step 1: Getting Started' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Describe the first step here.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Step 2: Next Step' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Describe the second step here.' }] },
        ],
      },
      {
        label: 'Conclusion',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Summarize what was covered and next steps for the reader.' }] },
        ],
      },
    ],
  },
  {
    name: 'Comparison',
    description: 'Compare two or more options',
    category: 'Analysis',
    icon: '⚖️',
    sections: [
      {
        label: 'Overview',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Comparison Title' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Overview of what is being compared and why it matters.' }] },
        ],
      },
      {
        label: 'Option A',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Option A' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Describe Option A, its strengths and weaknesses.' }] },
        ],
      },
      {
        label: 'Option B',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Option B' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Describe Option B, its strengths and weaknesses.' }] },
        ],
      },
      {
        label: 'Verdict',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Verdict' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Final recommendation and conclusion.' }] },
        ],
      },
    ],
  },
  {
    name: 'Technical Deep Dive',
    description: 'In-depth technical exploration',
    category: 'Technical',
    icon: '🔬',
    sections: [
      {
        label: 'Introduction',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Deep Dive: Topic Title' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Introduction to the technical topic.' }] },
        ],
      },
      {
        label: 'Background',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Background' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Context and background knowledge needed.' }] },
        ],
      },
      {
        label: 'Deep Dive',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Technical Details' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'In-depth technical explanation.' }] },
          { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: '// Code example here' }] },
        ],
      },
      {
        label: 'Implications',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Implications & Takeaways' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'What this means in practice.' }] },
        ],
      },
    ],
  },
  {
    name: 'Listicle',
    description: 'List-based article format',
    category: 'General',
    icon: '📋',
    sections: [
      {
        label: 'Introduction',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'X Things You Should Know About...' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Brief intro to the list topic.' }] },
        ],
      },
      {
        label: 'Items',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. First Item' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Explain the first item.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Second Item' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Explain the second item.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Third Item' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Explain the third item.' }] },
        ],
      },
      {
        label: 'Conclusion',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Wrapping Up' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Final thoughts on the list.' }] },
        ],
      },
    ],
  },
  {
    name: 'Problem-Solution',
    description: 'Problem and solution format',
    category: 'Technical',
    icon: '💡',
    sections: [
      {
        label: 'Problem',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'The Problem: ...' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Describe the problem clearly.' }] },
        ],
      },
      {
        label: 'Analysis',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Root Cause Analysis' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Why does this problem occur?' }] },
        ],
      },
      {
        label: 'Solution',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Solution' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'How to solve the problem.' }] },
          { type: 'codeBlock', attrs: { language: '' }, content: [{ type: 'text', text: '// Solution code here' }] },
        ],
      },
      {
        label: 'Results',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Results' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Outcome and impact of the solution.' }] },
        ],
      },
    ],
  },
];

export const seedTemplates = async (): Promise<void> => {
  try {
    for (const tmpl of BUILT_IN_TEMPLATES) {
      const allBlocks = tmpl.sections.flatMap((s: any) => s.defaultBlocks as any[]);
      const existing = await Template.findOne({ name: tmpl.name, isBuiltIn: true });

      if (!existing) {
        await Template.create({
          name: tmpl.name,
          description: tmpl.description,
          category: tmpl.category,
          icon: tmpl.icon,
          isBuiltIn: true,
          sections: tmpl.sections.map((s) => ({
            label: s.label,
            allowedBlockTypes: [...ALL_BLOCK_TYPES],
            defaultBlocks: s.defaultBlocks,
          })),
        });
        console.log(`[Seed] Created built-in template: ${tmpl.name}`);
      } else {
        // Update existing template if sections are empty (fix old empty seeds)
        const hasContent = existing.sections.some((s: any) => s.defaultBlocks?.length > 0);
        if (!hasContent) {
          await Template.findByIdAndUpdate(existing._id, {
            sections: tmpl.sections.map((s) => ({
              label: s.label,
              allowedBlockTypes: [...ALL_BLOCK_TYPES],
              defaultBlocks: s.defaultBlocks,
            })),
          });
          console.log(`[Seed] Updated empty template: ${tmpl.name}`);
        }
      }
    }
    console.log('[Seed] Template seeding complete');
  } catch (error) {
    console.error('[Seed] seedTemplates error:', error);
  }
};
