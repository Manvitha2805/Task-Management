import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Check if admin user already exists
  const adminExists = await prisma.user.findFirst({
    where: { email: 'admin@taskmanager.com' }
  });

  if (adminExists) {
    console.log('Database already seeded. Skipping seeder.');
    return;
  }

  // 1. Create global settings
  await prisma.settings.create({
    data: {
      id: 'global',
      workStartTime: '09:00',
      workEndTime: '18:00',
      lateGracePeriod: 15,
      halfDayThreshold: 4,
      holidayCalendar: JSON.stringify([
        { date: '2026-01-01', name: 'New Year\'s Day' },
        { date: '2026-07-04', name: 'Independence Day' },
        { date: '2026-12-25', name: 'Christmas Day' },
      ]),
      leaveRules: JSON.stringify({
        maxCasualLeave: 12,
        maxSickLeave: 10,
        maxPaidLeave: 15,
      }),
      departmentList: JSON.stringify(['Engineering', 'Human Resources', 'Management', 'Sales']),
    },
  });

  // 2. Create Departments
  const deptEngineering = await prisma.department.create({
    data: { name: 'Engineering' },
  });

  const deptHR = await prisma.department.create({
    data: { name: 'Human Resources' },
  });

  const deptManagement = await prisma.department.create({
    data: { name: 'Management' },
  });

  // Common password hash
  const passwordHash = await bcrypt.hash('password123', 10);

  // 3. Create Users
  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@taskmanager.com',
      passwordHash,
      name: 'Jane Doe (Admin)',
      role: 'ADMIN',
      departmentId: deptManagement.id,
    },
  });

  // HR
  const hr = await prisma.user.create({
    data: {
      email: 'hr@taskmanager.com',
      passwordHash,
      name: 'Sarah Smith (HR)',
      role: 'HR',
      departmentId: deptHR.id,
    },
  });

  // Manager
  const manager = await prisma.user.create({
    data: {
      email: 'manager@taskmanager.com',
      passwordHash,
      name: 'Robert Vance (Manager)',
      role: 'MANAGER',
      departmentId: deptEngineering.id,
    },
  });

  // Employee reporting to Manager
  const employee = await prisma.user.create({
    data: {
      email: 'employee@taskmanager.com',
      passwordHash,
      name: 'Alice Johnson (Employee)',
      role: 'EMPLOYEE',
      departmentId: deptEngineering.id,
      managerId: manager.id,
    },
  });

  // Intern reporting to Manager, mentored by Employee
  const intern = await prisma.user.create({
    data: {
      email: 'intern@taskmanager.com',
      passwordHash,
      name: 'Timmy Williams (Intern)',
      role: 'INTERN',
      departmentId: deptEngineering.id,
      managerId: manager.id,
      mentorId: employee.id,
    },
  });

  // Create Intern Profile
  await prisma.internProfile.create({
    data: {
      userId: intern.id,
      managerId: manager.id,
      mentorId: employee.id,
      joiningDate: '2026-06-01',
      duration: 3,
      onboardingStatus: 'IN_PROGRESS',
      onboardingChecklist: JSON.stringify([
        { task: 'account creation', completed: true, date: '2026-06-01' },
        { task: 'orientation completed', completed: true, date: '2026-06-02' },
        { task: 'initial task assigned', completed: false, date: null },
        { task: 'mentor assigned', completed: true, date: '2026-06-01' },
        { task: 'documentation completed', completed: false, date: null },
      ]),
      offboardingStatus: 'PENDING',
      offboardingChecklist: JSON.stringify([
        { task: 'exit initiation', completed: false },
        { task: 'project handover', completed: false },
        { task: 'mentor review', completed: false },
        { task: 'final evaluation', completed: false },
        { task: 'certificate approval', completed: false },
        { task: 'account deactivation', completed: false },
      ]),
    },
  });

  // 4. Create some tasks
  await prisma.task.create({
    data: {
      title: 'Setup Local Development Environment',
      description: 'Clone the repository, configure the environment variables, and run migrations.',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      assignedId: intern.id,
      creatorId: manager.id,
      activities: {
        create: [
          {
            userId: manager.id,
            activityType: 'CREATE',
            description: 'Task created and assigned to Timmy Williams (Intern)',
          },
          {
            userId: intern.id,
            activityType: 'STATUS_CHANGE',
            description: 'Status changed from TODO to IN_PROGRESS',
          },
          {
            userId: intern.id,
            activityType: 'STATUS_CHANGE',
            description: 'Status changed from IN_PROGRESS to COMPLETED',
          },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Design API Endpoints',
      description: 'Implement Express REST API routes for authentication, attendance, and task views.',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      assignedId: employee.id,
      creatorId: manager.id,
      activities: {
        create: [
          {
            userId: manager.id,
            activityType: 'CREATE',
            description: 'Task created and assigned to Alice Johnson (Employee)',
          },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Refactor UI Navigation Sidebar',
      description: 'Make the sidebar support multi-tier authorization routes for HR and Managers.',
      priority: 'MEDIUM',
      status: 'TODO',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      assignedId: intern.id,
      creatorId: employee.id,
      activities: {
        create: [
          {
            userId: employee.id,
            activityType: 'CREATE',
            description: 'Task created and assigned to Timmy Williams (Intern)',
          },
        ],
      },
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
