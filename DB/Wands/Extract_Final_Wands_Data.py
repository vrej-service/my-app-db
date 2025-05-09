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

# Input and output file paths for wand transformation
input_file = "./Wands_Data/RAW_Wands_Data.json"
output_file = "./Wands_Data/Wands_Data.json"

# Load the existing JSON data from the raw wand data file
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
    # Rename level_required to level
    new_item["level"] = item.get("level_required", "")
    new_item["tradeable"] = item.get("tradeable", False)
    new_item["no_auction"] = item.get("no_auction", False)
    new_item["status"] = item.get("status", "")
    
    # --- Process Sockets ---
    # Instead of copying the list, count the number of strings and subtract 1.
    # If there are no sockets, return [0] instead of [-1].
    socket_list = item.get("sockets", [])
    socket_count = max(len(socket_list) - 1, 0)
    new_item["sockets"] = [socket_count]                                    
    
    # --- Process Bonuses ---
    new_bonuses = []
    for bonus in item.get("bonuses", []):
        # Remove extraneous spaces, and remove both "Max" and "Rating" from bonus text.
        bonus_text = bonus.get("bonus", "").strip()
        bonus_text = bonus_text.replace("Max", "").replace("Rating", "").strip()
        icons = bonus.get("icons", [])
        # Skip bonus entries that are empty or missing icons.
        if not bonus_text or not icons:
            continue

        tokens = bonus_text.split()

        # --- Special Processing for Wand Bonuses with Duplicate Icons After Deduplication ---
        # Deduplicate the icons list (preserving order).
        dedup_icons = []
        for ic in icons:
            if ic not in dedup_icons:
                dedup_icons.append(ic)
                
        # If deduplicated icons count is greater than one and the number of tokens equals (dedup_icons - 1),
        # then assign tokens to the first dedup_icons minus one, with the last deduplicated icon as the umbrella key.
        if len(dedup_icons) > 1 and len(tokens) == (len(dedup_icons) - 1):
            umbrella_key = dedup_icons[-1]
            inner_mapping = {}
            for i in range(len(dedup_icons) - 1):
                inner_mapping[dedup_icons[i]] = tokens[i]
            bonus_mapping = {umbrella_key: inner_mapping}
            bonus_mapping = swap_if_wizards(bonus_mapping)
            new_bonuses.append(bonus_mapping)
        else:
            # --- Fallback Default Processing ---
            if len(icons) == 1:
                bonus_mapping = {icons[0]: bonus_text}
                bonus_mapping = swap_if_wizards(bonus_mapping)
                new_bonuses.append(bonus_mapping)
            else:
                num_pairs = len(icons) - 1  # expecting the first (n-1) icons to pair with tokens
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
    # Deduplicate category links (preserving order), remove the "/wiki/Category:" prefix,
    # remove the substring "_School_Items" from each category,
    # and ignore any category that includes "_Spells".
    # Finally, if there is only one cleaned category, store it as a string.
    categories = item.get("category", [])
    seen = set()
    deduped_categories = []
    for cat in categories:
        # Remove the prefix "/wiki/Category:" if present.
        if cat.startswith("/wiki/Category:"):
            cat_clean = cat[len("/wiki/Category:"):]
        else:
            cat_clean = cat
        # Remove the substring "_School_Items" from the category.
        cat_clean = cat_clean.replace("_School_Items", "")
        # Exclude any category that includes "_Spells".
        if "_Spells" in cat_clean:
            continue
        if cat_clean not in seen:
            deduped_categories.append(cat_clean)
            seen.add(cat_clean)
    if len(deduped_categories) == 1:
        new_item["School Type"] = deduped_categories[0]
    else:
        new_item["School Type"] = deduped_categories

    transformed_data.append(new_item)

# Write the transformed wand data to the output JSON file
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(transformed_data, f, indent=2, ensure_ascii=False)

print(f"Transformed JSON written to '{output_file}'")
