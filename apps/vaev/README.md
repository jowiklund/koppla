# Vaev
Vaev aims to provide "Clarity as a Service (CLAAS)" by offering a visual, interactive workspace. Users can map, analyze, and communicate about any system as a network of relationships, transforming abstract information into clear, tangible graphs. This helps users discover hidden patterns, identify critical connections, and make more informed decisions.

# MVP

I. Core Infrastructure & Setup
[ ] Set up Database/Persistence Layer for Projects and User Data

[ ] Implement Basic User Authentication (Registration, Login, Session Management)

[ ] Implement Core Server-Side Logic for Project CRUD (Create, Read, Update, Delete)

[ ] Integrate datastar for UI reactivity (if not already fully integrated)

[ ] Ensure WebAssembly (WASM) graph engine is correctly integrated and callable from frontend

II. Guest User Features (Anonymous Access)

[ ] Develop the main graph editor interface.

[ ] Implement basic node creation, selection, movement, and deletion.

[ ] Implement basic edge creation, selection, and deletion.

[ ] Pre-define default node types (e.g., "Entity", "Process", "Idea") in the editor.

[ ] Pre-define default edge types (e.g., "Connects To", "Depends On", "Relates To").

[ ] Implement functionality to import graph data (JSON format) into the current editor session.

[ ] Implement functionality to export current graph data (JSON format) from the editor.

[ ] Expose a minimal set of analytical algorithms from the @kpla/engine (e.g., simple connectivity check, node/edge count) in the UI.

[ ] Develop read-only view for public projects.

[ ] Implement client-side logic to block access to private projects for guests.

III. Registered User Features (Authenticated Access)

[ ] Develop UI for registered users to create new projects.

[ ] Develop UI to list, view, and select their existing projects.

[ ] Implement functionality to update project details (e.g., name).

[ ] Implement functionality to delete projects (with confirmation).

[ ] Develop UI for users to define custom node types within a project (name only for MVP).

[ ] Develop UI for users to define custom edge types within a project (name only for MVP).

[ ] Integrate custom types into the graph editor for that specific project.

[ ] Implement functionality to import graph data (JSON format) into a specific, persistent project.

[ ] Add a simple toggle/checkbox in the project settings UI to mark a project as "Public" or "Private."

[ ] Implement server-side logic to store and enforce the public/private flag.

[ ] Implement client-side access control: if private, only owner can view; if public, guests and owner can view. Display "Access Denied" for unauthorized private project access.

IV. Post-MVP / Future Considerations (Backlog Issues)
[ ] Implement advanced data ingestion and mapping for arbitrary data sources.

[ ] Develop granular project permissions for private projects.

[ ] Explore real-time collaboration features.

[ ] Introduce advanced visualization options and graph layouts.

[ ] Develop features for embedding Vaev projects on external websites.
