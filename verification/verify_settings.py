from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load Settings Page
        cwd = os.getcwd()
        settings_path = f"file://{cwd}/pages/settings/index.html"
        print(f"Navigating to {settings_path}")
        page.goto(settings_path)

        # Click the "Recherche" link to scroll to the section
        page.click("a[href='#search-engine-settings-container']")

        # Take screenshot of the Search Engine section
        screenshot_path = "verification/settings_search.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
