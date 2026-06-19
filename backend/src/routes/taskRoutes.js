import express from 'express';
import { prisma } from '../utils/db.js';
import { authenticateUser, recordAuditLog } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper: Check if manager can manage a user
const isUserManager = async (managerId, employeeId) => {
  const emp = await prisma.user.findUnique({ where: { id: employeeId } });
  return emp && emp.managerId === managerId;
};

// GET /api/tasks - Get all tasks accessible by current user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { role, id } = req.user;
    let queryFilter = {};

    if (role === 'ADMIN' || role === 'HR') {
      // Admins and HR have full tasks access
      queryFilter = {};
    } else if (role === 'MANAGER') {
      // Managers see tasks they created, or tasks assigned to members of their team
      queryFilter = {
        OR: [
          { creatorId: id },
          { assignedTo: { managerId: id } },
        ],
      };
    } else {
      // Employees and Interns only see their assigned tasks or tasks they created
      queryFilter = {
        OR: [
          { assignedId: id },
          { creatorId: id },
        ],
      };
    }

    const tasks = await prisma.task.findMany({
      where: queryFilter,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks.' });
  }
});

// GET /api/tasks/:id - Get specific task detail with activities & comments
router.get('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Role-based auth validation
    const { role, id: userId } = req.user;
    if (role !== 'ADMIN' && role !== 'HR') {
      if (role === 'MANAGER') {
        const isTeamTask = task.assignedTo && task.assignedTo.managerId === userId;
        if (task.creatorId !== userId && !isTeamTask) {
          return res.status(403).json({ error: 'Access denied to this task.' });
        }
      } else {
        if (task.assignedId !== userId && task.creatorId !== userId) {
          return res.status(403).json({ error: 'Access denied to this task.' });
        }
      }
    }

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve task.' });
  }
});

// POST /api/tasks - Create new task
router.post('/', authenticateUser, async (req, res) => {
  const { title, description, priority, dueDate, assignedId } = req.body;

  if (!title || !priority || !dueDate) {
    return res.status(400).json({ error: 'Title, priority, and due date are required.' });
  }

  try {
    // Managers can only assign tasks to their team members or themselves
    if (req.user.role === 'MANAGER' && assignedId && assignedId !== req.user.id) {
      const allowed = await isUserManager(req.user.id, assignedId);
      if (!allowed) {
        return res.status(403).json({ error: 'You can only assign tasks to members of your team.' });
      }
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description: description || '',
        priority,
        status: 'TODO',
        dueDate: new Date(dueDate),
        assignedId: assignedId || null,
        creatorId: req.user.id,
        activities: {
          create: {
            userId: req.user.id,
            activityType: 'CREATE',
            description: `Task created by ${req.user.name}`,
          },
        },
      },
    });

    // Create in-app notification for the assignee
    if (assignedId && assignedId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: assignedId,
          title: 'New Task Assigned',
          message: `Task "${title}" has been assigned to you by ${req.user.name}.`,
        },
      });
    }

    await recordAuditLog(req.user.id, 'TASK_CREATE', `Created task: ${title}`, req);
    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error('Task creation failed:', error);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// PUT /api/tasks/:id - Update task details or status
