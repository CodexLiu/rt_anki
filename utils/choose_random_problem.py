import random
import sqlite3
import zipfile
import json
import os
import tempfile
import re
import html
import sys
from pathlib import Path

# Add parent directory to sys.path to make imports work when running as script
sys.path.append(str(Path(__file__).parent.parent))
from utils.extract_categories import get_categories_from_apkg

def strip_html(text):
    """Remove HTML tags and decode HTML entities."""
    # First remove HTML tags
    text = re.sub(r'<.*?>', '', text)
    # Then decode HTML entities
    text = html.unescape(text)
    # Replace non-breaking spaces (\xa0) with regular spaces
    text = text.replace('\xa0', ' ')
    return text

def get_categories():
    """
    Get a list of available categories.
    
    Returns:
        list: List of category names
    """
    return [cat.split("::")[-1] for cat in get_categories_from_apkg() if "::" in cat]

def choose_random_problem(apkg_path=None, deck=None, debug=False):
    """
    Choose a random problem from the specified deck.
    
    Args:
        apkg_path (str): Path to the Anki package file
        deck (str): Name of the deck to choose from (without the "MileDown's MCAT Decks::" prefix)
        debug (bool): Whether to print debug info
        
    Returns:
        dict: A problem with 'question' and 'answer' keys
    """
    if isinstance(deck, int):
        # If deck is an integer, treat it as a category index
        categories = get_categories()
        if deck < 0 or deck >= len(categories):
            raise ValueError(f"Category index out of range: {deck}")
        deck = categories[deck]
    
    # If apkg_path is None, use the default path
    if apkg_path is None:
        apkg_path = str(Path(__file__).parent.parent / "MCAT_Milesdown.apkg")
    
    # Add the prefix to the deck name
    deck_prefix = "MileDown's MCAT Decks::"
    target_deck_name = f"{deck_prefix}{deck}"

    with zipfile.ZipFile(apkg_path, 'r') as zf:
        with tempfile.TemporaryDirectory() as tmpdir:
            zf.extract('collection.anki2', tmpdir)
            db_path = os.path.join(tmpdir, 'collection.anki2')
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Get deck info
            cur.execute("SELECT decks FROM col")
            decks = json.loads(cur.fetchone()[0])
            # Find the deck id for the target deck
            deck_id = None
            for did, d in decks.items():
                if d['name'] == target_deck_name:
                    deck_id = int(did)
                    break
            if debug:
                print(f"Deck found: {deck_id is not None}, deck_id: {deck_id}")
            if deck_id is None:
                conn.close()
                return None

            # Get note types (models)
            cur.execute("SELECT models FROM col")
            models = json.loads(cur.fetchone()[0])
            model_names = {str(mid): m['name'] for mid, m in models.items()}

            # Get all cards in the target deck
            cur.execute("SELECT nid FROM cards WHERE did = ?", (deck_id,))
            note_ids = [row[0] for row in cur.fetchall()]
            if debug:
                print(f"Number of cards in deck: {len(note_ids)}")
            if not note_ids:
                conn.close()
                return None

            # Choose a random note id
            chosen_nid = random.choice(note_ids)

            # Get the note info
            cur.execute("SELECT id, mid, flds FROM notes WHERE id = ?", (chosen_nid,))
            row = cur.fetchone()
            if not row:
                conn.close()
                return None
            note_id, mid, flds = row
            model_name = model_names.get(str(mid), "Unknown")
            if debug:
                print(f"Note type: {model_name}")
            fields = flds.split('\x1f')

            # Structure the output
            model_name_lower = model_name.lower()
            if 'cloze' in model_name_lower:
                cloze_text = fields[0]
                question = re.sub(r"{{c\d+::(.*?)}}", "{blank}", cloze_text)
                answer = re.sub(r"{{c\d+::(.*?)}}", r"\1", cloze_text)
                result = {'question': strip_html(question), 'answer': strip_html(answer)}
            elif 'basic' in model_name_lower and len(fields) >= 2:
                result = {'question': strip_html(fields[0]), 'answer': strip_html(fields[1])}
            else:
                result = None

            conn.close()
            return result

if __name__ == "__main__":
    # Example usage
    categories = get_categories()
    print("Available categories:")
    for i, category in enumerate(categories):
        print(f"{i+1}. {category}")
    
    category_index = int(input("Select a category (1-5): ")) - 1
    problem = choose_random_problem(deck=category_index)
    
    print(f"\nQuestion: {problem['question']}")
    print(f"Answer: {problem['answer']}") 