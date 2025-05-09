import json
import re

def swap_if_wizards(mapping):
    """
    If mapping is a single key/value pair and the value is exactly
    "Wizards Cannot Use", swap the key and value.
    For example:
       { "Balance": "Wizards Cannot Use" }  =>  { "Wizards Cannot Use": "Balance" }
    """
    if isinstance(mapping, dict) and len(mapping) == 1:
        key, value = list(mapping.items())[0]
        if isinstance(value, str) and value == "Wizards Cannot Use":
            return {"Wizards Cannot Use": key}
    return mapping

# Input and output file paths
input_file = "./Athames_Data/RAW_Athames_Data.json"
output_file = "./Athames_Data/Athames_Data.json"

# Load the existing JSON data
with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

transformed_data = []

for item in data:
    new_item = {}
    # --- Rename and Clean Name ---
    # Remove any text within parentheses from the title and rename key to "Name"
    original_name = item.get("title", "")
    cleaned_name = re.sub(r"\([^)]*\)", "", original_name).strip()
    new_item["Name"] = cleaned_name

    # --- Copy Standard Fields ---
    new_item["url"] = item.get("url", "")
    # Modified here: "level_required" is now renamed to "level"
    new_item["level"] = item.get("level_required", "")
    new_item["tradeable"] = item.get("tradeable", False)
    new_item["no_auction"] = item.get("no_auction", False)
    new_item["status"] = item.get("status", "")
    new_item["sockets"] = item.get("sockets", [])

    # --- Process Bonuses ---
    new_bonuses = []
    for bonus in item.get("bonuses", []):
        # Remove any extraneous spaces and the word "Max" from bonus text
        bonus_text = bonus.get("bonus", "").strip()
        bonus_text = bonus_text.replace("Max", "").strip()
        icons = bonus.get("icons", [])
        # Skip bonus entries that are empty or missing icons
        if not bonus_text or not icons:
            continue

        if len(icons) == 1:
            bonus_mapping = {icons[0]: bonus_text}
            bonus_mapping = swap_if_wizards(bonus_mapping)
            new_bonuses.append(bonus_mapping)
        else:
            # For multi-icon bonuses:
            # Remove "Max" from bonus_text and split into tokens.
            tokens = bonus_text.split()
            num_pairs = len(icons) - 1  # expecting the first (n-1) icons pair with tokens
            paired_tokens = tokens[:num_pairs]
            
            inner_mapping = {}
            for i in range(num_pairs):
                token = paired_tokens[i] if i < len(paired_tokens) else ""
                inner_mapping[icons[i]] = token
            umbrella_key = icons[-1]
            bonus_mapping = {umbrella_key: inner_mapping}
            bonus_mapping = swap_if_wizards(bonus_mapping)
            new_bonuses.append(bonus_mapping)
    new_item["bonuses"] = new_bonuses

    # --- Process Categories ---
    # Deduplicate category links (preserving order) and rename key to "School Type".
    # Also remove "/wiki/Category:" from the string and ignore any category that includes "_Spells"
    categories = item.get("category", [])
    seen = set()
    deduped_categories = []
    for cat in categories:
        # Remove the prefix "/wiki/Category:" if present.
        if cat.startswith("/wiki/Category:"):
            cat_clean = cat[len("/wiki/Category:"):]
        else:
            cat_clean = cat
        # Exclude categories that have _Spells in them.
        if "_Spells" in cat_clean:
            continue
        if cat_clean not in seen:
            deduped_categories.append(cat_clean)
            seen.add(cat_clean)
    new_item["School Type"] = deduped_categories

    transformed_data.append(new_item)

# Write the transformed data to a new JSON file
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(transformed_data, f, indent=2, ensure_ascii=False)

print(f"Transformed JSON written to '{output_file}'")
