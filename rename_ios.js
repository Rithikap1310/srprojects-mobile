const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, 'ios');

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'Pods' && file !== 'build' && !fullPath.includes('.xcworkspace/xcuserdata') && !fullPath.includes('.xcodeproj/xcuserdata')) {
        getFiles(fullPath, filesList);
      }
    } else {
      if (file.match(/\.(pbxproj|plist|m|mm|h|swift|xcworkspacedata|xcscheme|json|xml)$/) || file === 'Podfile') {
        filesList.push(fullPath);
      }
    }
  }
  return filesList;
}

console.log('Replacing contents...');
const filesToUpdate = getFiles(iosDir);
filesToUpdate.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content
    .replace(/ios\.getgaruda\.com/g, 'ios.srprojects.com')
    .replace(/getgaruda/g, 'srprojects')
    .replace(/Getgaruda/g, 'SRProjects');
    
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});

console.log('Renaming files and directories...');
const renames = [
  { old: 'ios/getgarudaTests/getgarudaTests.m', new: 'ios/getgarudaTests/srprojectsTests.m' },
  { old: 'ios/getgaruda.xcodeproj/xcshareddata/xcschemes/getgaruda.xcscheme', new: 'ios/getgaruda.xcodeproj/xcshareddata/xcschemes/srprojects.xcscheme' },
  { old: 'ios/getgaruda.xcworkspace', new: 'ios/srprojects.xcworkspace' },
  { old: 'ios/getgaruda.xcodeproj', new: 'ios/srprojects.xcodeproj' },
  { old: 'ios/getgarudaTests', new: 'ios/srprojectsTests' },
  { old: 'ios/getgaruda', new: 'ios/srprojects' }
];

renames.forEach(({ old, new: newPath }) => {
  const oldFullPath = path.join(__dirname, old);
  const newFullPath = path.join(__dirname, newPath);
  if (fs.existsSync(oldFullPath)) {
    fs.renameSync(oldFullPath, newFullPath);
    console.log(`Renamed ${old} -> ${newPath}`);
  }
});
