import json
import re

def swap_if_wizards(mapping):
    """
    If mapping is a single key/value pair and the value is exactly
    "Wizards Cannot Use", swap the key and value.
    """
    if isinstance(mapping, dict) and len(mapping) == 1:
        key, value = list(mapping.items())[0]
        if isinstance(value, str) and value == "Wizards Cannot Use":
            return {"Wizards Cannot Use": key}
    return mapping

def deduplicate_list(lst):
    """Deduplicate a list while preserving order."""
    seen = set()
    deduped = []
    for item in lst:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped

# Input and output file paths
input_file = "./Jewels_Data/RAW_Jewels_Data.json"
output_file = "./Jewels_Data/Jewels_Data.json"

# Load the existing JSON data
with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

transformed_data = []

for item in data:
    new_item = {}
    # --- Rename and Clean Name ---
    original_name = item.get("title", "")
    # Removed the line that removed parenthetical content.
    # Now we only remove a leading "Jewel:" (if present)
    cleaned_name = re.sub(r"^Jewel:", "", original_name).strip()
    new_item["Name"] = cleaned_name

    # --- Standard Fields ---
    new_item["url"] = item.get("url", "")
    new_item["level"] = item.get("level_required", "")
    new_item["tradeable"] = item.get("tradeable", False)
    new_item["no_auction"] = item.get("no_auction", False)
    new_item["status"] = item.get("status", "")
    new_item["sockets"] = item.get("sockets", [])

    # --- Deduplicate "type", "school", and "weaving_school" fields if present ---
    if "type" in item:
        new_item["type"] = deduplicate_list(item.get("type", []))
    if "school" in item:
        new_item["school"] = deduplicate_list(item.get("school", []))
    if "weaving_school" in item:
        new_item["weaving_school"] = deduplicate_list(item.get("weaving_school", []))
    
    # --- Process Bonuses ---
    new_bonuses = []
    for bonus in item.get("bonuses", []):
        # Clean bonus text: remove extra spaces and the words "Max", "Chance", and "Rating"
        bonus_text = bonus.get("bonus", "").strip()
        bonus_text = bonus_text.replace("Max", "").replace("Chance", "").replace("Rating", "").strip()
        bonus_tokens = bonus_text.split()  # Split bonus text into tokens

        # Process icons: replace "Damage Alternate" with "Damage"
        icons = bonus.get("icons", [])
        icons = [("Damage" if icon == "Damage Alternate" else icon) for icon in icons]

        # Build bonus mapping.
        if len(bonus_tokens) == 1 and len(icons) >= 4:
            # Single bonus token case:
            # Use the second duplicated group: outer key = icons[2] and inner key = icons[0]
            bonus_mapping = { icons[2]: { icons[0]: bonus_tokens[0] } }
            bonus_mapping = swap_if_wizards(bonus_mapping)
            new_bonuses.append(bonus_mapping)
        elif len(bonus_tokens) >= 2 and len(icons) >= 8:
            # Multi bonus tokens case (using raw icons list in duplicate pairs)
            bonus_mapping1 = { icons[2]: { icons[0]: bonus_tokens[0] } }
            bonus_mapping1 = swap_if_wizards(bonus_mapping1)
            bonus_mapping2 = { icons[6]: { icons[4]: bonus_tokens[1] } }
            bonus_mapping2 = swap_if_wizards(bonus_mapping2)
            new_bonuses.append(bonus_mapping1)
            new_bonuses.append(bonus_mapping2)
        else:
            # Fallback: simple mapping using the first icon if available.
            bonus_mapping = { icons[0] if icons else "" : bonus_text }
            bonus_mapping = swap_if_wizards(bonus_mapping)
            new_bonuses.append(bonus_mapping)
    new_item["bonuses"] = new_bonuses

    # --- Omit the "category" field entirely ---

    transformed_data.append(new_item)

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(transformed_data, f, indent=2, ensure_ascii=False)

print(f"Transformed JSON written to '{output_file}'")
