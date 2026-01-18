#!/usr/bin/env python3
"""
Convert NumPy embedding files to JSON for use in TypeScript.
"""

import numpy as np
import json
import os
import sys

def convert_npy_to_json(npy_path: str, json_path: str):
    """Convert a .npy file to .json"""
    print(f"Converting {npy_path} -> {json_path}")

    # Load numpy array
    embeddings = np.load(npy_path)
    print(f"  Shape: {embeddings.shape}")
    print(f"  Dtype: {embeddings.dtype}")

    # Convert to list and save as JSON
    embeddings_list = embeddings.tolist()

    with open(json_path, 'w') as f:
        json.dump(embeddings_list, f)

    # Verify file size
    file_size = os.path.getsize(json_path)
    print(f"  JSON file size: {file_size / 1024:.1f} KB")

    return embeddings_list

def main():
    # Source directory (Director knowledge bases)
    source_dir = "../director/director_rag_agent/knowledge_bases"

    # Target directory (Orchestrator knowledge bases)
    target_dir = "./knowledge_bases"

    # Create target directories
    os.makedirs(f"{target_dir}/voice_embeddings_store", exist_ok=True)
    os.makedirs(f"{target_dir}/audio_embeddings_store/music", exist_ok=True)
    os.makedirs(f"{target_dir}/audio_embeddings_store/sfx", exist_ok=True)
    os.makedirs(f"{target_dir}/audio_embeddings_store/ambience", exist_ok=True)

    # Files to convert
    conversions = [
        (f"{source_dir}/voice_embeddings_store/voice_embeddings.npy",
         f"{target_dir}/voice_embeddings_store/voice_embeddings.json"),
        (f"{source_dir}/audio_embeddings_store/music/music_embeddings.npy",
         f"{target_dir}/audio_embeddings_store/music/music_embeddings.json"),
        (f"{source_dir}/audio_embeddings_store/sfx/sfx_embeddings.npy",
         f"{target_dir}/audio_embeddings_store/sfx/sfx_embeddings.json"),
        (f"{source_dir}/audio_embeddings_store/ambience/ambience_embeddings.npy",
         f"{target_dir}/audio_embeddings_store/ambience/ambience_embeddings.json"),
    ]

    # Convert each file
    for npy_path, json_path in conversions:
        if os.path.exists(npy_path):
            convert_npy_to_json(npy_path, json_path)
        else:
            print(f"Warning: {npy_path} not found")

    # Copy metadata JSON files
    json_copies = [
        (f"{source_dir}/voice_embeddings_store/voices_metadata.json",
         f"{target_dir}/voice_embeddings_store/voices_metadata.json"),
        (f"{source_dir}/voice_embeddings_store/config.json",
         f"{target_dir}/voice_embeddings_store/config.json"),
        (f"{source_dir}/audio_embeddings_store/music/music_metadata.json",
         f"{target_dir}/audio_embeddings_store/music/music_metadata.json"),
        (f"{source_dir}/audio_embeddings_store/music/music_config.json",
         f"{target_dir}/audio_embeddings_store/music/music_config.json"),
        (f"{source_dir}/audio_embeddings_store/sfx/sfx_metadata.json",
         f"{target_dir}/audio_embeddings_store/sfx/sfx_metadata.json"),
        (f"{source_dir}/audio_embeddings_store/sfx/sfx_config.json",
         f"{target_dir}/audio_embeddings_store/sfx/sfx_config.json"),
        (f"{source_dir}/audio_embeddings_store/ambience/ambience_metadata.json",
         f"{target_dir}/audio_embeddings_store/ambience/ambience_metadata.json"),
        (f"{source_dir}/audio_embeddings_store/ambience/ambience_config.json",
         f"{target_dir}/audio_embeddings_store/ambience/ambience_config.json"),
        # Catalog files
        (f"{source_dir}/eleven_labs_voices_current.json",
         f"{target_dir}/eleven_labs_voices_current.json"),
        (f"{source_dir}/music_catalog_full.json",
         f"{target_dir}/music_catalog_full.json"),
        (f"{source_dir}/sfx_catalog_enriched.json",
         f"{target_dir}/sfx_catalog_enriched.json"),
        (f"{source_dir}/ambience_catalog_enriched.json",
         f"{target_dir}/ambience_catalog_enriched.json"),
    ]

    import shutil
    for src, dst in json_copies:
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"Copied {src} -> {dst}")
        else:
            print(f"Warning: {src} not found")

    # Also check for audio_selection_knowledge.json
    knowledge_src = f"{source_dir}/../knowledge/audio_selection_knowledge.json"
    knowledge_dst = f"{target_dir}/audio_selection_knowledge.json"
    if os.path.exists(knowledge_src):
        shutil.copy2(knowledge_src, knowledge_dst)
        print(f"Copied {knowledge_src} -> {knowledge_dst}")

    print("\nDone! Embeddings and metadata files converted.")

if __name__ == "__main__":
    main()
