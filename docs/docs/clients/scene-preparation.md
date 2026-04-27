---
id: scene-preparation
title: Asset Management & Preparation
sidebar_label: Asset Preparation
sidebar_position: 2
---

# Asset Management & Preparation

To leverage the power of a globally distributed network, your project assets must be structured for mobility. This guide outlines the professional standards required to ensure your mission executes without environment-level exceptions.

---

## 1. The Mobility Requirement: Relative Paths
Because your project will be executed across multiple independent agents, all internal file references must be relative to the primary project entry point (the `.blend` file).

- **Standard Execution:** `//textures/diffuse_01.jpg` (Success)
- **Hard-Linked Execution:** `C:/Users/Artist/Desktop/Textures/diffuse_01.jpg` (Failure)

**Optimization:** Use the internal Blender utility *File > External Data > Make All Paths Relative* before initiating the staging process.

---

## 2. Dependency Consolidation
The RenderOnNodes **Staging Engine** supports the automatic detection of external dependencies. However, for complex simulations or high-fidelity geometry, we recommend strategic consolidation.

- **Simulation Caches:** Ensure all physics (Fluid, Smoke, Cloth) are baked using a **Single Mesh Cache (.bphys / .vdb)** located within the project sub-directory.
- **External Geometry:** If using linked libraries, ensure they are packable or reside within the same directory tree as the master scene.

---

## 3. High-Performance Resource Tuning
The cost and speed of your compute mission are directly tied to your scene’s resource footprint.

### VRAM Optimization
The **[Distribution Engine](../concepts/scheduler-and-queues)** matches your project to agents based on available hardware memory.
- **Recommendation:** Aim for a peak VRAM usage of **8GB - 12GB**. This ensures your mission can be allocated to 95% of the active network pool, resulting in the fastest possible mission initiation.
- **Tip:** Use 2K or 4K textures instead of 8K where possible to maximize parallelism.

### Adaptive Sampling
To maximize the efficiency of the **[Automated Quality Logic](../concepts/job-lifecycle)**, utilize adaptive sampling.
- Set a reasonable noise threshold (e.g., 0.01) rather than a fixed high sample count. This allows the network to complete mission fragments faster without sacrificing perceptual quality.

---

## 4. Final Verification Checklist
Before committing your project to the **Stateless Staging Fabric**, ensure the following:
- [ ] No missing textures or environment maps.
- [ ] All simulation caches are baked to disk.
- [ ] Render engine is set to a supported architecture (e.g., Cycles).
- [ ] Output range (Start/End Frame) is correctly defined.

:::info[Next Step]
Once your assets are prepared, proceed to the **[Management Portal Guide](./job-management)** to learn how to monitor your mission in real-time.
:::
