/**
 * Project Management with Prisma
 *
 * Handles CRUD operations for projects in PostgreSQL
 */

import { prisma } from './prisma';
import type { Project, Bot, ForwardingConfig, WebhookRegistration } from '@/generated/prisma';

export type ProjectWithRelations = Project & {
  bot: Bot | null;
  forwardingConfig: ForwardingConfig | null;
  webhookRegistrations: WebhookRegistration[];
};

/**
 * Create a new project
 */
export async function createProject(name: string): Promise<Project> {
  const project = await prisma.project.create({
    data: {
      name,
    },
  });

  console.log('✅ Project created:', project.name);
  return project;
}

/**
 * Get all projects with their relations
 */
export async function getAllProjects(): Promise<ProjectWithRelations[]> {
  const projects = await prisma.project.findMany({
    include: {
      bot: true,
      forwardingConfig: true,
      webhookRegistrations: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return projects;
}

/**
 * Get project by ID with relations
 */
export async function getProjectById(id: string): Promise<ProjectWithRelations | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      bot: true,
      forwardingConfig: true,
      webhookRegistrations: true,
    },
  });

  return project;
}

/**
 * Get project by name with relations
 */
export async function getProjectByName(name: string): Promise<ProjectWithRelations | null> {
  const project = await prisma.project.findUnique({
    where: { name },
    include: {
      bot: true,
      forwardingConfig: true,
      webhookRegistrations: true,
    },
  });

  return project;
}

/**
 * Update project name
 */
export async function updateProjectName(id: string, name: string): Promise<Project> {
  const project = await prisma.project.update({
    where: { id },
    data: { name },
  });

  console.log('✅ Project updated:', project.name);
  return project;
}

/**
 * Delete project (cascades to bot, forwarding config, and webhook registrations)
 */
export async function deleteProject(id: string): Promise<void> {
  await prisma.project.delete({
    where: { id },
  });

  console.log('✅ Project deleted:', id);
}

/**
 * Get or create default project (for migration from single-bot setup)
 */
export async function getOrCreateDefaultProject(): Promise<Project> {
  const defaultName = 'goodboy'; // Default project name for migration

  let project = await prisma.project.findUnique({
    where: { name: defaultName },
  });

  if (!project) {
    project = await createProject(defaultName);
  }

  return project;
}
