# TypeScript Troubleshooting Guide for ATLAS

This document provides solutions for common TypeScript errors you might encounter when developing the ATLAS application.

## Common TypeScript Errors and Solutions

### "Cannot find module X or its corresponding type declarations"

This error occurs when TypeScript cannot find type definitions for a module you're importing.

#### Solutions:

1. **For Next.js modules (next/server, next/navigation, etc.)**:
   
   The custom type declarations for Next.js modules are located in `/src/types/next-server.d.ts`. 
   You can extend these definitions if you encounter issues with specific Next.js modules.

2. **For internal modules (@/lib/prisma, etc.)**:
   
   The custom type declarations for internal modules are located in `/src/types/lib-prisma.d.ts`.
   You can create similar declaration files for other internal modules following the same pattern.

3. **For third-party modules**:
   
   Install type definitions using npm:
   ```bash
   npm install --save-dev @types/module-name
   ```

### Restarting the TypeScript Server

If you've made changes to type declarations and TypeScript isn't picking them up:

1. Run the provided script to restart the TypeScript server:
   ```bash
   ./restart-ts.sh
   ```

2. Restart your editor/IDE (VS Code, etc.)

3. In VS Code, you can also try:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "TypeScript: Restart TS Server" and select it

## Adding New Type Declarations

If you need to add type declarations for a new module:

1. Create a new declaration file in `/src/types/` with a `.d.ts` extension
2. Add a reference to your new declaration file in `/src/types/global.d.ts`
3. Restart the TypeScript server using the steps above

## Configuration

The TypeScript configuration for ATLAS is in `tsconfig.json`. Key settings:

- `typeRoots`: Specifies where TypeScript looks for type declarations
- `paths`: Configures path aliases (like `@/` for `src/`)
- `include`: Patterns for files to be processed by TypeScript

## Docker Builds

The Docker build configuration ignores TypeScript errors during the build process:

```javascript
// in next.config.js
typescript: {
  ignoreBuildErrors: true,
}
```

This allows your Docker builds to succeed even if there are TypeScript errors, but it's still good practice to fix these errors in development for better code quality and developer experience. 