---
id: job-management
title: Creating & Managing Jobs
sidebar_label: Job Management
sidebar_position: 3
---

# Creating & Managing Jobs

The **Client Dashboard** is your primary interface for submitting renders to the global network. This guide walks you through the exact steps to create a new job and monitor your fleet of renders.

### Step 1: Initiating a New Job

Once your wallet is connected and funded:
1. Navigate to the **Client Dashboard**.
2. Click the bright blue **New Render Job** button located at the top right of the screen.
3. The **Create New Render Job** modal will appear.

<div style={{textAlign: 'center', margin: '30px 0'}}>
  <img src="/img/create-job-modal.png" alt="Create New Render Job Modal" style={{borderRadius: '8px', border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0, 0.5)', maxWidth: '100%'}} />
</div>

### Step 2: Uploading Your Scene

In the upload menu, you need to provide the network with your `.blend` file. As shown in the panel above:
1. You can either **Drag & Drop** your `.blend` (or `.zip` project archive) file into the designated area, or click the **Explore File System** button to browse your computer.
2. Max upload limit is **2GB** for a `.zip` and **500MB** for a standalone `.blend` file.
3. Once selected, click the **Next: Settings** button at the bottom right. 

### Step 3: Monitoring Active Renders

Once submitted, the system will instantly route your scene to available execution agents.
* You can track the progress under the **Active Jobs** section of the dashboard.
* Click on any specific job to see the live frame rendering progress and estimated time to completion.
* The 4 primary metrics banners (Active Renders, Frames Today, Total Frames, Time Saved) will update in real-time as your job progresses.

### Step 4: Retrieving Results

When the job reaches 100% completion, it will move from the `Active Jobs` tab to the `All Jobs` ledger.
1. Click on the completed job.
2. Ensure the status reads **FINALIZED**.
3. Click the **Download Final Render** button to save the completed frames or video file directly to your local machine.

:::info
Your job results are temporarily stored securely. Ensure you download your renders promptly, as the stateless staging layer deletes completed jobs after an expiration period.
:::
