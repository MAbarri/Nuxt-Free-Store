import { defineApiHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validate'
import { registerSchema } from '../../schemas/auth.schema'
import { authService } from '../../services/auth.service'

export default defineApiHandler(async (event) => {
  const input = await validateBody(event, registerSchema)
  const user = await authService.register(event, input)
  return { user }
})
