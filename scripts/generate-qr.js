const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return "";
  }

  return process.argv[index + 1] || "";
}

async function main() {
  const url = getArg("--url");
  const outputBase = getArg("--output");

  if (!url || !outputBase) {
    console.error("Usage: node scripts/generate-qr.js --url <url> --output <output-base>");
    process.exit(1);
  }

  const pngPath = path.resolve(outputBase + ".png");
  const svgPath = path.resolve(outputBase + ".svg");

  fs.mkdirSync(path.dirname(pngPath), { recursive: true });

  await QRCode.toFile(pngPath, url, {
    type: "png",
    width: 1200,
    margin: 2,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });

  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });

  fs.writeFileSync(svgPath, svg, "utf8");

  console.log(
    JSON.stringify(
      {
        url,
        pngPath,
        svgPath,
      },
      null,
      2,
    ),
  );
}

main().catch(function (error) {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
