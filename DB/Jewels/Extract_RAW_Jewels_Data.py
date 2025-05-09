import os
import re
import json
import cloudscraper
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def sanitize_filename(name):
    """
    Replace spaces with underscores and remove characters 
    not allowed in filenames for Windows and other OS.
    """
    name = name.replace(" ", "_")
    return re.sub(r'[\\/*?:"<>|]', "", name)

# Create the output folder if it doesn't exist
output_folder = "./Jewels_Data"
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# Load the JSON file with the item links
input_filename = "./Jewels_Data/Jewels_URL.json"
with open(input_filename, "r", encoding="utf-8") as f:
    items = json.load(f)

if not items:
    print("No items found in", input_filename)
    exit()

# Create a cloudscraper session to bypass Cloudflare protections
scraper = cloudscraper.create_scraper()

# Holds all extracted data
results = []

# Process each item from the JSON file
for index, item in enumerate(items):
    item_title = item.get("title", f"item_{index+1}")

    # Exclude items with title "previous page"
    if item_title.strip().lower() == "previous page":
        print(f"Skipping item '{item_title}' as it is a navigation link.")
        continue

    # Remove "Item:" prefix if present
    if item_title.startswith("Item:"):
        item_title = item_title[len("Item:"):].strip()

    item_url = item.get("url")
    if not item_url:
        print(f"No URL found for {item_title}. Skipping...")
        continue

    print(f"\nFetching item page: {item_url}")
    response = scraper.get(item_url)
    soup = BeautifulSoup(response.text, "html.parser")

    # Try to locate the info box using the "width" attribute; if not, try class "infobox"
    info_box = soup.find("table", attrs={"width": "300"})
    if not info_box:
        info_box = soup.find("table", class_="infobox")
    
    # Prepare our extracted info dictionary
    extracted = {"url": item_url, "title": item_title}

    if info_box:
        # Determine if this is a jewel page: either it has "Jewel Information" or the title starts with "Jewel:"
        if info_box.find("b", string=lambda t: t and "Jewel Information" in t) or item_title.lower().startswith("jewel:"):
            # --- JEWELS PAGE EXTRACTION ---
            additional_info = {}
            for row in info_box.find_all("tr"):
                cells = row.find_all("td")
                if len(cells) != 2:
                    continue  # Skip headers or rows without exactly 2 cells

                field_tag = cells[0].find("b")
                if not field_tag:
                    continue
                # Normalize field name: lowercase and remove any trailing colon
                field_name = field_tag.get_text(strip=True).lower().rstrip(":")
                value_cell = cells[1]

                if field_name == "level":
                    # Extract level data
                    level_text = value_cell.get_text(" ", strip=True)
                    if level_text:
                        extracted["level_required"] = level_text

                elif field_name == "socket":
                    sockets = []
                    socket_text = value_cell.get_text(" ", strip=True)
                    if socket_text:
                        sockets.append(socket_text)
                    # Append any icon titles if available
                    for img in value_cell.find_all("img"):
                        title = img.get("title")
                        if title:
                            sockets.append(title.strip())
                    extracted["sockets"] = sockets

                elif field_name in ("type", "school", "weaving school"):
                    key_name = field_name.replace(" ", "_")  # e.g., "weaving_school"
                    values = []
                    text_val = value_cell.get_text(" ", strip=True)
                    if text_val:
                        values.append(text_val)
                    for img in value_cell.find_all("img"):
                        icon = img.get("title") or img.get("alt", "")
                        if icon:
                            values.append(icon.strip())
                    extracted[key_name] = values

                elif field_name == "effect":
                    # Extract Effect data as bonuses
                    bonuses = []
                    # The effect cell may contain multiple lines separated by <br>
                    bonus_html = value_cell.decode_contents().strip()
                    bonus_lines = [line.strip() for line in bonus_html.split("<br>") if line.strip()]
                    for line in bonus_lines:
                        line_soup = BeautifulSoup(line, "html.parser")
                        bonus_text = line_soup.get_text(" ", strip=True)
                        icons = [img.get("alt", "").strip() for img in line_soup.find_all("img") if img.get("alt")]
                        bonuses.append({"bonus": bonus_text, "icons": icons})
                    extracted["bonuses"] = bonuses

                else:
                    # For any additional field, preserve the full text in an "additional_info" dictionary.
                    additional_info[field_name] = value_cell.get_text(" ", strip=True)
            if additional_info:
                extracted["additional_info"] = additional_info

        else:
            # --- STANDARD NON-JEWELS EXTRACTION ---
            # Extract Level Required
            level_tag = info_box.find("b", string=lambda t: t and "Level Required:" in t)
            if level_tag and level_tag.parent:
                level_text = level_tag.parent.get_text(strip=True)
                extracted["level_required"] = level_text.replace("Level Required:", "").strip()
            
            # Extract Bonuses (preserving icon order)
            bonuses = []
            bonuses_tag = info_box.find("b", string=lambda t: t and "Bonuses:" in t)
            if bonuses_tag:
                dl_tag = bonuses_tag.find_next("dl")
                if dl_tag:
                    for dd in dl_tag.find_all("dd"):
                        bonus_text = dd.get_text(" ", strip=True)
                        icons = []
                        for img in dd.find_all("img"):
                            alt_text = img.get("alt", "")
                            if alt_text.startswith("(Icon)"):
                                icon_name = alt_text.replace("(Icon)", "").strip()
                                if icon_name.lower().endswith(".png"):
                                    icon_name = icon_name[:-4].strip()
                                icons.append(icon_name)
                        bonuses.append({"bonus": bonus_text, "icons": icons})
            extracted["bonuses"] = bonuses
            
            # Extract Sockets
            sockets = []
            sockets_tag = info_box.find("b", string=lambda t: t and "Sockets" in t)
            if sockets_tag:
                parent_dl = sockets_tag.find_parent("dl")
                if parent_dl:
                    sockets_info_dl = parent_dl.find_next_sibling("dl")
                    if sockets_info_dl:
                        for dd in sockets_info_dl.find_all("dd"):
                            img = dd.find("img")
                            if img and img.get("title"):
                                sockets.append(img.get("title"))
                            else:
                                text = dd.get_text(" ", strip=True)
                                if text:
                                    sockets.append(text)
            extracted["sockets"] = sockets
            
            # Extract Tradeable and Auction flags
            extracted["tradeable"] = bool(info_box.find("b", string=lambda t: t and "Tradeable" in t))
            extracted["no_auction"] = bool(info_box.find("b", string=lambda t: t and "No Auction" in t))
    
    else:
        print(f"Info box not found for item: {item_title}")

    # --- Extract Status ---
    retired_text = "This item has been retired. Wizards can no longer acquire this item."
    extracted["status"] = "Retired" if soup.find("b", string=lambda t: t and retired_text in t) else "Active"

    # --- Extract Category ---
    # Capture categories and remove the prefix "/wiki/Category:" if present.
    categories = []
    for a in soup.find_all("a", href=re.compile(r"^/wiki/Category:")):
        cat = a["href"]
        if cat.startswith("/wiki/Category:"):
            cat = cat[len("/wiki/Category:"):]
        categories.append(cat)
    extracted["category"] = categories

    # Append the extracted data to the results list
    results.append(extracted)

# Save the combined extracted data into a JSON file
output_filename = os.path.join(output_folder, "RAW_Jewels_Data.json")
with open(output_filename, "w", encoding="utf-8") as outf:
    json.dump(results, outf, indent=2, ensure_ascii=False)
print(f"\nCombined extracted info saved to '{output_filename}'")
