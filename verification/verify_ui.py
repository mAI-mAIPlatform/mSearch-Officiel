from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load index.html locally
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait a bit for CSS to apply (though it should be instant)
        page.wait_for_timeout(1000)

        # Take screenshot
        page.screenshot(path="verification/ui_screenshot.png")
        browser.close()

if __name__ == "__main__":
    run()
