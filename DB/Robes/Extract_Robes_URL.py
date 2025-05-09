import cloudscraper
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import json

# Create a cloudscraper session (bypasses Cloudflare challenges)
scraper = cloudscraper.create_scraper()

# Base URL of the site and starting page relative URL
base_url = 'https://wiki.wizard101central.com'
page_url = '/wiki/Category:Robes'

all_links = []  # This list will hold dictionaries with "title" and "url"

while page_url:
    # Build the absolute URL for the current page and fetch it
    current_url = urljoin(base_url, page_url)
    print("Fetching:", current_url)
    response = scraper.get(current_url)
    
    # Parse the page content
    soup = BeautifulSoup(response.text, 'lxml')
    
    # Find the div containing the page links using its id 'mw-pages'
    mw_pages_div = soup.find('div', id='mw-pages')
    if mw_pages_div:
        # Iterate over all <a> tags in the container
        for a in mw_pages_div.find_all('a'):
            link_text = a.get_text().strip()
            # Exclude the "next page" link
            if link_text.lower() == "next page":
                continue
            href = a.get('href')
            if href:
                full_url = urljoin(base_url, href)
                all_links.append({"title": link_text, "url": full_url})
    else:
        print("Warning: 'mw-pages' section not found on this page.")
    
    # Look for the "next page" button in the current mw-pages div
    next_button = mw_pages_div.find('a', string="next page") if mw_pages_div else None
    if next_button and next_button.get('href'):
        page_url = next_button['href']
    else:
        page_url = None

# Export the collected links to a JSON file
output_filename = './Robes_Data/Robes_URL.json'
with open(output_filename, 'w', encoding='utf-8') as f:
    json.dump(all_links, f, indent=2, ensure_ascii=False)

print(f"\nCollected {len(all_links)} links. Results have been exported to '{output_filename}'.")