router.put('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status, dueDate, assignedId } = req.body;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignedTo: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const { role, id: userId, name: userName } = req.user;
    let allowedToUpdate = false;

    if (role === 'ADMIN' || role === 'HR' || task.creatorId === userId) {
      allowedToUpdate = true;
    } else if (role === 'MANAGER') {
      const isTeamTask = task.assignedTo && task.assignedTo.managerId === userId;
      if (isTeamTask) allowedToUpdate = true;
    } else if (task.assignedId === userId) {
      // Employees/Interns can update status of tasks assigned to them
      allowedToUpdate = true;
    }

    if (!allowedToUpdate) {
      return res.status(403).json({ error: 'You do not have permission to edit this task.' });
    }

    // Build update object
    const updateData = {};
    const activitiesToCreate = [];

    // Employees and interns should only be allowed to update STATUS, unless they created it
    const isFullEditor = role === 'ADMIN' || role === 'HR' || task.creatorId === userId || (role === 'MANAGER' && task.assignedTo?.managerId === userId);

    if (isFullEditor) {
      if (title !== undefined && title !== task.title) {
        updateData.title = title;
        activitiesToCreate.push({ userId, activityType: 'UPDATE', description: `Title updated to "${title}"` });
      }
      if (description !== undefined && description !== task.description) {
        updateData.description = description;
      }
      if (priority !== undefined && priority !== task.priority) {
        updateData.priority = priority;
        activitiesToCreate.push({ userId, activityType: 'UPDATE', description: `Priority changed to ${priority}` });
      }
      if (dueDate !== undefined) {
        const newDate = new Date(dueDate);
        if (newDate.getTime() !== new Date(task.dueDate).getTime()) {
          updateData.dueDate = newDate;
          activitiesToCreate.push({ userId, activityType: 'UPDATE', description: `Due date changed to ${newDate.toLocaleDateString()}` });
        }
      }
      if (assignedId !== undefined && assignedId !== task.assignedId) {
        updateData.assignedId = assignedId || null;
        const assignName = assignedId ? (await prisma.user.findUnique({ where: { id: assignedId } }))?.name : 'Unassigned';
        activitiesToCreate.push({ userId, activityType: 'ASSIGN', description: `Task assigned to ${assignName}` });

        if (assignedId) {
          await prisma.notification.create({
            data: {
              userId: assignedId,
              title: 'Task Assigned',
              message: `Task "${task.title}" has been assigned to you by ${userName}.`,
            },
          });
        }
      }
    }

    // Both full editors and the assignee can change the status
    if (status !== undefined && status !== task.status) {
      updateData.status = status;
      activitiesToCreate.push({ userId, activityType: 'STATUS_CHANGE', description: `Status changed to ${status}` });

      // Notify task creator when status updates
      if (task.creatorId !== userId) {
        await prisma.notification.create({
          data: {
            userId: task.creatorId,
            title: 'Task Status Updated',
            message: `Task "${task.title}" has been set to ${status} by ${userName}.`,
          },
        });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...updateData,
        activities: {
          create: activitiesToCreate,
        },
      },
    });

    await recordAuditLog(userId, 'TASK_UPDATE', `Updated task: ${task.title}. Changes: ${activitiesToCreate.map(a => a.description).join(', ')}`, req);
    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Task update failed:', error);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignedTo: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const { role, id: userId } = req.user;
    let allowedToDelete = false;

    if (role === 'ADMIN' || task.creatorId === userId) {
      allowedToDelete = true;
    } else if (role === 'MANAGER' && task.assignedTo?.managerId === userId) {
      allowedToDelete = true;
    }

    if (!allowedToDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this task.' });
    }

    await prisma.task.delete({ where: { id } });
    await recordAuditLog(userId, 'TASK_DELETE', `Deleted task: ${task.title}`, req);

    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// POST /api/tasks/:id/comments - Add comment to a task
router.post('/:id/comments', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment) {
    return res.status(400).json({ error: 'Comment content cannot be empty.' });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const newComment = await prisma.taskComment.create({
      data: {
        taskId: id,
        userId: req.user.id,
        comment,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Record comment activity log
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: req.user.id,
        activityType: 'COMMENT',
        description: `${req.user.name} added a comment: "${comment.substring(0, 30)}${comment.length > 30 ? '...' : ''}"`,
      },
    });

    // Notify assignee if someone else commented
    if (task.assignedId && task.assignedId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: task.assignedId,
          title: 'New Task Comment',
          message: `${req.user.name} commented on your assigned task "${task.title}".`,
        },
      });
    }

    res.status(201).json({ comment: newComment });
  } catch (error) {
    console.error('Comment adding failed:', error);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

export default router;
