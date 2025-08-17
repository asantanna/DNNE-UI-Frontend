# DNNE-UI-Frontend

Vue.js frontend for DNNE (Drag and Drop Neural Network Environment).

## Project Context

This is the frontend interface for DNNE, a visual programming environment for building neural networks and robotics control systems. The frontend provides the visual graph editor where users drag and drop nodes to create ML/robotics workflows.

**For complete project documentation, development commands, and system architecture, see the main CLAUDE.md in the DNNE-UI backend repository.**

## Development Timeline

- **June 25, 2025**: Started DNNE modifications to the ComfyUI frontend
  - First DNNE feature: Queue export button
- **July 25, 2025**: Added DNNE combo widget system
  - Custom widget for handling dynamic node configurations
- **August 2025**: Major UI enhancements
  - Agent UI integration
  - Log viewer implementation
  - Type system updates with wildcard matching

## Frontend-Specific Information

### Technology Stack
- Vue.js 3 with Composition API
- TypeScript for type safety
- Tailwind CSS for styling
- PrimeVue components
- Vite for development and building

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run typecheck    # TypeScript checking
npm run lint         # Linting
npm run format       # Code formatting
```

### Architecture
- **Visual Node Editor**: Drag-and-drop interface for creating ML/robotics workflows
- **Backend Communication**: Connects to DNNE-UI backend server for workflow export
- **Component Structure**: Vue 3 components with composition API pattern

### Key Guidelines
- Use Vue 3 Composition API (not Options API)
- Implement TypeScript for all components
- Use Tailwind CSS instead of custom CSS
- Follow PrimeVue component patterns
- Use vue-i18n for internationalization
- Maintain clean public APIs for extensibility

This frontend connects to the DNNE-UI backend to provide a complete visual programming environment for neural networks and robotics applications.