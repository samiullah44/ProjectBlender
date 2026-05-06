---
id: storage-system
title: Storage & File Privacy
sidebar_label: File Privacy
sidebar_position: 5
---

# Storage & File Privacy

**Mental Model:** RenderOnNodes is a compute service, not a Dropbox alternative. We do not store your files permanently.

When you upload your 3D scenes to the network, we treat your intellectual property with maximum security.

## How Your Files Are Handled

1. **Upload:** You upload your packed `.blend` file through the Dashboard. The file goes into our Secure Temporary Storage.
2. **Download by Node:** The specific Node Provider assigned to your job is given a temporary, one-time link. The node software on their computer automatically downloads your file in the background so it can open it in Blender.
3. **Execution:** The Node renders the single frame it was assigned.
4. **Upload by Node:** The Node uploads the final rendered image (PNG or EXR) back to our Secure Temporary Storage.

---

## The strict "Secure Deletion" Policy

To make sure your private 3D models and textures are safe, we strictly enforce automatic deletions across the entire network:

### For Node Providers:
The instant the Node finishes rendering your frame and uploads the final image, the Node software **automatically deletes all traces of your original `.blend` file** from their hard drive. 

### For the Platform:
The final rendered images (the ones you download from the dashboard) are kept securely on our servers for **7 Days** so you have plenty of time to download them.

:::warning[Download your files!]
**After 7 Days, all of your rendered images and files are permanently deleted from our servers.** Please ensure you download your finished frames from the Dashboard to your local computer before they expire.
:::
