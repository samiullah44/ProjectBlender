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
        'clients/advanced-rendering',
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
      label: 'Developer API & SDK',
      items: [
        'api/automation-guides',
        'api/reference',
        'api/authentication',
        'api/webhooks',
      ],
    },
    {
      type: 'category',
      label: 'Operations & Observability',
      items: [
        'ops/client-logs',
        'ops/node-metrics',
        'ops/debugging-jobs',
      ],
    },
    {
      type: 'category',
      label: 'Security & System Guarantees',
      items: [
        'security/security-model',
        'security/file-isolation',
        'security/guarantees',
        'security/system-constraints',
        'security/scaling-behavior',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/error-index',
        'troubleshooting/debugging-flows',
        'troubleshooting/role-based-issues',
      ],
    },
  ],
};

export default sidebars;
