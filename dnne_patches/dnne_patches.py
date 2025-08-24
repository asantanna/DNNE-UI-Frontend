#!/usr/bin/env python3
"""
DNNE Patch Verification System

Verifies that modified npm package files match our patched versions.
This ensures that patches are not lost after npm install or updates.
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any


def verify_all_patches(frontend_root: str = None) -> List[Dict[str, Any]]:
    """
    Verify all patches defined in PATCHES.json.
    
    Args:
        frontend_root: Root directory of the frontend (defaults to parent of this script's dir)
    
    Returns:
        List of dictionaries describing mismatched patches, or empty list if all match
    """
    # Determine root directory
    if frontend_root is None:
        # This script is in dnne_patches/, so parent is frontend root
        script_dir = Path(__file__).parent
        frontend_root = script_dir.parent
    else:
        frontend_root = Path(frontend_root)
    
    patches_file = frontend_root / "dnne_patches" / "PATCHES.json"
    
    if not patches_file.exists():
        print(f"Warning: {patches_file} not found. No patches to verify.")
        return []
    
    # Load patches configuration
    with open(patches_file, 'r') as f:
        patches = json.load(f)
    
    mismatches = []
    
    for patch in patches:
        target_file = frontend_root / patch["target_path"]
        patch_file = frontend_root / patch["patch_path"]
        
        # Check if target file exists
        if not target_file.exists():
            mismatches.append({
                "package": patch["package"],
                "file": patch["file"],
                "issue": "Target file does not exist",
                "target_path": str(target_file),
                "patch_path": str(patch_file),
                "description": patch["description"]
            })
            continue
        
        # Check if patch file exists
        if not patch_file.exists():
            mismatches.append({
                "package": patch["package"],
                "file": patch["file"],
                "issue": "Patch file does not exist",
                "target_path": str(target_file),
                "patch_path": str(patch_file),
                "description": patch["description"]
            })
            continue
        
        # Check timestamp
        current_timestamp = os.stat(target_file).st_mtime
        expected_timestamp = patch["timestamp"]
        
        # Allow small differences (within 1 second) for filesystem precision
        if abs(current_timestamp - expected_timestamp) > 1:
            mismatches.append({
                "package": patch["package"],
                "file": patch["file"],
                "issue": f"Timestamp mismatch (expected: {expected_timestamp}, got: {current_timestamp})",
                "target_path": str(target_file),
                "patch_path": str(patch_file),
                "description": patch["description"],
                "expected_timestamp": expected_timestamp,
                "current_timestamp": current_timestamp
            })
    
    return mismatches


def print_patch_errors(mismatches: List[Dict[str, Any]]) -> None:
    """
    Print formatted error messages for patch mismatches.
    
    Args:
        mismatches: List of mismatch dictionaries from verify_all_patches
    """
    if not mismatches:
        return
    
    print("\n" + "=" * 70)
    print("DNNE PATCH VERIFICATION FAILED")
    print("=" * 70)
    print(f"\n{len(mismatches)} patch(es) do not match expected state:\n")
    
    for i, mismatch in enumerate(mismatches, 1):
        print(f"{i}. Package: {mismatch['package']}")
        print(f"   File: {mismatch['file']}")
        print(f"   Issue: {mismatch['issue']}")
        print(f"   Description: {mismatch['description']}")
        print(f"   Fix: Copy {mismatch['patch_path']}")
        print(f"        to {mismatch['target_path']}")
        print()
    
    print("To fix these issues, run the following commands:")
    print("-" * 70)
    for mismatch in mismatches:
        print(f"cp {mismatch['patch_path']} {mismatch['target_path']}")
    print("-" * 70)
    print("\nAlternatively, start DNNE with --ignore-patch-errors to bypass this check.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    # When run directly, verify patches and print results
    mismatches = verify_all_patches()
    
    if mismatches:
        print_patch_errors(mismatches)
        sys.exit(1)
    else:
        print("All patches verified successfully!")
        sys.exit(0)