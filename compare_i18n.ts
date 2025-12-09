import { en } from './src/js/i18n/en';
import { de } from './src/js/i18n/de';

function compareValues(obj1: any, obj2: any, path: string = '') {
  const keys1 = Object.keys(obj1);

  keys1.forEach(key => {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof obj1[key] === 'object' && obj1[key] !== null) {
      if (obj2[key]) {
        compareValues(obj1[key], obj2[key], currentPath);
      }
    } else {
      if (obj1[key] === obj2[key] && typeof obj1[key] === 'string' && obj1[key].length > 2) {
         const ignoreList = ['PDF-Tools', 'OK', 'PDF', 'JSON', 'CSV', 'ZIP', 'BMP', 'TIFF', 'HEIC', 'SVG', 'PNG', 'JPG', 'WebP', 'Version', 'FAQ', 'Legal', 'Company', 'About Us', 'Contact Us', 'Licensing', 'Terms and Conditions', 'Privacy Policy', 'Follow Us'];
         if (!ignoreList.includes(obj1[key])) {
             console.log(`Potential untranslated value in de.ts: ${currentPath} = "${obj1[key]}"`);
         }
      }
    }
  });
}

compareValues(en, de);
