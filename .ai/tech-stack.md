# Technology Stack

## Core Framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server

## Styling
- **Tailwind CSS** - Utility-first CSS
- **Shadcn UI** - Component library (Radix-based)

## 3D Visualization
- **Three.js** - 3D graphics library
- **React Three Fiber (R3F)** - React renderer for Three.js
- **@react-three/drei** - Useful R3F helpers

## AI Integration
- **OpenAI API** - GPT for brief parsing, grouping, explanations
- API key stored in `.env.local`

## Data Export
- **xlsx** (SheetJS) - Excel file generation
- **three/examples/jsm/exporters/GLTFExporter** - GLB model export

## State Management
- React Context + useReducer (or Zustand if complexity grows)

## File Structure (Planned)
```
src/
├── components/          # UI components
│   ├── ui/             # Shadcn components
│   ├── steps/          # Step-specific components
│   ├── preview/        # 3D preview components
│   └── common/         # Shared components
├── features/           # Feature modules
│   ├── input/          # Brief input handling
│   ├── normalize/      # Program normalization
│   ├── grouping/       # Functional grouping
│   ├── rules/          # Rule assignment
│   ├── constraints/    # Parametric constraints
│   ├── variants/       # Variant generation
│   └── export/         # Output generation
├── lib/                # Utilities
│   ├── openai/         # OpenAI integration
│   ├── geometry/       # Geometry algorithms
│   ├── validation/     # Constraint validation
│   └── export/         # Excel/GLB exporters
├── types/              # TypeScript interfaces
├── hooks/              # Custom React hooks
├── store/              # State management
└── App.tsx             # Main app component
```

## Environment Variables
```
VITE_OPENAI_API_KEY=sk-...
```

## Dependencies to Install
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "@radix-ui/react-*": "various",
    "three": "^0.160.x",
    "@react-three/fiber": "^8.x",
    "@react-three/drei": "^9.x",
    "openai": "^4.x",
    "xlsx": "^0.18.x",
    "lucide-react": "^0.x",
    "class-variance-authority": "^0.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "@types/react": "^18.x",
    "@types/three": "^0.160.x",
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x"
  }
}
```
