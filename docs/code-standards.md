# Cattle Action: Code Standards & Codebase Structure

**Last Updated**: 2026-04-07  
**Version**: 1.0  
**Applies To**: All code in Cattle Action project

---

## Core Development Principles

### YAGNI (You Aren't Gonna Need It)
- Implement features only when needed
- Avoid over-engineering for hypothetical scenarios
- Start simple, refactor when necessary

### KISS (Keep It Simple, Stupid)
- Prefer straightforward solutions
- Avoid unnecessary complexity
- Write code that's easy to understand

### DRY (Don't Repeat Yourself)
- Eliminate code duplication
- Extract common logic into reusable functions
- Maintain single source of truth

---

## File Organization

### Directory Structure
```
Cow-Visioning/
├── server.js                   # Express backend (≤200 LOC per file goal)
├── package.json
├── .env.example
├── schema.sql
├── ecosystem.config.js
├── nginx-cow-visioning.conf
├── public/                     # Frontend
│   ├── index.html
│   ├── auth/
│   ├── css/
│   └── js/
├── ai_service/                 # Python FastAPI
│   ├── main.py
│   ├── requirements.txt
│   └── utils/
├── docs/
│   ├── project-overview-pdr.md
│   ├── code-standards.md
│   ├── codebase-summary.md
│   ├── system-architecture.md
│   ├── project-roadmap.md
│   └── deployment-guide.md
└── .github/workflows/
    └── deploy.yml
```

### File Size Limits
- **JavaScript**: ≤200 LOC per file (except server.js which is monolithic by design)
- **Python**: ≤200 LOC per file (except main.py)
- **HTML**: ≤150 LOC per file (split tabs into separate page files if needed)
- **CSS**: ≤300 LOC per file (organize by component)

---

## Naming Conventions

