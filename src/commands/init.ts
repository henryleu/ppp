import { mkdir, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createTable } from '../utils/table.js';
import { hybridManager } from '../utils/hybrid-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function initCommand(options: { name: string, template: string }) {
  console.log('>>> Initializing ppp in current directory...\n');

  const projectName = options.name;

  try {
    await mkdir('.ppp', { recursive: true });
    await mkdir('.ppp/template', { recursive: true });

    const settings = {
      name: projectName,
      description: '',
      created: new Date().toISOString(),
      version: '1.0.0'
    };

    await writeFile('.ppp/settings.json', JSON.stringify(settings, null, 2));

    const readmeContent = `# ${projectName}\n\n\n\nThis project is managed by ppp (Product Prompt Planner).\n`;
    await writeFile('.ppp/README.md', readmeContent);

    // Copy template files from src/templates/user-ppp to .ppp/template
    const templateDir = join(__dirname, 'templates/user-ppp');
    const templateFiles = ['TRACK.md', 'SPEC.md', 'IMPL.md'];
    
    for (const file of templateFiles) {
      const sourcePath = join(templateDir, file);
      const destPath = join('.ppp/template', file);
      await copyFile(sourcePath, destPath);
    }

    // Initialize database
    await hybridManager.initialize(projectName);

    const table = createTable({
      head: ['File', 'Status'],
      colWidths: [25, 15]
    });

    table.push(
      ['.ppp/settings.json', '[OK] Created'],
      ['.ppp/database.yml', '[OK] Created'],
      ['.ppp/README.md', '[OK] Created'],
      ['.ppp/template/', '[OK] Created'],
      ['.ppp/template/TRACK.md', '[OK] Created'],
      ['.ppp/template/SPEC.md', '[OK] Created'],
      ['.ppp/template/IMPL.md', '[OK] Created']
    );

    console.log('\n[OK] ppp initialized successfully!\n');
    console.log(table.toString());
    console.log('\n[INFO] Next steps:');
    console.log('  - Copy .ppp/template/SPEC.md to define your project requirements');
    console.log('  - Use .ppp/template/TRACK.md as a template for tracking your progress');
    console.log('  - Use .ppp/template/IMPL.md as a template for implementation details');

  } catch (error) {
    console.error('[ERROR] Error initializing ppp:', error);
    process.exit(1);
  }
}
