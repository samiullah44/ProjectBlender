# Blender Rendering Workflow (Production-Level)

```mermaid
flowchart TD
    A[Frontend User] -->|1. Request pre-signed multipart upload URL| B[Backend Node.js API]
    B -->|2. Generate multipart pre-signed URLs| C[S3 Private Bucket: uploads/]
    C -->|3. Frontend uploads .blend file directly (multipart)| A
    A -->|4. Notify backend → Store S3 key & job metadata in DB| D[DB]
    D -->|5. Add job to Job Queue / Assign Renderer| E[Renderer Node Provider]
    E -->|6. Get pre-signed GET URL → Download .blend securely| E
    E -->|7. Render frames locally| E
    E -->|8. Upload frames securely to S3 (renders/job-123/)| F[S3 Private Bucket: renders/]
    F -->|9. CloudFront + OAC serves frames to users| A
    A -->|10. View frames one by one (lazy load)| A
    A -->|11. Download ZIP (pre-generated or streamed via backend)| A
