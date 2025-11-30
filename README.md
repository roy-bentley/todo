# ToDo List - Modern Todo Application

A sleek, modern todo application with a beautiful dark-mode interface built with React and FastAPI.

## Features

- **Modern Dark UI**: Stylish dark-mode interface with gradient accents
- **Drag & Drop**: Reorder tasks by dragging them
- **Status Management**: Track tasks as "To Do", "In Progress", or "Done"
- **Filter Views**: Filter tasks by status or view all
- **Real-time Stats**: See task counts at a glance
- **Responsive Design**: Works great on desktop and mobile
- **TypeScript**: Full type safety in the frontend
- **RESTful API**: Clean FastAPI backend with SQLite database

## Tech Stack

### Frontend
- React 18 with TypeScript
- @hello-pangea/dnd for drag-and-drop
- Lucide React for icons
- CSS custom properties for theming

### Backend
- FastAPI (Python)
- SQLite database
- CORS enabled
- Pydantic for validation

## Setup & Installation

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Navigate to the frontend directory:
```bash
cd todo-frontend
```

3. Install dependencies:
```bash
npm install
```

4. Build the React app:
```bash
npm run build
```

5. Host with nginx

## API Endpoints

- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/{task_id}` - Get a specific task
- `PUT /api/tasks/{task_id}` - Update a task
- `DELETE /api/tasks/{task_id}` - Delete a task

## Environment Variables

Create a `.env` file in the `todo-frontend` directory:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

## Project Structure

```
.
├── main.py                 # FastAPI backend
├── todos.db               # SQLite database
├── requirements.txt       # Python dependencies
└── todo-frontend/        # React frontend
    ├── src/
    │   ├── App.tsx       # Main React component
    │   ├── App.css       # Styles
    │   └── index.tsx     # Entry point
    ├── build/            # Production build
    └── package.json      # Node dependencies
```

## Usage

1. **Add a task**: Type in the input field and click "Add Task"
2. **Change status**: Use the dropdown on each task
3. **Reorder tasks**: Drag tasks by the grip handle
4. **Filter tasks**: Click the filter tabs to view specific statuses
5. **Delete tasks**: Click the trash icon

## Customization

### Colors

Edit CSS variables in `todo-frontend/src/App.css`:

```css
:root {
  --bg-primary: #0f0f1e;
  --accent-primary: #6366f1;
  --accent-secondary: #818cf8;
  /* ... more variables */
}
```

## License

MIT
