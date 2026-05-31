import React, { useState, useEffect } from 'react';

const TaskManager = ({ onTaskSelect }) => {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const result = await window.electronAPI.getTasks();
      if (result.success) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleCreateTask = async () => {
    const title = prompt('Enter task title:');
    if (!title) return;

    try {
      const result = await window.electronAPI.createTask(title, '', 'manual');
      if (result.success) {
        loadTasks();
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter !== 'all' && task.status !== filter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="task-manager">
      <div className="task-manager-header">
        <h3>Tasks</h3>
        <button onClick={handleCreateTask} className="btn-primary">+ New Task</button>
      </div>
      <div className="task-filters">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="task-search"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="task-list">
        {filteredTasks.map(task => (
          <div key={task.id} className="task-item">
            <div className="task-content" onClick={() => onTaskSelect && onTaskSelect(task)}>
              <h4>{task.title}</h4>
              <p>{task.description || 'No description'}</p>
              <div className="task-meta">
                <span className={`task-status ${task.status}`}>{task.status}</span>
                <span className="task-type">{task.task_type}</span>
              </div>
            </div>
          </div>
        ))}
        {filteredTasks.length === 0 && (
          <div className="empty-state">
            <p>No tasks found</p>
            <button onClick={handleCreateTask}>Create your first task</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManager;

