import sqlite3
import zipfile
import os
import json
import tempfile
from pathlib import Path

def extract_categories_from_apkg(apkg_path):
    """
    Extract categories from an Anki .apkg file.
    
    Args:
        apkg_path (str or Path): Path to the .apkg file
        
    Returns:
        list: List of category names
    """
    apkg_path = Path(apkg_path)
    
    if not apkg_path.exists():
        raise FileNotFoundError(f"APKG file not found: {apkg_path}")
    
    categories = []
    
    with zipfile.ZipFile(apkg_path, 'r') as zf:
        # Check if the file contains a collection.anki2 file
        if 'collection.anki2' not in zf.namelist():
            raise ValueError(f"Invalid APKG file: {apkg_path}. Missing collection.anki2")
        
        # Extract the collection.anki2 file to a temporary directory
        with tempfile.TemporaryDirectory() as tmpdir:
            zf.extract('collection.anki2', tmpdir)
            db_path = os.path.join(tmpdir, 'collection.anki2')
            
            # Connect to the SQLite database
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            
            # Get deck info
            cur.execute("SELECT decks FROM col")
            decks_json = cur.fetchone()[0]
            decks = json.loads(decks_json)
            
            # Extract deck names and organized into a hierarchy
            all_decks = {}
            for deck_id, deck_info in decks.items():
                deck_name = deck_info.get('name', '')
                # Skip empty deck names
                if not deck_name:
                    continue
                
                # Handle deck hierarchies (e.g., "MileDown's MCAT Decks::Biology")
                parts = deck_name.split('::')
                
                # If it's a subdeck, add it to its parent
                if len(parts) > 1:
                    main_deck = parts[0]
                    sub_deck = parts[-1]
                    
                    if main_deck not in all_decks:
                        all_decks[main_deck] = set()
                    
                    all_decks[main_deck].add(sub_deck)
            
            # Convert to list format
            for main_deck, sub_decks in all_decks.items():
                categories.append(main_deck)
                categories.extend([f"{main_deck}::{sub}" for sub in sorted(sub_decks)])
            
            conn.close()
    
    return sorted(categories)

def get_categories_from_apkg(apkg_path=None):
    """
    Get a list of categories from an Anki .apkg file.
    
    Args:
        apkg_path (str or Path, optional): Path to the .apkg file. If None, uses the default path.
        
    Returns:
        list: List of category names
    """
    if apkg_path is None:
        # Use the default path relative to the project root
        apkg_path = Path(__file__).parent.parent / "MCAT_Milesdown.apkg"
    
    try:
        return extract_categories_from_apkg(apkg_path)
    except Exception as e:
        print(f"Error extracting categories: {e}")
        # Fallback to hardcoded categories
        return [
            "Biology",
            "Chemistry",
            "Physics",
            "Psychology",
            "General Knowledge"
        ]

if __name__ == "__main__":
    # Example usage
    categories = get_categories_from_apkg()
    print("Categories from APKG file:")
    for i, category in enumerate(categories):
        print(f"{i+1}. {category}") 