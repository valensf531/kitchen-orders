/* Validaciones compartidas por las rutas de items del menú. */
export function validateItemFields(body: { description?: unknown; ingredients?: unknown; tags?: unknown; featured?: unknown }) {
  if (body.description !== undefined && typeof body.description !== 'string') {
    return 'Invalid description';
  }
  if (body.ingredients !== undefined && typeof body.ingredients !== 'string') {
    return 'Invalid ingredients';
  }
  if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some((tag) => typeof tag !== 'string'))) {
    return 'Invalid tags';
  }
  if (body.featured !== undefined && typeof body.featured !== 'boolean') {
    return 'Invalid featured';
  }
  return null;
}
