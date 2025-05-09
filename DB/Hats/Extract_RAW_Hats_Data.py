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
output_folder = "./Hats_Data"
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# Load the JSON file with the item links
input_filename = "./Hats_Data/Hats_URL.json"
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
    # Using built‑in parser; you can switch to "lxml" if installed:
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Locate the info box table (assumed as the table with width="300")
    info_box = soup.find("table", attrs={"width": "300"})
    extracted = {"url": item_url, "title": item_title}
    
    if info_box:
        # --- Extract Level Required ---
        level_tag = info_box.find("b", string=lambda t: t and "Level Required:" in t)
        if level_tag and level_tag.parent:
            level_text = level_tag.parent.get_text(strip=True)
            extracted["level_required"] = level_text.replace("Level Required:", "").strip()
        
        # --- Extract Bonuses (preserving icon order) ---
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
        
        # --- Extract Sockets ---
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
        
        # --- Extract Tradeable and Auction flags ---
        extracted["tradeable"] = bool(info_box.find("b", string=lambda t: t and "Tradeable" in t))
        extracted["no_auction"] = bool(info_box.find("b", string=lambda t: t and "No Auction" in t))
    else:
        print(f"Info box not found for item: {item_title}")
    
    # --- Extract Status ---
    # Check for the retired notice in the page and set status accordingly.
    retired_text = "This item has been retired. Wizards can no longer acquire this item."
    if soup.find("b", string=lambda t: t and retired_text in t):
        extracted["status"] = "Retired"
    else:
        extracted["status"] = "Active"
    
    # --- Extract Category ---
    # Search through <td> elements for <a> tags with category links.
    category_links = []
    for td in soup.find_all("td"):
        a_tag = td.find("a", href=re.compile(r"^/wiki/Category:"))
        if a_tag:
            category_links.append(a_tag["href"])
    extracted["category"] = category_links
    
    # Append the extracted data to the results list
    results.append(extracted)

# Save the combined extracted data into a single JSON file
output_filename = os.path.join(output_folder, "RAW_Hats_Data.json")
with open(output_filename, "w", encoding="utf-8") as outf:
    json.dump(results, outf, indent=2, ensure_ascii=False)
print(f"\nCombined extracted info saved to '{output_filename}'")