### JavaScript (client & server)
- **Variables**: camelCase (`imageUrl`, `uploadDir`, `isAuthRequired`)
- **Functions**: camelCase (`uploadImage()`, `validateEmail()`, `fetchImageList()`)
- **Classes**: PascalCase (`UserManager`, `ImageProcessor`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_FILE_SIZE`)
- **File names**: kebab-case (`api-config.js`, `upload-handler.js`)
- **Directories**: kebab-case (`ai_service/`, `public/js/`)

### Python (AI Service)
- **Functions**: snake_case (`detect_cattle()`, `draw_bounding_boxes()`)
- **Classes**: PascalCase (`YOLODetector`, `ImageAnnotator`)
- **Constants**: UPPER_SNAKE_CASE (`MODEL_PATH`, `CONFIDENCE_THRESHOLD`)
- **File names**: snake_case (`main.py`, `yolo_handler.py`)
- **Variables**: snake_case (`image_path`, `conf_score`)

### Database
- **Tables**: plural, snake_case (`users`, `cow_images`, `blog_posts`, `blog_comments`)
- **Columns**: snake_case (`user_id`, `cow_id`, `created_at`, `confidence`)
- **Foreign keys**: `{table_singular}_id` (`user_id`, `post_id`)
- **Booleans**: `is_{action}` or `has_{property}` (`is_admin`, `has_image`)

### HTML/CSS
- **CSS classes**: kebab-case (`.upload-form`, `.gallery-item`, `.auth-header`)
- **IDs**: camelCase or kebab-case (use classes preferred, IDs only for unique elements)
- **Data attributes**: kebab-case (`data-cow-id`, `data-behavior-class`)

---

## Error Handling Patterns

### JavaScript (Express)
```javascript
// Route handler with error handling
app.post('/api/images', authRequired, (req, res) => {
    try {
        // Validate input
        if (!req.body.cow_id) {
            return res.status(400).json({ error: 'Missing cow_id' });
        }
        
        // Process
        const result = processImage(req.file);
        
        // Return success
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Server error during upload' });
    }
});

// Middleware errors
function authRequired(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}
```

### Python (FastAPI)
```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/predict")
async def predict(image_path: str):
    try:
        # Validate input
        if not image_path:
            raise HTTPException(status_code=400, detail="Missing image_path")
        
        # Process
        results = detect_cattle(image_path)
        
        # Return success
        return {"success": True, "data": results}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Server error")
```

---

## Security Standards

### Authentication & Sessions
- Use bcryptjs for password hashing (≥10 rounds)
- Store sessions in PostgreSQL (connect-pg-simple)
- Set secure session cookies: `httpOnly: true`, `sameSite: 'lax'`
- Session timeout: 7 days (configurable via `SESSION_SECRET`)
- Never log passwords or tokens

### Environment Variables
- Never commit `.env` file to version control
- Use `.env.example` with placeholder values
- Validate required env vars at startup
- Never hardcode database credentials or API keys
- Use strong passwords (≥16 chars for DB)

### Database Access
- Use parameterized queries (prevent SQL injection)
- No direct SQL concatenation
- Validate input on server side (never trust client)
- Implement rate limiting on sensitive endpoints (future Phase 2)

### CORS & Headers
- Configure CORS explicitly (whitelist origins)
- Add security headers via Helmet (future enhancement)
- Validate file uploads: check MIME type AND file extension
- Limit upload size: 10MB max per image

---

## API Conventions

### HTTP Verbs
- **GET**: Retrieve data (safe, cacheable)
- **POST**: Create new resource
- **PUT**: Update existing resource
- **DELETE**: Remove resource (should require admin)

### Status Codes
- **200 OK**: Success
- **201 Created**: Resource created (use sparingly, 200 OK acceptable)
- **400 Bad Request**: Invalid input
- **401 Unauthorized**: Not authenticated
- **403 Forbidden**: Authenticated but no permission
- **404 Not Found**: Resource doesn't exist
- **500 Internal Server Error**: Server fault

### Response Format
```json
{
  "success": true,
  "data": { /* response payload */ }
}
```

Error response:
```json
{
  "error": "Human-readable error message"
}
```

### Pagination (Future)
- `?page=1&limit=20`
- Response includes: `total`, `page`, `limit`, `pages`

---

## Code Quality Standards

### Comments
- Comment WHY, not WHAT (code shows what, comments explain intent)
- Use JSDoc for functions: `/** @param {string} cowId */`
- Mark TODO items: `// TODO: Phase 2 - implement real-time alerts`
- Mark HACK/FIXME: `// FIXME: AI timeout needs increase for large images`

### Testing
- Unit tests for utility functions
- Integration tests for API endpoints
- E2E tests for critical user flows (future)
- Target: ≥90% coverage for critical paths (auth, upload, export)
- Test files: `*.test.js` or `*.spec.js`

### Logging
- Use `console.error()` for failures (visible in pm2 logs)
- Use `console.log()` for important events (startup, shutdown)
- Include context: `console.error('Upload failed:', err.message)`
- No sensitive data in logs (no passwords, tokens)

### Git Commit Messages
Use conventional commits format:
```
feat: Add webcam burst mode to image capture
fix: Resolve database timeout on large exports
docs: Update deployment guide for SSL setup
refactor: Simplify image annotation logic
test: Add coverage for export endpoints
chore: Update npm dependencies
```

---

## Performance Standards

### Response Times
- API endpoints: <500ms (including DB queries)
- Image upload to result: <20s (including AI inference)
- Gallery load 100 images: <2s
- Export 1000 rows: <5s

### Database
- Index on frequently queried columns: `cow_id`, `behavior`, `created_at`
- Use LIMIT/OFFSET for pagination (future)
- Archive old images after 1 year (future policy)
- Connection pool: min 2, max 10 (configurable)

### Frontend
- Lazy load gallery images
- Use relative URLs for images (serve from same host)
- Minify CSS/JS in production (future build step)
- Cache static assets via Nginx (future)

---

## Frontend Standards

### HTML
- Use semantic HTML5 tags (`<section>`, `<article>`, `<nav>`)
- Always include `alt` text for images
- ARIA labels for accessibility (future)
- No inline styles (use CSS classes)

### JavaScript
- Use ES6+ (arrow functions, const/let, destructuring)
- Vanilla JS (no jQuery), modern DOM APIs
- Event delegation for dynamic content
- Fetch API with try/catch (no XMLHttpRequest)

### CSS
- Mobile-first responsive design
- CSS variables for theming (`--color-primary`, `--spacing-unit`)
- BEM naming for components: `.block__element--modifier`
- Forest Green design theme (2026 redesign)

---

## Testing Standards

### Unit Tests
- Test edge cases (empty input, null, undefined)
- Test error scenarios
- Use descriptive test names: `should reject image upload if cow_id missing`

### Integration Tests
- Test full API flow (request → response)
- Mock database when needed
- Verify database state after operations

### Test Coverage
- Critical paths: ≥95% coverage
- General code: ≥80% coverage
- Untested: error scenarios (future)

---

## Documentation Standards

### Code Comments
- Explain complex logic, not obvious code
- Use JSDoc format for functions and parameters
- Keep comments up-to-date with code changes

### API Documentation
- Document all endpoints in code comments or API spec
- Include request/response examples
- Document authentication requirements
- List error status codes

### README Files
- Clear setup instructions
- Prerequisites and dependencies
- Quick start guide
- Links to detailed documentation

---

## Deployment Standards

### Environment Variables
- All config via `.env` (never in code)
- Validate all required vars at startup
- Document all vars in `.env.example`
- Never log sensitive vars

### Database Migrations
- Use SQL migration files in `schema.sql`
- Use `CREATE TABLE IF NOT EXISTS` for safety
- Document schema changes in commit messages

### Process Management
- Use PM2 for Node.js processes
- Auto-restart on crash
- Keep logs in `/home/cowapp/logs/` on VPS
- Monitor with `pm2 logs` and `pm2 monit`

---

## Code Review Checklist

Before committing, verify:
- [ ] Code follows naming conventions
- [ ] No hardcoded credentials or secrets
- [ ] Error handling present (try/catch)
- [ ] No console.log in production code
- [ ] Comments explain WHY, not WHAT
- [ ] No duplicate code (follows DRY)
- [ ] File size <200 LOC (if applicable)
- [ ] No breaking changes to existing API
- [ ] Database changes documented
- [ ] Tests pass and coverage adequate

---

**Last Updated**: 2026-04-07  
**Version**: 1.0
