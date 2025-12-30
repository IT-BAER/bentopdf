/**
 * Script to fix missing i18n attributes on tool pages
 * 
 * Issues to fix:
 * 1. Navigation links missing data-i18n="nav.about", "nav.contact", "nav.licensing"
 * 2. Tool titles (h1) missing data-i18n="tools:toolName.name"
 * 3. Tool subtitles (p) missing data-i18n="tools:toolName.subtitle"
 * 4. Footer links missing data-i18n attributes
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'src', 'pages');

// Files confirmed missing navigation i18n
const NAV_MISSING_FILES = [
  'cbz-to-pdf.html', 'compress-pdf.html', 'crop-pdf.html', 'csv-to-pdf.html',
  'delete-pages.html', 'epub-to-pdf.html', 'excel-to-pdf.html', 'extract-images.html',
  'extract-pages.html', 'extract-tables.html', 'fb2-to-pdf.html', 'markdown-to-pdf.html',
  'mobi-to-pdf.html', 'odg-to-pdf.html', 'odp-to-pdf.html', 'ods-to-pdf.html',
  'odt-to-pdf.html', 'organize-pdf.html', 'pages-to-pdf.html', 'pdf-layers.html',
  'pdf-to-csv.html', 'pdf-to-excel.html', 'pdf-to-markdown.html', 'pdf-to-pdfa.html',
  'powerpoint-to-pdf.html', 'prepare-pdf-for-ai.html', 'psd-to-pdf.html', 'pub-to-pdf.html',
  'rasterize-pdf.html', 'rotate-custom.html', 'rtf-to-pdf.html', 'sign-pdf.html',
  'vsd-to-pdf.html', 'word-to-pdf.html', 'wpd-to-pdf.html', 'wps-to-pdf.html',
  'xml-to-pdf.html', 'xps-to-pdf.html'
];

// Files confirmed missing tool title/subtitle i18n
const TOOL_TITLE_MISSING_FILES = [
  'csv-to-pdf.html', 'extract-images.html', 'markdown-to-pdf.html', 'odt-to-pdf.html',
  'pdf-layers.html', 'pdf-to-docx.html', 'pdf-to-markdown.html', 'pdf-to-pdfa.html',
  'prepare-pdf-for-ai.html', 'rasterize-pdf.html', 'rtf-to-pdf.html'
];

// Map of file names to their tool translation keys
const FILE_TO_TOOL_KEY = {
  'csv-to-pdf.html': 'csvToPdf',
  'extract-images.html': 'extractImages',
  'markdown-to-pdf.html': 'markdownToPdf',
  'odt-to-pdf.html': 'odtToPdf',
  'pdf-layers.html': 'pdfOcg',
  'pdf-to-docx.html': 'pdfToWord',
  'pdf-to-markdown.html': 'pdfToMarkdown',
  'pdf-to-pdfa.html': 'pdfToPdfa',
  'prepare-pdf-for-ai.html': 'preparePdfForAi',
  'rasterize-pdf.html': 'rasterizePdf',
  'rtf-to-pdf.html': 'rtfToPdf'
};

function fixNavigationI18n(content) {
  // Fix nav-link without data-i18n for About
  content = content.replace(
    /<a href="\/about\.html" class="nav-link">About<\/a>/g,
    '<a href="/about.html" class="nav-link" data-i18n="nav.about">About</a>'
  );
  
  // Fix nav-link without data-i18n for Contact
  content = content.replace(
    /<a href="\/contact\.html" class="nav-link">Contact<\/a>/g,
    '<a href="/contact.html" class="nav-link" data-i18n="nav.contact">Contact</a>'
  );
  
  // Fix nav-link without data-i18n for Licensing
  content = content.replace(
    /<a href="\/licensing\.html" class="nav-link">Licensing<\/a>/g,
    '<a href="/licensing.html" class="nav-link" data-i18n="nav.licensing">Licensing</a>'
  );
  
  // Fix mobile-nav-link without data-i18n for About
  content = content.replace(
    /<a href="\/about\.html" class="mobile-nav-link">About<\/a>/g,
    '<a href="/about.html" class="mobile-nav-link" data-i18n="nav.about">About</a>'
  );
  
  // Fix mobile-nav-link without data-i18n for Contact
  content = content.replace(
    /<a href="\/contact\.html" class="mobile-nav-link">Contact<\/a>/g,
    '<a href="/contact.html" class="mobile-nav-link" data-i18n="nav.contact">Contact</a>'
  );
  
  // Fix mobile-nav-link without data-i18n for Licensing
  content = content.replace(
    /<a href="\/licensing\.html" class="mobile-nav-link">Licensing<\/a>/g,
    '<a href="/licensing.html" class="mobile-nav-link" data-i18n="nav.licensing">Licensing</a>'
  );
  
  return content;
}

function fixFooterI18n(content) {
  // Footer headings - general structure
  content = content.replace(
    /<h3 class="font-bold text-white mb-4">Company<\/h3>/g,
    '<h3 class="font-bold text-white mb-4" data-i18n="footer.company">Company</h3>'
  );
  content = content.replace(
    /<h3 class="font-bold text-white mb-4">Legal<\/h3>/g,
    '<h3 class="font-bold text-white mb-4" data-i18n="footer.legal">Legal</h3>'
  );
  content = content.replace(
    /<h3 class="font-bold text-white mb-4">Follow Us<\/h3>/g,
    '<h3 class="font-bold text-white mb-4" data-i18n="footer.followUs">Follow Us</h3>'
  );
  
  // Footer links - Company section
  content = content.replace(
    /<a href="\/about\.html" class="hover:text-indigo-400">About Us<\/a>/g,
    '<a href="/about.html" class="hover:text-indigo-400" data-i18n="footer.aboutUs">About Us</a>'
  );
  content = content.replace(
    /<a href="\/faq\.html" class="hover:text-indigo-400">FAQ<\/a>/g,
    '<a href="/faq.html" class="hover:text-indigo-400" data-i18n="footer.faqLink">FAQ</a>'
  );
  content = content.replace(
    /<a href="\/contact\.html" class="hover:text-indigo-400">Contact Us<\/a>/g,
    '<a href="/contact.html" class="hover:text-indigo-400" data-i18n="footer.contactUs">Contact Us</a>'
  );
  
  // Footer links - Legal section
  content = content.replace(
    /<a href="\/licensing\.html" class="hover:text-indigo-400">Licensing<\/a>/g,
    '<a href="/licensing.html" class="hover:text-indigo-400" data-i18n="footer.licensing">Licensing</a>'
  );
  content = content.replace(
    /<a href="\/terms\.html" class="hover:text-indigo-400">Terms and Conditions<\/a>/g,
    '<a href="/terms.html" class="hover:text-indigo-400" data-i18n="footer.termsAndConditions">Terms and Conditions</a>'
  );
  content = content.replace(
    /<a href="\/privacy\.html" class="hover:text-indigo-400">Privacy Policy<\/a>/g,
    '<a href="/privacy.html" class="hover:text-indigo-400" data-i18n="footer.privacyPolicy">Privacy Policy</a>'
  );
  
  // Footer copyright - with span already
  content = content.replace(
    /<p class="text-gray-400 text-sm">\s*© 2025 BentoPDF\. All rights reserved\.\s*<\/p>/g,
    '<p class="text-gray-400 text-sm" data-i18n="footer.copyright">© 2025 BentoPDF. All rights reserved.</p>'
  );
  
  return content;
}

function fixUploadAreaI18n(content) {
  // Fix "Click to select files" without i18n
  content = content.replace(
    /<span class="font-semibold">Click to select files<\/span>/g,
    '<span class="font-semibold" data-i18n="upload.clickToSelect">Click to select files</span>'
  );
  content = content.replace(
    /<span class="font-semibold">Click to select a file<\/span>/g,
    '<span class="font-semibold" data-i18n="upload.clickToSelect">Click to select a file</span>'
  );
  
  // Fix file type hints like "One or more CSV files"
  content = content.replace(
    /<p class="text-xs text-gray-500">One or more ([A-Z]+) files<\/p>/g,
    '<p class="text-xs text-gray-500" data-i18n="upload.fileHint">One or more $1 files</p>'
  );
  // For single file hints
  content = content.replace(
    /<p class="text-xs text-gray-500">PDF files only<\/p>/g,
    '<p class="text-xs text-gray-500" data-i18n="upload.pdfOnly">PDF files only</p>'
  );
  content = content.replace(
    /<p class="text-xs text-gray-500">One PDF file<\/p>/g,
    '<p class="text-xs text-gray-500" data-i18n="upload.onePdfFile">One PDF file</p>'
  );
  content = content.replace(
    /<p class="text-xs text-gray-500">One or more PDF files<\/p>/g,
    '<p class="text-xs text-gray-500" data-i18n="upload.oneOrMorePdfFiles">One or more PDF files</p>'
  );
  
  return content;
}

function fixToolTitleI18n(content, toolKey) {
  // For h1 titles without data-i18n
  const h1Regex = /<h1 class="text-2xl font-bold text-white mb-2">([^<]+)<\/h1>/;
  if (h1Regex.test(content) && !content.includes(`data-i18n="tools:${toolKey}.name"`)) {
    content = content.replace(
      h1Regex,
      `<h1 class="text-2xl font-bold text-white mb-2" data-i18n="tools:${toolKey}.name">$1</h1>`
    );
  }
  
  // For subtitle (p after h1)
  // Find the p.text-gray-400 after h1 that doesn't have data-i18n
  const subtitleRegex = /(<h1[^>]*>[^<]*<\/h1>\s*)<p class="text-gray-400 mb-6">\s*([^<]+)\s*<\/p>/;
  if (subtitleRegex.test(content) && !content.includes(`data-i18n="tools:${toolKey}.subtitle"`)) {
    content = content.replace(
      subtitleRegex,
      `$1<p class="text-gray-400 mb-6" data-i18n="tools:${toolKey}.subtitle">$2</p>`
    );
  }
  
  return content;
}

function processFile(filename) {
  const filePath = path.join(PAGES_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  Skipped (not found): ${filename}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix navigation i18n
  if (NAV_MISSING_FILES.includes(filename)) {
    content = fixNavigationI18n(content);
  }
  
  // Fix tool title/subtitle i18n
  if (TOOL_TITLE_MISSING_FILES.includes(filename)) {
    const toolKey = FILE_TO_TOOL_KEY[filename];
    if (toolKey) {
      content = fixToolTitleI18n(content, toolKey);
    }
  }
  
  // Fix footer i18n on all files
  content = fixFooterI18n(content);
  
  // Fix upload area i18n on all files
  content = fixUploadAreaI18n(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Fixed: ${filename}`);
    return true;
  } else {
    console.log(`  No changes: ${filename}`);
    return false;
  }
}

function main() {
  console.log('Fixing i18n attributes on tool pages...\n');
  
  // Get all HTML files in the pages directory
  const allFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
  
  let fixedCount = 0;
  
  // Process all files
  console.log(`Processing ${allFiles.length} files...\n`);
  
  for (const filename of allFiles) {
    if (processFile(filename)) {
      fixedCount++;
    }
  }
  
  console.log(`\nDone! Fixed ${fixedCount} files.`);
}

main();
