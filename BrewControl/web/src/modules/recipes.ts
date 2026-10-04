// Entry of the "recipes" package: everything reachable from here ends up in its
// own chunk (vite.config.ts) and is loaded with import() only when the package
// is installed on the device (optionalModules.ts).
export { RecipesPage } from '../pages/RecipesPage';
export { RecipeEditPage } from '../pages/RecipeEditPage';
