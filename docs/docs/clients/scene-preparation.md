---
id: scene-preparation
title: Scene Preparation
sidebar_label: Scene Preparation
sidebar_position: 2
---

# Scene Preparation

Before uploading your `.blend` file to the network, you must ensure that all global execution agents can properly open and read your file. If you have missing textures or physics caches, the network will try to render your scene and it will fail or render incorrectly (e.g., bright pink missing textures).

Follow this checklist for every file you upload to RenderOnNodes.

## 1. Pack All External Data

If your `.blend` file relies on external models, HDRIs, or image textures stored on your local `C:/` drive, the cloud GPUs will not be able to find them.

**How to fix this in Blender:**
1. Open your finished project.
2. At the top left, click **File**.
3. Hover over **External Data**.
4. Click **Pack Resources**. 

This will embed all images and HDRIs directly inside your `.blend` file. Your file size will increase, but it will guarantee the network can access everything.

## 2. Bake Your Physics

If you are using fluid, smoke, cloth, or rigid body simulations, you **must** bake your cache to disk or directly into the file. Unbaked physics simulations execute differently on different hardware, which will lead to jittery animations.

1. Select your simulation object.
2. Go to the Physics Properties tab.
3. Scroll down to Cache.
4. Ensure the cache is fully baked and saved alongside your blend file (if uploading a ZIP) or packed.

## 3. Limit Your VRAM Usage

RenderOnNodes matches your job to agents with enough VRAM (Video RAM) to open your scene. 

* **The Rule:** If your scene requires 20GB of VRAM to open, only top-tier hardware (like RTX 3090s/4090s) can render it. This means you will wait longer for a match, and you may pay more.
* **How to Optimize:** Reduce texture sizes from 8K down to 4K or 2K. Reduce polygon counts on objects that are far away from the camera. If you can keep your scene under **12GB of VRAM**, your job will instantly match with 95% of the network.

## 4. Adaptive Sampling

Instead of forcing the network to calculate 4096 samples per pixel (which is very expensive), utilize Blender's built-in **Noise Threshold**.

1. Go to your Render Properties tab.
2. Under Sampling > Render, check the **Noise Threshold** box.
3. Set the threshold to a reasonable number (e.g., `0.01` or `0.05`).
4. Set the Max Samples high.

This tells the network to stop rendering a pixel once it is "clean enough," saving you massive amounts of RON tokens across an entire animation sequence.
