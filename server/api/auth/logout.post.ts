import { defineApiHandler } from '../../utils/handler'
import { authService } from '../../services/auth.service'

export default defineApiHandler(async (event) => {
  await authService.logout(event)
  return { loggedOut: true }
})
