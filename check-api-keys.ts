import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function checkApiKeys() {
  try {
    const projects = await prisma.project.findMany({
      where: {
        id: {
          in: ['cmm0e52cx0000k104np3ksyh2', 'cmly34uzi0000ie04gpo38x7i']
        }
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        apiEnabled: true
      }
    });

    console.log('Projects found:');
    projects.forEach(project => {
      console.log(`\nProject ID: ${project.id}`);
      console.log(`Name: ${project.name}`);
      console.log(`API Enabled: ${project.apiEnabled}`);
      console.log(`API Key: ${project.apiKey || 'NOT SET'}`);
    });

    // Check if the provided API key matches any project
    const providedApiKey = 'bta_34ff0dbb336aae273c3a6e97cc1f4e81515fbf56fe38391186c189c9d8a509db';

    console.log('\n=== API Key Check ===');
    console.log(`Provided API Key: ${providedApiKey}`);

    projects.forEach(project => {
      if (project.apiKey === providedApiKey) {
        console.log(`✅ Matches project: ${project.name} (${project.id})`);
      } else {
        console.log(`❌ Does NOT match project: ${project.name} (${project.id})`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkApiKeys();