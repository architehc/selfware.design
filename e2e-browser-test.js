const puppeteer = require("puppeteer");
const path = require("path");

const SHOTS = "/tmp/trial-screenshots";

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on("pageerror", err => console.log(`[PAGE ERROR] ${err.message}`));

  const shot = async (name) => {
    const p = path.join(SHOTS, `${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`  📸 ${name}`);
  };

  try {
    console.log("1. Loading /try ...");
    await page.goto("http://localhost/try", { waitUntil: "networkidle2", timeout: 15000 });
    await shot("01-auth");

    console.log("2. Starting session ...");
    await page.type("#email-input", "final-demo@selfware.design");
    await page.click("#start-btn");

    console.log("3. Waiting for terminal ...");
    await page.waitForSelector(".xterm-screen", { timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await shot("02-terminal");

    console.log("4. selfware --version ...");
    await page.click(".xterm-screen");
    await page.keyboard.type("selfware --version", { delay: 20 });
    await page.keyboard.press("Enter");
    await new Promise(r => setTimeout(r, 1500));
    await shot("03-version");

    console.log("5. Running selfware task ...");
    await page.keyboard.type('cd ~/sample-project && selfware run "list the source files and show the first 5 lines of each"', { delay: 10 });
    await page.keyboard.press("Enter");

    // Wait in stages
    for (let i = 1; i <= 6; i++) {
      await new Promise(r => setTimeout(r, 10000));
      await shot(`04-run-${i * 10}s`);
      console.log(`   ... ${i * 10}s`);
    }

    const timer = await page.$eval("#timer", el => el.textContent);
    console.log(`6. Timer: ${timer}`);
    await shot("05-final");

    console.log("\n✅ All tests passed!");
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`);
    await shot("99-error");
  } finally {
    await browser.close();
  }
})();
