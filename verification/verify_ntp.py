from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Force body to have class 'is-ntp' to show the new tab page content
        page.evaluate("document.body.classList.add('is-ntp')")

        # Wait a bit for any transitions
        page.wait_for_timeout(1000)

        # Take a screenshot of the whole page
        page.screenshot(path="verification/ntp_screenshot.png", full_page=True)

        # Take a screenshot of the bottom part to verify the padding and controls
        # We scroll to bottom first
        page.evaluate("document.getElementById('ntp-main-shell').scrollTop = document.getElementById('ntp-main-shell').scrollHeight")
        page.wait_for_timeout(500)
        page.screenshot(path="verification/ntp_bottom_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
