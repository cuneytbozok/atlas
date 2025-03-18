/**
 * Simple script to generate a PNG favicon from our SVG
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Creating the favicon.ico file...');

// Create a temporary HTML file that will help us convert SVG to ICO
const tempHtml = path.resolve(__dirname, '../public/branding/favicon-converter.html');

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ATLAS Favicon Generator</title>
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui; }
    .container { max-width: 800px; margin: 0 auto; }
    .steps { line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ATLAS Favicon Generator</h1>
    <p>Follow these steps to generate your favicon:</p>
    <ol class="steps">
      <li>Right-click on the SVG image below and save it</li>
      <li>Visit <a href="https://favicon.io/favicon-converter/" target="_blank">favicon.io</a> or any other favicon generator</li>
      <li>Upload the saved SVG and download the generated favicon.ico</li>
      <li>Place the favicon.ico in the 'public/branding/' directory</li>
    </ol>
    
    <h2>Your SVG:</h2>
    <img src="/branding/favicon.svg" width="64" height="64" alt="ATLAS Favicon">
    
    <h2>Alternative: Use PNG</h2>
    <p>If SVG doesn't work well with the converter, try using this PNG version:</p>
    <canvas id="canvas" width="32" height="32" style="border: 1px solid #ddd;"></canvas>
    
    <script>
      // Draw the SVG to canvas for PNG download
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = function() {
        ctx.drawImage(img, 0, 0, 32, 32);
      };
      img.src = '/branding/favicon.svg';
    </script>
    
    <p>Right-click on the canvas above and select "Save image as..." to download the PNG.</p>
  </div>
</body>
</html>
`;

fs.writeFileSync(tempHtml, html);

console.log(`
Favicon generation helper created!

Please:
1. Open the browser and visit: http://localhost:3000/branding/favicon-converter.html
2. Follow the instructions on that page to generate and save your favicon
3. The generated favicon.ico file should be placed in: /public/branding/

Note: This approach uses a web tool since Node.js doesn't have built-in SVG to ICO conversion.
`); 