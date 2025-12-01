import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, GripVertical, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import './App.css';

// Use relative URL for production (works with nginx proxy)
// Falls back to localhost for local development
const API_URL = process.env.REACT_APP_API_URL || (
  window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api'
    : '/api'
);

interface Task {
  id: number;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  created_at: string;
  order_index: number;
}

type FilterType = 'all' | 'todo' | 'in_progress' | 'done';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks`);
      if (!response.ok) {
        console.error('Error fetching tasks:', response.status, response.statusText);
        setTasks([]);
        return;
      }
      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Add new task
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          status: 'todo'
        })
      });
      if (!response.ok) {
        console.error('Error adding task:', response.status, response.statusText);
        return;
      }
      const newTask = await response.json();
      setTasks([...tasks, newTask]);
      setNewTaskTitle('');
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  // Update task status
  const updateTaskStatus = async (taskId: number, newStatus: Task['status']) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        console.error('Error updating task status:', response.status, response.statusText);
        return;
      }
      const updatedTask = await response.json();
      setTasks(tasks.map(task => task.id === taskId ? updatedTask : task));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Delete task
  const deleteTask = async (taskId: number) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        console.error('Error deleting task:', response.status, response.statusText);
        return;
      }
      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Start editing task title
  const startEditingTitle = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  // Update task title
  const updateTaskTitle = async (taskId: number) => {
    if (!editingTitle.trim()) {
      setEditingTaskId(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle })
      });
      if (!response.ok) {
        console.error('Error updating task title:', response.status, response.statusText);
        setEditingTaskId(null);
        return;
      }
      const updatedTask = await response.json();
      setTasks(tasks.map(task => task.id === taskId ? updatedTask : task));
      setEditingTaskId(null);
    } catch (error) {
      console.error('Error updating task title:', error);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingTitle('');
  };

  // Handle key press in edit mode
  const handleEditKeyPress = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === 'Enter') {
      updateTaskTitle(taskId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // Handle drag and drop
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const items = Array.from(filteredTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Since order_index values are always contiguous (normalized after each delete),
    // we can safely use the destination index as the new order_index
    const newOrderIndex = result.destination.index;

    // Optimistically update UI with the reordered filtered tasks
    const reorderedWithNewIndices = items.map((task, index) => ({
      ...task,
      order_index: index
    }));

    // Merge back into the full task list
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    reorderedWithNewIndices.forEach(task => {
      taskMap.set(task.id, task);
    });

    const newTasks = Array.from(taskMap.values()).sort((a, b) => a.order_index - b.order_index);
    setTasks(newTasks);

    // Send to API
    try {
      await fetch(`${API_URL}/tasks/${reorderedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: newOrderIndex })
      });

      // Fetch fresh data from server to ensure consistency
      await fetchTasks();
    } catch (error) {
      console.error('Error reordering task:', error);
      // Revert on error
      fetchTasks();
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  // Stats
  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return <AlertCircle size={16} />;
      case 'in_progress':
        return <Clock size={16} />;
      case 'done':
        return <CheckCircle2 size={16} />;
    }
  };

  const getStatusLabel = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'done':
        return 'Done';
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>ToDo List</h1>
          <p>Stay organized!</p>
        </header>

        {/* Stats */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{stats.todo}</div>
            <div className="stat-label">To Do</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.done}</div>
            <div className="stat-label">Done</div>
          </div>
        </div>

        {/* Add Task Form */}
        <form className="add-task-form" onSubmit={addTask}>
          <div className="add-task-input-group">
            <input
              type="text"
              className="add-task-input"
              placeholder="What needs to be done?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={20} />
              Add Task
            </button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${filter === 'todo' ? 'active' : ''}`}
            onClick={() => setFilter('todo')}
          >
            To Do
          </button>
          <button
            className={`filter-tab ${filter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilter('in_progress')}
          >
            In Progress
          </button>
          <button
            className={`filter-tab ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done
          </button>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No tasks found</h3>
            <p>
              {filter === 'all'
                ? 'Add a task to get started!'
                : `No tasks in "${getStatusLabel(filter as Task['status'])}" status.`}
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tasks">
              {(provided) => (
                <div
                  className="tasks-container"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {filteredTasks.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={task.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          className={`task-item ${snapshot.isDragging ? 'dragging' : ''}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          <div
                            className="drag-handle"
                            {...provided.dragHandleProps}
                          >
                            <GripVertical size={20} />
                          </div>

                          <div className="task-content">
                            {editingTaskId === task.id ? (
                              <input
                                type="text"
                                className="task-title-input"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => updateTaskTitle(task.id)}
                                onKeyDown={(e) => handleEditKeyPress(e, task.id)}
                                autoFocus
                              />
                            ) : (
                              <div
                                className="task-title"
                                onDoubleClick={() => startEditingTitle(task)}
                                title="Double-click to edit"
                              >
                                {task.title}
                              </div>
                            )}
                            <div className="task-meta">
                              <span className={`task-status-badge status-${task.status}`}>
                                {getStatusIcon(task.status)}
                                <span style={{ marginLeft: '0.25rem' }}>
                                  {getStatusLabel(task.status)}
                                </span>
                              </span>
                              <span>
                                {new Date(task.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="task-actions">
                            <select
                              className="status-select"
                              value={task.status}
                              onChange={(e) =>
                                updateTaskStatus(task.id, e.target.value as Task['status'])
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                            </select>

                            <button
                              className="btn btn-danger"
                              onClick={() => deleteTask(task.id)}
                              title="Delete task"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}

export default App;
