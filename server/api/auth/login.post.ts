import { defineApiHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validate'
import { loginSchema } from '../../schemas/auth.schema'
import { authService } from '../../services/auth.service'

export default defineApiHandler(async (event) => {
  const input = await validateBody(event, loginSchema)
  const user = await authService.login(event, input)
  return { user }
})
