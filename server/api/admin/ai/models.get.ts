import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { fetchModelCatalog } from '../../../utils/openrouterModels'

/** Curated, live list of OpenRouter models selectable in Settings → AI models (see openrouterModels.ts for the filtering rules). */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return fetchModelCatalog()
})
