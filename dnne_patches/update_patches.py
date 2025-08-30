#!/usr/bin/env python3
"""
DNNE Patch Update System

Updates patches by copying modified patch files to their targets and updating timestamps.
This automates the tedious process of copying files and updating PATCHES.json.
"""

import json
import os
import shutil
import sys
from pathlib import Path
from typing import List, Dict, Any


def update_all_patches(frontend_root: str = None, force: bool = False) -> List[Dict[str, Any]]:
    """
    Update all patches that have been modified.
    
    Args:
        frontend_root: Root directory of the frontend (defaults to parent of this script's dir)
        force: If True, update all patches regardless of timestamps
    
    Returns:
        List of dictionaries describing updated patches
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
        print(f"Error: {patches_file} not found.")
        return []
    
    # Load patches configuration
    with open(patches_file, 'r') as f:
        patches = json.load(f)
    
    updated = []
    
    for patch in patches:
        target_file = frontend_root / patch["target_path"]
        patch_file = frontend_root / patch["patch_path"]
        
        # Check if patch file exists
        if not patch_file.exists():
            print(f"⚠️  Patch file does not exist: {patch_file}")
            continue
        
        # Get current timestamps
        patch_mtime = os.stat(patch_file).st_mtime
        target_mtime = os.stat(target_file).st_mtime if target_file.exists() else 0
        stored_timestamp = patch["timestamp"]
        
        # Determine if update is needed
        needs_update = False
        reason = ""
        
        if not target_file.exists():
            needs_update = True
            reason = "target doesn't exist"
        elif force:
            needs_update = True
            reason = "forced update"
        elif abs(patch_mtime - stored_timestamp) > 1:
            # Patch file was modified after last recorded update
            needs_update = True
            reason = f"patch modified (patch: {patch_mtime:.0f}, stored: {stored_timestamp:.0f})"
        elif abs(target_mtime - stored_timestamp) > 1:
            # Target file timestamp doesn't match stored
            needs_update = True
            reason = f"target mismatch (target: {target_mtime:.0f}, stored: {stored_timestamp:.0f})"
        
        if needs_update:
            print(f"\n📦 Updating patch: {patch['package']} - {patch['file']}")
            print(f"   Reason: {reason}")
            print(f"   Copying: {patch_file.relative_to(frontend_root)}")
            print(f"        to: {target_file.relative_to(frontend_root)}")
            
            # Create target directory if needed
            target_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy the file
            shutil.copy2(patch_file, target_file)
            
            # Get new timestamp
            new_timestamp = os.stat(target_file).st_mtime
            
            # Update the patch record
            patch["timestamp"] = new_timestamp
            
            updated.append({
                "package": patch["package"],
                "file": patch["file"],
                "old_timestamp": stored_timestamp,
                "new_timestamp": new_timestamp,
                "reason": reason
            })
            
            print(f"   ✅ Updated (timestamp: {new_timestamp:.0f})")
    
    if updated:
        # Save updated patches configuration
        with open(patches_file, 'w') as f:
            json.dump(patches, f, indent=2)
        print(f"\n✅ Updated PATCHES.json with new timestamps")
    
    return updated


def main():
    """Main entry point for command-line usage."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Update DNNE patches')
    parser.add_argument('--force', '-f', action='store_true',
                        help='Force update all patches regardless of timestamps')
    parser.add_argument('--check', '-c', action='store_true',
                        help='Only check which patches need updating without applying')
    args = parser.parse_args()
    
    if args.check:
        # Just check what needs updating
        print("Checking patches...")
        from dnne_patches import verify_all_patches
        mismatches = verify_all_patches()
        
        if mismatches:
            print(f"\n{len(mismatches)} patch(es) need updating:")
            for m in mismatches:
                print(f"  - {m['package']}: {m['issue']}")
            print("\nRun 'python dnne_patches/update_patches.py' to apply updates")
            sys.exit(1)
        else:
            print("✅ All patches are up to date!")
            sys.exit(0)
    
    # Update patches
    print("=" * 70)
    print("DNNE Patch Update System")
    print("=" * 70)
    
    updated = update_all_patches(force=args.force)
    
    if updated:
        print("\n" + "=" * 70)
        print(f"✅ Successfully updated {len(updated)} patch(es)")
        print("=" * 70)
        
        # Verify patches after update
        print("\nVerifying patches after update...")
        from dnne_patches import verify_all_patches
        mismatches = verify_all_patches()
        
        if mismatches:
            print(f"⚠️  Warning: {len(mismatches)} patch(es) still have issues after update")
            for m in mismatches:
                print(f"  - {m['package']}: {m['issue']}")
            sys.exit(1)
        else:
            print("✅ All patches verified successfully!")
    else:
        print("\n✅ No patches needed updating")
    
    sys.exit(0)


if __name__ == "__main__":
    main()