# AI Rules for AGBA Media Finder

## Tech Stack Overview
- **React (v18.3)** with **TypeScript** powering the entire UI layer.
- **Vite** as the build tool for fast development and optimized production bundles.
- **React Router DOM** to manage client-side navigation within `src/App.tsx`.
- **Tailwind CSS** (plus `tailwindcss-animate`) for styling via utility classes and custom tokens.
- **shadcn/ui** components for accessible, pre-built UI primitives like buttons, inputs, dialogs, toasts, etc.
- **Radix UI** packages underlying shadcn components for headless primitives.
- **@tanstack/react-query** for async data loading and caching.
- **sonner** and the custom `use-toast` hook for user notifications/toasts.
- **AWS Cognito** (via `aws-amplify`) for authentication (Google Sign-In + email/password).
- **AWS Backend** (FastAPI on Lambda) for all data operations (DynamoDB, S3, Rekognition).
- **lucide-react** for iconography across the interface.

## Library Usage Rules
1. **shadcn/ui & Radix**: Use shadcn's ready-made components wherever possible (buttons, inputs, modals, toasts, etc.) to ensure consistent styling.
2. **Tailwind CSS**: All styling should rely on Tailwind utility classes, leveraging the established theme tokens in `src/index.css` and `tailwind.config.ts`.
3. **React Router DOM**: Keep routing definitions centralized in `src/App.tsx` with `<Routes>`/`<Route>` declarations.
4. **React Query**: Whenever you fetch remote data or perform mutations, wrap components in `useQuery`/`useMutation` from `@tanstack/react-query`.
5. **sonner/use-toast**: Provide user feedback via the shared toast utilities.
6. **AWS Cognito + Backend**: Use `src/integrations/aws/auth.ts` for authentication and `src/integrations/aws/api.ts` for all backend calls. Never call AWS services directly from the frontend.
7. **lucide-react**: Stick to lucide icons for visual cues; import only the needed icons.
8. **Custom hooks/components**: Create new files under `src/hooks/` or `src/components/` for reusable logic/UI.
9. **Responsive Design**: Ensure every layout uses responsive Tailwind classes (`sm:`, `md:`, etc.).
10. **No direct DOM manipulations**: Rely on React's declarative rendering.