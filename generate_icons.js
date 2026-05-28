const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const SRC_IMAGE = path.join(__dirname, 'SRprojects_logo.png');
const ANDROID_RES_DIR = path.join(__dirname, 'android/app/src/main/res');
const IOS_ICON_DIR = path.join(__dirname, 'ios/srprojects/Images.xcassets/AppIcon.appiconset');

const ANDROID_SIZES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const IOS_SIZES = [
  { name: 'AppIcon@2x.png', size: 120 },
  { name: 'AppIcon@3x.png', size: 180 },
  { name: 'AppIcon~ipad.png', size: 76 },
  { name: 'AppIcon@2x~ipad.png', size: 152 },
  { name: 'AppIcon-83.5@2x~ipad.png', size: 167 },
  { name: 'AppIcon-40@2x.png', size: 80 },
  { name: 'AppIcon-40@3x.png', size: 120 },
  { name: 'AppIcon-40~ipad.png', size: 40 },
  { name: 'AppIcon-40@2x~ipad.png', size: 80 },
  { name: 'AppIcon-20@2x.png', size: 40 },
  { name: 'AppIcon-20@3x.png', size: 60 },
  { name: 'AppIcon-20~ipad.png', size: 20 },
  { name: 'AppIcon-20@2x~ipad.png', size: 40 },
  { name: 'AppIcon-29.png', size: 29 },
  { name: 'AppIcon-29@2x.png', size: 58 },
  { name: 'AppIcon-29@3x.png', size: 87 },
  { name: 'AppIcon-29~ipad.png', size: 29 },
  { name: 'AppIcon-29@2x~ipad.png', size: 58 },
  { name: 'AppIcon-60@2x~car.png', size: 120 },
  { name: 'AppIcon-60@3x~car.png', size: 180 },
  { name: 'AppIcon~ios-marketing.png', size: 1024 },
];

async function generate() {
  try {
    const image = await Jimp.read(SRC_IMAGE);

    // Generate Android icons
    console.log('Generating Android icons...');
    for (const { dir, size } of ANDROID_SIZES) {
      const outPathNormal = path.join(ANDROID_RES_DIR, dir, 'ic_launcher.png');
      const outPathRound = path.join(ANDROID_RES_DIR, dir, 'ic_launcher_round.png');
      
      const resized = image.clone().resize({ w: size, h: size });
      await resized.write(outPathNormal);
      await resized.write(outPathRound);
      console.log(`Generated Android ${dir} (${size}x${size})`);
    }

    // Generate Android splash screen logo
    const splashSize = 512;
    const splashOut = path.join(ANDROID_RES_DIR, 'drawable', 'splash_logo.png');
    const splashImage = image.clone().resize({ w: splashSize, h: splashSize });
    await splashImage.write(splashOut);
    console.log(`Generated splash_logo.png (${splashSize}x${splashSize})`);

    // Generate iOS icons
    if (fs.existsSync(IOS_ICON_DIR)) {
      console.log('Generating iOS icons...');
      for (const { name, size } of IOS_SIZES) {
        const outPath = path.join(IOS_ICON_DIR, name);
        const resized = image.clone().resize({ w: size, h: size });
        await resized.write(outPath);
        console.log(`Generated iOS ${name} (${size}x${size})`);
      }
    } else {
      console.warn(`iOS icon directory not found: ${IOS_ICON_DIR}`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generate();
