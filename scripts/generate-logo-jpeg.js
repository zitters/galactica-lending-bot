#!/usr/bin/env node

/**
 * Convert SVG logo to JPEG
 * Requires: npm install sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '../public/galactica-logo.svg');
const jpegPath = path.join(__dirname, '../public/galactica-logo.jpeg');
const pngPath = path.join(__dirname, '../public/galactica-logo.png');

async function generateLogos() {
  try {
    // Ensure svg exists
    if (!fs.existsSync(svgPath)) {
      console.error('❌ SVG file not found:', svgPath);
      process.exit(1);
    }

    console.log('📦 Converting SVG to image formats...');

    // SVG to PNG (intermediate)
    await sharp(svgPath, { density: 300 })
      .png()
      .toFile(pngPath);
    console.log('✅ Created:', pngPath);

    // PNG to JPEG
    await sharp(pngPath)
      .jpeg({ quality: 95, progressive: true })
      .toFile(jpegPath);
    console.log('✅ Created:', jpegPath);

    // Generate additional sizes
    const sizes = [
      { size: 256, suffix: '-256' },
      { size: 512, suffix: '-512' },
      { size: 1024, suffix: '-1024' }
    ];

    for (const { size, suffix } of sizes) {
      const jpegSizePath = jpegPath.replace('.jpeg', `${suffix}.jpeg`);
      await sharp(pngPath)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 95, progressive: true })
        .toFile(jpegSizePath);
      console.log(`✅ Created: ${jpegSizePath} (${size}x${size})`);
    }

    console.log('\n🎉 Logo generation complete!');
    console.log('   SVG:  ', svgPath);
    console.log('   JPEG: ', jpegPath);
    console.log('   PNG:  ', pngPath);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateLogos();
