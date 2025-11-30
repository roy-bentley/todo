from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
from contextlib import contextmanager

app = FastAPI(title="ToDo API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database file
DATABASE = "todos.db"

# --- Pydantic models for request/response ---

class TaskCreate(BaseModel):
    title: str
    status: str = "todo"
    order_index: Optional[int] = None # Will be calculated if None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None

class Task(BaseModel):
    id: int
    title: str
    status: str
    created_at: str
    order_index: int # Now required on retrieval

# --- Database helper ---
@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Initialize database
def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                order_index INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.commit()

# Initialize DB on startup
@app.on_event("startup")
async def startup():
    init_db()

# --- API Endpoints ---

@app.get("/api")
async def api_root():
    return {"message": "ToDo API is running"}

@app.get("/api/tasks", response_model=list[Task])
async def get_tasks():
    """Get all tasks, ordered by order_index"""
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT id, title, status, created_at, order_index FROM tasks ORDER BY order_index ASC"
        )
        tasks = [dict(row) for row in cursor.fetchall()]
    return tasks

@app.post("/api/tasks", response_model=Task, status_code=201)
async def create_task(task: TaskCreate):
    """Create a new task"""
    # Validate status
    valid_statuses = ["todo", "in_progress", "done"]
    if task.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    with get_db() as conn:
        cursor = conn.execute("SELECT MAX(order_index) FROM tasks")
        max_index = cursor.fetchone()[0] or 0
        new_order_index = max_index + 1

        cursor = conn.execute(
            "INSERT INTO tasks (title, status, order_index) VALUES (?, ?, ?)",
            (task.title, task.status, task.order_index if task.order_index is not None else new_order_index)
        )
        conn.commit()
        task_id = cursor.lastrowid
        
        # Fetch the created task including order_index
        cursor = conn.execute(
            "SELECT id, title, status, created_at, order_index FROM tasks WHERE id = ?",
            (task_id,)
        )
        new_task = dict(cursor.fetchone())
    
    return new_task

@app.get("/api/tasks/{task_id}", response_model=Task)
async def get_task(task_id: int):
    """Get a specific task"""
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT id, title, status, created_at, order_index FROM tasks WHERE id = ?",
            (task_id,)
        )
        task = cursor.fetchone()
    
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return dict(task)

@app.put("/api/tasks/{task_id}", response_model=Task)
async def update_task(task_id: int, task_update: TaskUpdate):
    """Update a task, including reordering logic if order_index is provided."""
    
    with get_db() as conn:
        cursor = conn.execute("SELECT order_index FROM tasks WHERE id = ?", (task_id,))
        current_task = cursor.fetchone()
        if current_task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        current_order_index = current_task['order_index']
        
        # --- Start Reordering Logic ---
        if task_update.order_index is not None and task_update.order_index != current_order_index:
            new_order_index = task_update.order_index
            
            # Use a large temporary index to 'hide' the task being moved
            TEMP_INDEX = -1 
            conn.execute("UPDATE tasks SET order_index = ? WHERE id = ?", (TEMP_INDEX, task_id))
            
            if new_order_index > current_order_index:
                # Moving Down: Shift items between old_pos and new_pos UP by 1
                conn.execute(
                    "UPDATE tasks SET order_index = order_index - 1 WHERE order_index > ? AND order_index <= ?", 
                    (current_order_index, new_order_index)
                )
            else: 
                # Moving Up: Shift items between new_pos and old_pos DOWN by 1
                conn.execute(
                    "UPDATE tasks SET order_index = order_index + 1 WHERE order_index >= ? AND order_index < ?", 
                    (new_order_index, current_order_index)
                )

            # Finally, move the task to its new position
            conn.execute("UPDATE tasks SET order_index = ? WHERE id = ?", (new_order_index, task_id))
            
            # Clear the order_index from the update object so it isn't processed again below
            task_update.order_index = None
        # --- End Reordering Logic ---


        # --- Start Standard Field Update Logic (Title/Status) ---
        updates = []
        params = []
        
        if task_update.status:
            valid_statuses = ["todo", "in_progress", "done"]
            if task_update.status not in valid_statuses:
                raise HTTPException(status_code=400, detail="Invalid status")
            updates.append("status = ?")
            params.append(task_update.status)

        if task_update.title is not None:
            updates.append("title = ?")
            params.append(task_update.title)
        
        # Only execute the UPDATE query if there are title/status fields left to update
        if updates: 
            params.append(task_id)
            query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
            conn.execute(query, params)

        conn.commit()
        
        # Fetch updated task
        cursor = conn.execute(
            "SELECT id, title, status, created_at, order_index FROM tasks WHERE id = ?",
            (task_id,)
        )
        updated_task = dict(cursor.fetchone())
    
    return updated_task

@app.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int):
    """Delete a task and recompact order indices"""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")

        # Recompact order indices to be contiguous (0, 1, 2, 3...)
        cursor = conn.execute("SELECT id FROM tasks ORDER BY order_index ASC")
        task_ids = [row[0] for row in cursor.fetchall()]

        for new_index, task_id in enumerate(task_ids):
            conn.execute("UPDATE tasks SET order_index = ? WHERE id = ?", (new_index, task_id))

        conn.commit()

    return None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)