/**
 * Verify all tool HTML pages have proper i18n attributes
 */

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

// Get all HTML files
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

console.log(`\n=== Verifying ${files.length} tool HTML pages for i18n ===\n`);

const issues = [];

for (const file of files) {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileIssues = [];
    
    // Check for navigation i18n
    if (content.includes('href="/about.html"') && !content.includes('data-i18n="nav.about"')) {
        fileIssues.push('Missing nav.about i18n');
    }
    if (content.includes('href="/contact.html"') && !content.includes('data-i18n="nav.contact"')) {
        fileIssues.push('Missing nav.contact i18n');
    }
    
    // Check for footer i18n
    if (content.includes('>Company<') && !content.includes('data-i18n="footer.company"')) {
        fileIssues.push('Missing footer.company i18n');
    }
    if (content.includes('>Legal<') && !content.includes('data-i18n="footer.legal"')) {
        fileIssues.push('Missing footer.legal i18n');
    }
    if (content.includes('>Follow Us<') && !content.includes('data-i18n="footer.followUs"')) {
        fileIssues.push('Missing footer.followUs i18n');
    }
    
    // Check for tool title i18n (h1 should have data-i18n)
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) {
        const h1Tag = content.match(/<h1[^>]*>/)[0];
        if (!h1Tag.includes('data-i18n="tools:')) {
            fileIssues.push(`Missing tool title i18n for "${h1Match[1]}"`);
        }
    }
    
    // Check for tool subtitle i18n (p tag after h1)
    const subtitleMatch = content.match(/<h1[^>]*>[^<]+<\/h1>\s*<p[^>]*>([^<]+)<\/p>/);
    if (subtitleMatch) {
        const pTagMatch = content.match(/<h1[^>]*>[^<]+<\/h1>\s*(<p[^>]*>)/);
        if (pTagMatch && !pTagMatch[1].includes('data-i18n="tools:')) {
            fileIssues.push('Missing tool subtitle i18n');
        }
    }
    
    // Check for upload area i18n
    if (content.includes('Click to select') && !content.includes('data-i18n="upload.clickToSelect"')) {
        fileIssues.push('Missing upload.clickToSelect i18n');
    }
    
    // Check footer links
    if (content.includes('>About Us<') && !content.includes('data-i18n="footer.aboutUs"')) {
        fileIssues.push('Missing footer.aboutUs i18n');
    }
    if (content.includes('>FAQ<') && !content.includes('data-i18n="footer.faq"')) {
        fileIssues.push('Missing footer.faq i18n');
    }
    if (content.includes('>Contact<') && !content.includes('data-i18n="footer.contact"')) {
        fileIssues.push('Missing footer.contact i18n');
    }
    if (content.includes('>Licensing<') && !content.includes('data-i18n="footer.licensing"')) {
        fileIssues.push('Missing footer.licensing i18n');
    }
    if (content.includes('>Terms of Use<') && !content.includes('data-i18n="footer.terms"')) {
        fileIssues.push('Missing footer.terms i18n');
    }
    if (content.includes('>Privacy Policy<') && !content.includes('data-i18n="footer.privacy"')) {
        fileIssues.push('Missing footer.privacy i18n');
    }
    
    if (fileIssues.length > 0) {
        issues.push({ file, issues: fileIssues });
    }
}

if (issues.length === 0) {
    console.log('✅ All tool pages have proper i18n attributes!\n');
} else {
    console.log(`❌ Found ${issues.length} files with missing i18n:\n`);
    for (const { file, issues: fileIssues } of issues) {
        console.log(`  ${file}:`);
        for (const issue of fileIssues) {
            console.log(`    - ${issue}`);
        }
        console.log();
    }
}

// Also check for tool translation keys in tools.json
console.log('\n=== Checking tools.json translation keys ===\n');

const enToolsPath = path.join(__dirname, 'public', 'locales', 'en', 'tools.json');
const deToolsPath = path.join(__dirname, 'public', 'locales', 'de', 'tools.json');

const enTools = JSON.parse(fs.readFileSync(enToolsPath, 'utf-8'));
const deTools = JSON.parse(fs.readFileSync(deToolsPath, 'utf-8'));

const enKeys = Object.keys(enTools);
const deKeys = Object.keys(deTools);

// Find missing in German
const missingInDe = enKeys.filter(k => !deKeys.includes(k));
if (missingInDe.length > 0) {
    console.log('❌ Missing in German tools.json:');
    for (const key of missingInDe) {
        console.log(`  - ${key}`);
    }
} else {
    console.log('✅ All English tools have German translations');
}

// Check for incomplete German translations (missing subtitle or name)
const incompleteDeTools = [];
for (const key of deKeys) {
    const tool = deTools[key];
    if (!tool.name) {
        incompleteDeTools.push(`${key}: missing name`);
    }
    if (!tool.subtitle) {
        incompleteDeTools.push(`${key}: missing subtitle`);
    }
}

if (incompleteDeTools.length > 0) {
    console.log('\n❌ Incomplete German tool translations:');
    for (const issue of incompleteDeTools) {
        console.log(`  - ${issue}`);
    }
} else {
    console.log('✅ All German tool translations are complete');
}

console.log('\n=== Verification Complete ===\n');
