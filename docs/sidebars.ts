import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Introduction & Basics',
      items: [
        'intro/what-is-renderonnodes',
        'intro/quickstart',
        'intro/wallet-setup',
        'intro/token-economy',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/architecture-overview',
        'concepts/job-lifecycle',
        'concepts/node-lifecycle',
        'concepts/scheduler-and-queues',
        'concepts/storage-system',
        'concepts/settlement-system',
      ],
    },
    {
      type: 'category',
      label: 'Compute Clients (Artists)',
      items: [
        'clients/artist-quickstart',
        'clients/scene-preparation',
        'clients/job-management',
        'clients/monitoring',
      ],
    },
    {
      type: 'category',
      label: 'Node Providers',
      items: [
        'providers/overview',
        'providers/setup-installation',
        'providers/node-lifecycle-practice',
        'providers/performance-optimization',
        'providers/earnings-settlement',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/artist-issues',
        'troubleshooting/provider-issues',
      ],
    },
  ],
};

export default sidebars;
