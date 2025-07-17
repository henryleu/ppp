import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { createTable } from '../utils/table.js';

export async function initCommand() {
  console.log('🚀 Initializing ppp in current directory...\n');

  const questions = [
    {
      type: 'text' as const,
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-project'
    },
    {
      type: 'text' as const,
      name: 'description',
      message: 'Project description:',
      initial: 'A new ppp project'
    },
    {
      type: 'confirm' as const,
      name: 'createReadme',
      message: 'Create README.md?',
      initial: true
    }
  ];

  const response = await prompts(questions);

  if (!response.projectName) {
    console.log('❌ Initialization cancelled');
    return;
  }

  try {
    await mkdir('.ppp', { recursive: true });

    const settings = {
      name: response.projectName,
      description: response.description,
      created: new Date().toISOString(),
      version: '1.0.0'
    };

    await writeFile('.ppp/settings.json', JSON.stringify(settings, null, 2));

    const readmeContent = `# ${response.projectName}\n\n${response.description}\n\nThis project is managed by ppp (Product Prompt Planner).\n`;
    await writeFile('.ppp/README.md', readmeContent);

    const trackContent = `# TRACK.md\n\n## Project Tracking\n\n- Created: ${new Date().toLocaleDateString()}\n- Status: Active\n\n## Tasks\n\n- [ ] Initial setup\n`;
    await writeFile('.ppp/TRACK.md', trackContent);

    const specContent = `# SPEC.md\n\n## Project Specification\n\n### Overview\n${response.description}\n\n### Requirements\n\n- TBD\n\n### Technical Specifications\n\n- TBD\n`;
    await writeFile('.ppp/SPEC.md', specContent);

    const implContent = `# IMPL.md\n\n## Implementation Notes\n\n### Architecture\n\n- TBD\n\n### Development Notes\n\n- TBD\n`;
    await writeFile('.ppp/IMPL.md', implContent);

    const table = createTable({
      head: ['File', 'Status'],
      colWidths: [25, 12]
    });

    table.push(
      ['.ppp/settings.json', '✅ Created'],
      ['.ppp/README.md', '✅ Created'],
      ['.ppp/TRACK.md', '✅ Created'],
      ['.ppp/SPEC.md', '✅ Created'],
      ['.ppp/IMPL.md', '✅ Created']
    );

    console.log('\n✅ ppp initialized successfully!\n');
    console.log(table.toString());
    console.log('\n💡 Next steps:');
    console.log('  - Edit .ppp/SPEC.md to define your project requirements');
    console.log('  - Use .ppp/TRACK.md to track your progress');
    console.log('  - Document implementation details in .ppp/IMPL.md');

  } catch (error) {
    console.error('❌ Error initializing ppp:', error);
    process.exit(1);
  }
}
