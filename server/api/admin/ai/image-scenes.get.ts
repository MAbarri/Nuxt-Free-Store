import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { IMAGE_SCENES } from '../../../services/ai.service'

/** The selectable library of AI product-photo "scenes" (studio angles, lifestyle settings), for the scene picker in the admin UI. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return IMAGE_SCENES.map(s => ({ id: s.id, label: s.label, hasModel: s.hasModel }))
})
