# Skylon ERP 🏭

Production Management System for Skylon Joinery

## 📋 Features

- **Production Management**: Track projects through production phases
- **Pipeline Management**: Manage sales pipeline and quotes  
- **Team Management**: Assign team members to tasks
- **Gantt Charts**: Visual timeline of all projects
- **Drag & Drop**: Reorganize tasks and phases
- **Real-time Sync**: Powered by Supabase

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge)
- Supabase account (for database)

### Configuration Setup

1. Copy the example configuration:
```bash
cp js/config.example.js js/config.js
```

2. Edit `js/config.js` with your Supabase credentials:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key

3. **Important**: `js/config.js` is in `.gitignore` and should NEVER be committed!

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/Piotr3009/skylon-erp.git
cd skylon-erp
```

2. Start a local server:
```bash
# Python 3
python -m http.server 8000

# Or use VS Code Live Server extension
```

3. Open http://localhost:8000

### Deployment

The app is automatically deployed to GitHub Pages on push to main branch.

Live URL: https://piotr3009.github.io/skylon-erp/

## 📁 Project Structure

```
skylon-erp/
├── css/              # Stylesheets
│   └── styles.css
├── js/               # JavaScript files
│   ├── config.js     # Configuration (gitignored)
│   ├── data.js       # Data management
│   ├── gantt.js      # Gantt chart functionality
│   └── ...
├── icons/            # SVG icons
├── PNG/              # Images
├── index.html        # Main production view
├── pipeline.html     # Sales pipeline view
├── team.html         # Team management
├── clients.html      # Client management
└── login.html        # Login page
```

## 🔐 Security

- Row Level Security (RLS) enabled in Supabase
- API keys stored in separate config file
- Only anon/public keys in frontend code
- Service keys never exposed

## 🛠️ Technologies

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: Supabase (PostgreSQL)
- **Hosting**: GitHub Pages
- **Icons**: Custom SVG icons

## 📊 Database Schema

Main tables:
- `projects` - Production projects
- `project_phases` - Project phases and timeline
- `pipeline_projects` - Sales pipeline
- `team_members` - Employee data
- `clients` - Customer information

## 🐛 Known Issues

- Phases must have unique keys per project
- RLS policies must be configured for all tables
- Sunday is non-working day by default

## 📝 License

Private repository - All rights reserved

## 👥 Authors

- Skylon Group Development Team

## 📞 Support

For internal support, contact IT department.

---

Last updated: September 2024
