# Slide 2 resource provenance

Curated 19 October 2026 from Hivemind community messages and primary project pages. Display titles are editorial summaries, not verbatim artifact names. Community techniques are attributed experiences, not universal guarantees. The field is illustrative, not a live directory; clicking a point retains the existing focus interaction.

## Streaming video super-resolution

Upscaler · FlashVSR · `model`

A one-step diffusion upscaler designed to process video as a stream.

[Source](https://github.com/OpenImagingLab/FlashVSR)

## Restore detail in low-res footage

Upscaler · SeedVR2 · `model`

SeedVR2 7B: diffusion-based restoration for images and video.

[Source](https://huggingface.co/ByteDance-Seed/SeedVR2-7B)

## Tile an H3 upscale through time

Upscaler · ComfyUI · `model`

Temporal splitting and overlap controls for the H3 latent upscaler.

[Source](https://github.com/LBH-123-AI/Comfyui_Minimax_h3_latent_Upscaler)

## One object, four sprite-sheet views

LoRA · FLUX.2 Klein · `lora`

fal’s sprite-sheet LoRA makes a 2×2 set of isometric, side and top-down views.

[Source](https://huggingface.co/fal/flux-2-klein-4b-spritesheet-lora)

## A controlled dolly-out camera move

LoRA · LTX-2 · `lora`

Lightricks’ camera-control LoRA biases a shot toward pulling back from its subject.

[Source](https://huggingface.co/Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Out)

## Remove stripe artefacts with SFT

LoRA · MOSS · `lora`

Nynxz’s small MOSS SFT Destripe adapter, with downloadable weights.

[Source](https://huggingface.co/nynxz/MOSS-Image/blob/main/loras/moss_sft_destripe_top64_bf16.safetensors)

## FlippinRad Motion Morph

LoRA · Wan · `lora`

A specialised motion LoRA for dynamic, stylised movement in Wan 2.1 14B.

[Source](https://civitai.com/models/2052865/flippinrad-motion-morph?modelVersionId=2323211)

## ICEdit Insight video editing

LoRA · LTX 2.3 · `lora`

Joyfox’s instruction-based video-editing adapter for LTX 2.3.

[Source](https://huggingface.co/joyfox/LTX2.3-ICEdit-Insight)

## Build a colour LUT from a reference

LUT tool · Kijai · `repo`

VideoColorGrading generates a 3D LUT from a reference image and source footage.

[Source](https://github.com/kijai/ComfyUI-VideoColorGrading)

## Match a shot to a colour palette

LUT tool · ComfyUI · `repo`

MLUT applies LUTs, swatches and palettes inside a ComfyUI graph.

[Source](https://github.com/TrophiHunter/ComfyUI-MLUT)

## Clean pixel grids and pack sprites

Tool · PixelPipeline · `repo`

Grid restoration, palette reduction, background removal and sprite-sheet packing.

[Source](https://github.com/PeaarLi/ComfyUI-PixelPipeline)

## Schedule VACE strength frame by frame

Tool · WanVaceAdvanced · `repo`

Control nodes for adjusting how strongly VACE follows its conditioning over time.

[Source](https://github.com/drozbay/ComfyUI-WanVaceAdvanced)

## Curate and caption a video dataset

Tool · Klippbok · `repo`

A dedicated workspace for preparing clips before training a video LoRA.

[Source](https://github.com/alvdansen/klippbok)

## Raw footage to a trained video LoRA

Tool · Flimmer · `repo`

Scene detection, captions, validation, encoding and phased Wan training.

[Source](https://github.com/alvdansen/flimmer-trainer)

## Balance tone between chained clips

Tool · H3 ToneCompensate · `repo`

A focused helper for colour continuity in chained H3 video segments.

[Source](https://github.com/rkfg/ComfyUI-MiniMaxH3-ToneCompensate)

## Wan 2.2 AnimateDiff looping pack

Workflow · Banodoco · `workflow`

Brbbbq’s shared graphs combine keyframes, depth maps and VACE animation.

[Source](https://discord.com/channels/1076117621407223829/1373291419434877078/1483892470227009779)

## Edit a still with multiple references

Workflow · ComfyUI · `workflow`

Wan Humo image-editing graphs use reference-conditioned video to produce a still.

[Source](https://github.com/vrgamegirl19/comfyui-vrgamedevgirl/tree/main/Workflows/WanHumo_imageEdit)

## Reference-to-video with pose control

Workflow · H3 · `workflow`

A shared 448×800 API graph for conditioning video on a reference and pose.

[Source](https://github.com/sepiablue-ai/minimax_h3_workflows/blob/main/phase2_ref2va_pose_control_448x800_api.json)

## Upscale anchors, then fill between

Workflow · Banodoco · `workflow`

A community recipe: upscale key images, interpolate with VACE, colour-match and stitch.

[Source](https://discord.com/channels/1076117621407223829/1373291419434877078/1464246100096450594)

## Swap a character, keep the scene

Workflow · Banodoco · `workflow`

A shared approach using Qwen Image Edit for a reference, then Wan Animate.

[Source](https://discord.com/channels/1076117621407223829/1342763350815277067/1476542672851439668)

## Relight a subject in a new scene

Workflow · Banodoco · `workflow`

Separate foreground, edges and background before feeding the shot into VACE.

[Source](https://discord.com/channels/1076117621407223829/1342763350815277067/1486447326934466612)

## Guide an eight-second video loop

Workflow · Banodoco · `workflow`

A community H3 recipe using a tiny guide video and overlapping end frames.

[Source](https://discord.com/channels/1076117621407223829/1533677158067736777/1560959324900298893)

## VACE first, Animate second

Workflow · Banodoco · `workflow`

Nathan Shipley’s two-pass approach: VACE followed by a partial-denoise Animate pass.

[Source](https://discord.com/channels/1076117621407223829/1344057524935983125/1478502156058497138)

## One character, layered sprite sheets

Workflow · ComfyUI · `workflow`

Base animation and separately tintable cosmetic layers, aligned for compositing.

[Source](https://github.com/mor-o/comfyui-2d-character-pipeline)

## Why does a fast face escape its mask?

Q&A · Banodoco · `thread`

A discussion of rapid motion, changing scale and the limits of temporal mask tracking.

[Source](https://discord.com/channels/1076117621407223829/1342763350815277067/1479746204072935526)

## Why do colours drift between cuts?

Q&A · Banodoco · `thread`

Ablejones explains matching a frame per clip instead of rematching every frame.

[Source](https://discord.com/channels/1076117621407223829/1373291419434877078/1453209957062148187)

## Pose or depth: which should lead?

Q&A · Banodoco · `thread`

Community notes on balancing motion control against character accuracy.

[Source](https://discord.com/channels/1076117621407223829/1373291419434877078/1480558754050084995)

## What should go in a training caption?

Q&A · LoRA training · `thread`

PineAmbassador discusses captioning the concepts you want to vary later.

[Source](https://discord.com/channels/1076117621407223829/1344309523187368046/1479300549433098433)

## Why does identity fade at higher res?

Q&A · LoRA training · `thread`

Spacepxl explains the gap between training resolution and inference resolution.

[Source](https://discord.com/channels/1076117621407223829/1344309523187368046/1529504842551132250)

## Can an upscale hide a clip join?

Q&A · Banodoco · `thread`

A community comparison of temporal FlashVSR and frame-by-frame upscaling.

[Source](https://discord.com/channels/1076117621407223829/1373291419434877078/1463908011213848774)

## Repair smeared frames with a hold map

Video guide · YouTube · `guide`

SmallKino’s walkthrough: extend the damaged frames, denoise, then restore the timing.

[Source](https://youtu.be/IlVPJI9ceKM?t=191)

## Use Wan Humo as an image editor

Video guide · YouTube · `guide`

A walkthrough of reference-guided image editing with a video model.

[Source](https://www.youtube.com/watch?v=vRoBhE4HO0A)

## Caption a dataset with intent

Guide · Klippbok · `guide`

A dedicated captioning guide for preparing video training data.

[Source](https://github.com/alvdansen/klippbok/blob/main/docs/CAPTIONING.md)

## Compare distilled VACE samplers

Comparison · WanTests · `guide`

Side-by-side test results for making a more informed sampling choice.

[Source](https://drozbay.github.io/WanTests/VaceTests/vace_results1_distill_sampler_tests.html)

## Turn animation into RGBA sprites

Guide · ComfyUI · `guide`

A documented video-to-sprite-sheet pipeline for layered 2D characters.

[Source](https://github.com/mor-o/comfyui-2d-character-pipeline/blob/main/docs/workflow-3-spritesheet.md)

## Test the motion before the long render

Field notes · Banodoco · `guide`

Atom.p’s image-shift prototype checks the move before committing to full animation.

[Source](https://discord.com/channels/1076117621407223829/1373291419434877078/1469409631712448606)
