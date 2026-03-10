# Comprehensive Backend Strategic Roadmap

After a full audit of the current architecture, I have categorized the potential features into four strategic pillars: **Infrastructure & Scalability**, **Financial Ecosystem**, **Security & Compliance**, and **Developer Experience**.

---

## 1. Financial Ecosystem (Monetization & Payouts)
Currently, there is a basic credit system. A professional network requires a robust financial ledger.

- **[ ] Multi-Tiered Credits**: Differentiate between "Promo Credits" (non-withdrawable) and "Purchased Credits".
- **[ ] Payment Gateway Integration**: Stripe/PayPal integration for automated credit top-ups with tiered discounts.
- **[ ] Provider Payout System**: Automated threshold-based payouts for Node Providers (e.g., withdraw to crypto or bank once holding $50).
- **[ ] Dynamic Pricing Engine**: Implement "Spot Pricing" where job costs fluctuate based on current network supply/demand.
- **[ ] Invoice Generation**: Automated PDF generation for every transaction for business compliance.

## 2. Infrastructure & Scalability
To handle 1,000+ simultaneous nodes and high-frequency jobs.

- **[ ] Redis-Based Distributed Caching**: Move from in-memory maps to Redis for WebSocket sessions and job states to support multi-instance backend clusters.
- **[ ] Database Sharding/Replication**: Plan for MongoDB sharding as the `Jobs` and `Frames` collections grow into millions of records.
- **[ ] S3 CloudFront Integration**: Serve render outputs via a Content Delivery Network (CDN) to reduce latency and S3 egress costs.
- **[ ] Task Queue Prioritization**: Implement fair-share scheduling (don't let one large job block the entire farm for smaller users).
- **[ ] Cold Storage Policy**: Automatically move job assets older than 30 days to S3 Glacier to save storage costs.

## 3. Advanced Management & Teams
Moving from individual users to professional studios.

- **[ ] Team/Organization Accounts**: One "Organization" with multiple users sharing a single credit pool and project library.
- **[ ] Granular RBAC (Role Based Access Control)**: Custom roles like "Studio Manager", "Artist", "Financial Auditor".
- **[ ] Shared Asset Library**: A "Project" level asset bin where textures/HDRIs are uploaded once and reused across 100 different jobs.
- **[ ] Project Templates**: Save render settings (resolutions, engine presets) as templates for one-click job submission.

## 4. Security & Health Monitoring
Ensuring the network is safe and reliable.

- **[ ] Comprehensive Audit Logs**: Track every sensitive action (who approved the job, who changed the node spec, who withdrew funds).
- **[ ] Node Sandboxing Orchestration**: The backend should verify that nodes are running in "Secure Mode" before assigning sensitive project files.
- **[ ] Real-time Health Dashboard**: Integration with Prometheus/Grafana to see real-time throughput, CPU/GPU usage across the world, and error rates.
- **[ ] Automated Penetration Scanning**: Integrated tools to scan uploaded BLEND files for malicious Python scripts before they reach the nodes.

## 5. Developer Experience (Integrations)
For studios that want to build their own tools on top of BlendFarm.

- **[ ] Public API / SDK**: A documented REST/GraphQL API for third-party integrations.
- **[ ] Webhook Support**: Notify external URLs when a job is "Started", "Finished", or "Failed".
- **[ ] Blender Add-on (Official)**: A native Blender plug-in that talks to the backend to submit jobs directly from the Blender UI.
- **[ ] CLI Tool**: A command-line interface for batch-submitting thousands of jobs from a local server.

---

### Suggested Execution Path

1. **Step 1 (Core)**: Implement Redis caching to stabilize WebSocket connections.
2. **Step 2 (Business)**: Integrate Stripe for automated credit purchases.
3. **Step 3 (UX)**: Studio/Team accounts for professional collaboration.

**Would you like me to start the technical design for any specific pillar above?**
