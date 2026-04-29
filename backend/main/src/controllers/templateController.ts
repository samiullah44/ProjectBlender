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
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'How to Build a Real-Time Application with Nodes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'In this comprehensive tutorial, we will explore the core concepts necessary to build a high-performance, real-time application. By the end of this guide, you will have a fully functional prototype ready for production use.' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tip: Read through the prerequisites carefully before starting to avoid dependency issues later.' }] }] }
        ],
      },
      {
        label: 'Prerequisites',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What You Will Need' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Before we dive into the code, ensure your development environment meets the following requirements:' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Node.js (v18 or higher recommended)' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A basic understanding of TypeScript and REST APIs' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A text editor like VS Code' }] }] },
          ]},
        ],
      },
      {
        label: 'Steps',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Step 1: Project Initialization' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Start by creating a new directory and initializing a blank Node project. Then, install the essential packages we will rely on.' }] },
          { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'mkdir real-time-app\ncd real-time-app\nnpm init -y\nnpm install express socket.io' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Step 2: Configuring the Server' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Create an `index.ts` file in your root folder. This file will serve as the entry point.' }] },
          { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'import express from "express";\nimport { createServer } from "http";\n\nconst app = express();\nconst server = createServer(app);\n\nserver.listen(3000, () => {\n  console.log("Server listening on port 3000");\n});' }] },
        ],
      },
      {
        label: 'Conclusion',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion & Next Steps' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Congratulations! You have successfully configured a foundational real-time server architecture. Moving forward, you can integrate authentication, set up a database, or connect a front-end framework.' }] },
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
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Option A vs Option B: Which is Better for Your Scaling Needs?' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Choosing between scaling strategies can be difficult. Today, we put these two popular options head-to-head.' }] },
        ],
      },
      {
        label: 'Summary Matrix',
        defaultBlocks: [
          { type: 'table', content: [
              { type: 'tableRow', content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Feature' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option A' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option B' }] }] }
              ]},
              { type: 'tableRow', content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Setup Complexity' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Low' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'High' }] }] }
              ]},
              { type: 'tableRow', content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Performance at Scale' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Moderate' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Excellent' }] }] }
              ]}
          ] }
        ]
      },
      {
        label: 'Option A',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deep Dive: Option A' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Option A focuses on simplicity and time-to-market. It provides an excellent out-of-the-box experience.' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pros: Easy setup, abundant community plugins' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cons: Can become expensive when traffic spikes unexpectedly' }] }] },
          ]},
        ],
      },
      {
        label: 'Option B',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deep Dive: Option B' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Option B is for engineers who demand total control over their stack and raw performance.' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pros: Maximum theoretical throughput, ultimate customizability' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cons: Steep learning curve' }] }] },
          ]},
        ],
      },
      {
        label: 'Verdict',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Final Verdict' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'If you are a startup needing speed to market, choose Option A. If you are an enterprise managing million-user concurrency, migrate to Option B.' }] }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Both options provide robust ecosystems. Base your choice entirely on the unique requirements of your application.' }] },
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
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Deep Dive: Memory Management in Modern JavaScript Engines' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Understanding memory allocation and garbage collection is crucial to resolving memory leaks and maximizing application stability.' }] },
        ],
      },
      {
        label: 'Under the Hood',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The V8 Garbage Collector Space Allocation' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'A V8 process divides its memory into the Resident Set, consisting of executable code, the stack, and the heap. Most memory leaks take place in the heap space.' }] },
          { type: 'codeBlock', attrs: { language: 'cpp' }, content: [{ type: 'text', text: '// V8 inner heap layout example\nclass HeapObject : public Object {\n public:\n  static const int kMapOffset = Object::kHeaderSize;\n  static const int kHeaderSize = kMapOffset + kTaggedSize;\n};' }] },
        ],
      },
      {
        label: 'Edge Cases',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Common Leak Scenarios' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Warning: Unintentional global variables are the most common cause of silent memory bloat.' }] }] },
          { type: 'table', content: [
              { type: 'tableRow', content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Scope' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Leak Risk Level' }] }] }
              ]},
              { type: 'tableRow', content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Global Cache' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Critical' }] }] }
              ]},
              { type: 'tableRow', content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local Functions' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Low' }] }] }
              ]}
          ] }
        ],
      },
      {
        label: 'Implications',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Implications & Takeaways' }] },
          { type: 'orderedList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Always profile your heap dumps via Chrome DevTools.' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Implement robust LRU caching instead of infinite objects.' }] }] },
          ]},
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
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Top 5 Open Source Tools to Accelerate Your Workflow' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Are you tired of jumping between disconnected apps? We gathered the five best tools to supercharge your developer productivity.' }] },
        ],
      },
      {
        label: 'Items',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Docker Compose' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Containerize your applications. It standardizes the workflow.' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '"It works on my machine" is a thing of the past.' }] }] },
          
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Postman API Client' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Organize and collaborate on all your REST API calls visually.' }] },
          { type: 'codeBlock', attrs: { language: 'json' }, content: [{ type: 'text', text: '{\n  "message": "Hello API world!"\n}' }] },
          
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Github Copilot' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Let AI assist you in scaffolding boilerplate rapidly.' }] },
        ],
      },
      {
        label: 'Conclusion',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Wrapping Up' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Try picking up just one of these tools this week and watch your velocity naturally increase.' }] },
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
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Fixing the "N+1" Query Problem in ORMs' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Object-Relational Mapping (ORM) tools are great, but they come with severe hidden pitfalls when fetching related records.' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The N+1 problem occurs when data access code executes N additional SQL statements to fetch the same data that could have been retrieved in one.' }] }] },
          { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'const users = await User.find();\nfor (const user of users) {\n  const profile = await Profile.findOne({ userId: user.id }); // Bad: Queries N times\n}' }] },
        ],
      },
      {
        label: 'Analysis',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Root Cause Analysis' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'By lazily loading relationships inside iterations, we hammer the database over the network, exhausting connection pools.' }] },
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Increased round-trip latency' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Higher database load spikes' }] }] },
          ]}
        ],
      },
      {
        label: 'Solution',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Solution: Eager Loading' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'The solution is to use "Eager Loading" features built right into the ORM to explicitly join tables initially.' }] },
          { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'const users = await User.find().populate("profile"); // Good: 1 Query' }] },
        ],
      },
      {
        label: 'Results',
        defaultBlocks: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Performance Gains' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'By switching to eager loading, we reduced our P99 page load times by a staggering 60% and avoided database bottlenecks.' }] },
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
        // Update existing template with the new complex templates
        if (true) {
          await Template.findByIdAndUpdate(existing._id, {
            sections: tmpl.sections.map((s) => ({
              label: s.label,
              allowedBlockTypes: [...ALL_BLOCK_TYPES],
              defaultBlocks: s.defaultBlocks,
            })),
          });
          console.log(`[Seed] Updated built-in template: ${tmpl.name}`);
        }
      }
    }
    console.log('[Seed] Template seeding complete');
  } catch (error) {
    console.error('[Seed] seedTemplates error:', error);
  }
};
